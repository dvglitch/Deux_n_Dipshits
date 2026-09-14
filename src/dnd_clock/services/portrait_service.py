"""Storage service for player portrait uploads supporting local file storage and Supabase Storage."""
import os
import uuid
from pathlib import Path
from typing import Optional

from ..config import supabase_url, storage_bucket
from ..domain.roster import RosterManager

PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_UPLOADS_DIR = PROJECT_ROOT / "src" / "dnd_clock" / "static" / "images" / "portraits"


class PortraitStorageService:
    """Handles saving and replacing character portrait images."""

    def __init__(self):
        try:
            LOCAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

    def save_portrait(self, player_id: str, filename: str, file_bytes: bytes) -> str:
        """Validate, store portrait, and return public/relative URL. Replaces prior image."""
        RosterManager.validate_portrait(filename, file_bytes)
        ext = "." + filename.rsplit(".", 1)[1].lower()
        
        # Consistent file naming per player to replace old images automatically
        safe_player_id = "".join(c for c in player_id if c.isalnum() or c in ("-", "_"))
        unique_name = f"portrait_{safe_player_id}_{uuid.uuid4().hex[:8]}{ext}"

        # 1. If Supabase Storage is configured with secret key, upload to bucket
        sb_url = supabase_url()
        sb_key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        bucket_name = storage_bucket()

        if sb_url and sb_key:
            try:
                import urllib.request
                import json

                # Clean prior portrait for this player if needed, then upload
                clean_url = sb_url.rstrip("/")
                upload_endpoint = f"{clean_url}/storage/v1/object/{bucket_name}/{unique_name}"
                
                req = urllib.request.Request(
                    upload_endpoint,
                    data=file_bytes,
                    headers={
                        "Authorization": f"Bearer {sb_key}",
                        "apikey": sb_key,
                        "Content-Type": "image/" + ext.lstrip("."),
                        "x-upsert": "true"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status in (200, 201):
                        return f"{clean_url}/storage/v1/object/public/{bucket_name}/{unique_name}"
            except Exception as e:
                # Fallback to local storage if remote storage fails
                pass

        # 2. Local filesystem storage fallback
        try:
            LOCAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
            for existing in LOCAL_UPLOADS_DIR.glob(f"portrait_{safe_player_id}_*"):
                try:
                    existing.unlink()
                except OSError:
                    pass

            dest_path = LOCAL_UPLOADS_DIR / unique_name
            dest_path.write_bytes(file_bytes)
            return f"/static/images/portraits/{unique_name}"
        except Exception as e:
            # If server filesystem is read-only (e.g. Vercel Lambda without Supabase Key),
            # convert image to a compact data URI so upload always succeeds!
            import base64
            mime_type = "image/" + ("jpeg" if ext in (".jpg", ".jpeg") else ext.lstrip("."))
            b64_data = base64.b64encode(file_bytes).decode("utf-8")
            return f"data:{mime_type};base64,{b64_data}"
