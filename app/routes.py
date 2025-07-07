import os
import json
import csv
from flask import Blueprint, render_template, jsonify
from datetime import datetime, timezone

rutas = Blueprint("rutas", __name__)
DATA_PATH = os.path.join("data", "vuelos")

@rutas.route("/upload_vuelo", methods=["POST"])
def upload_vuelo():
    """
    Permite subir uno o varios archivos CSV de vuelo desde el frontend.
    Guarda cada archivo en el directorio correspondiente y procesa cada vuelo.
    """
    from flask import request
    import shutil
    files = request.files.getlist('files')
    if not files or all(not f.filename.lower().endswith('.csv') for f in files):
        return jsonify({"error": "Debes seleccionar al menos un archivo CSV válido."}), 400

    resultados = []
    from app.processor import procesar_archivo_csv
    for file in files:
        if not file or not file.filename.lower().endswith('.csv'):
            resultados.append({"filename": file.filename if file else '', "success": False, "error": "Archivo no es CSV."})
            continue
        base_name = os.path.splitext(file.filename)[0]
        # Validar si ya existe un vuelo con el mismo nombre base
        existe_duplicado = False
        for existing in os.listdir(DATA_PATH):
            if existing.startswith(base_name + "_"):
                existe_duplicado = True
                break
        if existe_duplicado:
            resultados.append({"filename": file.filename, "success": False, "error": "Ya existe un vuelo con este nombre de archivo."})
            continue
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        vuelo_id = f"{base_name}_{timestamp}"
        vuelo_path = os.path.join(DATA_PATH, vuelo_id)
        os.makedirs(vuelo_path, exist_ok=True)
        csv_path = os.path.join(vuelo_path, 'datos.csv')
        file.save(csv_path)
        try:
            # Validar encabezados mínimos
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.reader(f)
                encabezados = next(reader)
                encabezados = [h.strip().replace("\ufeff", "") for h in encabezados]
                required = ["height_above_takeoff(feet)", "time(millisecond)", "latitude", "longitude", "datetime(utc)", "battery_percent", "speed(mph)"]
                for col in required:
                    if col not in encabezados:
                        shutil.rmtree(vuelo_path)
                        resultados.append({"filename": file.filename, "success": False, "error": f"Falta columna: {col}"})
                        break
                else:
                    # Procesar CSV y guardar resumen real
                    resumen = procesar_archivo_csv(csv_path)
                    if resumen is None:
                        shutil.rmtree(vuelo_path)
                        resultados.append({"filename": file.filename, "success": False, "error": "Error procesando el archivo CSV."})
                        continue
                    with open(os.path.join(vuelo_path, 'resumen.json'), 'w', encoding='utf-8') as f2:
                        json.dump(resumen, f2, ensure_ascii=False, indent=2)
                    resultados.append({"filename": file.filename, "success": True, "vuelo_id": vuelo_id})
        except Exception as e:
            shutil.rmtree(vuelo_path)
            resultados.append({"filename": file.filename, "success": False, "error": f"Error procesando: {e}"})
    return jsonify(resultados), 200

