
// Configurar token de Cesium Ion (reemplaza con tu token real)
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NTk0M2RjOC0xYzc5LTQyZTgtOTMzYy1iOGMzOGMyMjFkNGIiLCJpZCI6MzEyMjA4LCJpYXQiOjE3NDk5MjM2OTZ9.hNylnne1DsKBD6JknfqBaB0NwC2YeRd2B0LqiCryCxM';

let viewer = null;
let entity = null;
let gaugeVelocidad = null;
let gaugeAltitud = null;
let gaugeBateria = null;
let gaugeVelocidadVertical = null;
let tickListener = null; // Para poder remover el listener correctamente

window.cargarVuelo = async function (vueloId) {
  console.log("Cargando vuelo...", vueloId);

  const resumen = document.getElementById("resumen");
  const detalleVuelo = document.getElementById("detalle-vuelo");
  const cesiumContainer = document.getElementById("cesiumContainer");
  const infoDron = document.getElementById("info-dron");

  if (!resumen || !detalleVuelo || !cesiumContainer) {
    console.error("❌ No se encontró uno de los contenedores en el DOM");
    return;
  }

  resumen.style.display = "none";
  detalleVuelo.style.display = "block";
  cesiumContainer.style.display = "block";
  if (infoDron) infoDron.style.display = "block";

  // Limpiar mensajes previos
  const mensajePrevio = cesiumContainer.parentNode.querySelector('.bg-yellow-100, .bg-yellow-900');
  if (mensajePrevio) mensajePrevio.remove();

  try {
    const respuesta = await fetch(`/vuelo/${vueloId}`);
    const datos = await respuesta.json();

    if (!datos.coordenadas || datos.coordenadas.length === 0) {
      document.getElementById("cesiumContainer").style.display = "none";

      const container = document.getElementById("cesiumContainer");
      const mensajeDiv = document.createElement("div");
      mensajeDiv.className = "bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-lg";
      mensajeDiv.innerHTML = `<div class="flex items-center">
          <svg class="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
          </svg>
          <div><strong>Vuelo sin datos GPS</strong><br>Este vuelo no tiene coordenadas válidas para mostrar en el mapa 3D.</div>
        </div>`;
      container.parentNode.insertBefore(mensajeDiv, container);

      // Mostrar datos del resumen
      const r = datos.resumen || datos;
      actualizarDetallesVuelo(r);
      return;
    }

    if (!datos.tiempos || datos.tiempos.length !== datos.coordenadas.length) {
      throw new Error("No se encontraron tiempos válidos");
    }
    if (!datos.fecha_inicio) {
      throw new Error("No se recibió la fecha de inicio del vuelo");
    }

    // Actualizar detalles del vuelo
    actualizarDetallesVuelo(datos.resumen);

    // Inicializar gauges solo una vez
    inicializarGauges();

    // Inicializar viewer de Cesium
    await inicializarCesiumViewer(
      datos.coordenadas,
      datos.tiempos,
      datos.fecha_inicio.replace("+00:00", "Z"),
      datos.baterias,
      datos.velocidades_horizontal,
      datos.velocidades_vertical
    );
  } catch (error) {
    console.error("❌ Error cargando vuelo:", error);
    alert(`Error inicializando el visualizador 3D\n\n${error.message}`);
  }
};

function actualizarDetallesVuelo(resumen) {
  const elementos = {
    "duracion": resumen.duracion_segundos ? (resumen.duracion_segundos / 60).toFixed(1) : "—",
    "bateria-inicio": resumen.bateria_inicio_porcentaje ?? "—",
    "bateria-fin": resumen.bateria_fin_porcentaje ?? "—",
    "altitud-maxima": resumen.altitud_maxima_metros?.toFixed(1) ?? "—",
    "distancia-maxima": resumen.distancia_maxima_km?.toFixed(2) ?? "—",
    "distancia-total": resumen.distancia_recorrida_km?.toFixed(2) ?? "—",
    "temperatura-maxima": resumen.temperatura_maxima_bateria_c?.toFixed(1) ?? "—",
    "velocidad-maxima": resumen.velocidad_maxima_kmh?.toFixed(1) ?? "—"
  };

  Object.entries(elementos).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
  });
}

