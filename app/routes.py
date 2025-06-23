import os
import csv
import json
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
            # Cargar el contenido del JSON, no solo la ruta
            try:
                with open(resumen_path, 'r', encoding='utf-8') as f:
                    resumen_data = json.load(f)
                vuelos.append({
                    "id": vuelo_id, 
                    "resumen": resumen_data
                })
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error cargando resumen para {vuelo_id}: {e}")
                continue
    
    # Ordenar vuelos por fecha (más recientes primero)
    vuelos.sort(key=lambda x: x["resumen"].get("fecha_vuelo", ""), reverse=True)
    
    resumen_general = calcular_resumen_general()
    return render_template("index.html",
                           resumen_general=resumen_general,
                           vuelos=vuelos)

@rutas.route("/vuelo/<vuelo_id>")
def obtener_vuelo(vuelo_id):
    """
    Endpoint para obtener coordenadas de trayectoria de vuelo procesadas
    para visualización en CesiumJS
    """
    ruta_csv = os.path.join(DATA_PATH, vuelo_id, "datos.csv")
    puntos = []
    
    if not os.path.isfile(ruta_csv):
        return jsonify({"error": "Archivo de datos no encontrado"}), 404
    
    try:
        with open(ruta_csv, newline='', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)  # Saltar encabezado confirmado en el CSV
            
            for row_num, fila in enumerate(reader, start=2):
                try:
                    # Validar que la fila tenga suficientes columnas
                    if len(fila) < 48:
                        continue
                    
                    # Extraer coordenadas según formato DJI confirmado
                    lat = float(fila[2])    # latitude
                    lon = float(fila[3])    # longitude  
                    alt_feet = float(fila[47])  # altitude(feet) - última columna
                    
                    # Convertir altitud de pies a metros para CesiumJS
                    alt_meters = alt_feet * 0.3048
                    
                    # Validar coordenadas geográficas válidas
                    if (-90 <= lat <= 90 and -180 <= lon <= 180 and 
                        lat != 0 and lon != 0):
                        puntos.append({
                            "lat": lat, 
                            "lon": lon, 
                            "alt": alt_meters
                        })
                        
                except (ValueError, IndexError):
                    # Log silencioso de filas malformadas para debugging
                    continue
    
    except IOError as e:
        return jsonify({"error": f"Error leyendo archivo: {str(e)}"}), 500
    
    if not puntos:
        return jsonify({"error": "No se encontraron coordenadas válidas"}), 404
    
    # Respuesta estructurada con metadatos útiles
    return jsonify({
        "puntos": puntos,
        "total_puntos": len(puntos),
        "vuelo_id": vuelo_id
    })

@rutas.route("/vuelo/<vuelo_id>/detalle")
def detalle_vuelo(vuelo_id):
    """Ruta para mostrar la página de detalle del vuelo con el mapa"""
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
