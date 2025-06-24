let viewer = null;

window.cargarVuelo = async function (vueloId) {
  console.log("Cargando vuelo...", vueloId);

  const resumen = document.getElementById("resumen");
  const detalleVuelo = document.getElementById("detalle-vuelo");
  const cesiumContainer = document.getElementById("cesiumContainer");

  if (!resumen || !detalleVuelo || !cesiumContainer) {
    console.error("❌ No se encontró uno de los contenedores en el DOM");
    return;
  }

  resumen.style.display = "none";
  detalleVuelo.style.display = "block";
  cesiumContainer.style.display = "block";

  try {
    const respuesta = await fetch(`/vuelo/${vueloId}`);
    const datos = await respuesta.json();

    if (!datos.coordenadas || datos.coordenadas.length === 0) {
      throw new Error("No se encontraron coordenadas para este vuelo");
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

    const fechaIsoZ = datos.fecha_inicio.replace("+00:00", "Z");

    await inicializarCesiumViewer(datos.coordenadas, datos.tiempos, fechaIsoZ);
  } catch (error) {
    alert(`Error inicializando el visualizador 3D\n\n${error.message}`);
    console.error("❌ Error cargando vuelo:", error);
  }
};

window.volverAlResumen = function () {
  const resumen = document.getElementById("resumen");
  const detalleVuelo = document.getElementById("detalle-vuelo");
  const cesiumContainer = document.getElementById("cesiumContainer");

  if (!resumen || !detalleVuelo || !cesiumContainer) return;

  detalleVuelo.style.display = "none";
  cesiumContainer.style.display = "none";
  resumen.style.display = "block";
};

async function inicializarCesiumViewer(coordenadas, tiempos, fechaInicioStr) {
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }

  Cesium.Ion.defaultAccessToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NTk0M2RjOC0xYzc5LTQyZTgtOTMzYy1iOGMzOGMyMjFkNGIiLCJpZCI6MzEyMjA4LCJpYXQiOjE3NDk5MjM2OTZ9.hNylnne1DsKBD6JknfqBaB0NwC2YeRd2B0LqiCryCxM";

  const terrain = new Cesium.EllipsoidTerrainProvider(); // 👈 Terreno plano

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

  const puntos = coordenadas.map(([lat, lon, alt]) =>
    Cesium.Cartesian3.fromDegrees(lon, lat, alt)
  );

  const start = Cesium.JulianDate.fromIso8601(fechaInicioStr);
  const property = new Cesium.SampledPositionProperty();
  const t0 = tiempos[0];

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
  viewer.clock.multiplier = 1;
  viewer.clock.shouldAnimate = true;
  viewer.timeline.zoomTo(start, stop);

  viewer.entities.add({
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

  viewer.zoomTo(viewer.entities);
}

