function inicializarGauges() {
  if (!gaugeVelocidad) {
    gaugeVelocidad = new JustGage({
      id: "gauge-velocidad",
      value: 0,
      min: 0,
      max: 100,
      label: "km/h",
      pointer: true,
      gaugeWidthScale: 0.6,
      levelColors: ["#2563eb", "#0ea5e9", "#22c55e"],
      customSectors: [{ color: "#dc2626", lo: 90, hi: 100 }],
      labelFontColor: "#444",
      valueFontColor: "inherit",
      shadowOpacity: 0.3
    });
  }

  if (!gaugeAltitud) {
    gaugeAltitud = new JustGage({
      id: "gauge-altitud",
      value: 0,
      min: 0,
      max: 500,
      label: "m",
      pointer: true,
      gaugeWidthScale: 0.6,
      levelColors: ["#2563eb", "#38bdf8", "#a3e635"],
      customSectors: [{ color: "#dc2626", lo: 450, hi: 500 }],
      labelFontColor: "#444",
      valueFontColor: "inherit",
      shadowOpacity: 0.3
    });
  }

  if (!gaugeBateria) {
    gaugeBateria = new JustGage({
      id: "gauge-bateria",
      value: 100,
      min: 0,
      max: 100,
      label: "%",
      pointer: true,
      gaugeWidthScale: 0.6,
      levelColors: ["#f87171", "#facc15", "#4ade80"],
      customSectors: [{ color: "#dc2626", lo: 10, hi: 30 }],
      labelFontColor: "#444",
      valueFontColor: "inherit",
      shadowOpacity: 0.3
    });
  }

  if (!gaugeVelocidadVertical) {
    gaugeVelocidadVertical = new JustGage({
      id: "gauge-velocidad-vertical",
      value: 0,
      min: -10,
      max: 10,
      label: "m/s",
      pointer: true,
      gaugeWidthScale: 0.6,
      noGradient: true,
      levelColors: ["#f59e0b"],
      labelFontColor: "#444",
      valueFontColor: "inherit",
      shadowOpacity: 0.3
    });
  }
}

