# Phase 01 Runtime Findings

Date: 2026-09-09
Status: Complete with polling limitation; active-state restart persistence remains unproven and is accepted as disposable behavior.

## Public deployment identified

- Production URL: `https://deux-n-dipshits.vercel.app/`
- Connected repository: `https://github.com/dvglitch/Deux_n_Dipshits`

## Vercel project/deployment facts

- Vercel project: `dn-dipshits/deux-n-dipshits`.
- Production domain: `deux-n-dipshits.vercel.app`.
- Production deploys from the GitHub `main` branch.
- Current production deployment is `Ready`.
- Current deployment commit: `ba801a3`, `Phase 0 initial finding`.
- Current deployment URL: `https://deux-n-dipshits-59347msm8-dn-dipshits.vercel.app`.
- Framework preset: `Flask`.
- Root directory: repository root, with no subdirectory configured.
- Build command: no custom build command configured.
- Output directory: not configured/applicable.
- Install command: default `pip install -r requirements.txt`.
- Fluid Compute: enabled.
- Function region: North America `iad1` is selected; the Hobby plan allows one region.
- Function resources shown: `0.6 vCPU` and `1 GB` memory.
- Project environment variables: none currently added.
- Vercel runtime logs show requests being served by the Flask development-style server output. This should be treated as an architecture concern to resolve, not as proof that production is configured correctly.

After the authorized redeploy on 2026-09-10:

- New production deployment URL: `https://deux-n-dipshits-o9t8hjp44-dn-dipshits.vercel.app`.
- New deployment status: `Ready`.
- Production domain continued to serve successfully.
- The new instance loaded the expected paused defaults: 1:00, 1:40, 1:40, and 2:00.
- The deployment used the same `main` branch and commit `ba801a3`.

The Vercel dashboard did not expose secret values in the inspected project settings. No secrets were copied into this repository.

## Local baseline

- Local entry point: `python app.py`.
- Python: 3.14.0.
- Installed locally: Flask 3.1.3, Flask-SocketIO 5.6.1, python-socketio 5.16.1.
- `eventlet` is not installed. This is not currently a local blocker because the app explicitly configures `async_mode="threading"` and `requirements.txt` does not list eventlet.
- The standard Flask development-server warning is expected for local debugging and is not treated as an application failure.

## Local HTTP smoke test

The Flask test client returned HTTP 200 for every current route:

- `/`
- `/control`
- `/display`
- `/dm`
- `/remote`
- `/qr`
- `/api/sounds`

Phase 00 also confirmed that the pages and their static assets load in a browser.

## Local Socket.IO smoke test

A Flask-SocketIO test client:

- Connected successfully.
- Received the initial `control_update` event.
- Disconnected successfully.

## Local realtime/timer test

Two Flask-SocketIO test clients were connected to the same imported application. One client emitted `toggle` for timer 1. After approximately 1.2 seconds:

- Timer 1 changed from approximately 60 seconds remaining to approximately 59 seconds.
- Timer 1 was running.
- Both clients received `update` events.

This confirms that the current local process shares runtime state and that the background timer loop emits live updates to connected clients.

## Public Vercel smoke observations

- The public home page loads successfully.
- The public `/control` page loads and displays the current cooldown-mode controls and four timers.
- The public `/display` page loads.
- The integrated browser observed a failed WebSocket upgrade for `wss://deux-n-dipshits.vercel.app/socket.io/`.
- The browser also observed successful Engine.IO polling requests to `/socket.io/`, indicating that the client is falling back to polling rather than maintaining a confirmed WebSocket connection.
- This is not yet a complete two-client synchronization or timer-lifecycle test. Do not treat polling fallback as proof that Vercel reliably supports the intended realtime architecture.

## Production cross-client test

Using two separate production `/control` browser pages:

1. Both clients connected through polling fallback.
2. `Start All` was triggered from one client.
3. Both clients displayed all timers as running and showed matching countdown progression.
4. `Reset All` was triggered immediately afterward.
5. Both clients returned to the original paused values: 1:00, 1:40, 1:40, and 2:00.

This confirms that the current production deployment can synchronize a live timer mutation between two clients while the deployment instance is active. The test changed only disposable live timer state and restored it immediately.

