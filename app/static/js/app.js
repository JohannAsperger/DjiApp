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

    if (!datos.puntos || datos.puntos.length === 0) {
      throw new Error("No se encontraron coordenadas para este vuelo");
    }

    if (!datos.tiempos || datos.tiempos.length !== datos.puntos.length) {
      throw new Error("No se encontraron tiempos válidos para animar la trayectoria");
    }

    console.log(`🔹 Cargados ${datos.puntos.length} puntos para vuelo ${vueloId}`);

    await inicializarCesiumViewer(datos.puntos, datos.tiempos);
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

async function inicializarCesiumViewer(coordenadas, tiempos) {
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }

  Cesium.Ion.defaultAccessToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NTk0M2RjOC0xYzc5LTQyZTgtOTMzYy1iOGMzOGMyMjFkNGIiLCJpZCI6MzEyMjA4LCJpYXQiOjE3NDk5MjM2OTZ9.hNylnne1DsKBD6JknfqBaB0NwC2YeRd2B0LqiCryCxM";

  const terrain = await Cesium.createWorldTerrainAsync();

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

  const puntos = coordenadas.map((p) =>
    Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
  );

  // Esfera animada sincronizada con tiempo real
  const property = new Cesium.SampledPositionProperty();
  const start = Cesium.JulianDate.now();
  const t0 = tiempos[0];

  for (let i = 0; i < puntos.length; i++) {
    const offsetSeg = (tiempos[i] - t0) / 1000; // milisegundos a segundos
    const time = Cesium.JulianDate.addSeconds(start, offsetSeg, new Cesium.JulianDate());
    property.addSample(time, puntos[i]);
  }

  const duracionTotalSeg = (tiempos[tiempos.length - 1] - t0) / 1000;
  const stop = Cesium.JulianDate.addSeconds(start, duracionTotalSeg, new Cesium.JulianDate());

  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
  viewer.clock.multiplier = 1; // velocidad real
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
      leadTime: 0, // sin línea hacia adelante
      trailTime: duracionTotalSeg, // trazo visible en tiempo real
      material: Cesium.Color.YELLOW,
      width: 2,
    },
  });

  viewer.zoomTo(viewer.entities);
}