async function inicializarCesiumViewer(coordenadas, tiempos, fechaInicio, baterias, velocidadesH, velocidadesV) {
  // Validar datos de entrada
  if (!coordenadas || !Array.isArray(coordenadas) || coordenadas.length === 0) {
    throw new Error("Coordenadas inválidas o vacías");
  }
  
  if (!tiempos || !Array.isArray(tiempos) || tiempos.length !== coordenadas.length) {
    throw new Error("Tiempos inválidos o no coinciden con coordenadas");
  }

  // Limpiar viewer anterior
  if (viewer) {
    // Remover listener anterior
    if (tickListener) {
      viewer.clock.onTick.removeEventListener(tickListener);
      tickListener = null;
    }
    viewer.destroy();
    viewer = null;
  }

  try {
    // Crear nuevo viewer
    viewer = new Cesium.Viewer('cesiumContainer', {
      baseLayerPicker: false,
      vrButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: true,
      timeline: true,
      fullscreenButton: true,
      geocoder: false,
      homeButton: true,
      infoBox: false,
      selectionIndicator: false,
      terrainProvider: await Cesium.createWorldTerrainAsync({
        requestWaterMask: false,
        requestVertexNormals: false
      })
    });

    // Filtrar coordenadas válidas
    const coordenadasValidas = [];
    const tiemposValidos = [];
    
    for (let i = 0; i < coordenadas.length; i++) {
      const coord = coordenadas[i];
      if (coord && 
          typeof coord.lat === 'number' && 
          typeof coord.lon === 'number' && 
          typeof coord.alt === 'number' && 
          !isNaN(coord.lat) && 
          !isNaN(coord.lon) && 
          !isNaN(coord.alt) &&
          coord.lat !== 0 && 
          coord.lon !== 0) {
        coordenadasValidas.push(coord);
        tiemposValidos.push(tiempos[i]);
      }
    }

    if (coordenadasValidas.length === 0) {
      throw new Error("No hay coordenadas válidas para mostrar");
    }

    console.log(`✅ Usando ${coordenadasValidas.length} coordenadas válidas de ${coordenadas.length} totales`);

    // Crear posiciones
    const positions = coordenadasValidas.map(coord => 
      Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, coord.alt)
    );

    const property = new Cesium.SampledPositionProperty();
    const startTime = Cesium.JulianDate.fromIso8601(fechaInicio);

    for (let i = 0; i < positions.length; i++) {
      const time = Cesium.JulianDate.addSeconds(startTime, tiemposValidos[i], new Cesium.JulianDate());
      property.addSample(time, positions[i]);
    }

    // Crear entidad del dron
    entity = viewer.entities.add({
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({
          start: startTime,
          stop: Cesium.JulianDate.addSeconds(startTime, tiemposValidos[tiemposValidos.length - 1], new Cesium.JulianDate())
        })
      ]),
      position: property,
      orientation: new Cesium.VelocityOrientationProperty(property),
      point: {
        pixelSize: 10,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.NONE
      },
      path: {
        resolution: 1,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.1,
          color: Cesium.Color.CYAN
        }),
        width: 3
      }
    });

    // Configurar clock
    const endTime = Cesium.JulianDate.addSeconds(startTime, tiemposValidos[tiemposValidos.length - 1], new Cesium.JulianDate());
    viewer.clock.startTime = startTime;
    viewer.clock.stopTime = endTime;
    viewer.clock.currentTime = startTime;
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.multiplier = 3; // Reducir velocidad

    // Volar a la primera posición
    viewer.camera.flyTo({
      destination: positions[0],
      duration: 2.0
    });

    // Configurar tracking después de un breve delay
    setTimeout(() => {
      if (viewer && entity) {
        viewer.trackedEntity = entity;
      }
    }, 3000);

    // Agregar listener para actualizar gauges (con throttling)
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 100; // Actualizar cada 100ms máximo

    tickListener = function(clock) {
      const now = Date.now();
      if (now - lastUpdateTime < UPDATE_INTERVAL) {
        return; // Skip si es muy pronto
      }
      lastUpdateTime = now;

      const currentTime = clock.currentTime;
      const totalSeconds = Cesium.JulianDate.secondsDifference(currentTime, startTime);
      const currentIndex = Math.floor(totalSeconds);
      
      // Solo actualizar si tenemos datos válidos
      if (currentIndex >= 0 && currentIndex < velocidadesH.length) {
        try {
          if (gaugeVelocidad && velocidadesH[currentIndex] !== undefined) {
            gaugeVelocidad.refresh(Math.max(0, velocidadesH[currentIndex] || 0));
          }
          if (gaugeAltitud && coordenadasValidas[currentIndex]) {
            gaugeAltitud.refresh(Math.max(0, coordenadasValidas[currentIndex].alt || 0));
          }
          if (gaugeBateria && baterias[currentIndex] !== undefined) {
            gaugeBateria.refresh(Math.max(0, Math.min(100, baterias[currentIndex] || 0)));
          }
          if (gaugeVelocidadVertical && velocidadesV[currentIndex] !== undefined) {
            const velVertical = velocidadesV[currentIndex] || 0;
            gaugeVelocidadVertical.refresh(Math.max(-10, Math.min(10, velVertical)));
          }
        } catch (e) {
          console.warn("Error actualizando gauges:", e);
        }
      }
    };

    viewer.clock.onTick.addEventListener(tickListener);

  } catch (error) {
    console.error("Error creando viewer:", error);
    throw new Error("No se pudo inicializar el visor 3D: " + error.message);
  }
}

window.volverAlResumen = function () {
  // Limpiar viewer y listeners
  if (viewer && tickListener) {
    viewer.clock.onTick.removeEventListener(tickListener);
    tickListener = null;
  }
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }
  
  document.getElementById("resumen").style.display = "block";
  document.getElementById("detalle-vuelo").style.display = "none";
  document.getElementById("cesiumContainer").style.display = "none";
  const infoDron = document.getElementById("info-dron");
  if (infoDron) infoDron.style.display = "none";
};

// Función para expandir el visor (si existe el botón)
window.toggleCesiumSize = function() {
  const container = document.getElementById("cesiumContainer");
  if (container) {
    if (container.style.height === "80vh") {
      container.style.height = "50vh";
    } else {
      container.style.height = "80vh";
    }
    // Trigger resize en Cesium
    if (viewer) {
      setTimeout(() => {
        viewer.resize();
      }, 100);
    }
  }
};
