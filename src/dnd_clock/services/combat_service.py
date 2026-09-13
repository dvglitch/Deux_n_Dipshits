"""Domain services for coordinating combat timers, state transitions, and business logic."""
from typing import Any, Dict, Optional
import time

from .. import game_logic as gl
from .. import timers as tm


def _parse_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


class CombatService:
    """Service providing safe, validated state transitions for combat timers."""

    @staticmethod
    def toggle_hand(timer_id_raw: Any) -> bool:
        timer_id = _parse_int(timer_id_raw)
        if timer_id is None or tm.control_state.get("locked", False):
            return False
        tm.toggle_hand(timer_id)
        return True

    @staticmethod
    def set_condition(timer_id_raw: Any, condition: Any) -> bool:
        timer_id = _parse_int(timer_id_raw)
        if timer_id is None:
            return False
        tm.set_condition(timer_id, str(condition or "").strip())
        return True

    @staticmethod
    def toggle_timer(timer_id_raw: Any) -> bool:
        timer_id = _parse_int(timer_id_raw)
        if timer_id is None or tm.control_state.get("locked", False):
            return False
        tm.toggle_timer(timer_id)
        return True

    @staticmethod
    def reset_timer(timer_id_raw: Any, start: bool = False) -> bool:
        timer_id = _parse_int(timer_id_raw)
        if timer_id is None:
            return False
        tm.reset_timer(timer_id, start=bool(start))
        return True

    @staticmethod
    def set_timer_duration(timer_id_raw: Any, duration_raw: Any) -> bool:
        timer_id = _parse_int(timer_id_raw)
        duration = _parse_int(duration_raw)
        if timer_id is None or duration is None or duration <= 0:
            return False
        tm.set_timer_duration(timer_id, duration)
        return True

    @staticmethod
    def set_timer_name(timer_id_raw: Any, name: Any) -> bool:
        timer_id = _parse_int(timer_id_raw)
        if timer_id is None:
            return False
        name_str = str(name or f"Timer {timer_id}").strip()
        tm.set_timer_name(timer_id, name_str)
        return True

    @staticmethod
    def set_timer_visibility(timer_id_raw: Any, show_on_remote: Any) -> bool:
        timer_id = _parse_int(timer_id_raw)
        if timer_id is None:
            return False
        tm.set_timer_visibility(timer_id, bool(show_on_remote))
        return True

    @staticmethod
    def adjust_timer(timer_id_raw: Any, delta_raw: Any) -> bool:
        timer_id = _parse_int(timer_id_raw)
        delta = _parse_int(delta_raw)
        if timer_id is None or delta is None:
            return False
        if tm.control_state.get("locked", False) or tm.control_state.get("adjust_locked", False):
            return False
        tm.adjust_timer(timer_id, delta)
        return True

    @staticmethod
    def set_timer(timer_id_raw: Any, seconds_raw: Any) -> bool:
        timer_id = _parse_int(timer_id_raw)
        seconds = _parse_int(seconds_raw)
        if timer_id is None or seconds is None or seconds < 0:
            return False
        tm.set_timer(timer_id, seconds)
        return True

    @staticmethod
    def set_hp(timer_id_raw: Any, current_hp_raw: Any, max_hp_raw: Any = None) -> bool:
        timer_id = _parse_int(timer_id_raw)
        current_hp = _parse_int(current_hp_raw)
        max_hp = _parse_int(max_hp_raw) if max_hp_raw is not None else None
        if timer_id is None or current_hp is None:
            return False
        tm.set_hp(timer_id, current_hp, max_hp=max_hp)
        return True

    @staticmethod
    def set_timer_meta(
        timer_id_raw: Any,
        accent_color: Optional[str] = None,
        portrait_url: Optional[str] = None,
        is_enemy: Optional[bool] = None,
        character_name: Optional[str] = None,
    ) -> bool:
        timer_id = _parse_int(timer_id_raw)
        if timer_id is None:
            return False
        tm.set_timer_meta(
            timer_id,
            accent_color=accent_color,
            portrait_url=portrait_url,
            is_enemy=is_enemy,
            character_name=character_name,
        )
        return True

    @staticmethod
    def add_timer(is_enemy: bool = False, name: Optional[str] = None) -> int:
        return tm.add_timer(is_enemy=bool(is_enemy), name=name)

    @staticmethod
    def set_display_tab(tab_raw: Any) -> Dict[str, Any]:
        tab = str(tab_raw or "timers").strip().lower()
        if tab not in {"timers", "map", "objectives", "recaps"}:
            tab = "timers"
        return tm.update_control_state("display_tab", tab)

    @staticmethod
    def delete_timer(timer_id_raw: Any) -> bool:
        timer_id = _parse_int(timer_id_raw)
        if timer_id is None:
            return False
        tm.delete_timer(timer_id)
        return True

    @staticmethod
    def toggle_all_timers() -> None:
        tm.toggle_all_timers()

    @staticmethod
    def reset_all_timers() -> None:
        tm.reset_all_timers()

    @staticmethod
    def calculate_initiatives(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not isinstance(data, dict):
            return None
        mode = data.get("mode", "proportional")
        interval = _parse_int(data.get("interval"), 30)
        ranks = data.get("ranks", {})
        min_seconds = _parse_int(data.get("min_seconds"))
        max_seconds = _parse_int(data.get("max_seconds"))

        return gl.calculate_initiatives(
            mode,
            interval,
            ranks,
            min_seconds=min_seconds,
            max_seconds=max_seconds,
        )

    @staticmethod
    def update_control_state(key: str, value: Any) -> Dict[str, Any]:
        return tm.update_control_state(key, value)

    @staticmethod
    def get_control_state() -> Dict[str, Any]:
        return dict(tm.control_state)
