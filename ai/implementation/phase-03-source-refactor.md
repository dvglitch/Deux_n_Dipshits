# Phase 03 - Source Package Refactor

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
