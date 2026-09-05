# Phase 07 - Obsolete Path Removal

## Objective
Commit the dedicated app to cooldown combat and remove obsolete local-distribution paths after behavior is protected.

## Scope
- Remove timer-mode branches, settings, UI, and events.
- Remove quick-adjust if inventory confirms it is unused.
- Remove PyInstaller path logic, build files, tunnel files, release workflow, dependency, and tracked artifacts.
- Preserve valued sounds/theme behavior.

## Dependencies
Phases 02-04 and 06, plus deployment verification.

## Deliverables
Simplified dedicated app, dependency cleanup, and no obsolete executable release pipeline.

## Success criteria
Cooldown tests pass, `python app.py` works, Vercel deploys, and retained assets/features remain functional.
