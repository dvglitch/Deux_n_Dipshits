# Phase 04 - State Boundaries

Status: Complete locally; persistence/realtime integration remains in later phases.

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
- See [phase-04-state-model.md](phase-04-state-model.md) for the implemented boundaries and deliberate limitations.

## Success criteria
Combat reset cannot erase campaign data; session start restores HP/slots, clears live state, activates the roster, and selects Timers.

## Completed validation

- Added typed dataclasses for application, campaign, session, combat, and aggregate state.
- Added legacy `settings.json` migration and `persistence.load_application_state()`.
- Removed `cooldown_mode` from the migrated dedicated-app state.
- Added session-start and combat-reset transitions.
- Added 3 state-boundary tests; the full suite now has 10 passing tests.

The existing `timers.py` global runtime and JSON save path are intentionally not fully rewired yet. Phase 05 should connect the state model to repositories and durable campaign storage; Phase 06 should centralize realtime transitions.

## Handoff to Phase 05

Preserve the state categories and transition semantics while implementing repository interfaces and provider-backed campaign persistence. Do not reintroduce live timer ticks as database writes.
