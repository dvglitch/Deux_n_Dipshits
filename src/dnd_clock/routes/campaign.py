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
