# Phase 02 - Characterization

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

## Success criteria
Tests protect the cooldown behavior that the dedicated app will retain, and every important state mutation has an identified owner.
