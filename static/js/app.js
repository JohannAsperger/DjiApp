// c:\Users\johan\Desktop\DjiApp\static\js\app.js
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NTk0M2RjOC0xYzc5LTQyZTgtOTMzYy1iOGMzOGMyMjFkNGIiLCJpZCI6MzEyMjA4LCJpYXQiOjE3NDk5MjM2OTZ9.hNylnne1DsKBD6JknfqBaB0NwC2YeRd2B0LqiCryCxM';

// --- ESTADO GLOBAL ---
let viewer = null;
let flightEntity = null;
let tickListener = null;
const gauges = {};

// --- FUNCIONES DE LA INTERFAZ ---

function actualizarDetallesVuelo(resumenData) {
  const infoDronDiv = document.getElementById("info-dron");
  if (!infoDronDiv) return;

  const infoMap = [
    { label: "Duración (min)", value: resumenData.duracion_segundos ? (resumenData.duracion_segundos / 60).toFixed(1) : "—" },
    { label: "Batería Inicio", value: (resumenData.bateria_inicio_porcentaje ?? "—") + "%" },
    { label: "Batería Fin", value: (resumenData.bateria_fin_porcentaje ?? "—") + "%" },
    { label: "Altitud Máxima (m)", value: resumenData.altitud_maxima_metros?.toFixed(1) ?? "—" },
    { label: "Distancia Máx. (km)", value: resumenData.distancia_maxima_km?.toFixed(3) ?? "—" },
    { label: "Distancia Total (km)", value: resumenData.distancia_recorrida_km?.toFixed(3) ?? "—" },
    { label: "Temp. Máx. (°C)", value: resumenData.temperatura_maxima_bateria_c?.toFixed(1) ?? "—" },
    { label: "Velocidad Máx. (km/h)", value: resumenData.velocidad_maxima_kmh?.toFixed(1) ?? "—" }
  ];

  infoDronDiv.innerHTML = infoMap.map(item => `
    <div class="bg-background-light dark:bg-background-dark p-3 rounded-lg text-center">
      <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">${item.label}</p>
      <strong class="text-xl font-bold text-text-light dark:text-text-dark">${item.value}</strong>
    </div>
  `).join('');
}

function inicializarGauges() {
  const gaugeDefaults = {
    value: 0,
    pointer: true,
    relativeGaugeSize: true,
    labelFontColor: "#9ca3af"
  };

  if (!gauges.velocidad) gauges.velocidad = new JustGage({ ...gaugeDefaults, id: "gauge-velocidad", min: 0, max: 100, label: "km/h" });
  else gauges.velocidad.refresh(0);

  if (!gauges.altitud) gauges.altitud = new JustGage({ ...gaugeDefaults, id: "gauge-altitud", min: 0, max: 500, label: "m" });
  else gauges.altitud.refresh(0);

  if (!gauges.bateria) gauges.bateria = new JustGage({ ...gaugeDefaults, id: "gauge-bateria", min: 0, max: 100, label: "%" });
  else gauges.bateria.refresh(0);

  if (!gauges.velocidadVertical) gauges.velocidadVertical = new JustGage({ ...gaugeDefaults, id: "gauge-velocidad-vertical", min: -10, max: 10, label: "m/s" });
  else gauges.velocidadVertical.refresh(0);
}

// --- LÓGICA PRINCIPAL DEL VUELO ---

/**
 * Limpia el visor de Cesium y los listeners para preparar una nueva carga.
 */
function _limpiarVisor() {
  if (viewer) {
    if (tickListener) {
      viewer.clock.onTick.removeEventListener(tickListener);
      tickListener = null;
    }
    viewer.destroy();
    viewer = null;
    flightEntity = null;
  }
}

/**
 * Valida los datos del vuelo y los muestra en la interfaz.
 * @param {object} datos - El objeto de datos del vuelo recibido del backend.
 */
function _procesarYMostrarVuelo(datos) {
  if (datos.error) throw new Error(datos.error);
  if (!datos.coordenadas?.length) throw new Error("Vuelo sin coordenadas válidas para mostrar.");

  // 🔐 Validar y corregir datos si es necesario
  const arraysAValidar = ['grabando_video', 'tomando_foto', 'baterias', 'velocidades_horizontal', 'velocidades_vertical'];
  arraysAValidar.forEach(key => {
    if (!datos[key] || datos[key].length !== datos.tiempos.length) {
      console.warn(`⚠️ '${key}' desalineado o ausente. Corrigiendo.`);
      const defaultValue = (key === 'grabando_video' || key === 'tomando_foto') ? false : 0;
      datos[key] = new Array(datos.tiempos.length).fill(defaultValue);
    }
  });

  actualizarDetallesVuelo(datos.resumen);
  inicializarGauges();
  inicializarCesiumViewer(datos);
}

