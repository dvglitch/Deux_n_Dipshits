# Phase 00 - Baseline

## Objective

Create a recoverable starting point and confirm the dedicated-app scope before structural changes.

## Scope

- Inspect git status, branches, ignored files, and tracked runtime data.
- Preserve user changes; do not reset or overwrite unrelated work.
- Capture a known-good local run and identify data that must survive migration.
- Confirm the general application remains available separately.

## Exact steps

Complete these steps from the repository root in PowerShell. Do not run destructive git commands such as `git reset --hard` or `git clean`.

### 1. Record the repository state

Run:

```powershell
git status --short --branch
git branch --show-current
git log -1 --oneline --decorate
git ls-files
git check-ignore -v settings.json dist build 2>$null
```

Record:

- Current branch.
- Current commit hash and message.
- Whether the working tree is clean or has existing user changes.
- Whether `settings.json`, `dist/`, and other runtime/build artifacts are tracked or ignored.
- Any files that must not be changed during foundation work.

Do not create a commit automatically. If a baseline commit or tag is wanted, create it only after reviewing the working-tree state.

### 2. Confirm the local Python environment

Run:

```powershell
python --version
python -m pip --version
python -m pip show Flask Flask-SocketIO eventlet python-socketio
```

If dependencies are not installed, record that fact rather than changing the environment without agreement. If a virtual environment exists, record its path and interpreter version.

Record:

- Python version.
- Active interpreter or virtual-environment path.
- Whether required dependencies are installed.
- Any import or version errors.

### 3. Back up current runtime data

Before starting the application, make a manual copy of `settings.json` outside the repository or in a clearly named temporary backup location. Do not commit secrets or personal data.

Record:

- What data exists in `settings.json`.
- Whether it contains campaign data, session state, combat state, application settings, or a mixture.
- Whether files under `static/` or other folders are user-maintained assets that must survive migration.
- Whether `dist/` contains anything not reproducible from source.

Do not edit the original file during this phase.

### 4. Run the application locally

From the repository root, run:

```powershell
python app.py
```

Keep the process running and record:

- Whether startup succeeds.
- The local URL and network URL printed by the application.
- Any startup warnings or tracebacks.
- Whether the process remains alive after opening the first page.

Stop the process with `Ctrl+C` after the smoke checks. Do not make code changes to fix issues during Phase 00; record them for Phase 01 or Phase 02.

### 5. Perform a minimal route smoke test

Open the local application and check these existing routes:

```text
/
/control
/display
/dm
/remote
/qr
```

Record for each route:

- Whether it loads successfully.
- Any visible server or browser error.
- Any missing template, static asset, or JavaScript error.
- Whether the route is intended to remain in the dedicated app.

If a route depends on Socket.IO, note whether it connects, but leave detailed two-client investigation to Phase 01.

### 6. Check one harmless existing behavior

Use a disposable timer or test value where possible. Verify one retained behavior, such as:

- A timer can start and update.
- A timer can reset.
- A client can load current state.
- A retained sound or theme asset can load.

Do not perform a destructive reset against important personal data. Record the behavior and any error; detailed realtime testing belongs to Phase 01.

### 7. Review the old distribution path

Confirm the presence and current purpose of:

```text
build.bat
DnD-Clock.spec
start-tunnel.py
.github/workflows/build.yml
dist/
```

Record whether any are still needed for recovery, local testing, or another user. Do not delete them in Phase 00.

### 8. Complete the handoff record

Add a short dated result to the bottom of this file or to a separate baseline record containing:

- Baseline date.
- Current branch and commit.
- Working-tree status.
- Python/dependency result.
- Local startup result.
- Route smoke-test result.
- Existing warnings/errors.
- Data and assets that must be preserved.
- Distribution files confirmed obsolete or still uncertain.
- Whether Phase 01 can begin.

## Dependencies

None.

## Deliverables

- Baseline commit/tag created by the user if desired, or a documented current commit/working-tree snapshot. The implementation work should not create a commit automatically.
- Data-preservation checklist.
- Confirmed scope and non-goals.
- Local environment and startup record.
- Route smoke-test record.
- List of known baseline issues.

## Validation

- `python app.py` starts locally.
- Existing key routes can be opened.
- Current settings/data have a backup or recovery path.
- At least one retained local behavior has been observed.
- No user changes were reset, overwritten, or committed automatically.

## Completion template

Copy and fill this in when the phase is complete:

```text
Baseline date:
Branch:
Commit:
Working tree:
Python/interpreter:
Dependencies:
Local startup: pass/fail
Routes checked:
Retained behavior checked:
Known errors/warnings:
Data/assets to preserve:
Distribution-path findings:
Phase 01 ready: yes/no
Notes:
```

## Handoff

Record the completed baseline template, known failures, preserved data, and the current deployment/repository questions before Phase 01.
