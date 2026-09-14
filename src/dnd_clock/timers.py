import time
from .persistence import load_settings, save_settings

# Load settings from persistence
settings = load_settings()

# Dynamic configuration
locked = settings.get("locked", False)
adjust_locked = settings.get("adjust_locked", False)
adjust_interval = settings.get("adjust_interval", 30)
DEFAULT_DURATION = settings.get("DEFAULT_DURATION", 180)
theme = settings.get("theme", "tavern")
custom_bg_url = settings.get("custom_bg_url", "")
timer_done_sound = settings.get("timer_done_sound", "synthetic")
hand_raise_sound = settings.get("hand_raise_sound", "synthetic")
display_tab = settings.get("display_tab", "timers")
active_map_id = settings.get("active_map_id", "")

max_timer_id = settings.get("max_timer_id", 6)
active_timer_ids = settings.get("active_timer_ids", list(range(1, max_timer_id + 1)))

# Timer state (will be populated dynamically)
timers = {}
finish_order = []

control_state = {
    "locked": locked,
    "adjust_locked": adjust_locked,
    "adjust_interval": adjust_interval,
    "DEFAULT_DURATION": DEFAULT_DURATION,
    "theme": theme,
    "custom_bg_url": custom_bg_url,
    "timer_done_sound": timer_done_sound,
    "hand_raise_sound": hand_raise_sound,
    "display_tab": display_tab,
    "active_map_id": active_map_id,
    "cooldown_mode": True
}

def save_current_state():
    """Saves the current variables down to the persistence layer"""
    settings = {
        "max_timer_id": max_timer_id,
        "active_timer_ids": active_timer_ids,
        "locked": control_state["locked"],
        "adjust_locked": control_state.get("adjust_locked", False),
        "adjust_interval": control_state.get("adjust_interval", 30),
        "DEFAULT_DURATION": DEFAULT_DURATION,
        "cooldown_mode": True,
        "display_tab": control_state.get("display_tab", "timers"),
        "active_map_id": control_state.get("active_map_id", ""),
        "timer_durations": {str(k): v["duration"] for k, v in timers.items()},
        "timer_cooldown_durations": {str(k): v.get("cooldown_duration", v["duration"]) for k, v in timers.items()},
        "timer_names": {str(k): v["name"] for k, v in timers.items()},
        "timer_character_names": {str(k): v.get("character_name", "") for k, v in timers.items()},
        "timer_show_on_remote": {str(k): v.get("show_on_remote", True) for k, v in timers.items()},
        "timer_hp": {str(k): v.get("current_hp", 30) for k, v in timers.items()},
        "timer_max_hp": {str(k): v.get("max_hp", 30) for k, v in timers.items()},
        "timer_accent_colors": {str(k): v.get("accent_color", "#d4af37") for k, v in timers.items()},
        "timer_portraits": {str(k): v.get("portrait_url", "") for k, v in timers.items()},
        "timer_is_enemy": {str(k): v.get("is_enemy", False) for k, v in timers.items()},
        "timer_spell_slots": {str(k): v.get("spell_slots", {}) for k, v in timers.items()},
        "theme": theme,
        "custom_bg_url": custom_bg_url,
        "timer_done_sound": control_state.get("timer_done_sound", "synthetic"),
        "hand_raise_sound": control_state.get("hand_raise_sound", "synthetic")
    }
    save_settings(settings)

