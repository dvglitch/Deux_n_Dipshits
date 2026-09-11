# Phase 02 Characterization Inventory

Date: 2026-09-10
Status: Initial inventory complete; retained behavior tests added.

## Module ownership

| Module/surface | Current responsibility | State or behavior owned | Planned direction |
| --- | --- | --- | --- |
| `app.py` | Flask/Socket.IO construction, blueprint registration, asset routes, sound API, timer task startup, local server startup | Application lifecycle and runtime wiring | Thin entry point plus application factory in Phase 03 |
| `timers.py` | Global timer state, control state, timer mutation functions, persistence serialization, background loop | Current timers, defaults, locks, conditions, names, theme/sounds, cooldown flag | Split domain state, services, persistence, and realtime ownership |
| `game_logic.py` | Initiative calculation | Initiative-derived timer values and default duration updates | Pure domain/service logic with explicit state input |
| `persistence.py` | JSON load/save and defaults merge | `settings.json` storage | Repository boundary in Phases 04-05 |
| `socket_events.py` | Socket.IO event registration and handlers | Event-to-mutation wiring and broadcasts | Explicit command contracts and centralized transitions in Phase 06 |
| `routes/*.py` | Render one page per current device/workflow | Route-to-template mapping | Keep workflow ownership; split laptop modes later |
| `timers.timer_loop` | Polls global timers every 0.5 seconds and emits `update` | Live timer progression and finish order | Runtime authority must be deployment-compatible |
| `static/js/control.js` | Laptop control UI and Socket.IO commands | Cooldown-mode UI, quick adjustment, settings controls | Session Control/Campaign Maintenance separation; remove obsolete paths |
| `static/js/dm.js` | DM phone timer UI and commands | DM timer/hand/adjust controls | DM live control surface |
| `static/js/remote.js` | Player phone timer UI and commands | Player timer/hand/adjust controls | Player Control, Spellbook, Resources |
| `static/js/display.js` | TV timer rendering and sound/theme reactions | Shared display state | Combat display plus campaign tabs |
| `templates/*.html` | Current page markup | Device-specific page structure | Rework after state foundations |
| `settings.json` | Mixed persisted configuration and timer setup/state | Names, timers, durations, visibility, locks, theme, sounds, cooldown flag | Migrate into explicit state categories |

## Current route inventory

| Route | Blueprint | Current purpose | Dedicated-app direction |
| --- | --- | --- | --- |
| `/` | `home` | Landing page linking to current surfaces | Keep as entry point |
| `/control` | `control` | Full laptop control panel | Two modes: Session Control and Campaign Maintenance |
| `/display` | `display` | Shared TV display | Timers, World Map, Objectives, Recaps |
| `/dm` | `dm` | DM mobile timer page | DM live controls for players/enemies and display tabs |
| `/remote` | `remote` | Player mobile timer page | Player Control, Spellbook, Resources |
| `/qr` | `qr` | QR utility page | Keep as access utility |
| `/api/sounds` | `app.py` | Lists local sound files | Preserve if sound selection remains; move with app setup |
| `/static/sounds/*` | `app.py` | Serves sound files through external-asset path | Replace PyInstaller-specific path handling |
| `/static/images/*` | `app.py` | Serves image files through external-asset path | Replace PyInstaller-specific path handling |

## Current persisted fields

Observed in `settings.json` and `timers.py`:

| Field/group | Current meaning | Future category |
| --- | --- | --- |
| `max_timer_id`, `active_timer_ids` | Dynamic timer roster/setup | Session/campaign migration decision |
| `locked`, `adjust_locked`, `adjust_interval` | Live control settings | Session/combat configuration |
| `DEFAULT_DURATION` | Global duration/default | Combat configuration |
| `cooldown_mode` | Chooses timer versus cooldown behavior | Remove from dedicated app after consumer inventory |
| `timer_durations` | Timer duration values | Campaign/default combat configuration |
| `timer_cooldown_durations` | Cooldown defaults | Campaign/default combat configuration |
| `timer_names` | Timer labels | Campaign/player profile data |
| `timer_show_on_remote` | Remote visibility | Session/display configuration |
| `theme`, `custom_bg_url` | Display appearance | Application/campaign presentation settings |
| `timer_done_sound`, `hand_raise_sound` | Sound choices | Application/campaign presentation settings |
| `timers[*].remaining`, `running`, `last_update`, `finished` | Live timer state | Disposable combat state |
| `timers[*].raised_hand`, `condition` | Live player state | Disposable combat state |
| `finish_order` | Runtime completion ordering | Disposable combat state |

## Socket.IO event inventory

### Client commands

