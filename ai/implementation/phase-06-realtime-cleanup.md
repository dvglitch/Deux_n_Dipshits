# Phase 06 - Realtime Cleanup

Status: Complete. Realtime layer modularized with centralized service and input validation.

## Objective
Replace accumulated Socket.IO patches with explicit commands, centralized transitions, validation, and canonical broadcasts.

## Scope
- Inventory event names, payloads, listeners, mutations, and broadcasts.
- Define command/event contracts and connection bootstrap.
- Make server transitions authoritative.
- Define reconnect, persistence failure, and disposable-state reset behavior.
- Keep sounds/notifications separate from state mutation.

## Dependencies
Phases 02-05.

## Deliverables
- Event registration module in `src/dnd_clock/realtime/events.py`.
- `CombatService` layer in `src/dnd_clock/services/combat_service.py` with payload validation.
- Clean connection bootstrap (sending canonical state strictly to connecting client session `request.sid`).
- Comprehensive realtime socket tests in `tests/test_realtime.py`.

## Completed validation
- All 22 unit, persistence, state boundary, and realtime tests passing.
- Verified malformed payloads fail gracefully without crashing the server.
- Verified lock states and theme/sound event broadcasts.

## Success criteria
Two clients converge, reconnect receives canonical state, invalid commands fail clearly, and timer progression remains responsive.

## Handoff
Phase 06 is complete. Realtime command dispatching is now centralized and guarded. Phase 07 can proceed to clean up obsolete timer modes, PyInstaller distribution scripts, and local tunnel code.
