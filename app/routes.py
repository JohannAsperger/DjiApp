
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
        v["fecha_mostrar"] = v["fecha_dt"].strftime("%d/%m/%Y %H:%M")

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

        with open(datos_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            encabezados = next(reader)
            print(f"📋 Encabezados encontrados: {encabezados}")

            # Buscar índices de las columnas necesarias
            try:
                idx_tiempo = encabezados.index("time(millisecond)")
                idx_lat = encabezados.index("latitude")
                idx_lon = encabezados.index("longitude")
                idx_alt = encabezados.index("altitude_above_seaLevel(feet)")
                idx_datetime = encabezados.index("datetime(utc)")
                idx_bateria = encabezados.index("battery_percent")
                idx_vel_h = encabezados.index("speed(mph)")
                # Buscar velocidad vertical - puede tener diferentes nombres
                idx_vel_v = None
                for posible_nombre in [" zSpeed(mph)", "zSpeed(mph)", "vz(m/s)", "vertical_velocity(m/s)"]:
                    try:
                        idx_vel_v = encabezados.index(posible_nombre)
                        print(f"✅ Encontrada velocidad vertical como: {posible_nombre}")
                        break
                    except ValueError:
                        continue
                
                if idx_vel_v is None:
                    print("⚠️ No se encontró columna de velocidad vertical, usando 0")
                    
            except ValueError as e:
                print(f"❌ Error encontrando columnas: {e}")
                return jsonify({"error": f"Columna requerida no encontrada: {e}"}), 400

            filas_procesadas = 0
            coordenadas_validas = 0
            
            for fila in reader:
                try:
                    tiempo_ms = int(fila[idx_tiempo])
                    lat = float(fila[idx_lat])
                    lon = float(fila[idx_lon])
                    alt = float(fila[idx_alt]) * 0.3048  # pies a metros
                    bat = int(fila[idx_bateria])
                    vel_h = float(fila[idx_vel_h]) * 1.60934  # mph → km/h
                    
                    # Manejar velocidad vertical
                    if idx_vel_v is not None:
                        vel_v_raw = fila[idx_vel_v]
                        if "zSpeed(mph)" in encabezados[idx_vel_v]:
                            # Convertir de mph a m/s e invertir signo (positivo = subiendo)
                            vel_v = -float(vel_v_raw) * 0.44704
                        else:
                            # Invertir signo (positivo = subiendo)
                            vel_v = -float(vel_v_raw)
                    else:
                        vel_v = 0.0

                    filas_procesadas += 1

                    # Validar rango de coordenadas GPS válidas
                    if lat < -90 or lat > 90 or lon < -180 or lon > 180:
                        continue

                    # Verificar si son coordenadas válidas (no exactamente 0,0)
                    if lat != 0.0 or lon != 0.0:
                        coordenadas_validas += 1

                    if fecha_inicio is None:
                        fecha_str = fila[idx_datetime]
                        dt = datetime.strptime(fecha_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                        fecha_inicio = dt.isoformat().replace("+00:00", "Z")

                    puntos.append([lat, lon, alt])
                    tiempos.append(tiempo_ms)
                    baterias.append(bat)
                    velocidades_horizontales.append(vel_h)
                    velocidades_verticales.append(vel_v)
                    
                except (ValueError, IndexError) as e:
                    print(f"⚠️ Error procesando fila: {e}")
                    continue

        print(f"📊 Estadísticas de procesamiento:")
        print(f"   - Filas procesadas: {filas_procesadas}")
        print(f"   - Puntos totales: {len(puntos)}")
        print(f"   - Coordenadas válidas (no 0,0): {coordenadas_validas}")

        if not puntos or not tiempos:
            print(f"❌ No se encontraron datos válidos para el vuelo {vuelo_id}")
            return jsonify({
                "error": "Vuelo sin datos válidos", 
                "detalle": "Este vuelo no tiene datos válidos.",
                "resumen": resumen,
                "id": vuelo_id
            }), 200
            
        # Verificar si tenemos coordenadas GPS válidas (no todas en 0,0)
        if coordenadas_validas == 0:
            print(f"⚠️ Vuelo {vuelo_id} sin coordenadas GPS válidas")
            return jsonify({
                "error": "Vuelo sin coordenadas GPS válidas", 
                "detalle": "Este vuelo no tiene datos de GPS válidos. Es posible que el vuelo se haya realizado en interiores o sin señal GPS.",
                "resumen": resumen,
                "id": vuelo_id,
                "coordenadas": [],
                "tiempos": [(t - tiempos[0]) / 1000.0 for t in tiempos] if tiempos else [],
                "baterias": baterias,
                "velocidades_horizontal": velocidades_horizontales,
                "velocidades_vertical": velocidades_verticales
            }), 200
        
        if fecha_inicio is None:
            print(f"❌ No se encontraron datos de fecha válidos para {vuelo_id}")
            return jsonify({"error": "No se encontraron datos de fecha válidos"}), 400

        tiempos_rel = [(t - tiempos[0]) / 1000.0 for t in tiempos]
        
        print(f"✅ Vuelo {vuelo_id} procesado exitosamente:")
        print(f"   - {len(puntos)} coordenadas")
        print(f"   - {coordenadas_validas} coordenadas GPS válidas")
        print(f"   - Primer punto: {puntos[0] if puntos else 'N/A'}")

        return jsonify({
            "id": vuelo_id,
            "fecha_inicio": fecha_inicio,
            "coordenadas": puntos,
            "tiempos": tiempos_rel,
            "baterias": baterias,
            "velocidades_horizontal": velocidades_horizontales,
            "velocidades_vertical": velocidades_verticales,
            "resumen": resumen
        })

    except Exception as e:
        print(f"❌ Error al procesar vuelo {vuelo_id}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Error interno al procesar el vuelo"}), 500
