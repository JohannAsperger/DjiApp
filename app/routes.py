import os
import json
import csv
from flask import Blueprint, render_template, jsonify
from datetime import datetime, timezone

rutas = Blueprint("rutas", __name__)
DATA_PATH = os.path.join("data", "vuelos")

@rutas.route("/")
def index():
    vuelos = []

    for vuelo_id in os.listdir(DATA_PATH):
        resumen_path = os.path.join(DATA_PATH, vuelo_id, "resumen.json")
        if os.path.exists(resumen_path):
            with open(resumen_path, "r", encoding="utf-8") as f:
                resumen = json.load(f)
                resumen["id"] = vuelo_id

                try:
                    fecha_dt = datetime.strptime(resumen["fecha"], "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    try:
                        fecha_dt = datetime.strptime(resumen["fecha"], "%Y-%m-%d")
                    except:
                        continue

                resumen["fecha_dt"] = fecha_dt
                vuelos.append(resumen)

    vuelos.sort(key=lambda x: x["fecha_dt"], reverse=True)

    for v in vuelos:
        v["fecha_mostrar"] = v["fecha_dt"].strftime("%Y-%m-%d %H:%M")

    cantidad_vuelos = len(vuelos)
    duracion_total = sum(v.get("duracion_segundos", 0) for v in vuelos)
    distancia_total = sum(v.get("distancia_recorrida_km", 0) for v in vuelos)
    distancia_maxima = max((v.get("distancia_maxima_km", 0) for v in vuelos), default=0)
    altitud_maxima = max((v.get("altitud_maxima_metros", 0) for v in vuelos), default=0)
    temperatura_maxima = max((v.get("temperatura_maxima_bateria_c", 0) for v in vuelos), default=0)
    velocidad_maxima = max((v.get("velocidad_maxima_kmh", 0) for v in vuelos), default=0)

    resumen_general = {
        "cantidad_vuelos": cantidad_vuelos,
        "duracion_total_min": round(duracion_total / 60, 1),
        "distancia_total_km": round(distancia_total, 2),
        "distancia_maxima_km": round(distancia_maxima, 2),
        "altitud_maxima_metros": round(altitud_maxima, 2),
        "temperatura_maxima_bateria_c": round(temperatura_maxima, 1),
        "velocidad_maxima_kmh": round(velocidad_maxima, 1),
    }

    return render_template("index.html", vuelos=vuelos, resumen_general=resumen_general)

@rutas.route("/vuelo/<vuelo_id>")
def obtener_vuelo(vuelo_id):
    resumen_path = os.path.join(DATA_PATH, vuelo_id, "resumen.json")
    datos_path = os.path.join(DATA_PATH, vuelo_id, "datos.csv")

    if not os.path.exists(resumen_path) or not os.path.exists(datos_path):
        return jsonify({"error": "Vuelo no encontrado"}), 404

    try:
        with open(resumen_path, 'r', encoding='utf-8') as f:
            resumen = json.load(f)

        puntos = []
        tiempos = []
        fecha_inicio = None

        with open(datos_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            encabezados = next(reader)
            idx_datetime = encabezados.index("datetime(utc)")

            for fila in reader:
                try:
                    tiempo_ms = int(fila[0])
                    lat = float(fila[2])
                    lon = float(fila[3])
                    alt = float(fila[4]) * 0.3048  # ✅ Convertir pies a metros para Cesium

                    if fecha_inicio is None:
                        fecha_str = fila[idx_datetime]
                        dt = datetime.strptime(fecha_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                        fecha_inicio = dt.isoformat().replace("+00:00", "Z")

                    puntos.append([lat, lon, alt])
                    tiempos.append(tiempo_ms)
                except (ValueError, IndexError):
                    continue

        if not puntos or not tiempos or fecha_inicio is None:
            return jsonify({"error": "No se encontraron datos válidos"}), 400

        tiempos_rel = [(t - tiempos[0]) / 1000.0 for t in tiempos]

        return jsonify({
            "id": vuelo_id,
            "fecha_inicio": fecha_inicio,
            "coordenadas": puntos,
            "tiempos": tiempos_rel,
            "resumen": resumen
        })

    except Exception as e:
        print(f"❌ Error al procesar vuelo {vuelo_id}: {e}")
        return jsonify({"error": "Error interno al procesar el vuelo"}), 500
















