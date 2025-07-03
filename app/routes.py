import os
import json
import csv
from flask import Blueprint, render_template, jsonify
from datetime import datetime, timezone

rutas = Blueprint("rutas", __name__)
DATA_PATH = os.path.join("data", "vuelos")

# SE HA ELIMINADO LA RUTA DUPLICADA @rutas.route("/")
# La lógica para la página de inicio ahora reside únicamente en main.py

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

        with open(datos_path, 'r', encoding='utf-8-sig') as f: # Usar utf-8-sig para manejar el BOM
            reader = csv.reader(f)
            encabezados = next(reader)
            # Limpieza robusta de encabezados
            encabezados = [h.strip().replace("\ufeff", "") for h in encabezados]

            try:
                # CORRECCIÓN: Usar la altitud relativa al despegue
                idx_alt = encabezados.index("height_above_takeoff(feet)")
                
                idx_tiempo = encabezados.index("time(millisecond)")
                idx_lat = encabezados.index("latitude")
                idx_lon = encabezados.index("longitude")
                idx_datetime = encabezados.index("datetime(utc)")
                idx_bateria = encabezados.index("battery_percent")
                idx_vel_h = encabezados.index("speed(mph)")
                idx_vel_v = None
                
                # Búsqueda más robusta de la columna de velocidad vertical
                for posible_nombre in ["zSpeed(mph)", " zSpeed(mph)", "vz(m/s)", "vertical_velocity(m/s)", "vertical_speed(m/s)"]:
                    if posible_nombre in encabezados:
                        idx_vel_v = encabezados.index(posible_nombre)
                        break

            except ValueError as e:
                print(f"❌ Error encontrando columnas: {e}")
                return jsonify({"error": f"Columna requerida no encontrada: {e}"}), 400

            for fila in reader:
                try:
                    # Usar la altitud relativa y convertirla a metros
                    alt_raw = fila[idx_alt].strip()
                    alt = float(alt_raw) * 0.3048 if alt_raw else 0.0

                    # El resto de las conversiones ya eran correctas
                    tiempo_ms = int(fila[idx_tiempo])
                    lat = float(fila[idx_lat])
                    lon = float(fila[idx_lon])
                    
                    bat_raw = fila[idx_bateria].strip()
                    bat = int(bat_raw) if bat_raw else 0

                    vel_h_raw = fila[idx_vel_h].strip()
                    # Convertir de mph a km/h
                    vel_h = float(vel_h_raw) * 1.60934 if vel_h_raw else 0.0

                    if idx_vel_v is not None:
                        vel_v_raw = fila[idx_vel_v].strip()
                        if vel_v_raw:
                            # DJI reporta Z-speed positiva hacia abajo, la invertimos
                            # y convertimos de mph a m/s
                            if "mph" in encabezados[idx_vel_v]:
                                vel_v = -float(vel_v_raw) * 0.44704 
                            else: # Asumir m/s
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
                    
                    # CORRECCIÓN: Usar la altitud relativa 'alt' que ya calculamos
                    puntos.append([lat, lon, alt])
                    tiempos.append(tiempo_ms)
                    baterias.append(bat)
                    velocidades_horizontales.append(vel_h)
                    velocidades_verticales.append(vel_v)

                except (ValueError, IndexError) as e:
                    print(f"⚠️ Error procesando fila: {fila} -> {e}")
                    continue

        if not puntos or not tiempos:
            return jsonify({"error": "Vuelo sin datos válidos"}), 400
        
        if fecha_inicio is None:
            # Esto puede ocurrir si el CSV está vacío o no tiene filas con fecha
            return jsonify({"error": "No se encontraron datos de fecha válidos"}), 400

        tiempos_rel = [(t - tiempos[0]) / 1000.0 for t in tiempos]

        return jsonify({
            "id": vuelo_id,
            "fecha_inicio": fecha_inicio,
            "coordenadas": [{"lat": p[0], "lon": p[1], "alt": p[2]} for p in puntos],
            "tiempos": tiempos_rel,
            "baterias": baterias,
            "velocidades_horizontal": velocidades_horizontales,
            # CORRECCIÓN: Clave JSON corregida a plural para que coincida con el JS
            "velocidades_vertical": velocidades_verticales,
            "resumen": resumen
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Error interno al procesar el vuelo"}), 500





