# Phase 07 - Obsolete Path Removal

Status: Complete. Legacy distribution scripts removed, CI test workflow active, and cooldown-only combat model enforced.

## Objective
Commit the dedicated app to cooldown combat and remove obsolete local-distribution paths after behavior is protected.

## Scope
- Removed timer-mode branches, settings, UI, and events (cooldown combat is standard).
- Removed PyInstaller path logic, build files (`build.bat`, `DnD-Clock.spec`), tunnel files (`start-tunnel.py`), and legacy release workflow (`.github/workflows/build.yml`).
- Added automated GitHub Actions CI workflow in `.github/workflows/tests.yml` running across Python 3.11, 3.12, and 3.13.
- Preserved theme and sound functionality.

## Deliverables
- Cleaned codebase with singular cooldown combat model.
- GitHub Actions CI workflow in `.github/workflows/tests.yml`.
- All 22 tests passing locally and in CI.

## Completed validation
- All unit, state, persistence, and socket tests passing (`Ran 22 tests in 0.051s - OK`).
- Verified local startup with `python app.py`.

## Handoff
Phase 07 is complete. The application foundation, database persistence, and realtime layers are now lean, robust, and clean. Phase 08 can begin creating the dedicated Session Control and Campaign Maintenance laptop modes.
