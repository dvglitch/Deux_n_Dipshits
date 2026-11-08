# User-Reported Session Reset and Dungeon Map Needs

Date recorded: 2026-11-08

## User report

- Supabase warned on October 28 that the project might be paused because of low traffic. The user reports that the site/database appears available now; this remains an operational item to check in the Supabase dashboard.
- With the display, DM controller, session control, and player controls open together, live session state sometimes appears to desynchronize or reset. The reported example is player HP changing to 30 rather than the profile's max HP.
- The user suspects page startup/load behavior may overwrite current browser data with stored defaults. This is not established by the code review.
- The user proposes an explicit session lifecycle: start from the landing page, load database data into the active site state, and save/end explicitly or automatically after 12 hours.
- The user would also like editable, recolorable rectangles on map images, especially for dungeon maps.

## Follow-up validation observations (2026-11-08)

The user tested with display, DM, and player remote open on different devices, refreshed all pages (including hard refreshes), and did not invoke Start Session:

- Test HP was 16. Players with max HP 32 started at 30 HP.
- At about 5:41, the pages were left open in the background.
- At about 5:44, DM and player remote showed 20 HP while display showed 16. The user is unsure whether the change to 20 was caused by their own input.
- Refreshing display then showed 20 HP, but the first display refresh remained stuck on the “Audio Sync Required” overlay; a second refresh cleared the issue.
- At about 5:51, after closing DM, refreshing player remote showed 16 HP again. The display had been switched to World Map, but after refresh showed the Timers tab.
- The user stopped the test, expecting the eventual full reset to 30 HP may still recur.

These are user observations, not server logs; timestamps are approximate and the 16-to-20 edit is not attributed.

### Follow-up reset after controller reload (2026-11-08, about 18:04 local)

- The user reports that after reloading the controller tab, HP was back to 30.
- The user had previously noted that profiles with max HP 32 started at 30. This repeat makes the 30-HP value look like a recurring restored/default snapshot rather than a one-off display rendering glitch.
- It is not yet clear whether every device/page changed simultaneously, or only what the reloaded controller showed. No new Vercel request/runtime evidence has been correlated to this 18:04 event yet.
- This strengthens the cold/stale runtime snapshot hypothesis, but it does not by itself prove a process restart: refreshing a controller is a new Socket.IO connection and may be routed to a different process, while the logs have not exposed a runtime identity or HP state.

### Vercel production log inspection

The user authenticated the integrated browser to the project's Vercel Runtime Logs. The selected window covered approximately 17:27–17:56 local time on Nov 8 (matching the user's 5:41–5:51 PM test period). Findings:

- The refreshed `/display` request around 17:50:55 and `/remote` request around 17:51:06 returned HTTP 200.
- Socket.IO requests around those page loads show transport/session churn: several polling or WebSocket requests returned HTTP 400, while adjacent/new Socket.IO sessions and polling requests returned HTTP 200. The same SID could be involved in failed polling after another transport request; this fits reconnect/transport fallback behavior.
- The error-level filter showed five `Invalid session <sid>` Socket.IO messages around 17:34, before the reported test period. They were production Function logs for the Flask route in `cle1`; the visible metadata did not expose a distinct process/instance identifier.
- The request/runtime logs show no HP values, state revisions, explicit Start Session event, database health results, or process identity. Thus they cannot establish which process served each page, whether a session mutation was applied, or why a particular HP value was rendered.

Interpretation: the logs confirm real Socket.IO invalid-session/HTTP-400 reconnect behavior in production and reinforce that realtime transport/session continuity deserves investigation. They do not prove that the 5:41–5:51 HP divergence was caused by multiple Vercel instances or that any particular request reset HP. A 400 during WebSocket upgrade can also be followed by a successful polling connection, so an individual 400 is not by itself a lost-state proof.

## Initial code facts checked