| Event | Current handler | Mutation | Broadcast behavior |
| --- | --- | --- | --- |
| `toggle_hand` | `socket_events.py` | `timers.toggle_hand` | No direct broadcast; later timer update carries state |
| `set_condition` | `socket_events.py` | `timers.set_condition` | No direct broadcast; later timer update carries state |
| `toggle` | `socket_events.py` | `timers.toggle_timer` | No direct broadcast; timer loop emits updates |
| `reset` | `socket_events.py` | `timers.reset_timer` | No direct broadcast; timer loop emits updates |
| `set_timer_duration` | `socket_events.py` | `timers.set_timer_duration` | No direct broadcast; persists immediately |
| `set_cooldown_mode` | `socket_events.py` | `timers.update_control_state` | Broadcasts `control_update` to all clients |
| `toggle_all` | `socket_events.py` | `timers.toggle_all_timers` | No direct broadcast; timer loop emits updates |
| `reset_all` | `socket_events.py` | `timers.reset_all_timers` | No direct broadcast; timer loop emits updates |
| `set_all_time` | `socket_events.py` | `timers.update_control_state` | Broadcasts `control_update` |
| `set_timer` | `socket_events.py` | `timers.set_timer` | No direct broadcast; timer loop emits updates |
| `lock_controls` | `socket_events.py` | `timers.update_control_state` | Broadcasts `control_update` |
| `lock_adjust` | `socket_events.py` | `timers.update_control_state` | Broadcasts `control_update` |
| `set_adjust_interval` | `socket_events.py` | `timers.update_control_state` | Broadcasts `control_update` |
| `adjust_timer` | `socket_events.py` | `timers.adjust_timer` | No direct broadcast; timer loop emits updates |
| `set_name` | `socket_events.py` | `timers.set_timer_name` | No direct broadcast; timer loop emits updates |
| `add_timer` | `socket_events.py` | `timers.add_timer` | No direct broadcast; later update reflects state |
| `delete_timer` | `socket_events.py` | `timers.delete_timer` | No direct broadcast; later update reflects state |
| `set_timer_visibility` | `socket_events.py` | `timers.set_timer_visibility` | No direct broadcast; later update reflects state |
| `set_theme` | `socket_events.py` | `timers.update_control_state` | Broadcasts `control_update` |
| `set_custom_bg_url` | `socket_events.py` | `timers.update_control_state` | Broadcasts `control_update` |
| `set_timer_done_sound` | `socket_events.py` | `timers.update_control_state` | Broadcasts `control_update` |
| `set_hand_raise_sound` | `socket_events.py` | `timers.update_control_state` | Broadcasts `control_update` |
| `calculate_initiatives` | `socket_events.py` | `game_logic.calculate_initiatives` | Broadcasts `control_update` only when the function returns state |

### Server events

| Event | Producer | Current consumers | Purpose |
| --- | --- | --- | --- |
| `control_update` | Socket handlers and connect handler | Control, display, DM, remote clients | Control/settings bootstrap and changes |
| `update` | `timers.timer_loop` | Control, display, DM, remote clients | Live timer payload every 0.5 seconds |

### Characterization observations

- Event handlers generally mutate module-level state directly.
- Some mutations persist immediately; others only appear in the next timer-loop update or are not persisted at all.
- `socketio.emit` is generally broadcast-wide rather than scoped to the requesting client.
- The `connect` handler emits `control_update` globally, not only to the newly connected client.
- Payload validation is minimal and commonly relies on `int(...)` or direct dictionary indexing.
- The client can emit `adjust_timer`; quick adjustment is exposed in control, DM, and remote JavaScript and remains a removal candidate.
- The client exposes the cooldown-mode toggle even though the dedicated app intends to remove the alternate timer mode.
- The background loop is the effective synchronization mechanism for many state mutations.

## Retained, changed, and removed behavior

### Retain and protect

- Cooldown timer start, pause, reset, and completion.
- Initiative-derived cooldown values.
- Player conditions and hand-raise behavior where retained by the new design.
- Theme, timer-complete sound, and hand-raise sound.
- DM ability to control timers.
- Shared display synchronization.

### Change later

- Persisted state categories.
- Socket.IO command and broadcast contracts.
- Route responsibilities within the existing device surfaces.
- Player roster from generic timers to permanent/temporary profiles.
- Player display from timer-only cards to cooldown, HP, conditions, and enemy status.

### Remove after protection

- Alternate timer-based combat mode in the dedicated app.
- Quick-adjust UI and event if confirmed unused.
- PyInstaller path handling and local distribution workflow.
- Generic timer assumptions that conflict with permanent party profiles.

## Test baseline

Added `tests/test_retained_behavior.py` using Python `unittest`.

Current coverage:

- Cooldown reset uses the configured duration and can start immediately.
- Locked timers cannot toggle.
- Unlocked timers can toggle.
- Conditions are stored on a timer.
- Cooldown initiative assigns the minimum value to the best initiative rank and the maximum to the worst rank.
- Persistence save path is called.
- Invalid JSON falls back to default settings.

Run with:

```powershell
python -m unittest discover -s tests -v
```

## Handoff to Phase 03

Phase 02 is complete enough for source reorganization when the test baseline is accepted. Phase 03 should preserve the observed behavior while moving setup into a package. It should not yet redesign state categories or rename Socket.IO events; those belong to later phases.
