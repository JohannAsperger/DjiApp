// Configurar token de Cesium Ion (reemplaza con tu token real)
Cesium.Ion.defaultAccessToken = 'TU_TOKEN_DE_CESIUM_AQUI';

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
        levelColors: ["#2563eb", "#0ea5e9", "#22c55e"], // azul → turquesa → verde
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
        levelColors: ["#2563eb", "#38bdf8", "#a3e635"], // azul → celeste → lima
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
        noGradient: true, // ✅ evita pintar desde 0 hasta la aguja
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
};
