def sync_with_campaign_profiles(profiles=None, clear_enemies=False, restore_progress=False):
    """Sync active timers with saved campaign player profiles (from DB or provided list).

    When restore_progress is True (cold start), remaining/cooldown/current_hp/spell_slots
    are pulled from the last saved settings snapshot instead of the (empty) in-memory
    timers dict, so a fresh process reflects the last known combat progress rather than
    resetting every player back to full HP/duration.
    """
    global timers, active_timer_ids, max_timer_id, finish_order
    if profiles is None:
        try:
            from .database.factory import create_campaign_repository
            repo = create_campaign_repository()
            try:
                profiles = repo.load_collection("player_profiles")
            finally:
                repo.close()
        except Exception:
            profiles = []

    if profiles:
        current_enemies = {}
        if not clear_enemies:
            current_enemies = {
                tid: data for tid, data in timers.items() if data.get("is_enemy", False)
            }

        saved = load_settings() if restore_progress else {}
        saved_durs = saved.get("timer_cooldown_durations", saved.get("timer_durations", {}))
        saved_hp = saved.get("timer_hp", {})
        saved_slots = saved.get("timer_spell_slots", {})
        saved_conditions = saved.get("timer_conditions", {})

        new_timers = {}
        new_active_ids = []
        for idx, p in enumerate(profiles, start=1):
            new_active_ids.append(idx)
            max_hp = int(p.get("max_hp", 30))
            cd = int(p.get("default_cooldown", 60))
            key = str(idx)

            existing = timers.get(idx, {})
            if clear_enemies:
                cur_hp = max_hp
                cur_slots = None
                remaining = cd
            else:
                cur_hp = existing.get("current_hp", saved_hp.get(key, max_hp))
                cur_slots = existing.get("spell_slots") or saved_slots.get(key)
                remaining = existing.get("remaining", saved_durs.get(key, cd))

            new_timers[idx] = {
                "remaining": int(remaining),
                "running": False,
                "last_update": time.time(),
                "name": p.get("name") or f"Player {idx}",
                "character_name": p.get("character_name", ""),
                "finished": int(remaining) <= 0,
                "raised_hand": False,
                "condition": "" if clear_enemies else saved_conditions.get(key, ""),
                "duration": cd,
                "cooldown_duration": cd,
                "show_on_remote": True,
                "current_hp": min(int(cur_hp), max_hp),
                "max_hp": max_hp,
                "accent_color": p.get("accent_color", "#d4af37"),
                "portrait_url": p.get("portrait_url", ""),
                "is_enemy": False,
                "spell_slots": cur_slots or p.get("spell_slots", {
                    "1": {"current": 4, "max": 4},
                    "2": {"current": 3, "max": 3},
                    "3": {"current": 2, "max": 2}
                }),
            }

        if current_enemies:
            next_id = len(new_active_ids) + 1
            for _, e_data in current_enemies.items():
                new_active_ids.append(next_id)
                new_timers[next_id] = e_data
                next_id += 1

        timers = new_timers
        active_timer_ids = new_active_ids
        max_timer_id = max(active_timer_ids) if active_timer_ids else 0
        finish_order = [fid for fid in finish_order if fid in new_timers]
        save_current_state()
        return True
    return False

