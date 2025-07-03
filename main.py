import os
import json
from flask import Flask, render_template
from app.routes import rutas
from datetime import datetime

# --- Constantes ---
DATA_PATH = os.path.join("data", "vuelos")
DEFAULT_DATETIME = datetime(1970, 1, 1) # Una fecha por defecto para vuelos sin fecha

def create_app():
    """Crea y configura la instancia de la aplicación Flask."""
    app = Flask(__name__)
    app.register_blueprint(rutas)

    def calcular_resumen_general():
        """
        Calcula y agrega las estadísticas de todos los vuelos.

        Returns:
            dict: Un diccionario con el resumen de datos agregados.
        """
        resumen = {
            "cantidad_vuelos": 0,
            "tiempo_total_vuelo_min": 0.0,
            "distancia_total_km": 0.0,
            "distancia_maxima_km": 0.0,
            "distancia_recorrida_max_km": 0.0,
            "altitud_maxima_m": 0.0,
            "temperatura_maxima_c": 0.0,
            "velocidad_maxima_kmh": 0.0,
        }

        try:
            for entry in os.scandir(DATA_PATH):
                if not entry.is_dir():
                    continue

                resumen_path = os.path.join(entry.path, "resumen.json")
                if os.path.exists(resumen_path):
                    try:
                        with open(resumen_path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            resumen["cantidad_vuelos"] += 1
                            resumen["tiempo_total_vuelo_min"] += data.get("duracion_segundos", 0) / 60
                            resumen["distancia_total_km"] += data.get("distancia_recorrida_km", 0)
                            resumen["distancia_maxima_km"] = max(resumen["distancia_maxima_km"], data.get("distancia_maxima_km", 0))
                            resumen["distancia_recorrida_max_km"] = max(resumen["distancia_recorrida_max_km"], data.get("distancia_recorrida_km", 0))
                            resumen["altitud_maxima_m"] = max(resumen["altitud_maxima_m"], data.get("altitud_maxima_metros", 0))
                            resumen["temperatura_maxima_c"] = max(resumen["temperatura_maxima_c"], data.get("temperatura_maxima_bateria_c", 0))
                            resumen["velocidad_maxima_kmh"] = max(resumen["velocidad_maxima_kmh"], data.get("velocidad_maxima_kmh", 0))
                    except (json.JSONDecodeError, KeyError, TypeError) as e:
                        print(f"Advertencia: No se pudo procesar el resumen de {entry.name}: {e}")
                        continue
        except FileNotFoundError:
            print(f"Advertencia: El directorio de datos '{DATA_PATH}' no fue encontrado.")
            return resumen

        return {
            "cantidad_vuelos": resumen["cantidad_vuelos"],
            "duracion_total_min": round(resumen["tiempo_total_vuelo_min"], 1),
            "distancia_total_km": round(resumen["distancia_total_km"], 2),
            "distancia_maxima_km": round(resumen["distancia_maxima_km"], 2),
            "distancia_recorrida_max_km": round(resumen["distancia_recorrida_max_km"], 2),
            "altitud_maxima_metros": round(resumen["altitud_maxima_m"], 1),
            "temperatura_maxima_bateria_c": round(resumen["temperatura_maxima_c"], 1),
            "velocidad_maxima_kmh": round(resumen["velocidad_maxima_kmh"], 1)
        }

    def cargar_lista_vuelos():
        """
        Carga la lista de todos los vuelos disponibles desde el directorio de datos.

        Returns:
            list: Una lista de diccionarios, cada uno representando un vuelo.
        """
        vuelos = []
        try:
            for entry in os.scandir(DATA_PATH):
                if not entry.is_dir():
                    continue
                
                resumen_path = os.path.join(entry.path, "resumen.json")
                if os.path.exists(resumen_path):
                    try:
                        with open(resumen_path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            
                            # --- BLOQUE CORREGIDO ---
                            fecha_str = data.get("fecha", "").strip() # Obtenemos la fecha y eliminamos espacios
                            dt_obj = DEFAULT_DATETIME # Asignamos una fecha por defecto

                            if fecha_str: # Solo intentamos convertir si la cadena no está vacía
                                try:
                                    dt_obj = datetime.strptime(fecha_str, "%Y-%m-%d %H:%M:%S")
                                except ValueError:
                                    try:
                                        dt_obj = datetime.strptime(fecha_str, "%Y-%m-%d")
                                    except ValueError:
                                        print(f"Advertencia: Formato de fecha no reconocido para '{fecha_str}' en vuelo {entry.name}. Usando fecha por defecto.")
                                        # dt_obj ya tiene el valor por defecto
                            # -------------------------
                            
                            vuelos.append({
                                "id": entry.name,
                                "fecha_dt": dt_obj,
                                "fecha_mostrar": dt_obj.strftime("%Y-%m-%d %H:%M") if fecha_str else "Fecha desconocida",
                                "duracion_segundos": data.get("duracion_segundos", 0)
                            })
                    except (json.JSONDecodeError, KeyError, TypeError) as e:
                        print(f"Advertencia: No se pudo cargar el vuelo {entry.name}: {e}")
                        continue
        except FileNotFoundError:
            print(f"Advertencia: El directorio de datos '{DATA_PATH}' no fue encontrado.")
        
        vuelos.sort(key=lambda x: x["fecha_dt"], reverse=True)
        return vuelos

    @app.route("/")
    def index():
        """Renderiza la página principal con el resumen y la lista de vuelos."""
        resumen_general = calcular_resumen_general()
        lista_vuelos = cargar_lista_vuelos()
        return render_template("index.html", resumen_general=resumen_general, vuelos=lista_vuelos)

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=3000)





