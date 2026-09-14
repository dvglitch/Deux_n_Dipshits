"""API routes for Campaign Maintenance (players, spells, maps, objectives, recaps)."""
import logging
from flask import Blueprint, current_app, jsonify, request

from ..database.factory import create_campaign_repository
from ..database.repositories import RepositoryError

logger = logging.getLogger(__name__)

campaign_bp = Blueprint("campaign", __name__, url_prefix="/api/campaign")

VALID_COLLECTIONS = {"player_profiles", "spells", "world_maps", "objectives", "recaps"}


def _remove_legacy_portrait_fields(collection, records):
    if collection != "player_profiles":
        return records
    return [
        {key: value for key, value in record.items() if key != "portrait_url"}
        for record in records
    ]


def _sync_live_player_profiles(records):
    """Apply saved profile configuration to the running session and notify clients."""
    if records is None:
        return

    from .. import timers

    timers.sync_with_campaign_profiles(records, clear_enemies=False, restore_progress=False)
    socketio = current_app.extensions.get("socketio")
    if socketio is not None:
        socketio.emit("update", timers.get_timer_payload())


@campaign_bp.get("/<collection>")
def get_collection(collection: str):
    if collection not in VALID_COLLECTIONS:
        return jsonify({"error": f"Invalid collection: {collection}"}), 400

    repo = None
    try:
        repo = create_campaign_repository()
        records = _remove_legacy_portrait_fields(collection, repo.load_collection(collection))
        return jsonify({"collection": collection, "records": records})
    except (RepositoryError, Exception) as err:
        logger.exception("Failed to load collection %s: %s", collection, err)
        return jsonify({"error": "Failed to load collection", "message": str(err)}), 500
    finally:
        if repo is not None:
            try:
                repo.close()
            except Exception:
                pass


@campaign_bp.put("/<collection>")
@campaign_bp.post("/<collection>")
def save_collection(collection: str):
    if collection not in VALID_COLLECTIONS:
        return jsonify({"error": f"Invalid collection: {collection}"}), 400

    data = request.get_json(silent=True)
    if data is None or not isinstance(data.get("records"), list):
        return jsonify({"error": "Payload must be JSON with a 'records' list"}), 400

    repo = None
    try:
        repo = create_campaign_repository()
        records = _remove_legacy_portrait_fields(collection, data["records"])
        repo.save_collection(collection, records)
        saved_records = repo.load_collection(collection)
        saved_records = _remove_legacy_portrait_fields(collection, saved_records)
        if collection == "player_profiles":
            _sync_live_player_profiles(saved_records)
        return jsonify({"collection": collection, "records": saved_records, "status": "saved"})
    except (RepositoryError, Exception) as err:
        logger.exception("Failed to save collection %s: %s", collection, err)
        return jsonify({"error": "Failed to save collection", "message": str(err)}), 500
    finally:
        if repo is not None:
            try:
                repo.close()
            except Exception:
                pass


@campaign_bp.delete("/<collection>")
def delete_collection(collection: str):
    if collection not in VALID_COLLECTIONS:
        return jsonify({"error": f"Invalid collection: {collection}"}), 400

    repo = None
    try:
        repo = create_campaign_repository()
        repo.delete_collection(collection)
        return jsonify({"collection": collection, "status": "deleted"})
    except (RepositoryError, Exception) as err:
        logger.exception("Failed to delete collection %s: %s", collection, err)
        return jsonify({"error": "Failed to delete collection", "message": str(err)}), 500
    finally:
        if repo is not None:
            try:
                repo.close()
            except Exception:
                pass


@campaign_bp.post("/upload_map")
def upload_map():
    """Upload a world map image to static maps storage."""
    from pathlib import Path
    import re

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"error": "Empty or invalid file"}), 400

    allowed_exts = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_exts:
        return jsonify({"error": f"Invalid file type '{ext}'. Allowed: {', '.join(allowed_exts)}"}), 400

    clean_name = re.sub(r"[^a-zA-Z0-9_\.\-]", "_", file.filename)
    maps_dir = Path(__file__).resolve().parents[1] / "static" / "maps"

    try:
        maps_dir.mkdir(parents=True, exist_ok=True)
        dest = maps_dir / clean_name
        file.save(str(dest))
        return jsonify({"filename": clean_name, "map_url": f"/static/maps/{clean_name}", "status": "uploaded"})
    except Exception as err:
        # Fallback for read-only serverless filesystem (e.g. Vercel Lambda without Supabase bucket)
        import base64
        file_bytes = file.read()
        mime_type = "image/" + ("jpeg" if ext in (".jpg", ".jpeg") else ext.lstrip("."))
        b64_data = base64.b64encode(file_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_data}"
        return jsonify({"filename": clean_name, "map_url": data_url, "status": "uploaded"})