def init_timers():
    """Initialize timers on process startup.

    The campaign database is the source of truth for the active roster's identity
    (names, portraits, colors). It is always checked first so a fresh process
    (new tab, cold serverless start) never shows placeholder names instead of the
    real party. Live combat progress (remaining time, HP, spell slots) is restored
    from the last saved settings snapshot on top of that roster. Settings.json is
    only used standalone as a fallback when no campaign profiles exist at all.
    """
    global timers, finish_order
    if sync_with_campaign_profiles(clear_enemies=False, restore_progress=True):
        return

    settings = load_settings()
    timer_vis = settings.get("timer_show_on_remote", {})
    timer_durs = settings.get("timer_durations", {})
    timer_cooldown_durs = settings.get("timer_cooldown_durations", {})
    timer_hp = settings.get("timer_hp", {})
    timer_max_hp = settings.get("timer_max_hp", {})
    timer_colors = settings.get("timer_accent_colors", {})
    timer_portraits = settings.get("timer_portraits", {})
    timer_enemies = settings.get("timer_is_enemy", {})
    timer_chars = settings.get("timer_character_names", {})
    timer_slots = settings.get("timer_spell_slots", {})
    saved_names = settings.get("timer_names", {})

    active_ids = settings.get("active_timer_ids", [])

    if active_ids and saved_names:
        timers = {
            i: {
                "remaining": int(timer_cooldown_durs.get(str(i), timer_durs.get(str(i), DEFAULT_DURATION))),
                "running": False,
                "last_update": time.time(),
                "name": saved_names.get(str(i), f"Timer {i}"),
                "character_name": timer_chars.get(str(i), ""),
                "finished": False,
                "raised_hand": False,
                "condition": "",
                "duration": int(timer_cooldown_durs.get(str(i), timer_durs.get(str(i), DEFAULT_DURATION))),
                "cooldown_duration": int(timer_cooldown_durs.get(str(i), timer_durs.get(str(i), DEFAULT_DURATION))),
                "show_on_remote": timer_vis.get(str(i), True),
                "current_hp": int(timer_hp.get(str(i), 30)),
                "max_hp": int(timer_max_hp.get(str(i), 30)),
                "accent_color": timer_colors.get(str(i), "#d4af37"),
                "portrait_url": timer_portraits.get(str(i), ""),
                "is_enemy": bool(timer_enemies.get(str(i), not timer_vis.get(str(i), True))),
                "spell_slots": timer_slots.get(str(i), {
                    "1": {"current": 4, "max": 4},
                    "2": {"current": 3, "max": 3},
                    "3": {"current": 2, "max": 2}
                }),
            }
            for i in active_ids
        }
        finish_order = []
    else:
        timers = {}
        finish_order = []

# Initialize timers on startup
init_timers()

# ==========================================
# ====== STATE MUTATION APIS ===============
# ==========================================

def update_control_state(key, value):
    """Updates a global control variable, syncs state, and persists."""
    global DEFAULT_DURATION, theme, custom_bg_url, adjust_interval, timer_done_sound, hand_raise_sound
    
    if key == "locked":
        control_state["locked"] = value
    elif key == "adjust_locked":
        control_state["adjust_locked"] = value
    elif key == "adjust_interval":
        adjust_interval = int(value)
        control_state["adjust_interval"] = adjust_interval
    elif key == "DEFAULT_DURATION":
        DEFAULT_DURATION = int(value)
        control_state["DEFAULT_DURATION"] = DEFAULT_DURATION
    elif key == "theme":
        theme = value
        control_state["theme"] = theme
    elif key == "custom_bg_url":
        custom_bg_url = value
        control_state["custom_bg_url"] = custom_bg_url
    elif key == "timer_done_sound":
        timer_done_sound = value
        control_state["timer_done_sound"] = timer_done_sound
    elif key == "hand_raise_sound":
        hand_raise_sound = value
        control_state["hand_raise_sound"] = hand_raise_sound
    elif key == "display_tab":
        control_state["display_tab"] = str(value)
    elif key == "active_map_id":
        control_state["active_map_id"] = str(value)
    
    save_current_state()
    return control_state

def set_timer_duration(timer_id, duration):
    if timer_id not in timers: return
    timers[timer_id]["duration"] = int(duration)
    timers[timer_id]["cooldown_duration"] = int(duration)
    save_current_state()

def add_timer(is_enemy=False, name=None):
    global max_timer_id, active_timer_ids
    
    new_id = 1
    while new_id in active_timer_ids:
        new_id += 1
        
    if new_id > max_timer_id:
        max_timer_id = new_id
        
    active_timer_ids.append(new_id)
    timers[new_id] = {
        "remaining": DEFAULT_DURATION,
        "running": False,
        "last_update": time.time(),
        "name": name or (f"Enemy {new_id}" if is_enemy else f"Timer {new_id}"),
        "character_name": "",
        "finished": False,
        "raised_hand": False,
        "condition": "",
        "duration": DEFAULT_DURATION,
        "cooldown_duration": DEFAULT_DURATION,
        "show_on_remote": not is_enemy,
        "current_hp": 30,
        "max_hp": 30,
        "accent_color": "#e74c3c" if is_enemy else "#d4af37",
        "portrait_url": "",
        "is_enemy": bool(is_enemy),
    }
    save_current_state()
    return new_id

