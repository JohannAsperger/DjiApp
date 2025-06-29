
let viewer = null;
let entity = null;
let gaugeVelocidad = null;
let gaugeAltitud = null;
let gaugeBateria = null;
let gaugeVelocidadVertical = null;

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

      const r = datos.resumen || datos;
      document.getElementById("duracion").textContent = r.duracion_segundos ? (r.duracion_segundos / 60).toFixed(1) : "—";
      document.getElementById("bateria-inicio").textContent = r.bateria_inicio_porcentaje ?? "—";
      document.getElementById("bateria-fin").textContent = r.bateria_fin_porcentaje ?? "—";
      document.getElementById("altitud-maxima").textContent = r.altitud_maxima_metros?.toFixed(1) ?? "—";
      document.getElementById("distancia-maxima").textContent = r.distancia_maxima_km?.toFixed(2) ?? "—";
      document.getElementById("distancia-total").textContent = r.distancia_recorrida_km?.toFixed(2) ?? "—";
      document.getElementById("temperatura-maxima").textContent = r.temperatura_maxima_bateria_c?.toFixed(1) ?? "—";
      document.getElementById("velocidad-maxima").textContent = r.velocidad_maxima_kmh?.toFixed(1) ?? "—";

      return;
    }

    if (!datos.tiempos || datos.tiempos.length !== datos.coordenadas.length) throw new Error("No se encontraron tiempos válidos");
    if (!datos.fecha_inicio) throw new Error("No se recibió la fecha de inicio del vuelo");

    const r = datos.resumen;
    document.getElementById("duracion").textContent = r.duracion_segundos ? (r.duracion_segundos / 60).toFixed(1) : "—";
    document.getElementById("bateria-inicio").textContent = r.bateria_inicio_porcentaje ?? "—";
    document.getElementById("bateria-fin").textContent = r.bateria_fin_porcentaje ?? "—";
    document.getElementById("altitud-maxima").textContent = r.altitud_maxima_metros?.toFixed(1) ?? "—";
    document.getElementById("distancia-maxima").textContent = r.distancia_maxima_km?.toFixed(2) ?? "—";
    document.getElementById("distancia-total").textContent = r.distancia_recorrida_km?.toFixed(2) ?? "—";
    document.getElementById("temperatura-maxima").textContent = r.temperatura_maxima_bateria_c?.toFixed(1) ?? "—";
    document.getElementById("velocidad-maxima").textContent = r.velocidad_maxima_kmh?.toFixed(1) ?? "—";

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

    const fechaIsoZ = datos.fecha_inicio.replace("+00:00", "Z");

    await inicializarCesiumViewer(
      datos.coordenadas,
      datos.tiempos,
      fechaIsoZ,
      datos.baterias,
      datos.velocidades_horizontal,
      datos.velocidades_vertical
    );
  } catch (error) {
    alert(`Error inicializando el visualizador 3D\n\n${error.message}`);
    console.error("❌ Error cargando vuelo:", error);
  }
};

window.volverAlResumen = function () {
  document.getElementById("resumen").style.display = "block";
  document.getElementById("detalle-vuelo").style.display = "none";
  document.getElementById("cesiumContainer").style.display = "none";
  const infoDron = document.getElementById("info-dron");
  if (infoDron) infoDron.style.display = "none";
  
  // Limpiar el viewer de Cesium para liberar memoria
  if (viewer) {
    viewer.destroy();
    viewer = null;
    entity = null;
  }
};