@rutas.route("/vuelo/<vuelo_id>")
def obtener_vuelo(vuelo_id):
    print(f"🔍 Solicitando vuelo: {vuelo_id}")
    
    resumen_path = os.path.join(DATA_PATH, vuelo_id, "resumen.json")
    datos_path = os.path.join(DATA_PATH, vuelo_id, "datos.csv")

    if not os.path.exists(resumen_path) or not os.path.exists(datos_path):
        print(f"❌ Archivos no encontrados para vuelo {vuelo_id}")
        return jsonify({"error": "Vuelo no encontrado"}), 404

    try:
        with open(resumen_path, 'r', encoding='utf-8') as f:
            resumen = json.load(f)
        print(f"✅ Resumen cargado para {vuelo_id}")

        puntos = []
        tiempos = []
        baterias = []
        velocidades_horizontales = []
        velocidades_verticales = []
        fecha_inicio = None

        with open(datos_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            encabezados = next(reader)
            encabezados = [h.strip().replace("\ufeff", "") for h in encabezados]

            try:
                idx_alt = encabezados.index("height_above_takeoff(feet)")
                idx_tiempo = encabezados.index("time(millisecond)")
                idx_lat = encabezados.index("latitude")
                idx_lon = encabezados.index("longitude")
                idx_datetime = encabezados.index("datetime(utc)")
                idx_bateria = encabezados.index("battery_percent")
                idx_vel_h = encabezados.index("speed(mph)")
                idx_vel_v = None
                for posible_nombre in ["zSpeed(mph)", " zSpeed(mph)", "vz(m/s)", "vertical_velocity(m/s)", "vertical_speed(m/s)"]:
                    if posible_nombre in encabezados:
                        idx_vel_v = encabezados.index(posible_nombre)
                        break
            except ValueError as e:
                print(f"❌ Error encontrando columnas: {e}")
                return jsonify({"error": f"Columna requerida no encontrada: {e}"}), 400

            try:
                idx_is_video = encabezados.index("isVideo")
                idx_is_photo = encabezados.index("isPhoto")
            except ValueError:
                idx_is_video = idx_is_photo = None

            grabando_video = []
            tomando_foto = []

            for fila in reader:
                try:
                    alt_raw = fila[idx_alt].strip()
                    alt = float(alt_raw) * 0.3048 if alt_raw else 0.0
                    tiempo_ms = int(fila[idx_tiempo])
                    lat = float(fila[idx_lat])
                    lon = float(fila[idx_lon])
                    bat_raw = fila[idx_bateria].strip()
                    bat = int(bat_raw) if bat_raw else 0
                    vel_h_raw = fila[idx_vel_h].strip()
                    vel_h = float(vel_h_raw) * 1.60934 if vel_h_raw else 0.0

                    if idx_vel_v is not None:
                        vel_v_raw = fila[idx_vel_v].strip()
                        if vel_v_raw:
                            if "mph" in encabezados[idx_vel_v]:
                                vel_v = -float(vel_v_raw) * 0.44704 
                            else:
                                vel_v = -float(vel_v_raw)
                        else:
                            vel_v = 0.0
                    else:
                        vel_v = 0.0

                    if lat < -90 or lat > 90 or lon < -180 or lon > 180 or (lat == 0.0 and lon == 0.0):
                        continue

                    if fecha_inicio is None:
                        fecha_str = fila[idx_datetime]
                        dt = datetime.strptime(fecha_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                        fecha_inicio = dt.isoformat().replace("+00:00", "Z")
                    
                    puntos.append([lat, lon, alt])
                    tiempos.append(tiempo_ms)
                    baterias.append(bat)
                    velocidades_horizontales.append(vel_h)
                    velocidades_verticales.append(vel_v)

                    grabando_video.append(bool(int(fila[idx_is_video]))) if idx_is_video is not None else grabando_video.append(False)
                    tomando_foto.append(bool(int(fila[idx_is_photo]))) if idx_is_photo is not None else tomando_foto.append(False)

                except (ValueError, IndexError) as e:
                    print(f"⚠️ Error procesando fila: {fila} -> {e}")
                    continue

        if not puntos or not tiempos:
            return jsonify({"error": "Vuelo sin datos válidos"}), 400
        
        if fecha_inicio is None:
            return jsonify({"error": "No se encontraron datos de fecha válidos"}), 400

        tiempos_rel = [(t - tiempos[0]) / 1000.0 for t in tiempos]

        return jsonify({
            "id": vuelo_id,
            "fecha_inicio": fecha_inicio,
            "coordenadas": [{"lat": p[0], "lon": p[1], "alt": p[2]} for p in puntos],
            "tiempos": tiempos_rel,
            "baterias": baterias,
            "velocidades_horizontal": velocidades_horizontales,
            "velocidades_vertical": velocidades_verticales,
            "grabando_video": grabando_video,
            "tomando_foto": tomando_foto,
            "resumen": resumen
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Error interno al procesar el vuelo"}), 500