def set_hp(timer_id, current_hp, max_hp=None):
    if timer_id not in timers: return
    t = timers[timer_id]
    if max_hp is not None:
        t["max_hp"] = max(1, int(max_hp))
    curr = max(0, int(current_hp))
    if "max_hp" in t:
        curr = min(t["max_hp"], curr)
    t["current_hp"] = curr
    save_current_state()

def set_spell_slot(timer_id, level, current, max_slots=None):
    if timer_id not in timers: return
    t = timers[timer_id]
    if "spell_slots" not in t:
        t["spell_slots"] = {}
    lvl_str = str(level)
    if lvl_str not in t["spell_slots"]:
        t["spell_slots"][lvl_str] = {"current": int(current), "max": int(max_slots or current or 4)}
    else:
        if max_slots is not None:
            t["spell_slots"][lvl_str]["max"] = max(1, int(max_slots))
        cur_max = t["spell_slots"][lvl_str].get("max", 4)
        t["spell_slots"][lvl_str]["current"] = max(0, min(cur_max, int(current)))
    save_current_state()

def adjust_spell_slot(timer_id, level, delta):
    if timer_id not in timers: return
    t = timers[timer_id]
    if "spell_slots" not in t:
        t["spell_slots"] = {}
    lvl_str = str(level)
    slot_info = t["spell_slots"].get(lvl_str, {"current": 4, "max": 4})
    cur_val = slot_info.get("current", 4)
    max_val = slot_info.get("max", 4)
    new_val = max(0, min(max_val, cur_val + int(delta)))
    slot_info["current"] = new_val
    t["spell_slots"][lvl_str] = slot_info
    save_current_state()

def restore_all_slots(timer_id=None):
    target_ids = [timer_id] if timer_id in timers else list(timers.keys())
    for tid in target_ids:
        t = timers[tid]
        if "spell_slots" in t:
            for lvl_str in t["spell_slots"]:
                t["spell_slots"][lvl_str]["current"] = t["spell_slots"][lvl_str].get("max", 4)
    save_current_state()

def set_timer_meta(timer_id, accent_color=None, portrait_url=None, is_enemy=None, character_name=None):
    if timer_id not in timers: return
    t = timers[timer_id]
    if accent_color is not None: t["accent_color"] = str(accent_color)
    if portrait_url is not None: t["portrait_url"] = str(portrait_url)
    if is_enemy is not None:
        t["is_enemy"] = bool(is_enemy)
        t["show_on_remote"] = not bool(is_enemy)
    if character_name is not None: t["character_name"] = str(character_name)
    save_current_state()

    # Attempt to persist updated portrait/color/character_name to campaign database
    try:
        from .database.factory import create_campaign_repository
        repo = create_campaign_repository()
        try:
            profiles = repo.load_collection("player_profiles")
            target_id = f"player_{timer_id}"
            found = False
            for p in profiles:
                if str(p.get("id")) == target_id or str(p.get("id")) == str(timer_id):
                    if accent_color is not None: p["accent_color"] = str(accent_color)
                    if portrait_url is not None: p["portrait_url"] = str(portrait_url)
                    if character_name is not None: p["character_name"] = str(character_name)
                    found = True
                    break

            if not found:
                idx = int(timer_id) - 1
                while len(profiles) <= idx:
                    profiles.append({"id": f"player_{len(profiles) + 1}", "name": f"Player {len(profiles) + 1}"})
                if 0 <= idx < len(profiles):
                    if accent_color is not None: profiles[idx]["accent_color"] = str(accent_color)
                    if portrait_url is not None: profiles[idx]["portrait_url"] = str(portrait_url)
                    if character_name is not None: profiles[idx]["character_name"] = str(character_name)

            repo.save_collection("player_profiles", profiles)
        finally:
            repo.close()
    except Exception:
        pass