async function inicializarCesiumViewer(coordenadas, tiempos, fechaInicio, baterias, velocidadesH, velocidadesV) {
  console.log("🚀 Inicializando Cesium viewer...");
  
  // Limpiar viewer anterior si existe
  if (viewer) {
    viewer.destroy();
    viewer = null;
    entity = null;
  }

  try {
    // Crear el viewer de Cesium
    viewer = new Cesium.Viewer('cesiumContainer', {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      animation: true,
      timeline: true,
      fullscreenButton: true,
      geocoder: false,
      infoBox: false,
      selectionIndicator: false
    });

    // Configurar el reloj
    const startTime = Cesium.JulianDate.fromIso8601(fechaInicio);
    const stopTime = Cesium.JulianDate.addSeconds(startTime, tiempos[tiempos.length - 1], new Cesium.JulianDate());
    
    viewer.clock.startTime = startTime.clone();
    viewer.clock.stopTime = stopTime.clone();
    viewer.clock.currentTime = startTime.clone();
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.multiplier = 2;

    // Crear las propiedades de posición y datos
    const positionProperty = new Cesium.SampledPositionProperty();
    const batteriaProperty = new Cesium.SampledProperty(Number);
    const velocidadHProperty = new Cesium.SampledProperty(Number);
    const velocidadVProperty = new Cesium.SampledProperty(Number);
    const altitudProperty = new Cesium.SampledProperty(Number);

    // Agregar los puntos de datos
    for (let i = 0; i < coordenadas.length; i++) {
      const tiempo = Cesium.JulianDate.addSeconds(startTime, tiempos[i], new Cesium.JulianDate());
      const posicion = Cesium.Cartesian3.fromDegrees(
        coordenadas[i][1], // longitud
        coordenadas[i][0], // latitud
        coordenadas[i][2]  // altitud
      );
      
      positionProperty.addSample(tiempo, posicion);
      
      if (baterias && baterias[i] !== undefined) {
        batteriaProperty.addSample(tiempo, baterias[i]);
      }
      if (velocidadesH && velocidadesH[i] !== undefined) {
        velocidadHProperty.addSample(tiempo, velocidadesH[i]);
      }
      if (velocidadesV && velocidadesV[i] !== undefined) {
        velocidadVProperty.addSample(tiempo, velocidadesV[i]);
      }
      if (coordenadas[i][2] !== undefined) {
        altitudProperty.addSample(tiempo, coordenadas[i][2]);
      }
    }

    // Crear la entidad del dron
    entity = viewer.entities.add({
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({
          start: startTime,
          stop: stopTime
        })
      ]),
      position: positionProperty,
      orientation: new Cesium.VelocityOrientationProperty(positionProperty),
      model: {
        uri: '/static/models/drone.glb',
        minimumPixelSize: 64,
        maximumScale: 20000,
        scale: 0.5
      },
      path: {
        resolution: 1,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.1,
          color: Cesium.Color.CYAN
        }),
        width: 3,
        leadTime: 0,
        trailTime: 60
      }
    });

    // Seguir la entidad
    viewer.trackedEntity = entity;

    // Configurar el evento de tick del reloj para actualizar los gauges
    viewer.clock.onTick.addEventListener(function(clock) {
      const currentTime = clock.currentTime;
      
      try {
        if (batteriaProperty.getValue(currentTime) !== undefined && gaugeBateria) {
          gaugeBateria.refresh(Math.round(batteriaProperty.getValue(currentTime)));
        }
        
        if (velocidadHProperty.getValue(currentTime) !== undefined && gaugeVelocidad) {
          gaugeVelocidad.refresh(Math.round(velocidadHProperty.getValue(currentTime)));
        }
        
        if (velocidadVProperty.getValue(currentTime) !== undefined && gaugeVelocidadVertical) {
          gaugeVelocidadVertical.refresh(parseFloat(velocidadVProperty.getValue(currentTime).toFixed(1)));
        }
        
        if (altitudProperty.getValue(currentTime) !== undefined && gaugeAltitud) {
          gaugeAltitud.refresh(Math.round(altitudProperty.getValue(currentTime)));
        }
      } catch (error) {
        console.warn("Error actualizando gauges:", error);
      }
    });

    // Centrar la vista en la trayectoria
    viewer.zoomTo(entity);

    console.log("✅ Cesium viewer inicializado correctamente");
    
  } catch (error) {
    console.error("❌ Error inicializando Cesium:", error);
    throw error;
  }
}

// Función para alternar modo oscuro
window.toggleDarkMode = function() {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem('darkMode', isDark);
  
  // Actualizar el ícono del botón
  const button = document.querySelector('[onclick="toggleDarkMode()"]');
  if (button) {
    const icon = button.querySelector('svg');
    if (isDark) {
      icon.innerHTML = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
    } else {
      icon.innerHTML = '<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';
    }
  }
};

// Inicializar el modo oscuro al cargar la página
document.addEventListener('DOMContentLoaded', function() {
  const savedDarkMode = localStorage.getItem('darkMode') === 'true';
  if (savedDarkMode) {
    document.documentElement.classList.add('dark');
  }
});
