"""API routes for Campaign Maintenance (players, spells, maps, objectives, recaps)."""
import logging
from flask import Blueprint, jsonify, request

from ..database.factory import create_campaign_repository
from ..database.repositories import RepositoryError

logger = logging.getLogger(__name__)

campaign_bp = Blueprint("campaign", __name__, url_prefix="/api/campaign")

VALID_COLLECTIONS = {"player_profiles", "spells", "world_maps", "objectives", "recaps"}


@campaign_bp.get("/<collection>")
def get_collection(collection: str):
    if collection not in VALID_COLLECTIONS:
        return jsonify({"error": f"Invalid collection: {collection}"}), 400

    repo = None
    try:
        repo = create_campaign_repository()
        records = repo.load_collection(collection)
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
        repo.save_collection(collection, data["records"])
        saved_records = repo.load_collection(collection)
        if collection == "player_profiles":
            try:
                from .. import timers as tm
                tm.sync_with_campaign_profiles(saved_records, clear_enemies=False)
            except Exception as sync_err:
                logger.warning("Could not sync timers after saving player profiles: %s", sync_err)
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


@campaign_bp.post("/upload_portrait")
def upload_portrait():
    """Upload a character portrait image for a player."""
    from ..services.portrait_service import PortraitStorageService

    player_id = request.form.get("player_id", "").strip()
    if not player_id:
        return jsonify({"error": "player_id is required"}), 400

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"error": "Empty or invalid file"}), 400

    try:
        service = PortraitStorageService()
        file_bytes = file.read()
        portrait_url = service.save_portrait(player_id, file.filename, file_bytes)
        return jsonify({"player_id": player_id, "portrait_url": portrait_url, "status": "uploaded"})
    except ValueError as val_err:
        return jsonify({"error": str(val_err)}), 400
    except Exception as err:
        logger.exception("Failed to upload portrait for %s: %s", player_id, err)
        return jsonify({"error": "Upload failed", "message": str(err)}), 500

