# Phase 04 - State Boundaries

## Objective
Separate application configuration, durable campaign data, session configuration, and disposable combat state.

## Scope
- Define typed/validated state structures and migration mapping from `settings.json`.
- Define session start, reset, restore, and restart semantics.
- Remove the cooldown-mode flag from the dedicated model after consumers are known.
- Keep theme and sound preferences in an appropriate configuration boundary.

## Dependencies
Phases 02-03.

## Deliverables
- State model document.
- Migration/initialization path.
- Boundary and session-transition tests.

## Success criteria
Combat reset cannot erase campaign data; session start restores HP/slots, clears live state, activates the roster, and selects Timers.
