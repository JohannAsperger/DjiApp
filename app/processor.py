import csv
import os
import json
import shutil
from datetime import datetime
from math import radians, cos, sin, sqrt, atan2

def convertir_a_celsius(fahrenheit):
    return (fahrenheit - 32) * 5.0 / 9.0

def distancia_coord(lat1, lon1, lat2, lon2):
    R = 6371.0  # Radio terrestre en km
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))

def procesar_archivo_csv(ruta_archivo):
    try:
        with open(ruta_archivo, newline='', encoding='utf-8') as f:
            lector = csv.DictReader(f)
            filas = list(lector)

        if not filas:
            print(f"⚠️ Archivo vacío: {ruta_archivo}")
            return None

        primer_fila = filas[0]
        ultima_fila = filas[-1]

        # ✅ Incluir fecha con hora completa
        fecha_vuelo = primer_fila["datetime(utc)"]

        duracion_segundos = int(ultima_fila["time(millisecond)"]) / 1000

        coords_home = (
            float(primer_fila["latitude"]),
            float(primer_fila["longitude"])
        )

        altitud_max = 0
        velocidad_max = 0
        temperatura_max = 0
        distancia_max_origen = 0
        distancia_total = 0

        lat_prev, lon_prev = None, None

        for fila in filas:
            try:
                lat = float(fila["latitude"])
                lon = float(fila["longitude"])
                altitud = float(fila["altitude(feet)"])
                velocidad = float(fila["speed(mph)"])
                temp_f = float(fila["battery_temperature(f)"])

                altitud_max = max(altitud_max, altitud)
                velocidad_max = max(velocidad_max, velocidad)
                temperatura_max = max(temperatura_max, temp_f)

                dist_home = distancia_coord(coords_home[0], coords_home[1], lat, lon)

                if dist_home <= 20:  # ✅ ignorar puntos erróneos
                    distancia_max_origen = max(distancia_max_origen, dist_home)

                    if lat_prev is not None and lon_prev is not None:
                        dist_segmento = distancia_coord(lat_prev, lon_prev, lat, lon)
                        if dist_segmento <= 20:
                            distancia_total += dist_segmento

                    lat_prev, lon_prev = lat, lon

            except Exception:
                continue

        bateria_inicio = None
        bateria_fin = None
        try:
            valores_bateria = [float(f["battery_percent"]) for f in filas if f["battery_percent"]]
            if valores_bateria:
                bateria_inicio = valores_bateria[0]
                bateria_fin = valores_bateria[-1]
        except Exception:
            pass

        id_vuelo = os.path.splitext(os.path.basename(ruta_archivo))[0]
        directorio_salida = os.path.join("data/vuelos", id_vuelo)
        os.makedirs(directorio_salida, exist_ok=True)

        ruta_destino_csv = os.path.join(directorio_salida, "datos.csv")
        shutil.copyfile(ruta_archivo, ruta_destino_csv)

        with open(os.path.join(directorio_salida, "raw_data.json"), "w", encoding="utf-8") as f_json:
            json.dump(filas, f_json, ensure_ascii=False, indent=2)

        resumen = {
            "id": id_vuelo,
            "fecha": fecha_vuelo,
            "duracion_segundos": round(duracion_segundos, 1),
            "altitud_maxima_metros": round(altitud_max * 0.3048, 1),
            "distancia_maxima_km": round(distancia_max_origen, 3),
            "distancia_recorrida_km": round(distancia_total, 3),
            "temperatura_maxima_bateria_c": round(convertir_a_celsius(temperatura_max), 1),
            "velocidad_maxima_kmh": round(velocidad_max * 1.60934, 1)
        }

        if bateria_inicio is not None and bateria_fin is not None:
            resumen["bateria_inicio_porcentaje"] = round(bateria_inicio, 1)
            resumen["bateria_fin_porcentaje"] = round(bateria_fin, 1)

        return resumen

    except Exception as e:
        print(f"❌ Error procesando {ruta_archivo}: {e}")
        return None