def get_timer_payload():
    """Return the current serialized payload dictionary for all active timers."""
    positions = {tid: idx + 1 for idx, tid in enumerate(finish_order)}
    return {
        i: {
            **t,
            "position": positions.get(i)
        }
        for i, t in timers.items()
    }

def delete_timer(timer_id):
    if timer_id in timers:
        del timers[timer_id]
    if timer_id in active_timer_ids:
        active_timer_ids.remove(timer_id)
    if timer_id in finish_order:
        finish_order.remove(timer_id)
    save_current_state()

def toggle_hand(timer_id):
    if timer_id not in timers: return
    t = timers[timer_id]
    new_state = not t.get("raised_hand", False)
    t["raised_hand"] = new_state
    if new_state:
        if timer_id not in finish_order:
            finish_order.append(timer_id)
    else:
        if timer_id in finish_order:
            finish_order.remove(timer_id)
    save_current_state()

def set_condition(timer_id, condition):
    if timer_id not in timers: return
    timers[timer_id]["condition"] = condition

def toggle_timer(timer_id):
    if timer_id not in timers: return
    t = timers[timer_id]
    if t["remaining"] > 0:
        t["running"] = not t["running"]
        t["last_update"] = time.time()
    else:
        t["running"] = False

def _reset_single(timer_id, start=False):
    """Internal helper to reset a single timer by ID avoiding duplicate logic"""
    if timer_id not in timers: return
    t = timers[timer_id]
    
    t["remaining"] = t["duration"]
    t["running"] = bool(start)
    t["last_update"] = time.time()
    t["finished"] = False
    t["raised_hand"] = False
    if timer_id in finish_order:
        finish_order.remove(timer_id)

def reset_timer(timer_id, start=False):
    _reset_single(timer_id, start=start)

def toggle_all_timers():
    now = time.time()
    any_running = any(t["running"] for t in timers.values())
    for t in timers.values():
        if t["remaining"] > 0:
            t["running"] = not any_running
            t["last_update"] = now
        else:
            t["running"] = False

def reset_all_timers():
    for i in timers.keys():
        _reset_single(i)
    finish_order.clear()

def set_timer(timer_id, seconds):
    if timer_id not in timers: return
    t = timers[timer_id]
    t["remaining"] = int(seconds)
    t["duration"] = int(seconds)
    t["cooldown_duration"] = int(seconds)
    t["running"] = False
    t["last_update"] = time.time()

def adjust_timer(timer_id, delta):
    if timer_id not in timers: return
    t = timers[timer_id]
    t["remaining"] = max(0, t["remaining"] + int(delta))
    t["last_update"] = time.time()

def set_timer_name(timer_id, name):
    if timer_id not in timers: return
    timers[timer_id]["name"] = name
    save_current_state()

def set_timer_visibility(timer_id, show_on_remote):
    if timer_id not in timers: return
    timers[timer_id]["show_on_remote"] = bool(show_on_remote)
    save_current_state()

# ==========================================
# ====== BACKGROUND LOOP ===================
# ==========================================

def timer_loop(socketio):
    while True:
        now = time.time()

        for i, t in timers.items():
            if t["running"]:
                elapsed = now - t["last_update"]
                t["remaining"] = max(0, t["remaining"] - elapsed)
                t["last_update"] = now

                if t["remaining"] <= 0 and not t["finished"]:
                    t["remaining"] = 0
                    t["finished"] = True
                    t["running"] = False
                    if i not in finish_order:
                        finish_order.append(i)

        positions = {tid: idx + 1 for idx, tid in enumerate(finish_order)}

        payload = {
            i: {
                **t,
                "position": positions.get(i)
            }
            for i, t in timers.items()
        }

        socketio.emit("update", payload)
        socketio.sleep(0.5)