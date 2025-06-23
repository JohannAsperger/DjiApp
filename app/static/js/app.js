/**
 * DJIApp - Visualizador de trayectorias de vuelo con CesiumJS
 * Funciones principales para manejo de interfaz y renderizado 3D
 */

// Configuración global de Cesium
const CESIUM_CONFIG = {
    accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NTk0M2RjOC0xYzc5LTQyZTgtOTMzYy1iOGMzOGMyMjFkNGIiLCJpZCI6MzEyMjA4LCJpYXQiOjE3NDk5MjM2OTZ9.hNylnne1DsKBD6JknfqBaB0NwC2YeRd2B0LqiCryCxM",
    terrainProvider: null,
    viewerOptions: {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false
    }
};

// Variable global para el viewer de Cesium
let cesiumViewer = null;

/**
 * Carga y visualiza la trayectoria de un vuelo específico
 * @param {string} vueloId - Identificador único del vuelo
 */
window.cargarVuelo = async function(vueloId) {
    try {
        // Transición de interfaz
        toggleVistas('detalle');

        // Mostrar indicador de carga
        mostrarCargando(true);

        // Petición de datos al backend
        const response = await fetch(`/vuelo/${vueloId}`);

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();

        // Validar estructura de respuesta
        if (data.error) {
            throw new Error(data.error);
        }

        const puntos = data.puntos || data; // Compatibilidad con formato anterior

        if (!Array.isArray(puntos) || puntos.length === 0) {
            throw new Error("No se encontraron coordenadas para este vuelo");
        }

        console.log(`✅ Cargados ${puntos.length} puntos para vuelo ${vueloId}`);

        // Inicializar o limpiar viewer de Cesium
        await inicializarCesiumViewer();

        // Renderizar trayectoria en el mapa 3D
        renderizarTrayectoria(puntos, vueloId);

    } catch (error) {
        console.error("❌ Error al cargar el vuelo:", error.message);
        mostrarError(`Error cargando vuelo: ${error.message}`);
    } finally {
        mostrarCargando(false);
    }
};

/**
 * Inicializa el viewer de CesiumJS con configuración optimizada
 */
async function inicializarCesiumViewer() {
    try {
        // Configurar token de acceso
        Cesium.Ion.defaultAccessToken = CESIUM_CONFIG.accessToken;

        // Limpiar viewer existente si existe
        if (cesiumViewer) {
            cesiumViewer.entities.removeAll();
        } else {
            // Crear nuevo viewer con configuración optimizada
            cesiumViewer = new Cesium.Viewer("cesiumContainer", {
                ...CESIUM_CONFIG.viewerOptions,
                terrainProvider: await Cesium.createWorldTerrainAsync()
            });

            // Configurar cámara para mejor visualización de drones
            cesiumViewer.scene.screenSpaceCameraController.minimumZoomDistance = 10;
            cesiumViewer.scene.screenSpaceCameraController.maximumZoomDistance = 50000;
        }

    } catch (error) {
        console.error("❌ Error inicializando CesiumJS:", error);
        throw new Error("Error inicializando el visualizador 3D");
    }
}

/**
 * Renderiza la trayectoria del vuelo en CesiumJS
 * @param {Array} puntos - Array de coordenadas {lat, lon, alt}
 * @param {string} vueloId - Identificador del vuelo
 */
function renderizarTrayectoria(puntos, vueloId) {
    try {
        // Convertir coordenadas a formato Cesium (grados a Cartesian3)
        const positions = puntos.map(punto => 
            Cesium.Cartesian3.fromDegrees(punto.lon, punto.lat, punto.alt)
        );

        // Crear entidad de trayectoria con estilo mejorado
        const trayectoriaEntity = cesiumViewer.entities.add({
            name: `Trayectoria ${vueloId}`,
            polyline: {
                positions: positions,
                width: 4,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.2,
                    color: Cesium.Color.CYAN
                }),
                clampToGround: false,
                followSurface: false
            }
        });

        // Agregar marcador de inicio (verde)
        if (puntos.length > 0) {
            const inicio = puntos[0];
            cesiumViewer.entities.add({
                name: "Inicio del vuelo",
                position: Cesium.Cartesian3.fromDegrees(inicio.lon, inicio.lat, inicio.alt),
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.LIME,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.NONE
                }
            });
        }

        // Agregar marcador de fin (rojo)
        if (puntos.length > 1) {
            const fin = puntos[puntos.length - 1];
            cesiumViewer.entities.add({
                name: "Fin del vuelo",
                position: Cesium.Cartesian3.fromDegrees(fin.lon, fin.lat, fin.alt),
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.NONE
                }
            });
        }

        // Ajustar cámara para mostrar toda la trayectoria
        cesiumViewer.zoomTo(trayectoriaEntity, new Cesium.HeadingPitchRange(0, -0.5, 0));

        console.log(`✅ Trayectoria renderizada: ${puntos.length} puntos`);

    } catch (error) {
        console.error("❌ Error renderizando trayectoria:", error);
        throw new Error("Error visualizando la trayectoria del vuelo");
    }
}

/**
 * Regresa a la vista de resumen principal
 */
window.volverAlResumen = function() {
    toggleVistas('resumen');

    // Limpiar viewer de Cesium para liberar recursos
    if (cesiumViewer) {
        cesiumViewer.entities.removeAll();
    }
};

/**
 * Maneja la transición entre vistas de la aplicación
 * @param {string} vistaActiva - 'resumen' o 'detalle'
 */
function toggleVistas(vistaActiva) {
    const resumenEl = document.getElementById("resumen");
    const detalleEl = document.getElementById("detalle-vuelo"); // 🔧 corregido ID

    if (vistaActiva === 'detalle') {
        resumenEl.style.display = "none";
        detalleEl.style.display = "block";
    } else {
        detalleEl.style.display = "none";
        resumenEl.style.display = "block";
    }

    // Mostrar/ocultar el visor Cesium
    const cesiumEl = document.getElementById("cesiumContainer");
    cesiumEl.style.display = (vistaActiva === 'detalle') ? "block" : "none";
}

/**
 * Muestra/oculta indicador de carga
 * @param {boolean} mostrar - true para mostrar, false para ocultar
 */
function mostrarCargando(mostrar) {
    // Placeholder de carga
    if (mostrar) {
        console.log("🔄 Cargando vuelo...");
    }
}

/**
 * Muestra mensaje de error al usuario
 * @param {string} mensaje - Mensaje de error a mostrar
 */
function mostrarError(mensaje) {
    alert(mensaje);
    console.error("❌", mensaje);
}





