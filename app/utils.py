import os
import csv
import json


def cargar_resumen_vuelo(vuelo_id):
    """
    Carga el archivo resumen.json de un vuelo específico
    
    Args:
        vuelo_id (str): Identificador único del vuelo
        
    Returns:
        dict: Datos del resumen del vuelo o None si hay error
    """
    ruta = os.path.join("data", "vuelos", vuelo_id, "resumen.json")
    
    if not os.path.exists(ruta):
        return None
        
    try:
        with open(ruta, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"❌ Error cargando resumen de vuelo {vuelo_id}: {e}")
        return None


def cargar_coordenadas_csv(vuelo_id):
    """
    Carga coordenadas desde el archivo datos.csv procesado
    
    Args:
        vuelo_id (str): Identificador único del vuelo
        
    Returns:
        list: Lista de coordenadas {lat, lon, alt} en metros
    """
    ruta = os.path.join("data", "vuelos", vuelo_id, "datos.csv")
    coordenadas = []
    
    if not os.path.exists(ruta):
        print(f"⚠️ Archivo CSV no encontrado: {ruta}")
        return coordenadas
    
    try:
        with open(ruta, newline='', encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            
            # Validar que existan las columnas necesarias
            required_columns = ["latitude", "longitude", "altitude_above_seaLevel(feet)"]
            if not all(col in reader.fieldnames for col in required_columns):
                print(f"❌ Columnas faltantes en CSV {vuelo_id}")
                return coordenadas
            
            for row_num, row in enumerate(reader, start=1):
                try:
                    lat_raw = row.get("latitude", "").strip()
                    lon_raw = row.get("longitude", "").strip()
                    alt_raw = row.get("altitude_above_seaLevel(feet)", "").strip()
                    
                    # Validar que los valores no estén vacíos
                    if not all([lat_raw, lon_raw, alt_raw]):
                        continue
                    
                    lat = float(lat_raw)
                    lon = float(lon_raw)
                    alt_feet = float(alt_raw)
                    alt_meters = alt_feet * 0.3048  # Conversión pies a metros
                    
                    # Validar coordenadas geográficas válidas
                    if (-90 <= lat <= 90 and -180 <= lon <= 180 and 
                        lat != 0 and lon != 0):
                        coordenadas.append({
                            "lat": lat,
                            "lon": lon,
                            "alt": round(alt_meters, 2)
                        })
                        
                except (ValueError, TypeError) as e:
                    print(f"⚠️ Error procesando fila {row_num} en {vuelo_id}: {e}")
                    continue
                    
    except IOError as e:
        print(f"❌ Error leyendo CSV {vuelo_id}: {e}")
    
    print(f"✅ Cargadas {len(coordenadas)} coordenadas válidas para {vuelo_id}")
    return coordenadas


def calcular_resumen_general():
    """
    Calcula estadísticas generales de todos los vuelos procesados
    
    Returns:
        dict: Resumen con estadísticas agregadas de todos los vuelos
    """
    path_vuelos = os.path.join("data", "vuelos")
    
    # Validar que el directorio exista
    if not os.path.exists(path_vuelos):
        print(f"⚠️ Directorio de vuelos no encontrado: {path_vuelos}")
        return crear_resumen_vacio()
    
    # Inicializar contadores
    total_vuelos = 0
    total_duracion = 0
    total_distancia = 0
    max_distancia = 0
    max_altitud = 0
    max_temp = 0
    max_velocidad = 0
    vuelos_procesados = []
    
    try:
        # Procesar cada vuelo en el directorio
        for item in os.listdir(path_vuelos):
            item_path = os.path.join(path_vuelos, item)
            
            # Verificar que sea un directorio
            if not os.path.isdir(item_path):
                continue
                
            resumen = cargar_resumen_vuelo(item)
            if not resumen:
                print(f"⚠️ No se pudo cargar resumen para: {item}")
                continue
            
            # Procesar estadísticas del vuelo
            total_vuelos += 1
            vuelos_procesados.append(item)
            
            # Sumar valores totales con validación
            total_duracion += resumen.get("duracion_segundos", 0)
            total_distancia += resumen.get("distancia_recorrida_km", 0)
            
            # Actualizar máximos
            max_distancia = max(max_distancia, 
                              resumen.get("distancia_maxima_km", 0))
            max_altitud = max(max_altitud, 
                            resumen.get("altitud_maxima_metros", 0))
            max_temp = max(max_temp, 
                         resumen.get("temperatura_maxima_bateria_c", 0))
            max_velocidad = max(max_velocidad, 
                              resumen.get("velocidad_maxima_kmh", 0))
    
    except OSError as e:
        print(f"❌ Error accediendo al directorio de vuelos: {e}")
        return crear_resumen_vacio()
    
    # Log de procesamiento
    print(f"✅ Procesados {total_vuelos} vuelos: {vuelos_procesados}")
    
    # Retornar resumen calculado
    resumen_calculado = {
        "cantidad_vuelos": total_vuelos,
        "duracion_total_minutos": round(total_duracion / 60, 2) if total_duracion > 0 else 0,
        "distancia_total_km": round(total_distancia, 2),
        "distancia_maxima_home_km": round(max_distancia, 2),
        "altura_maxima_m": round(max_altitud, 2),
        "temperatura_maxima_bateria": round(max_temp, 1),
        "velocidad_maxima_kmh": round(max_velocidad, 1)
    }
    
    print(f"📊 Resumen general calculado: {resumen_calculado}")
    return resumen_calculado


def crear_resumen_vacio():
    """
    Crea un resumen con valores por defecto cuando no hay datos
    
    Returns:
        dict: Resumen con valores cero para evitar errores en templates
    """
    return {
        "cantidad_vuelos": 0,
        "duracion_total_minutos": 0,
        "distancia_total_km": 0,
        "distancia_maxima_home_km": 0,
        "altura_maxima_m": 0,
        "temperatura_maxima_bateria": 0,
        "velocidad_maxima_kmh": 0
    }


def validar_estructura_vuelo(vuelo_id):
    """
    Valida que un vuelo tenga la estructura de archivos correcta
    
    Args:
        vuelo_id (str): Identificador del vuelo
        
    Returns:
        bool: True si la estructura es válida
    """
    base_path = os.path.join("data", "vuelos", vuelo_id)
    
    archivos_requeridos = ["resumen.json", "datos.csv"]
    
    for archivo in archivos_requeridos:
        ruta_archivo = os.path.join(base_path, archivo)
        if not os.path.exists(ruta_archivo):
            print(f"❌ Archivo faltante: {ruta_archivo}")
            return False
    
    return True