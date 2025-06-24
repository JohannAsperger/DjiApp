// static/js/app.js

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

    console.log(`🔹 Cargados ${datos.puntos.length} puntos para vuelo ${vueloId}`);

    await inicializarCesiumViewer(datos.puntos);  // 👈 función async
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

async function inicializarCesiumViewer(coordenadas) {
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }

  Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NTk0M2RjOC0xYzc5LTQyZTgtOTMzYy1iOGMzOGMyMjFkNGIiLCJpZCI6MzEyMjA4LCJpYXQiOjE3NDk5MjM2OTZ9.hNylnne1DsKBD6JknfqBaB0NwC2YeRd2B0LqiCryCxM";

  const terrain = await Cesium.createWorldTerrainAsync();  // ✅ NUEVO método

  viewer = new Cesium.Viewer("cesiumContainer", {
    terrainProvider: terrain,
    timeline: false,
    animation: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    infoBox: false,
    scene3DOnly: true,
    fullscreenButton: false,
  });

  const puntos = coordenadas.map((p) =>
    Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
  );

  viewer.entities.add({
    name: "Trayectoria de Vuelo",
    polyline: {
      positions: puntos,
      width: 3,
      material: Cesium.Color.CYAN,
    },
  });

  viewer.zoomTo(viewer.entities);
}

// Controles de cámara
function zoomIn() {
  if (viewer) viewer.camera.zoomIn();
}

function zoomOut() {
  if (viewer) viewer.camera.zoomOut();
}

function setTopView() {
  if (viewer) {
    const center = viewer.scene.camera.positionWC;
    viewer.camera.setView({
      destination: center,
      orientation: {
        heading: 0,
        pitch: -Math.PI / 2,
        roll: 0,
      },
    });
  }
}

function resetView() {
  if (viewer) viewer.zoomTo(viewer.entities);
}








