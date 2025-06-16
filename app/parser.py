import csv
import os
from datetime import datetime

def procesar_archivo_csv(path):
    print(f"📥 Procesando archivo: {path}")

    with open(path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        datos = []
        for fila in reader:
            fila_limpia = {}
            for k, v in fila.items():
                try:
                    k_clean = str(k).strip().replace("\n", " ").replace('"', "'")
                    v_clean = str(v).strip().replace("\n", " ").replace('"', "'")
                    fila_limpia[k_clean] = v_clean
                except:
                    continue
            datos.append(fila_limpia)

    if not datos:
        raise ValueError("CSV vacío")

    nombre_archivo = os.path.basename(path)

    try:
        timestamp_ms = int(datos[0].get("time(millisecond)", "0"))
        fecha = datetime.fromtimestamp(timestamp_ms / 1000.0).strftime("%Y-%m-%d")
    except:
        fecha = "1970-01-01"

    try:
        duracion = (int(datos[-1].get("time(millisecond)", "0")) - int(datos[0].get("time(millisecond)", "0"))) / 1000
    except:
        duracion = 0

    try:
        altitudes = [float(f["height_above_takeoff(feet)"]) for f in datos if f.get("height_above_takeoff(feet)")]
        altitud_maxima = max(altitudes) * 0.3048 if altitudes else 0
    except:
        altitud_maxima = 0

    try:
        distancias = [float(f["distance_from_home(feet)"]) for f in datos if f.get("distance_from_home(feet)")]
        distancia_maxima = max(distancias) * 0.3048 if distancias else 0
    except:
        distancia_maxima = 0

    return {
        "id": nombre_archivo,
        "fecha": fecha,
        "duracion_segundos": duracion,
        "altitud_maxima_metros": round(altitud_maxima, 1),
        "distancia_maxima_metros": round(distancia_maxima, 1),
        "datos_csv": datos
    }