import os
import json
import shutil

CARPETA_VUELOS = os.path.join("data", "vuelos")

def vuelo_existente(vuelo_id):
    """Verifica si un vuelo ya existe"""
    ruta = os.path.join(CARPETA_VUELOS, vuelo_id, "resumen.json")
    return os.path.exists(ruta)

def guardar_resumen(vuelo_id, resumen):
    """Guarda el archivo resumen.json para un vuelo"""
    carpeta = os.path.join(CARPETA_VUELOS, vuelo_id)
    os.makedirs(carpeta, exist_ok=True)
    resumen_path = os.path.join(carpeta, "resumen.json")
    with open(resumen_path, "w", encoding="utf-8") as f:
        json.dump(resumen, f, indent=2, ensure_ascii=False)

def guardar_datos_csv(vuelo_id, path_original):
    """Copia el CSV original al folder del vuelo como datos.csv"""
    carpeta = os.path.join(CARPETA_VUELOS, vuelo_id)
    os.makedirs(carpeta, exist_ok=True)
    destino = os.path.join(carpeta, "datos.csv")
    shutil.copy(path_original, destino)

def listar_vuelos():
    """Lee todos los archivos resumen.json y devuelve los datos"""
    vuelos = []
    if not os.path.exists(CARPETA_VUELOS):
        return vuelos

    for vuelo_id in os.listdir(CARPETA_VUELOS):
        resumen_path = os.path.join(CARPETA_VUELOS, vuelo_id, "resumen.json")
        if os.path.exists(resumen_path):
            try:
                with open(resumen_path, "r", encoding="utf-8") as f:
                    vuelos.append(json.load(f))
            except Exception as e:
                print(f"❌ Error al leer {resumen_path}: {e}")
    return vuelos