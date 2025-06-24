import os
import csv
import json
from datetime import datetime, timezone
from flask import Blueprint, render_template, jsonify
from .utils import calcular_resumen_general

rutas = Blueprint("routes", __name__)
DATA_PATH = "data/vuelos"

@rutas.route("/")
def index():
    vuelos = []
    for vuelo_id in os.listdir(DATA_PATH):
        resumen_path = os.path.join(DATA_PATH, vuelo_id, "resumen.json")
        if os.path.isfile(resumen_path):
            try:
                with open(resumen_path, 'r', encoding='utf-8') as f:
                    resumen_data = json.load(f)
                vuelos.append({"id": vuelo_id, "resumen": resumen_data})
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error cargando resumen para {vuelo_id}: {e}")
                continue

    vuelos.sort(key=lambda x: x["resumen"].get("fecha_vuelo", ""), reverse=True)
    resumen_general = calcular_resumen_general()

    return render_template("index.html",
                           resumen_general=resumen_general,
                           vuelos=vuelos)


@rutas.route("/vuelo/<vuelo_id>")
def obtener_vuelo(vuelo_id):
    ruta_csv = os.path.join(DATA_PATH, vuelo_id, "datos.csv")
    puntos = []
    tiempos_ms = []
    inicio_datetime = None
    inicio_timestamp_ms = None

    if not os.path.isfile(ruta_csv):
        return jsonify({"error": "Archivo de datos no encontrado"}), 404

    try:
        with open(ruta_csv, newline='', encoding='utf-8') as f:
            reader = csv.reader(f)
            primera_fila = next(reader, None)

            if primera_fila and len(primera_fila) > 3 and primera_fila[2].strip().lower() == "latitude":
                pass
            else:
                reader = [primera_fila] + list(reader)

            for fila in reader:
                try:
                    if len(fila) < 49:
                        continue

                    timestamp = int(fila[0])  # time(millisecond)
                    lat = float(fila[2])
                    lon = float(fila[3])
                    alt_feet = float(fila[47])
                    alt_metros = alt_feet * 0.3048

                    if (-90 <= lat <= 90 and -180 <= lon <= 180 and lat != 0 and lon != 0):
                        puntos.append({
                            "lat": lat,
                            "lon": lon,
                            "alt": alt_metros
                        })

                        if inicio_datetime is None:
                            try:
                                inicio_datetime = datetime.strptime(
                                    fila[1], "%Y-%m-%d %H:%M:%S"
                                ).replace(tzinfo=timezone.utc)
                                inicio_timestamp_ms = timestamp
                            except ValueError:
                                continue

                        delta_ms = timestamp - inicio_timestamp_ms
                        tiempos_ms.append(delta_ms)

                except (ValueError, IndexError):
                    continue

    except IOError as e:
        return jsonify({"error": f"Error leyendo archivo: {str(e)}"}), 500

    if not puntos or inicio_datetime is None:
        return jsonify({"error": "No se encontraron coordenadas válidas"}), 404

    fecha_inicio_iso = inicio_datetime.isoformat().replace("+00:00", "Z")

    return jsonify({
        "puntos": puntos,
        "tiempos": tiempos_ms,
        "fecha_inicio": fecha_inicio_iso,
        "total_puntos": len(puntos),
        "vuelo_id": vuelo_id
    })


@rutas.route("/vuelo/<vuelo_id>/detalle")
def detalle_vuelo(vuelo_id):
    resumen_path = os.path.join(DATA_PATH, vuelo_id, "resumen.json")

    if not os.path.isfile(resumen_path):
        return "Vuelo no encontrado", 404

    try:
        with open(resumen_path, 'r', encoding='utf-8') as f:
            resumen = json.load(f)

        return render_template("flight_detail.html",
                               vuelo_id=vuelo_id,
                               resumen=resumen)
    except (json.JSONDecodeError, IOError):
        return "Error cargando datos del vuelo", 500



