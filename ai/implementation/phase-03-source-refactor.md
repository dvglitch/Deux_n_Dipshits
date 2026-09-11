# Phase 03 - Source Package Refactor

Status: Complete for the structural refactor; Vercel preview verification remains.

## Objective
Move application code under `src/dnd_clock/` and keep the root `app.py` a thin local entry point without changing intended behavior.

## Scope
- Introduce application factory/explicit initialization.
- Move routes, templates, static assets, realtime, persistence, and timer ownership under the package.
- Keep `python app.py` and optional F5 debugging working.
- Prevent imports from unexpectedly starting servers or background loops.

## Dependencies
Phases 01-02.

## Deliverables
- Source package and import paths.
- Thin root entry point.
- Local/debug configuration.
- Deployment import proof.

## Success criteria
Local tests and retained routes pass; application creation is testable without launching a server; a preview deployment resolves the new entry point.

## Completed work

- Added `src/dnd_clock/` as the application package.
- Moved Python modules, route modules, templates, and static assets under the package.
- Added package-relative imports for moved modules.
- Added `create_app(start_background_task=True)` in `src/dnd_clock/app.py`.
- Added package-aware Flask template and static asset paths.
- Added a thin root `app.py` that preserves `python app.py` and exports `app`/`socketio` for deployment discovery.
- Added `pyproject.toml` to describe the `src` package and package data.
- Updated characterization tests for the `src` layout.
- Preserved application behavior; state and Socket.IO ownership were not redesigned in this phase.

## Validation completed

- Root entry-point import and route smoke check passed for `/`, `/control`, `/display`, `/dm`, `/remote`, `/qr`, and `/api/sounds`.
- `create_app(start_background_task=False)` can be created without starting the timer loop when `PYTHONPATH=src` is configured.
- All 7 Phase 2 characterization tests pass.

## Remaining handoff check

Deploy the structural refactor to a Vercel preview and confirm that the Flask preset discovers the root `app.py`, package templates/static assets, and Socket.IO routes. Do not combine that deployment check with state or event redesign.

## Handoff to Phase 04

Phase 04 can define explicit application configuration, campaign data, session configuration, and combat state boundaries on top of this package structure. It should preserve the factory and tests while addressing the current `timers.py` global state and JSON persistence coupling.