- `src/dnd_clock/timers.py` stores live timers and HP in module-level Python globals. The database repository currently stores campaign collections, not a canonical live-session snapshot.
- On a Socket.IO connection, `realtime/events.py` sends the current process's in-memory control state and timer payload. It does not load session state from the database on each browser/page startup.
- `start_session` is an explicit Socket.IO command. It reads campaign player profiles, synchronizes timers, resets cooldowns, and is intended to initialize HP and spell slots from profile maxima. `reset_all` resets cooldown timers only; it does not reset HP.
- At application initialization, `timers.init_timers()` tries to sync campaign profiles and restore live progress from `settings.json`. If profile loading fails, `sync_with_campaign_profiles` catches the exception and treats the profile collection as empty; initialization then falls back to legacy settings/default values, including HP defaults of 30.
- Even when profile loading succeeds, cold-start profile sync restores current HP from `settings.json` when present, rather than automatically restoring to max HP. Thus a profile with max HP 32 showing 30 is consistent with the code restoring a saved/stale current value of 30; it does not by itself prove a Supabase outage. The expected full-HP initialization is tied to the explicit Start Session action, which the user did not invoke in this test.
- `add_timer` also initializes new combatants with 30 HP. For a profile-backed party, the intended fresh-session HP is the profile's `max_hp`, so a 30-HP reset is a clue that defaults, a placeholder, or a stale/different runtime may be involved; it is not proof of which path occurred.
- Campaign-maintenance profile reads populate the maintenance UI. Saving player profiles synchronizes profile configuration into the current runtime while preserving in-memory current HP where a matching timer exists. This is not the same as reloading and replacing the live session on every page load.
- `settings.json` contains both configuration and snapshots of live state. It is local filesystem persistence, separate from Supabase; it is not a suitable cross-instance source of truth on a serverless deployment.
- Existing production observations in `implementation/phase-01-runtime-findings.md` verified polling-based synchronization between two clients while active, but did not prove state consistency across distinct server instances or a live session across process restart.
- The current tests verify basic realtime HP mutation and domain-level session-start behavior. They do not cover a deployment cold start, failed profile reads, multiple runtime instances, or preservation of a live session across reconnect/restart.

## Assessment

The new observations increase confidence in the process-local state hypothesis: at one point clients showed 16 and 20 HP, then a later player refresh showed 16 again, while a display refresh also reverted its selected tab from World Map to Timers. That pattern is consistent with pages connecting to runtimes holding different in-memory state/control settings, or with an unobserved state mutation followed by a stale snapshot. A browser page does not load and overwrite canonical live state on connect; it receives whatever the serving process currently has.

The 30/32 HP result is specifically consistent with cold-start sync restoring a saved current HP of 30 from `settings.json` and clamping it to the profile maximum of 32. It is not necessarily a failure to load the profile. No Start Session event was used, so full HP was not expected from the current startup path. The observation therefore exposes a separate UX/semantics problem: after a cold start, the stored combat snapshot may be stale, but the UI does not distinguish an active recovered session from a new session that should begin at max HP.

The “Audio Sync Required” issue may be an independent first-update/click timing race: the display creates the overlay when its first timer update arrives, while audio initialization can occur on a prior click and only hides an overlay that already exists. This is a plausible code-level explanation, not yet reproduced.

The test substantially supports the hypothesis that stale/inconsistent session state is involved, especially given divergent simultaneous views, the display-tab revert, and a later controller reload followed by HP returning to 30. The Vercel log inspection confirms Socket.IO invalid-session and 400 reconnect/transport behavior, but still does not prove multiple Vercel instances caused the HP divergence: logs have no process identity or state payload/revision, and the possible HP adjustment at 5:44 is uncertain. Check the persistence health endpoint and Supabase project status when the issue occurs, but note that a healthy database does not guarantee shared live state. Do not copy connection strings or keys into notes.

## Recommended direction

1. Make live session state canonical outside a single Python process before relying on an “active session” toggle to solve desynchronization. Evaluate whether the deployed Socket.IO/runtime arrangement can route all clients to one authoritative service; if not, use a shared state mechanism with conflict control or move the realtime authority to a compatible long-lived host.
2. Add a durable current-session record and an explicit lifecycle:
   - Start: load the selected roster and campaign data, then initialize the intended fresh-session resources.
   - During play: persist state-changing commands/checkpoints, not every timer tick. Represent timer progress using an authoritative timestamp/anchor so a process restart does not need a database write every half-second.
   - End: explicitly close/archive the session and retain any desired recap.
   - Expiry: treat 12 hours as a server-enforced inactivity lease, not a browser timer. Record `last_activity_at`/expiry and define whether expiry preserves a recoverable snapshot or closes it. A browser tab closing must not be required for saving.
