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

```
PS C:\Users\jacob\OneDrive\Desktop\Repos\Deux_n_Dipshits> git status --short --branch
## main...origin/main
PS C:\Users\jacob\OneDrive\Desktop\Repos\Deux_n_Dipshits> git branch --show-current
>> 
main
PS C:\Users\jacob\OneDrive\Desktop\Repos\Deux_n_Dipshits> git log -1 --oneline --decorate
>> 
4be07e2 (HEAD -> main, tag: 26.9.5.1, origin/main, origin/dev, origin/HEAD) Project overhaul documentation
PS C:\Users\jacob\OneDrive\Desktop\Repos\Deux_n_Dipshits> git ls-files
>> 
.github/workflows/build.yml
.gitignore
DnD-Clock.spec
README.md
ai/implementation/README.md
ai/implementation/phase-00-baseline.md
ai/implementation/phase-01-deployment-spike.md
ai/implementation/phase-02-characterization.md
ai/implementation/phase-03-source-refactor.md
ai/implementation/phase-04-state-boundaries.md
ai/implementation/phase-05-persistence.md
ai/implementation/phase-06-realtime-cleanup.md
ai/implementation/phase-07-removal.md
ai/implementation/phase-08-control-modes.md
ai/implementation/phase-09-roster-profiles.md
ai/implementation/phase-10-combat-display.md
ai/implementation/phase-11-spellbook-resources.md
ai/implementation/phase-12-campaign-tabs.md
ai/implementation/phase-13-rehearsal-polish.md
ai/implementation/phase-14-documentation-cleanup.md
ai/project-notes.md
ai/project-plan.md
app.py
build.bat
dist/README.txt
game_logic.py
persistence.py
requirements.txt
routes/control.py
routes/display.py
routes/dm.py
routes/home.py
routes/qr.py
routes/remote.py
settings.json
socket_events.py
start-tunnel.py
static/css/styles.css
static/images/dungeon.png
static/images/forest.png
static/images/mystical_forest.png
static/images/parchment.png
static/images/stone.png
static/images/tavern.png
static/images/tavern_table.png
static/js/control.js
static/js/display.js
static/js/dm.js
static/js/remote.js
static/sounds/ack.mp3
static/sounds/among-us-role.mp3
static/sounds/applepay.mp3
static/sounds/bad-to-the-bone-meme.mp3
static/sounds/correct.mp3
static/sounds/ding.mp3
static/sounds/discord-notification.mp3
static/sounds/dun-dun-dun.mp3
static/sounds/emotional-damage.mp3
static/sounds/error.mp3
static/sounds/fart-w-reverb.mp3
static/sounds/gemini.mp3
static/sounds/google-meet-sound-3.mp3
static/sounds/google-meet-sound.mp3
static/sounds/m-e-o-w.mp3
static/sounds/metal-pipe-clang.mp3
static/sounds/papa-louie1.mp3
static/sounds/papa-louie2.mp3
static/sounds/rizz-sound-effect.mp3
static/sounds/roblox-death.mp3
static/sounds/smoke-detector-beep.mp3
static/sounds/timer1.mp3
static/sounds/timer2.mp3
static/sounds/timer3.wav
static/sounds/timer4.wav
static/sounds/vine-boom.mp3
static/sounds/what-bottom-text.mp3
static/sounds/wrong-answer-buzzer.mp3
static/sounds/yippeeee.mp3
templates/control.html
templates/display.html
templates/dm.html
templates/home.html
templates/remote.html
timers.py
utils.py
PS C:\Users\jacob\OneDrive\Desktop\Repos\Deux_n_Dipshits> git check-ignore -v settings.json dist build 2>$null
>> 
PS C:\Users\jacob\OneDrive\Desktop\Repos\Deux_n_Dipshits> 
```

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

