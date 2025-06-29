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

  // Limpiar mensajes previos
  const mensajePrevio = cesiumContainer.parentNode.querySelector('.bg-yellow-100, .bg-yellow-900');
  if (mensajePrevio) {
    mensajePrevio.remove();
  }

  try {
    const respuesta = await fetch(`/vuelo/${vueloId}`);
    const datos = await respuesta.json();

    if (!datos.coordenadas || datos.coordenadas.length === 0) {
      // Mostrar información del vuelo sin mapa
      document.getElementById("cesiumContainer").style.display = "none";
      
      // Mostrar mensaje informativo
      const container = document.getElementById("cesiumContainer");
      const mensajeDiv = document.createElement("div");
      mensajeDiv.className = "bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-lg";
      mensajeDiv.innerHTML = `
        <div class="flex items-center">
          <svg class="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
          </svg>
          <div>
            <strong>Vuelo sin datos GPS</strong><br>
            Este vuelo no tiene coordenadas válidas para mostrar en el mapa 3D. 
            Es posible que se haya realizado en interiores o sin señal GPS.
          </div>
        </div>
      `;
      container.parentNode.insertBefore(mensajeDiv, container);
      
      // Continuar mostrando el resto de la información
      const r = datos.resumen || datos; // Para vuelos sin GPS, los datos están en el nivel raíz
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

    if (!datos.tiempos || datos.tiempos.length !== datos.coordenadas.length) {
      throw new Error("No se encontraron tiempos válidos para animar la trayectoria");
    }

    if (!datos.fecha_inicio) {
      throw new Error("No se recibió la fecha de inicio del vuelo");
    }

    console.log(`🔹 Cargados ${datos.coordenadas.length} puntos para vuelo ${vueloId}`);

    const r = datos.resumen;
    document.getElementById("duracion").textContent = r.duracion_segundos ? (r.duracion_segundos / 60).toFixed(1) : "—";
    document.getElementById("bateria-inicio").textContent = r.bateria_inicio_porcentaje ?? "—";
    document.getElementById("bateria-fin").textContent = r.bateria_fin_porcentaje ?? "—";
    document.getElementById("altitud-maxima").textContent = r.altitud_maxima_metros?.toFixed(1) ?? "—";
    document.getElementById("distancia-maxima").textContent = r.distancia_maxima_km?.toFixed(2) ?? "—";
    document.getElementById("distancia-total").textContent = r.distancia_recorrida_km?.toFixed(2) ?? "—";
    document.getElementById("temperatura-maxima").textContent = r.temperatura_maxima_bateria_c?.toFixed(1) ?? "—";
    document.getElementById("velocidad-maxima").textContent = r.velocidad_maxima_kmh?.toFixed(1) ?? "—";

    // Gauges
    if (!gaugeVelocidad) {
      gaugeVelocidad = new JustGage({
        id: "gauge-velocidad",
        value: 0,
        min: 0,
        max: 100,
        label: "km/h",
        pointer: true,
        gaugeWidthScale: 0.6,
        levelColors: ["#5eead4", "#60a5fa", "#facc15"],
        customSectors: [{ color: "#dc2626", lo: 90, hi: 100 }]
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
        levelColors: ["#a5f3fc", "#93c5fd", "#fde68a"],
        customSectors: [{ color: "#dc2626", lo: 450, hi: 500 }]
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
        customSectors: [{ color: "#dc2626", lo: 10, hi: 30 }]
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
        levelColors: ["#facc15", "#60a5fa", "#4ade80"],
        customSectors: [{ color: "#dc2626", lo: -10, hi: -5 }]
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
  const resumen = document.getElementById("resumen");
  const detalleVuelo = document.getElementById("detalle-vuelo");
  const cesiumContainer = document.getElementById("cesiumContainer");
  const infoDron = document.getElementById("info-dron");

  if (!resumen || !detalleVuelo || !cesiumContainer) return;

  detalleVuelo.style.display = "none";
  cesiumContainer.style.display = "none";
  if (infoDron) infoDron.style.display = "none";
  resumen.style.display = "block";
};

async function inicializarCesiumViewer(coordenadas, tiempos, fechaInicioStr, baterias, velocidadesHorizontal, velocidadesVertical) {
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }

  Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NTk0M2RjOC0xYzc5LTQyZTgtOTMzYy1iOGMzOGMyMjFkNGIiLCJpZCI6MzEyMjA4LCJpYXQiOjE3NDk5MjM2OTZ9.hNylnne1DsKBD6JknfqBaB0NwC2YeRd2B0LqiCryCxM";

  const terrain = new Cesium.EllipsoidTerrainProvider();

  viewer = new Cesium.Viewer("cesiumContainer", {
    terrainProvider: terrain,
    timeline: true,
    animation: true,
    geocoder: false,
    homeButton: false,
    sceneModePicker: true,
    baseLayerPicker: true,
    navigationHelpButton: true,
    infoBox: false,
    scene3DOnly: false,
    fullscreenButton: false,
  });

  viewer.scene.fxaa = true;
  viewer.scene.postProcessStages.fxaa.enabled = true;
  viewer.scene.requestRenderMode = false;

  const puntos = coordenadas.map(([lat, lon, alt]) =>
    Cesium.Cartesian3.fromDegrees(lon, lat, alt)
  );

  const start = Cesium.JulianDate.fromIso8601(fechaInicioStr);
  const property = new Cesium.SampledPositionProperty();

  property.setInterpolationOptions({
    interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
    interpolationDegree: 2,
  });

  for (let i = 0; i < puntos.length; i++) {
    const offsetSeg = tiempos[i];
    const time = Cesium.JulianDate.addSeconds(start, offsetSeg, new Cesium.JulianDate());
    property.addSample(time, puntos[i]);
  }

  const duracionTotalSeg = tiempos[tiempos.length - 1];
  const stop = Cesium.JulianDate.addSeconds(start, duracionTotalSeg, new Cesium.JulianDate());

  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
  viewer.clock.multiplier = 1.0;
  viewer.clock.shouldAnimate = true;
  viewer.timeline.zoomTo(start, stop);

  entity = viewer.entities.add({
    availability: new Cesium.TimeIntervalCollection([
      new Cesium.TimeInterval({ start, stop }),
    ]),
    position: property,
    point: {
      pixelSize: 10,
      color: Cesium.Color.RED,
    },
    path: {
      resolution: 1,
      leadTime: 0,
      trailTime: duracionTotalSeg,
      material: Cesium.Color.YELLOW,
      width: 2,
    },
  });

  viewer.clock.onTick.addEventListener(function (clock) {
    if (!entity) return;
    const position = entity.position.getValue(clock.currentTime);
    if (position) {
      const carto = Cesium.Cartographic.fromCartesian(position);
      const altitud = carto.height.toFixed(1);

      const currentTimeSeconds = Cesium.JulianDate.secondsDifference(clock.currentTime, start);
      const idx = tiempos.findIndex(t => t >= currentTimeSeconds);

      if (idx >= 0) {
        try {
          if (gaugeAltitud) gaugeAltitud.refresh(parseFloat(altitud));
          if (gaugeBateria && baterias && baterias.length > idx) {
            gaugeBateria.refresh(Math.round(baterias[idx]));
          }
          if (gaugeVelocidad && velocidadesHorizontal && velocidadesHorizontal.length > idx) {
            gaugeVelocidad.refresh(parseFloat(velocidadesHorizontal[idx].toFixed(1)));
          }
          if (gaugeVelocidadVertical && velocidadesVertical && velocidadesVertical.length > idx) {
            gaugeVelocidadVertical.refresh(parseFloat(velocidadesVertical[idx].toFixed(1)));
          }
        } catch (error) {
          console.error("Error actualizando gauges:", error);
        }
      }
    }
  });

  viewer.zoomTo(viewer.entities);
}