## Production reconnect test

- One production control page was reloaded after the reset.
- After the polling connection re-established, it received the current `Cooldown Mode` state and the paused timer values.
- The reconnect check passed through polling; WebSocket transport remains unconfirmed because the upgrade failed.

## Post-redeploy production test

- A fresh production `/control` client connected after the redeploy and received the expected current state through polling.
- A second client connected to the same production domain.
- `Start All` from the fresh client caused both clients to show running timers and matching countdown progression.
- `Reset All` then returned both clients to 1:00, 1:40, 1:40, and 2:00 paused.
- This confirms the new deployment remains functional and synchronized after redeploy.
- The test does not prove whether an active timer survives or resets across a deployment because the timers were already reset before the redeploy. Disposable-state reset on restart remains an accepted design outcome, but its observed behavior is not yet measured.

## Important local architecture facts

- Importing `app.py` constructs the Flask and Socket.IO applications and starts the background timer task.
- Socket.IO is configured with `cors_allowed_origins="*"` and `async_mode="threading"`.
- Runtime timer state is held in module-level globals in `timers.py`.
- `timers.py` loads and saves `settings.json` through `persistence.py`.
- The timer loop emits updates every 0.5 seconds.
- Current event handlers mutate module-level state directly through `timers.py` functions.
- The local tests therefore validate a single long-lived process, not Vercel's deployment lifecycle.

## Vercel work required from the user

The following information must come from the Vercel dashboard or deployment logs. Do not copy secret values into the repository.

1. Open the Vercel project connected to this GitHub repository.
2. Record the production project URL.
3. In project settings, record:
   - Connected repository.
   - Production branch.
   - Root directory.
   - Framework preset.
   - Install command.
   - Build command.
   - Output directory.
   - Functions/runtime settings.
   - Environment-variable names only, grouped by Development, Preview, and Production.
4. Open the latest successful production deployment and record:
   - Commit deployed.
   - Build command actually executed.
   - Python entry point or function path.
   - Whether templates and static assets were included.
   - Any runtime errors after deployment.
5. Open a preview deployment if available and use it for tests before touching production.
6. Test the deployed URL for `/`, `/control`, `/display`, `/dm`, `/remote`, `/qr`, and `/api/sounds`.
7. Open two browser contexts against the same deployment and test:
   - Socket.IO connection.
   - One harmless state update.
   - Update received by both clients.
   - Reconnection receives current state.
8. Test timer progression after leaving the deployment idle briefly.
9. Trigger or wait for a safe preview deployment restart and record whether disposable state resets, stalls, or splits between clients.

## Dashboard access limitation

The authenticated project dashboard is now available through the shared browser page. Secret values must still not be copied into this repository or chat.

## Current conclusion

The local runtime model works in one long-lived process. The public deployment renders pages, synchronizes live timer changes between two clients, and restores current state after a client reload using polling fallback. A redeploy produced a ready replacement deployment that continued to serve and synchronize correctly. Vercel's Fluid Compute setting is enabled and may help preserve a process for longer. The remaining limitation is that an active timer was not present before the redeploy, so active-state reset versus persistence was not directly observed. The current provisional outcome is **Supported with polling limitations; active-state lifecycle behavior needs one targeted test if the distinction matters**.

## Phase 03 deployment incident

After the Phase 03 source-package deployment from commit `03329d8`, Vercel runtime logs reported:

```text
could not import "app.py"
...
File "/var/task/app.py", line 10, in <module>
   from dnd_clock.app import app, socketio
File "/var/task/src/dnd_clock/app.py", line 3, in <module>
   from flask import Flask, jsonify, send_from_directory
ModuleNotFoundError: No module named 'flask'
```

The root launcher and `src` package were found correctly, but the deployed environment did not install the runtime dependencies after `pyproject.toml` was introduced. The local environment masked this because Flask was already installed globally.

Resolution applied locally: declare the existing runtime dependencies in `pyproject.toml` as well as retaining `requirements.txt`. The dependency metadata parses successfully and all 7 characterization tests pass locally. A new deployment is required to validate the fix.

Post-fix redeploy validation was confirmed by the user: deployment, pages, and timer functionality work as expected.

Current phase outcome: **Complete with polling limitation**.
