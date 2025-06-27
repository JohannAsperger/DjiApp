import os
import json
import shutil
from processor import procesar_archivo_csv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_PATH = os.path.join(BASE_DIR, "data", "logs")
VUELOS_PATH = os.path.join(BASE_DIR, "data", "vuelos")

def borrar_vuelos_existentes():
    if os.path.exists(VUELOS_PATH):
        shutil.rmtree(VUELOS_PATH)
        print("🗑️ Carpeta de vuelos eliminada.")
    os.makedirs(VUELOS_PATH, exist_ok=True)
    print("📁 Carpeta de vuelos recreada.")

def reprocesar_todos():
    borrar_vuelos_existentes()

    for nombre_archivo in os.listdir(LOGS_PATH):
        if not nombre_archivo.lower().endswith(".csv"):
            continue

        ruta_csv = os.path.join(LOGS_PATH, nombre_archivo)
        print(f"🔄 Procesando: {nombre_archivo}")

        resumen = procesar_archivo_csv(ruta_csv)
        if resumen is not None:
            id_vuelo = resumen["id"]
            ruta_salida = os.path.join(VUELOS_PATH, id_vuelo, "resumen.json")
            os.makedirs(os.path.dirname(ruta_salida), exist_ok=True)
            with open(ruta_salida, "w", encoding="utf-8") as f:
                json.dump(resumen, f, ensure_ascii=False, indent=2)
            print(f"✅ Vuelo {id_vuelo} procesado y guardado.")
        else:
            print(f"❌ Falló el procesamiento de {nombre_archivo}")

if __name__ == "__main__":
    reprocesar_todos()

