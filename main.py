from flask import Flask
from app.routes import rutas
from app.watcher import iniciar_watcher
import threading
import os

# 👇 Esto le dice a Flask dónde está la carpeta 'static'
app = Flask(__name__, static_folder="app/static")

app.register_blueprint(rutas)

# Arrancar el watcher en un hilo separado
threading.Thread(target=iniciar_watcher, args=("data/logs", ),
                 daemon=True).start()

# Ejecutar la app con configuración compatible con Replit
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port, debug=True)