/**
 * Carga un vuelo existente desde el servidor por su ID.
 * @param {string} vueloId - El ID del vuelo a cargar.
 */
window.cargarVuelo = async (vueloId) => {
  _limpiarVisor();
  
  const resumenView = document.getElementById("resumen");
  const detalleView = document.getElementById("detalle-vuelo");
  if (!resumenView || !detalleView) return;
  resumenView.style.display = "none";
  detalleView.style.display = "block";
  document.body.style.overflow = "auto";

  try {
    const response = await fetch(`/vuelo/${vueloId}`);
    if (!response.ok) throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
    const datos = await response.json();
    _procesarYMostrarVuelo(datos);
  } catch (e) {
    console.error("❌ Error al cargar el vuelo:", e);
    alert(`No se pudo cargar el vuelo:\n\n${e.message}`);
    window.volverAlResumen();
  }
};

/**
 * Sube uno o más archivos CSV, los procesa en el backend y carga el primer vuelo válido en el visor.
 * @param {FileList} files - La lista de archivos seleccionados por el usuario.
 */
window.cargarNuevosVuelosDesdeArchivos = async (files) => {
  if (!files || files.length === 0) {
    alert('No se seleccionó ningún archivo.');
    return;
  }

  _limpiarVisor();

  const resumenView = document.getElementById("resumen");
  const detalleView = document.getElementById("detalle-vuelo");
  if (!resumenView || !detalleView) return;
  resumenView.style.display = "none";
  detalleView.style.display = "block";
  document.body.style.overflow = "auto";

  const formData = new FormData();
  let csvCount = 0;
  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.csv')) {
      formData.append('csv_files', file); // Usamos el mismo nombre para todos los archivos
      csvCount++;
    }
  }

  if (csvCount === 0) {
    alert('Por favor, selecciona al menos un archivo CSV válido.');
    window.volverAlResumen();
    return;
  }

  try {
    // Muestra un indicador de carga (opcional, pero recomendado)
    // document.getElementById('loading-indicator').style.display = 'block';

    const response = await fetch('/upload_vuelos', { // Endpoint actualizado a plural
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
    // El backend devolverá los datos del primer vuelo procesado con éxito
    const datos = await response.json();
    _procesarYMostrarVuelo(datos);

  } catch (e) {
    console.error("❌ Error al subir y procesar los nuevos vuelos:", e);
    alert(`No se pudieron cargar los vuelos:\n\n${e.message}`);
    window.volverAlResumen();
  } finally {
    // Oculta el indicador de carga
    // document.getElementById('loading-indicator').style.display = 'none';
  }
};


function inicializarCesiumViewer(datos) {
  const { coordenadas, tiempos, fecha_inicio, baterias, velocidades_horizontal, velocidades_vertical, grabando_video, tomando_foto } = datos;

  viewer = new Cesium.Viewer("cesiumContainer", {
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    baseLayerPicker: true,
    timeline: true,
    animation: true,
    shouldAnimate: true,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    infoBox: false,
    selectionIndicator: false,
    fullscreenButton: false
  });

  const start = Cesium.JulianDate.fromIso8601(fecha_inicio);
  const stop = Cesium.JulianDate.addSeconds(start, tiempos[tiempos.length - 1], new Cesium.JulianDate());

  viewer.clock.startTime = Cesium.JulianDate.clone(start);
  viewer.clock.stopTime = Cesium.JulianDate.clone(stop);
  viewer.clock.currentTime = Cesium.JulianDate.clone(start);
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  viewer.timeline.zoomTo(start, stop);

  const positionProperty = new Cesium.SampledPositionProperty();
  coordenadas.forEach((c, i) => {
    const time = Cesium.JulianDate.addSeconds(start, tiempos[i], new Cesium.JulianDate());
    const position = Cesium.Cartesian3.fromDegrees(c.lon, c.lat, c.alt);
    positionProperty.addSample(time, position);
  });

  flightEntity = viewer.entities.add({
    availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({ start, stop })]),
    position: positionProperty,
    orientation: new Cesium.VelocityOrientationProperty(positionProperty),
    point: {
      pixelSize: 10,
      color: Cesium.Color.fromCssColorString('#3b82f6'),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    }
  });

  const pathPositions = [];
  viewer.entities.add({
    polyline: {
      positions: new Cesium.CallbackProperty(() => pathPositions, false),
      width: 2,
      material: Cesium.Color.RED.withAlpha(0.9),
    }
  });

  viewer.clock.shouldAnimate = true;
  viewer.trackedEntity = undefined;

  if (coordenadas.length > 0) {
    const primeraPos = Cesium.Cartesian3.fromDegrees(coordenadas[0].lon, coordenadas[0].lat, coordenadas[0].alt);
    viewer.scene.camera.flyToBoundingSphere(new Cesium.BoundingSphere(primeraPos), {
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 100),
      duration: 0
    });
  }

  // --- ESTADO LOCAL PARA LA ANIMACIÓN ---
  // Se encapsula el estado de la animación para evitar variables globales.
  let ultimoIndiceConocido = 0;
  let fotoLedTimeout = null;
  let ultimaFotoFlag = false;

  tickListener = () => {
    const currentTime = viewer.clock.currentTime;
    const currentPosition = positionProperty.getValue(currentTime);

    if (currentPosition) {
      pathPositions.push(currentPosition);
    }

    const t = Cesium.JulianDate.secondsDifference(currentTime, start);

    // ✅ OPTIMIZACIÓN DE RENDIMIENTO: Búsqueda eficiente del índice actual.
    // En lugar de recorrer todo el array en cada fotograma, avanzamos o
    // retrocedemos desde la última posición conocida.
    let i = ultimoIndiceConocido;
    if (tiempos[i] < t) { // Búsqueda hacia adelante
      while (i < tiempos.length - 1 && tiempos[i] < t) {
        i++;
      }
    } else { // Búsqueda hacia atrás (si el usuario mueve la línea de tiempo)
      while (i > 0 && tiempos[i] > t) {
        i--;
      }
    }
    ultimoIndiceConocido = i;

    if (coordenadas[i]) {
      // 🟢🔴 ACTUALIZACIÓN VISUAL DE INDICADORES
      const ledVideo = document.getElementById("led-video");
      if (ledVideo) {
        const isRecording = grabando_video[i];
        ledVideo.classList.toggle("bg-red-500", isRecording);
        ledVideo.classList.toggle("bg-gray-500", !isRecording);
      }

      // ✅ CORRECCIÓN RACE CONDITION: Lógica robusta para el indicador de foto.
      // Se detecta el momento exacto en que se toma la foto y se gestiona
      // el temporizador de forma segura para evitar apagados prematuros.
      const ledFoto = document.getElementById("led-foto");
      if (ledFoto) {
        const fotoTomadaAhora = tomando_foto[i] && !ultimaFotoFlag;
        if (fotoTomadaAhora) {
          if (fotoLedTimeout) clearTimeout(fotoLedTimeout); // Cancela timer anterior
          ledFoto.classList.remove("bg-gray-500");
          ledFoto.classList.add("bg-green-400");
          fotoLedTimeout = setTimeout(() => {
            ledFoto.classList.remove("bg-green-400");
            ledFoto.classList.add("bg-gray-500");
            fotoLedTimeout = null;
          }, 2000);
        }
        ultimaFotoFlag = tomando_foto[i];
      }

      // Actualización de los medidores (gauges)
      gauges.velocidad?.refresh(Math.max(0, velocidades_horizontal[i]).toFixed(1));
      gauges.velocidadVertical?.refresh(velocidades_vertical[i].toFixed(1));
      gauges.altitud?.refresh(coordenadas[i].alt.toFixed(1));
      gauges.bateria?.refresh(baterias[i]);
    }
  };

  viewer.clock.onTick.addEventListener(tickListener);
}

window.volverAlResumen = function () {
  const resumenView = document.getElementById("resumen");
  const detalleView = document.getElementById("detalle-vuelo");

  if (detalleView) detalleView.style.display = "none";
  if (resumenView) resumenView.style.display = "block";
  document.body.style.overflow = "auto";

  _limpiarVisor();
};