```
PS C:\Users\jacob\OneDrive\Desktop\Repos\Deux_n_Dipshits> git check-ignore -v settings.json dist build 2>$null                                            python --version
>> python -m pip --version
>> python -m pip show Flask Flask-SocketIO eventlet python-socketio
Python 3.14.0
pip 26.0.1 from C:\Users\jacob\AppData\Local\Programs\Python\Python314\Lib\site-packages\pip (python 3.14)
WARNING: Package(s) not found: eventlet
Name: Flask
Version: 3.1.3
Summary: A simple framework for building complex web applications.
Home-page: 
Author: 
Author-email: 
License-Expression: BSD-3-Clause
Location: C:\Users\jacob\AppData\Local\Programs\Python\Python314\Lib\site-packages
Requires: blinker, click, itsdangerous, jinja2, markupsafe, werkzeug
Required-by: Flask-SocketIO
---
Name: Flask-SocketIO
Version: 5.6.1
Summary: Socket.IO integration for Flask applications
Home-page: https://github.com/miguelgrinberg/flask-socketio
Author: 
Author-email: Miguel Grinberg <miguel.grinberg@gmail.com>
License: 
Location: C:\Users\jacob\AppData\Local\Programs\Python\Python314\Lib\site-packages
Requires: blinker, click, flask, Flask, jinja2, python-socketio, werkzeug
Required-by: 
---
Name: python-socketio
Version: 5.16.1
Summary: Socket.IO server and client for Python
Home-page: https://github.com/miguelgrinberg/python-socketio
Author: 
Author-email: Miguel Grinberg <miguel.grinberg@gmail.com>
License: MIT
Location: C:\Users\jacob\AppData\Local\Programs\Python\Python314\Lib\site-packages
Requires: bidict, python-engineio
Required-by: Flask-SocketIO
PS C:\Users\jacob\OneDrive\Desktop\Repos\Deux_n_Dipshits> 
```

### 3. Back up current runtime data

Before starting the application, make a manual copy of `settings.json` outside the repository or in a clearly named temporary backup location. Do not commit secrets or personal data.

Record:

- What data exists in `settings.json`.
  - Mainly data relating to either site settings like sounds or campaign setting like number of timers, etc.
- Whether it contains campaign data, session state, combat state, application settings, or a mixture.
  - A litle mixture of all, you can read the file
- Whether files under `static/` or other folders are user-maintained assets that must survive migration.
  - Id like to keep the sound files but they are user maintained.
- Whether `dist/` contains anything not reproducible from source.
  - dist is just old files generated on build and can be removed

`settings.json` is backed up in the general clone of this application. The sound files under `static/` are user-maintained assets and must be preserved during restructuring.

Do not edit the original file during this phase.

### 4. Run the application locally

From the repository root, run:

```powershell
python app.py
```

Keep the process running and record:

- Whether startup succeeds.
  - startup succeeds
- The local URL and network URL printed by the application.
  - Server running at:
  Local:   http://localhost:5000
  Network: http://192.168.1.150:5000
- Any startup warnings or tracebacks.
  - The only output was Flask's standard development-server warning. This is expected for local debugging and is not a Phase 00 application warning; production deployment behavior will be evaluated in Phase 01.
- Whether the process remains alive after opening the first page.
  - process remains alive

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
  - all pages load
- Any visible server or browser error.
  - no errors
- Any missing template, static asset, or JavaScript error.
  - all assets present
- Whether the route is intended to remain in the dedicated app.
  - unsure of question, but the route remains on the relative base URL

If a route depends on Socket.IO, note whether it connects, but leave detailed two-client investigation to Phase 01.

### 6. Check one harmless existing behavior

Use a disposable timer or test value where possible. Verify one retained behavior, such as:

- A timer can start and update.
- A timer can reset.
- A client can load current state.
- A retained sound or theme asset can load.

All timers work as expected

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

build.bat builds a local set of files for distribution, no longer needed
DnD-Clock.spec has some sort of setting/setup? Im unsure of use
start-tunnel.py was an IP tunnel srvice that is no longer used
build.yml is the GitHub Actions workflow that builds and publishes the old Windows release artifacts. Vercel deployment is a separate GitHub-connected deployment path and must be verified in Phase 01.
dist is the directory that holds locally build files for local runs that can be removed

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

2026-09-09
Branch: main
Commit: 4be07e2 (tagged `26.9.5.1`; exact hash is not important for this baseline)
Working tree: no changes
Python: 3.14.0
Dependencies: Flask, Flask-SocketIO, and python-socketio are installed globally; eventlet is not installed and is not currently required by the threaded configuration.
Settings backup: confirmed in the general clone of this application
Local startup: pass
Routes: all existing routes load successfully
Retained behavior: timers work as expected
Known warnings: only Flask's standard development-server warning; no application or build warnings
Data/assets to preserve: static sound files; static assets may be moved/restructured but must remain available
Distribution-path findings: obsolete and can be removed after Phase 01 deployment verification
Phase 01 ready: yes

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
