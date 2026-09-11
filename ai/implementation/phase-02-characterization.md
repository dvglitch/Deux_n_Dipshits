# Phase 02 - Characterization

Status: Complete enough to begin Phase 03.

## Objective
Capture retained behavior and map current ownership before moving files or removing modes.

## Scope
- Inventory Python modules, routes, templates, JavaScript clients, settings fields, persistence, timer loop, and Socket.IO events.
- Add focused Python tests for retained cooldown behavior, locks, conditions, persistence, and initiative adjustments.
- Mark timer-mode and quick-adjust behavior as removal candidates.

## Dependencies
Phases 00-01.

## Deliverables
- Module/state/event inventory.
- Retained/changed/removed behavior list.
- Initial test suite and documented command.
- See [phase-02-inventory.md](phase-02-inventory.md) for the completed inventory and handoff notes.

## Success criteria
Tests protect the cooldown behavior that the dedicated app will retain, and every important state mutation has an identified owner.

## Completed validation

Run:

```powershell
python -m unittest discover -s tests -v
```

Result: 7 tests passed.

The test command is intended to become a required GitHub Actions check. The current Phase 02 work does not add the workflow yet because the existing `build.yml` is still the obsolete PyInstaller release pipeline; Phase 07 should replace it with a focused test workflow before removing the old release automation.

The current application has important ownership problems intentionally preserved for later phases: `timers.py` owns global runtime state and persistence serialization, Socket.IO handlers mutate that state directly, and many changes rely on the background loop for synchronization. These are characterization findings, not Phase 02 fixes.

## Handoff

Phase 03 may now reorganize the source package and application entry point. It should preserve the behavior protected by the tests and avoid combining source movement with the state-boundary redesign or Socket.IO event renaming.
