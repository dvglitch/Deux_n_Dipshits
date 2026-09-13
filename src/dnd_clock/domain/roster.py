"""Roster and player profile domain models and lifecycle logic."""
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional
import re

MAX_ACTIVE_ROSTER = 9
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_PORTRAIT_BYTES = 2 * 1024 * 1024  # 2MB limit


@dataclass
class PlayerProfile:
    id: str
    name: str
    character_name: str = ""
    max_hp: int = 30
    default_cooldown: int = 60
    accent_color: str = "#d4af37"
    portrait_url: str = ""
    is_guest: bool = False
    notes: str = ""
    spell_slots_max: Dict[str, int] = field(default_factory=dict)
    known_spells: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class RosterManager:
    """Manages active session roster with max 9 profile cap, guest handling, and inactive filtering."""

    @staticmethod
    def validate_portrait(filename: str, file_bytes: bytes) -> None:
        if not filename or "." not in filename:
            raise ValueError("Invalid filename")
        ext = "." + filename.rsplit(".", 1)[1].lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise ValueError(f"Unsupported image type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}")
        if len(file_bytes) > MAX_PORTRAIT_BYTES:
            raise ValueError(f"Image exceeds max size of {MAX_PORTRAIT_BYTES // (1024 * 1024)}MB")

    @staticmethod
    def set_active_roster(
        permanent_profiles: List[Dict[str, Any]],
        active_ids: List[str],
        guest_profiles: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Combine active permanent profiles and guests into the active session roster (max 9)."""
        active_roster = []
        
        # 1. Add active permanent profiles
        perm_map = {str(p.get("id")): p for p in permanent_profiles}
        for pid in active_ids:
            pid_str = str(pid)
            if pid_str in perm_map:
                profile = dict(perm_map[pid_str])
                profile["is_guest"] = False
                active_roster.append(profile)

        # 2. Add guests
        for g in guest_profiles:
            guest = dict(g)
            guest["is_guest"] = True
            if not guest.get("id"):
                guest["id"] = f"guest_{len(active_roster) + 1}"
            active_roster.append(guest)

        # 3. Enforce maximum capacity
        if len(active_roster) > MAX_ACTIVE_ROSTER:
            raise ValueError(f"Active roster cannot exceed {MAX_ACTIVE_ROSTER} combatants (attempted {len(active_roster)})")

        return active_roster