3. Use a session revision/transaction or equivalent single-writer rule so stale clients cannot overwrite newer state. Broadcast only after the canonical update succeeds; if persistence is unavailable, show an explicit error/degraded state instead of silently substituting defaults.
4. Add focused regression tests for two clients, reconnect, failed profile reads, process restart, and stale-write rejection. Add safe diagnostic logging for runtime identity, session revision, roster count, and fallback reason (never secrets or full player data).
5. Treat the Supabase warning as a separate availability/billing/free-tier concern. Verify current project status and the provider's current inactivity policy in its dashboard. A 12-hour application session lifecycle or a one-off health check does not itself guarantee that the database will not pause; do not add artificial keepalive writes without first checking the provider's current rules and the project's plan.

## Dungeon-map rectangles

Treat shapes as editable overlays on a map, not edits to the uploaded image. Persist per-map rectangle annotations with normalized coordinates (0–1) so they remain aligned when the display scales the image. A first version can support draw/select, move/resize, delete, fill/outline color, and opacity. SVG or an equivalent vector overlay is preferable to a flattened image because it keeps shapes editable and separate from map assets and existing markers.

## Suggested next implementation sequence

1. Add temporary, safe diagnostics or a controlled test build that records a non-secret runtime identifier with each connect/update, plus state revision and active-map/tab values. If pages at the same time receive different runtime identifiers or revisions, this confirms split process-local state. The currently available Vercel runtime logs do not include such an identifier; correlate future diagnostics with them without logging player data or secrets.
2. Reproduce cold initialization with max HP 32 and a saved `timer_hp` of 30. Verify it restores 30 without Start Session, then verify Start Session restores 32. This confirms the known 30/32 startup behavior independently of deployment routing.
3. Confirm the hosting/runtime behavior and add tests reproducing the current cold-start/profile-failure behavior.
4. Implement canonical live-session persistence and cross-instance synchronization; update the older design notes that currently call live combat state disposable once the desired restart/expiry behavior is confirmed.
5. Add a visible session status and explicit Start/End controls, with a server-enforced configurable inactivity expiry (12 hours as the user's proposed default).
6. Investigate and test the display audio-overlay timing race.
7. Implement map rectangle overlays as a separate feature after the session-state reliability work.

## Implementation update

The user approved reconnect/resume, autosaving meaningful state changes, a manual Save Session checkpoint, Start New Session as an intentional reset, and no automatic expiry. The implementation now stores a revisioned active-session snapshot separately from campaign collections. Socket.IO mutations reload the canonical snapshot before applying changes and persist before broadcasting; compare-and-swap revisions reject writes based on stale snapshots. Pages request canonical state every two seconds, and timer-loop broadcasts no longer send process-local snapshots over shared clients. Timer progress is reconstructed from saved timestamps, including timer completion.

The Session Control page now exposes Save Session and a visible persistence status/error. Fresh-session behavior is covered against a local profile with max HP 32 and verifies full HP and spell-slot restoration.

Validation completed locally: `python -m unittest discover -s tests -v` passed all 44 tests, and `git diff --check` passed. Tests set database URL variables empty before application imports and patch realtime persistence to temporary SQLite, so this validation did not intentionally connect to Supabase. No preview deployment or production active-session read/write was performed.

Important safety note: an earlier test run before database isolation used the configured repository adapter and may have written fixture data to the production active-session row. The user was informed; do not read, overwrite, or delete that row without explicit approval. The worktree also contains a modified `settings.json` from earlier test execution; it was left untouched to avoid overwriting possible local game data.

Remaining follow-up: inspect the production active-session row with the user's approval before enabling the deployment; verify migration/behavior in a controlled preview; investigate the first-refresh audio overlay separately; editable map rectangles remain a separate unimplemented feature. Keep the Supabase low-traffic pause warning as an operational dashboard check, not something addressed by artificial keepalive writes.
