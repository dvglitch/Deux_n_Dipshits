from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from flask_socketio import SocketIO

from .routes.control import control_bp
from .routes.display import display_bp
from .routes.dm import dm_bp
from .routes.home import home_bp
from .routes.qr import qr_bp
from .routes.remote import remote_bp
from .routes.campaign import campaign_bp
from .database.factory import create_campaign_repository
from .database.repositories import RepositoryError
from .realtime import register_socket_events
from .timers import timer_loop


PACKAGE_ROOT = Path(__file__).resolve().parent
STATIC_ROOT = PACKAGE_ROOT / "static"
SOUNDS_ROOT = STATIC_ROOT / "sounds"
IMAGES_ROOT = STATIC_ROOT / "images"


def create_app(start_background_task=True):
    flask_app = Flask(
        __name__,
        template_folder=str(PACKAGE_ROOT / "templates"),
        static_folder=str(STATIC_ROOT),
    )
    socketio = SocketIO(flask_app, cors_allowed_origins="*", async_mode="threading")

    @flask_app.route("/static/sounds/<path:filename>")
    def serve_external_sounds(filename):
        return send_from_directory(SOUNDS_ROOT, filename)

    @flask_app.route("/static/images/<path:filename>")
    def serve_external_images(filename):
        return send_from_directory(IMAGES_ROOT, filename)

    flask_app.register_blueprint(control_bp)
    flask_app.register_blueprint(display_bp)
    flask_app.register_blueprint(dm_bp)
    flask_app.register_blueprint(home_bp)
    flask_app.register_blueprint(qr_bp)
    flask_app.register_blueprint(remote_bp)
    flask_app.register_blueprint(campaign_bp)

    register_socket_events(socketio)

    if start_background_task:
        socketio.start_background_task(timer_loop, socketio)

    @flask_app.route("/api/sounds")
    def list_sounds():
        if not SOUNDS_ROOT.exists():
            return jsonify([])
        files = [
            path.name
            for path in SOUNDS_ROOT.iterdir()
            if path.suffix.lower() in {".mp3", ".wav", ".ogg"}
        ]
        return jsonify(sorted(files))

    @flask_app.get("/api/persistence/health")
    def persistence_health():
        repository = None
        try:
            repository = create_campaign_repository()
            repository.load_collection("player_profiles")
            return jsonify({"database": "ok", "backend": type(repository).__name__})
        except Exception as error:
            flask_app.logger.exception("Persistence health check failed: %s", error)
            return jsonify({
                "database": "error",
                "error_type": type(error).__name__,
                "error_message": str(error)
            }), 500
        finally:
            if repository is not None:
                try:
                    repository.close()
                except Exception:
                    pass

    flask_app.extensions["socketio"] = socketio
    return flask_app, socketio


app, socketio = create_app(start_background_task=True)
