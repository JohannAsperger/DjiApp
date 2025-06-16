import os
import time
import shutil
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from app.processor import procesar_archivo_csv
from app.datastore import guardar_resumen, vuelo_existente, guardar_datos_csv

CARPETA_LOGS = "data/logs"

class Handler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory or not event.src_path.endswith(".csv"):
            return
        procesar(event.src_path)

def procesar(path):
    print(f"📥 Procesando archivo: {path}")
    resumen = procesar_archivo_csv(path)
    if resumen:
        vuelo_id = resumen["id"]
        if vuelo_existente(vuelo_id):
            print(f"⚠️ Vuelo duplicado ignorado: {vuelo_id}")
            return

        # Crear carpeta y guardar archivos
        guardar_resumen(vuelo_id, resumen)
        guardar_datos_csv(vuelo_id, path)
        print(f"✅ Vuelo procesado y guardado: {vuelo_id}")

def iniciar_watcher(directorio=CARPETA_LOGS):
    print(f"👁 Observando carpeta: {directorio}")
    os.makedirs(directorio, exist_ok=True)

    # Procesar archivos existentes al iniciar
    for archivo in os.listdir(directorio):
        if archivo.endswith(".csv"):
            procesar(os.path.join(directorio, archivo))

    event_handler = Handler()
    observer = Observer()
    observer.schedule(event_handler, directorio, recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()