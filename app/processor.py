import csv
import os
import json
import shutil
from datetime import datetime
from math import radians, cos, sin, sqrt, atan2
from typing import List, Dict, Any, Optional, Tuple
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderUnavailable, GeocoderTimedOut

# --- Constantes de Conversión y Geográficas ---
PIES_A_METROS = 0.3048
MPH_A_KMH = 1.60934
RADIO_TERRESTRE_KM = 6371.0
LIMITE_DISTANCIA_SEGMENTO_KM = 20.0 # Para filtrar saltos de GPS anómalos

# --- Funciones de Utilidad ---

def convertir_a_celsius(fahrenheit: float) -> float:
    """Convierte grados Fahrenheit a Celsius."""
    return (fahrenheit - 32) * 5.0 / 9.0

def distancia_haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula la distancia en km entre dos puntos geográficos usando la fórmula de Haversine."""
    lat1_rad, lon1_rad, lat2_rad, lon2_rad = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    a = sin(dlat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return RADIO_TERRESTRE_KM * c

def _obtener_nombre_ubicacion(filas: List[Dict[str, str]]) -> str:
    """
    Obtiene el nombre de la ubicación del vuelo usando geocodificación inversa.
    Busca la primera coordenada válida para mayor precisión.
    """
    coordenadas_validas = None
    for fila in filas:
        try:
            lat = float(fila.get("latitude", 0))
            lon = float(fila.get("longitude", 0))
            # Consideramos (0, 0) como inválido, una suposición común.
            if lat != 0.0 and lon != 0.0:
                coordenadas_validas = (lat, lon)
                break
        except (ValueError, TypeError):
            continue

    if not coordenadas_validas:
        return "Ubicación desconocida"

    try:
        geolocator = Nominatim(user_agent="dji_flight_processor_app")
        location = geolocator.reverse(coordenadas_validas, exactly_one=True, language="es", timeout=10)
        
        if not location:
            return "Ubicación no encontrada"

        # Extraer solo las partes deseadas de la dirección
        address_parts = location.raw.get('address', {})
        
        # Obtener las partes de la dirección con un orden de prioridad
        barrio_o_zona = address_parts.get('suburb') or address_parts.get('neighbourhood') or address_parts.get('quarter')
        localidad = address_parts.get('city') or address_parts.get('town') or address_parts.get('village')
        pais = address_parts.get('country', '')

        # Combinar las partes que existan, separadas por una coma.
        # El filtro elimina las partes que no se encontraron (son None)
        partes_finales = filter(None, [barrio_o_zona, localidad, pais])
        nombre_final = ', '.join(partes_finales)

        return nombre_final if nombre_final else "Ubicación no encontrada"
    except (GeocoderUnavailable, GeocoderTimedOut, Exception):
        return "Ubicación no disponible"

# --- Funciones de Lógica Principal ---

def _leer_csv(ruta_archivo: str) -> Optional[List[Dict[str, str]]]:
    """Lee un archivo CSV y devuelve su contenido como una lista de diccionarios."""
    try:
        with open(ruta_archivo, mode='r', newline='', encoding='utf-8-sig') as f:
            return list(csv.DictReader(f))
    except (FileNotFoundError, IOError) as e:
        print(f"❌ Error al leer el archivo CSV {ruta_archivo}: {e}")
        return None

def _extraer_metricas(filas: List[Dict[str, str]]) -> Dict[str, Any]:
    """Extrae y calcula las métricas clave de las filas de telemetría."""
    metricas = {
        "altitud_max_pies": 0.0,
        "velocidad_max_mph": 0.0,
        "temp_max_f": -float('inf'), # Iniciar con un valor muy bajo
        "distancia_max_origen_km": 0.0,
        "distancia_total_km": 0.0,
        "bateria_inicio": None,
        "bateria_fin": None,
    }

    try:
        home_coords = (float(filas[0]["latitude"]), float(filas[0]["longitude"]))
        lat_prev, lon_prev = None, None

        for fila in filas:
            try:
                lat, lon = float(fila["latitude"]), float(fila["longitude"])
                metricas["altitud_max_pies"] = max(metricas["altitud_max_pies"], float(fila.get("height_above_takeoff(feet)", 0)))
                metricas["velocidad_max_mph"] = max(metricas["velocidad_max_mph"], float(fila.get("speed(mph)", 0)))
                metricas["temp_max_f"] = max(metricas["temp_max_f"], float(fila.get("battery_temperature(f)", -float('inf'))))

                dist_home = distancia_haversine(home_coords[0], home_coords[1], lat, lon)
                # Solo considerar distancias razonables (<=10km) para el cálculo de distancia máxima desde el origen
                if dist_home <= 10.0:
                    metricas["distancia_max_origen_km"] = max(metricas["distancia_max_origen_km"], dist_home)

                if lat_prev is not None:
                    dist_segmento = distancia_haversine(lat_prev, lon_prev, lat, lon)
                    if dist_segmento < LIMITE_DISTANCIA_SEGMENTO_KM:
                        metricas["distancia_total_km"] += dist_segmento
                lat_prev, lon_prev = lat, lon
            except (ValueError, TypeError):
                continue # Ignorar fila si tiene datos numéricos inválidos

        valores_bateria = [float(f["battery_percent"]) for f in filas if f.get("battery_percent")]
        if valores_bateria:
            metricas["bateria_inicio"] = valores_bateria[0]
            metricas["bateria_fin"] = valores_bateria[-1]

    except (KeyError, IndexError) as e:
        print(f"⚠️ Faltan columnas esenciales en los datos: {e}")

    return metricas

def _crear_artefactos_vuelo(id_vuelo: str, ruta_origen_csv: str):
    """Crea el directorio y copia el archivo CSV del vuelo."""
    directorio_salida = os.path.join("data", "vuelos", id_vuelo)
    os.makedirs(directorio_salida, exist_ok=True)
    ruta_destino_csv = os.path.join(directorio_salida, "datos.csv")
    shutil.copyfile(ruta_origen_csv, ruta_destino_csv)


def procesar_archivo_csv(ruta_archivo: str) -> Optional[Dict[str, Any]]:
    """
    Función principal para procesar un único archivo CSV de un vuelo.
    Extrae telemetría, calcula un resumen y guarda los artefactos.

    Args:
        ruta_archivo: La ruta al archivo CSV original.

    Returns:
        Un diccionario con el resumen del vuelo o None si ocurre un error.
    """
    print(f"⚙️  Procesando: {os.path.basename(ruta_archivo)}")
    
    filas = _leer_csv(ruta_archivo)
    if not filas:
        print(f"⚠️  Archivo vacío o no legible: {ruta_archivo}")
        return None

    try:
        # Extracción de datos básicos
        id_vuelo = os.path.splitext(os.path.basename(ruta_archivo))[0]
        fecha_vuelo = filas[0]["datetime(utc)"]
        duracion_segundos = int(filas[-1]["time(millisecond)"]) / 1000

        # Obtener nombre de la ubicación
        nombre_ubicacion = _obtener_nombre_ubicacion(filas)

        # Cálculo de métricas complejas
        metricas = _extraer_metricas(filas)
        
        # Guardar artefactos (directorio y copia del CSV)
        _crear_artefactos_vuelo(id_vuelo, ruta_archivo)

        # Ensamblar el resumen final
        resumen = {
            "id": id_vuelo,
            "fecha": fecha_vuelo,
            "ubicacion": nombre_ubicacion,
            "duracion_segundos": round(duracion_segundos, 1),
            "altitud_maxima_metros": round(metricas["altitud_max_pies"] * PIES_A_METROS, 1),
            "distancia_maxima_km": round(metricas["distancia_max_origen_km"], 3),
            "distancia_recorrida_km": round(metricas["distancia_total_km"], 3),
            "temperatura_maxima_bateria_c": round(convertir_a_celsius(metricas["temp_max_f"]), 1),
            "velocidad_maxima_kmh": round(metricas["velocidad_max_mph"] * MPH_A_KMH, 1)
        }

        if metricas["bateria_inicio"] is not None:
            resumen["bateria_inicio_porcentaje"] = round(metricas["bateria_inicio"], 1)
            resumen["bateria_fin_porcentaje"] = round(metricas["bateria_fin"], 1)
        
        print(f"✅ Procesamiento completado para: {id_vuelo}")
        return resumen

    except (KeyError, IndexError, ValueError) as e:
        print(f"❌ Error crítico procesando {ruta_archivo}: Faltan datos esenciales. Error: {e}")
        return None
