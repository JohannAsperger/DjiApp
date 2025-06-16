import os
import json
from flask import Blueprint, render_template

rutas = Blueprint("rutas", __name__)
CARPETA_VUELOS = os.path.join("data", "vuelos")

@rutas.route("/")
def index():
    vuelos = []
    estadisticas = {
        "cantidad_vuelos": 0,
        "tiempo_total_min": 0,
        "kilometraje_total": 0,
        "distancia_max_origen": 0,
        "distancia_vuelo_mas_largo": 0,
        "altitud_maxima": 0,
        "temperatura_max_bateria": 0,
        "velocidad_maxima": 0
    }

    if not os.path.exists(CARPETA_VUELOS):
        return render_template("index.html", vuelos=[], resumen=estadisticas)

    for vuelo_id in os.listdir(CARPETA_VUELOS):
        ruta_resumen = os.path.join(CARPETA_VUELOS, vuelo_id, "resumen.json")
        if not os.path.exists(ruta_resumen):
            continue

        try:
            with open(ruta_resumen, "r", encoding="utf-8") as f:
                data = json.load(f)

                vuelos.append({
                    "fecha": data.get("fecha", "1970-01-01"),
                    "duracion_minutos": round(data.get("duracion_segundos", 0) / 60, 1),
                    "altitud_maxima_metros": round(data.get("altitud_maxima_metros", 0), 1),
                    "distancia_maxima_km": round(data.get("distancia_maxima_km", 0), 2)
                })

                # Acumular estadísticas
                estadisticas["cantidad_vuelos"] += 1
                estadisticas["tiempo_total_min"] += data.get("duracion_segundos", 0) / 60
                estadisticas["kilometraje_total"] += data.get("distancia_recorrida_km", 0)
                estadisticas["distancia_max_origen"] = max(estadisticas["distancia_max_origen"], data.get("distancia_maxima_km", 0))
                estadisticas["distancia_vuelo_mas_largo"] = max(estadisticas["distancia_vuelo_mas_largo"], data.get("distancia_recorrida_km", 0))
                estadisticas["altitud_maxima"] = max(estadisticas["altitud_maxima"], data.get("altitud_maxima_metros", 0))
                estadisticas["temperatura_max_bateria"] = max(estadisticas["temperatura_max_bateria"], data.get("temperatura_maxima_bateria_c", 0))
                estadisticas["velocidad_maxima"] = max(estadisticas["velocidad_maxima"], data.get("velocidad_maxima_kmh", 0))

        except Exception as e:
            print(f"❌ Error al procesar {ruta_resumen}: {e}")

    # Redondeos seguros
    for key in estadisticas:
        if isinstance(estadisticas[key], (int, float)):
            estadisticas[key] = round(estadisticas[key], 2)

    return render_template("index.html", vuelos=vuelos, resumen=estadisticas)