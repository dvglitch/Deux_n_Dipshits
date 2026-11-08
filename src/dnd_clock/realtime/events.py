"""Socket.IO event registrations with input validation and clean broadcasting."""
import logging
from functools import wraps
from typing import Any, Dict

from flask import request
from ..services.combat_service import CombatService
from .. import timers as tm

logger = logging.getLogger(__name__)


def register_socket_events(socketio):
    """Register all Socket.IO client command handlers and connection events."""

    def synchronized(event_name):
        def decorate(handler):
            @wraps(handler)
            def wrapper(*args, **kwargs):
                with tm.session_state_lock:
                    previous_state = tm._session_snapshot()
                    try:
                        tm.initialize_shared_session()
                        if tm.session_persistence_error:
                            raise RuntimeError(tm.session_persistence_error)
                        previous_state = tm._session_snapshot()
                        return handler(*args, **kwargs)
                    except Exception:
                        tm.apply_session_snapshot(previous_state)
                        logger.exception("Session state operation failed for %s", event_name)
                        socketio.emit(
                            "session_error",
                            {"message": "Session could not be synchronized or saved. Please retry."},
                            to=request.sid,
                        )
                        return None

            return wrapper

        return decorate

    @socketio.on("connect")
    def handle_connect():
        with tm.session_state_lock:
            try:
                tm.initialize_shared_session()
                if tm.session_persistence_error:
                    raise RuntimeError(tm.session_persistence_error)
            except Exception:
                logger.exception("Could not restore active session for connecting client")
                socketio.emit(
                    "session_error",
                    {"message": "Active session could not be loaded. Please retry."},
                    to=request.sid,
                )
                return

        state = CombatService.get_control_state()
        socketio.emit("control_update", state, to=request.sid)
        socketio.emit("update", tm.get_timer_payload(), to=request.sid)
        socketio.emit("session_status", tm.get_session_status(), to=request.sid)

    @socketio.on("start_session")
    @synchronized("start_session")
    def handle_start_session(data=None):
        CombatService.start_session()
        socketio.emit("update", tm.get_timer_payload())
        socketio.emit("control_update", CombatService.get_control_state())
        socketio.emit("session_status", tm.get_session_status())

    @socketio.on("save_session")
    @synchronized("save_session")
    def handle_save_session(data=None):
        tm.persist_active_session()
        socketio.emit("session_saved", tm.get_session_status(), to=request.sid)

    @socketio.on("sync_state")
    def handle_sync_state(data=None):
        with tm.session_state_lock:
            try:
                tm.initialize_shared_session()
                if tm.session_persistence_error:
                    raise RuntimeError(tm.session_persistence_error)
            except Exception:
                logger.exception("Could not synchronize active session")
                socketio.emit(
                    "session_error",
                    {"message": "Active session could not be synchronized. Retrying shortly."},
                    to=request.sid,
                )
                return
            socketio.emit("control_update", CombatService.get_control_state(), to=request.sid)
            socketio.emit("update", tm.get_timer_payload(), to=request.sid)
            socketio.emit("session_status", tm.get_session_status(), to=request.sid)

    @socketio.on("toggle_hand")
    @synchronized("toggle_hand")
    def handle_toggle_hand(data):
        if not isinstance(data, dict) or "timer" not in data:
            return
        CombatService.toggle_hand(data["timer"])
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("set_condition")
    @synchronized("set_condition")
    def handle_set_condition(data):
        if not isinstance(data, dict) or "timer" not in data:
            return
        CombatService.set_condition(data["timer"], data.get("condition", ""))
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("toggle")
    @synchronized("toggle")
    def handle_toggle(data):
        if not isinstance(data, dict) or "timer" not in data:
            return
        CombatService.toggle_timer(data["timer"])
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("reset")
    @synchronized("reset")
    def handle_reset(data):
        if not isinstance(data, dict) or "timer" not in data:
            return
        start = bool(data.get("start", False))
        CombatService.reset_timer(data["timer"], start=start)
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("set_timer_duration")
    @synchronized("set_timer_duration")
    def handle_set_timer_duration(data):
        if not isinstance(data, dict) or "timer" not in data or "duration" not in data:
            return
        CombatService.set_timer_duration(data["timer"], data["duration"])
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("toggle_all")
    @synchronized("toggle_all")
    def handle_toggle_all():
        CombatService.toggle_all_timers()
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("reset_all")
    @synchronized("reset_all")
    def handle_reset_all():
        CombatService.reset_all_timers()
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("set_all_time")
    @synchronized("set_all_time")
    def handle_set_all_time(data):
        if not isinstance(data, dict) or "seconds" not in data:
            return
        try:
            seconds = int(data["seconds"])
            new_state = CombatService.update_control_state("DEFAULT_DURATION", seconds)
            socketio.emit("control_update", new_state)
            socketio.emit("update", tm.get_timer_payload())
        except (ValueError, TypeError):
            logger.warning("Invalid seconds received for set_all_time: %s", data.get("seconds"))

    @socketio.on("set_timer")
    @synchronized("set_timer")
    def handle_set_timer(data):
        if not isinstance(data, dict) or "timer" not in data or "seconds" not in data:
            return
        CombatService.set_timer(data["timer"], data["seconds"])
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("lock_controls")
    @synchronized("lock_controls")
    def handle_lock_controls(data):
        if not isinstance(data, dict) or "locked" not in data:
            return
        new_state = CombatService.update_control_state("locked", bool(data["locked"]))
        socketio.emit("control_update", new_state)

    @socketio.on("lock_adjust")
    @synchronized("lock_adjust")
    def handle_lock_adjust(data):
        if not isinstance(data, dict) or "locked" not in data:
            return
        new_state = CombatService.update_control_state("adjust_locked", bool(data["locked"]))
        socketio.emit("control_update", new_state)

    @socketio.on("set_adjust_interval")
    @synchronized("set_adjust_interval")
    def handle_set_adjust_interval(data):
        if not isinstance(data, dict) or "interval" not in data:
            return
        try:
            interval = int(data["interval"])
            new_state = CombatService.update_control_state("adjust_interval", interval)
            socketio.emit("control_update", new_state)
        except (ValueError, TypeError):
            logger.warning("Invalid interval received for set_adjust_interval: %s", data.get("interval"))

    @socketio.on("adjust_timer")
    @synchronized("adjust_timer")
    def handle_adjust_timer(data):
        if not isinstance(data, dict) or "timer" not in data or "delta" not in data:
            return
        CombatService.adjust_timer(data["timer"], data["delta"])
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("set_name")
    @synchronized("set_name")
    def handle_set_name(data):
        if not isinstance(data, dict) or "timer" not in data:
            return
        CombatService.set_timer_name(data["timer"], data.get("name", ""))
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("set_hp")
    @synchronized("set_hp")
    def handle_set_hp(data):
        if not isinstance(data, dict) or "timer" not in data or "current_hp" not in data:
            return
        CombatService.set_hp(data["timer"], data["current_hp"], data.get("max_hp"))
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("set_spell_slot")
    @synchronized("set_spell_slot")
    def handle_set_spell_slot(data):
        if not isinstance(data, dict) or "timer" not in data or "level" not in data or "current" not in data:
            return
        CombatService.set_spell_slot(data["timer"], data["level"], data["current"], data.get("max_slots"))
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("adjust_spell_slot")
    @synchronized("adjust_spell_slot")
    def handle_adjust_spell_slot(data):
        if not isinstance(data, dict) or "timer" not in data or "level" not in data or "delta" not in data:
            return
        CombatService.adjust_spell_slot(data["timer"], data["level"], data["delta"])
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("restore_all_slots")
    @synchronized("restore_all_slots")
    def handle_restore_all_slots(data=None):
        timer_id = data.get("timer") if isinstance(data, dict) else None
        CombatService.restore_all_slots(timer_id)
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("set_timer_meta")
    @synchronized("set_timer_meta")
    def handle_set_timer_meta(data):
        if not isinstance(data, dict) or "timer" not in data:
            return
        CombatService.set_timer_meta(
            data["timer"],
            accent_color=data.get("accent_color"),
            is_enemy=data.get("is_enemy"),
            character_name=data.get("character_name"),
        )
        socketio.emit("update", tm.get_timer_payload())
        socketio.emit("control_update", CombatService.get_control_state())

    @socketio.on("set_display_tab")
    @synchronized("set_display_tab")
    def handle_set_display_tab(data):
        if not isinstance(data, dict) or "tab" not in data:
            return
        new_state = CombatService.set_display_tab(data["tab"])
        socketio.emit("control_update", new_state)

    @socketio.on("set_active_map")
    @synchronized("set_active_map")
    def handle_set_active_map(data):
        if not isinstance(data, dict) or "map_id" not in data:
            return
        map_id = str(data["map_id"])
        tab = data.get("tab")
        if tab:
            CombatService.set_display_tab(tab)
        new_state = CombatService.update_control_state("active_map_id", map_id)
        socketio.emit("control_update", new_state)

    @socketio.on("add_timer")
    @synchronized("add_timer")
    def handle_add_timer(data=None):
        is_enemy = False
        name = None
        if isinstance(data, dict):
            is_enemy = bool(data.get("is_enemy", False))
            name = data.get("name")
        CombatService.add_timer(is_enemy=is_enemy, name=name)
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("delete_timer")
    @synchronized("delete_timer")
    def handle_delete_timer(data):
        if not isinstance(data, dict) or "timer" not in data:
            return
        CombatService.delete_timer(data["timer"])
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("set_timer_visibility")
    @synchronized("set_timer_visibility")
    def handle_set_timer_visibility(data):
        if not isinstance(data, dict) or "timer" not in data or "show_on_remote" not in data:
            return
        CombatService.set_timer_visibility(data["timer"], data["show_on_remote"])
        socketio.emit("update", tm.get_timer_payload())

    @socketio.on("set_theme")
    @synchronized("set_theme")
    def handle_set_theme(data):
        if not isinstance(data, dict) or "theme" not in data:
            return
        new_state = CombatService.update_control_state("theme", str(data["theme"]))
        socketio.emit("control_update", new_state)

    @socketio.on("set_custom_bg_url")
    @synchronized("set_custom_bg_url")
    def handle_set_custom_bg_url(data):
        if not isinstance(data, dict) or "url" not in data:
            return
        new_state = CombatService.update_control_state("custom_bg_url", str(data["url"]))
        socketio.emit("control_update", new_state)

    @socketio.on("set_timer_done_sound")
    @synchronized("set_timer_done_sound")
    def handle_set_timer_done_sound(data):
        if not isinstance(data, dict) or "sound" not in data:
            return
        new_state = CombatService.update_control_state("timer_done_sound", str(data["sound"]))
        socketio.emit("control_update", new_state)

    @socketio.on("set_hand_raise_sound")
    @synchronized("set_hand_raise_sound")
    def handle_set_hand_raise_sound(data):
        if not isinstance(data, dict) or "sound" not in data:
            return
        new_state = CombatService.update_control_state("hand_raise_sound", str(data["sound"]))
        socketio.emit("control_update", new_state)

    @socketio.on("calculate_initiatives")
    @synchronized("calculate_initiatives")
    def handle_calculate_initiatives(data):
        if not isinstance(data, dict):
            return
        updated_state = CombatService.calculate_initiatives(data)
        if updated_state:
            socketio.emit("control_update", updated_state)
