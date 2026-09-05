# Deux n Dipshits Dedicated App
## Project and Implementation Plan

Status: Planning

Detailed phase briefs are in [implementation/README.md](implementation/README.md). Phase 01 has the first full execution plan; later phase briefs should be expanded immediately before implementation begins so they can incorporate findings from earlier phases.

This plan describes the order for turning the current general-purpose DnD timer application into a focused combat and campaign tool for one DnD group. It is intentionally staged so that deployment, state ownership, persistence, and realtime behavior are understood before new features are built on top of them.

The plan is organized around small, testable phases. A phase should not be considered complete because its code exists; it is complete when its success criteria are met and the next phase can safely depend on it.

## Product goal

Create a fast, low-interruption combat support application for one DnD group:

- The TV shows active player cooldowns, general HP, conditions, and a compact enemy status area.
- Player phones provide simple cooldown controls plus separate Spellbook and Resources views.
- The DM phone provides fast control of player timers, enemy timers, global session actions, locks, restores, and display tabs.
- The laptop provides separate Session Control and Campaign Maintenance modes.
- Campaign data persists between sessions.
- Live session and combat state may reset after a server restart or deployment.
- The dedicated app commits to the cooldown-based combat model.

## Product boundaries

### Primary users and surfaces

| Surface | User | Responsibility |
| --- | --- | --- |
| Home | None | Opening page and navigation entry point |
| Control | DM on laptop | Session Control and Campaign Maintenance modes |
| DM | DM on phone | Live player/enemy controls and display-tab control |
| Display | Everyone on TV | Shared timers and selected campaign-information view |
| Remote | Individual player on phone | That player's Control, Spellbook, and Resources views |
| QR | None | Player-control access utility |

### Durable campaign data

- Permanent player profiles.
- Known spells and user-managed spell descriptions.
- Maximum HP.
- Spell-slot maximums by level or resource group.
- Optional portrait and DM-selected accent color.
- World maps and marker positions.
- Objectives.
- Session recaps.

### Disposable session and combat data

- Active permanent players and temporary guests.
- Current player and enemy timers.
- Current HP.
- Expended spell slots.
- Active conditions.
- Active enemy roster.
- Session lock/pause state.
- Selected display tab.

A server restart or deployment may clear disposable state. Starting a session is an explicit operation and should restore HP and spell slots, clear enemies and combat timers, activate the selected roster, and switch the display to Timers.

### Explicit non-goals for the first dedicated version

- A general-purpose configurable combat platform.
- A tactical battle map or combat-token simulator.
- Automatic character-sheet rules or a class-specific spell engine.
- Tracking how many spells a player knows.
- Full authentication or permission management.
- Player-controlled profile customization.
- A scrolling enemy ticker as the default enemy display.
- A Party tab that duplicates the timer display.
- A session-notes tab.
- Preserving the old timer-based combat mode in the dedicated app.
- Preserving the rarely used quick-adjust feature unless later evidence justifies it.

## Working principles

- Make the player experience opinionated and polished.
- Preserve DM flexibility when it improves live-session control without adding visible clutter.
- Keep campaign, session, combat, and application configuration state distinct.
- Let the server own state transitions and broadcast canonical resulting state.
- Do not make timer ticks depend on database requests.
- Use focused prototypes when design uncertainty cannot be resolved by discussion.
- Prefer small, explicit abstractions over a large framework or generic admin system.
- Treat free-tier service limits and deployment behavior as hard constraints.
- Preserve the background theme, timer-complete sound, and hand-raise sound where practical.

## Phase 0: Confirm scope and protect the baseline

### Purpose

Freeze the agreed product direction and preserve a recoverable baseline before structural changes begin.

### Work

- Confirm the current repository branch and working-tree state.
- Tag or otherwise record a known-good baseline without rewriting user changes.
- Confirm that the general application remains available separately as a source of future ideas.
- Record the product boundaries from this plan in the implementation issue or project tracker.
- Identify any user data that must be preserved before state migration.

### Dependencies

None.

### Deliverables

- Recoverable baseline.
- Confirmed dedicated-app scope.
- List of data and behaviors that must not be lost during migration.

### Success criteria

- The current application can still be run locally from the baseline.
- Existing campaign/timer data has a backup or clear preservation path.
- No implementation feature work has started before the baseline is understood.

## Phase 1: Deployment and runtime feasibility spike

### Purpose

Verify how Vercel currently builds and runs the application before reorganizing its entry point or committing to a persistence/realtime architecture.

### Work

Inspect the Vercel project dashboard and deployment logs for:

- Connected GitHub repository and production branch.
- Root directory.
- Framework preset.
- Build and install commands.
- Python entry point.
- Environment variables for local, preview, and production deployments.
- Current successful deployment behavior.

Test the deployed application for:

- HTTP page access.
- Database connectivity using a minimal proof only if a provider is already configured.
- Socket.IO connection and reconnection.
- Two clients receiving the same update.
- Server-side timer progression.
- Background-task lifecycle.
- Behavior after a deployment restart or instance replacement.

### Dependencies

Phase 0.

### Deliverables

- Deployment configuration record in the project notes.
- A short compatibility decision for Flask-SocketIO, background timers, and Vercel.
- A decision on whether the realtime authority remains on Vercel or needs another hosting/service arrangement.
- A list of required environment variables with secret values kept out of git.

### Success criteria

- We can explain exactly how production is deployed.
- We know whether connected clients can reliably share live state.
- We know whether the server-side timer loop survives the deployment model.
- Any hosting limitation is discovered before feature architecture depends on it.

### Gate

Do not proceed with the production persistence or realtime design until this phase is understood. If Vercel cannot reliably support the live server model, choose the hosting/realtime arrangement before continuing.

## Phase 2: Characterization tests and code inventory

### Purpose

Capture current behavior before moving files or removing old branches. These tests are protection against accidental regressions, not an attempt to preserve every obsolete feature.

### Work

Inventory:

- Top-level Python modules.
- Route blueprints.
- Templates and JavaScript clients.
- Socket.IO events and listeners.
- Persistence reads and writes.
- Settings fields and their consumers.
- Timer-loop ownership.
- Cooldown-mode branches.
- Asset-serving behavior.

Add focused Python tests for behavior that the dedicated app still needs:

- Timer start, completion, pause, and reset.
- Cooldown duration and default duration behavior.
- Active timer override behavior.
- Initiative-based cooldown adjustment behavior.
- Lock state behavior.
- Conditions and hand-raise state where retained.
- Persistence load/save behavior currently relied upon.

Mark old timer-mode and quick-adjust behavior as removal candidates instead of writing new tests for them unless needed to understand migration.

### Dependencies

Phase 1.

### Deliverables

- Module and dependency inventory.
- Event inventory.
- Settings/state inventory.
- Initial Python test suite.
- List of behavior intentionally retained, changed, or removed.

### Success criteria

- Tests run from a documented local command.
- The retained cooldown behavior has executable protection.
- We can identify where each current piece of state is read, mutated, persisted, and broadcast.
- No major refactor begins while important behavior remains completely unobserved.

## Phase 3: Source-package and application-entry refactor

### Purpose

Improve file ownership and make local debugging and deployment imports predictable without changing product behavior unnecessarily.

### Target shape

```text
src/
└── dnd_clock/
    ├── __init__.py
    ├── app.py
    ├── config.py
    ├── domain/
    ├── routes/
    ├── realtime/
    ├── persistence/
    ├── services/
    ├── templates/
    └── static/
tests/
app.py
README.md
requirements.txt
```

### Work

- Move application code under a source package.
- Keep root `app.py` as a thin local-debug entry point.
- Introduce an application factory or equivalent explicit initialization function.
- Move Flask and Socket.IO setup into the application package.
- Move route modules under the route package while preserving workflow ownership.
- Move templates and static assets under the application package if compatible with deployment.
- Separate local-only URL printing and browser/debug behavior from import-time setup.
- Add a VS Code F5 configuration if useful, while preserving `python app.py`.
- Keep background tasks explicit and testable rather than starting them unexpectedly during imports.

### Dependencies

Phases 1 and 2.

### Deliverables

- Source package structure.
- Thin root entry point.
- Local run/debug configuration.
- Updated import paths.
- No behavior change beyond the intended structural move.

### Success criteria

- `python app.py` starts the local application.
- F5 debugging can start the application if configured.
- The application can be imported by tests without launching a server or background loop unexpectedly.
- Existing retained routes and realtime behavior still work locally.
- Deployment can resolve the new entry point in a minimal preview deployment.

## Phase 4: Configuration and state-boundary redesign

### Purpose

Replace the mixed settings model with explicit ownership for application configuration, campaign data, session configuration, and live combat state.

### Work

Define and document these boundaries:

- Application configuration: debug mode, host/port, deployment settings, provider URLs, and secrets.
- Campaign data: permanent players, spells, resource maximums, portraits/colors, maps, objectives, and recaps.
- Session configuration: active roster, guest profiles, selected display tab, and session metadata.
- Combat state: timers, conditions, current HP, expended slots, enemies, pause/lock state, and other disposable values.

- Remove the cooldown-mode switch from the dedicated model after its consumers are understood.
- Define the session-start transition explicitly.
- Define reset and restore semantics so campaign data cannot be cleared by a combat reset.
- Define current HP and current spell-slot permissions for DM and players.
- Preserve theme and sound choices in an appropriate configuration or campaign-owned location.
- Replace implicit dictionary mutation with typed or validated state boundaries where practical.

### Dependencies

Phases 2 and 3.

### Deliverables

- State model documentation.
- Migration mapping from old `settings.json` fields.
- Explicit reset/restore behavior.
- Configuration loading strategy for local and Vercel environments.
- Tests for state boundaries and session-start behavior.

### Success criteria

- A combat reset cannot erase campaign data.
- A session start restores HP and slots, clears live combat state, activates the chosen roster, and selects Timers.
- A server restart may clear disposable state without losing campaign data.
- Missing or malformed configuration fails clearly.
- The cooldown-based model is the only active combat direction in the dedicated application.

## Phase 5: Persistence provider and repository layer

### Purpose

Establish durable campaign persistence before campaign features are implemented, while keeping live combat state fast and independent from database tick traffic.

### Provider direction

Use a free-tier managed PostgreSQL provider for production, with Supabase as the provisional preference because it can cover PostgreSQL and small portrait storage in one service. Neon remains the fallback if its free database-only offering is a better fit after verification.

The provider is not final until free-tier limits, billing requirements, connection behavior, backups/exports, and portrait storage are checked.

### Work

- Create a provider project using only free services.
- Configure local and Vercel environment variables without committing secrets.
- Define a small initial schema for campaign objects and durable configuration.
- Add migrations and a documented migration command.
- Add seed data or a safe empty-state initializer.
- Create repository interfaces for campaign, session boundary operations, and any durable configuration.
- Add a local test adapter using SQLite or in-memory storage where practical.
- Add the production PostgreSQL adapter.
- Add portrait storage with one optional image per permanent player, replacement semantics, and a practical size/type limit.
- Keep disposable combat state in the runtime authority/cache rather than writing every timer tick.
- Persist deliberate campaign changes and session-start/reset boundaries as defined by the state model.
- Document backup/export and recovery steps.

### Dependencies

Phases 1 through 4. The Vercel runtime must be understood before selecting the final production adapter.

### Deliverables

- Free-tier provider setup guide.
- Environment-variable checklist.
- Initial schema and migrations.
- Repository interfaces and adapters.
- Seed/empty-state workflow.
- Portrait storage strategy.
- Persistence tests.

### Success criteria

- A local developer can configure the database from documented steps.
- The deployed application can read and write durable campaign data.
- A deployment restart does not erase campaign data.
- A failed save is visible to the user and does not masquerade as success.
- Timer ticks do not depend on a database round trip.
- The project has no paid-only dependency or undisclosed overage risk.

### Gate

Do not implement campaign editors until a deployed read/write proof succeeds and the recovery path is understood.

## Phase 6: Socket.IO and realtime-state cleanup

### Purpose

Replace the accumulated event patchwork with explicit commands, centralized state transitions, and canonical broadcasts.

### Work

Inventory and classify current events by:

- Client command.
- Server state mutation.
- Canonical state broadcast.
- One-time notification or sound trigger.
- Connection/bootstrap behavior.

Define consistent event naming and payload contracts. Candidate command families include:

- `start_player_timer`
- `reset_player_timer`
- `override_player_timer`
- `update_player_default_cooldown`
- `pause_all`
- `reset_session`
- `restore_resources`
- `update_player_hp`
- `update_spell_slots`
- `toggle_condition`
- `set_display_tab`
- `start_enemy_timer`
- `pause_enemy_timer`
- `update_roster`

The exact names are not final until the event inventory is complete.

- Make server-side state transitions the source of truth.
- Broadcast resulting canonical state after successful mutation.
- Return explicit errors for invalid commands or failed persistence.
- Define connection bootstrap payloads.
- Define reconnect behavior when disposable state has been reset.
- Preserve sound/hand-raise notifications as separate concerns from state mutation.
- Add Socket.IO tests for validation, mutation, broadcast, and error paths.

### Dependencies

Phases 2 through 5.

### Deliverables

- Event contract document.
- Reorganized realtime package.
- Central state-transition service.
- Client/server payload validation.
- Realtime tests.

### Success criteria

- Every retained event has one clear purpose and owner.
- Clients request changes rather than asserting arbitrary full state.
- Two connected clients converge on the same canonical state.
- Reconnect sends current canonical state.
- Database failures are surfaced without corrupting the runtime state.
- Timer progression remains responsive.

## Phase 7: Remove obsolete combat and distribution paths

### Purpose

Reduce feature and deployment clutter only after the retained cooldown behavior and new state/realtime boundaries are protected.

### Work

- Remove dedicated-app timer-mode branches and settings.
- Remove quick-adjust controls if the inventory confirms they are unused.
- Remove obsolete timer-mode UI and client events.
- Remove PyInstaller-specific resource logic.
- Remove `build.bat`.
- Remove `DnD-Clock.spec`.
- Remove `start-tunnel.py` if no longer needed.
- Remove or disable `.github/workflows/build.yml` release builds.
- Remove PyInstaller from requirements.
- Remove tracked `dist/` artifacts and update ignore rules as appropriate.
- Preserve the general application separately if the old mode remains valuable there.

### Dependencies

Phases 2, 3, 4, and 6. Deployment verification from Phase 1 must be complete.

### Deliverables

- Dedicated app with one cooldown combat model.
- Simplified dependencies and repository contents.
- No obsolete executable release workflow.
- Updated local run instructions.

### Success criteria

- No dedicated-app route or event depends on the old timer-mode switch.
- Cooldown combat tests still pass.
- Local debugging still works with `python app.py`.
- Vercel deployment still builds after cleanup.
- No required asset or sound behavior is lost.

## Phase 8: Session Control and Campaign Maintenance modes

### Purpose

Give the laptop two distinct workflows without recreating a generic admin panel.

### Session Control mode

Include:

- Start session.
- Pause all.
- Master lock.
- Full reset with extra validation.
- Active roster selection.
- Temporary guest management.
- Player timer start/reset/set-time/default cooldown.
- Enemy creation and timer controls where needed.
- Manual HP and spell-slot restore/override.
- Display-tab control.

Default cooldown and active timer override must remain distinct:

- Default cooldown changes future normal cooldown behavior.
- Active timer override changes only the current timer.
- Initiative-based cooldown adjustment remains supported.

### Campaign Maintenance mode

Include focused editors for:

- Permanent player profiles.
- Known spells and user-managed descriptions.
- Spell-slot maximums/resource configuration.
- Max HP.
- Portrait and accent color.
- World maps and marker data.
- Objectives.
- Session recaps.

Both modes should be reachable from Home. They should share only the navigation needed to switch modes and common components that do not blur their responsibilities.

### Dependencies

Phases 4 through 7.

### Deliverables

- Two-mode laptop workflow.
- Session Control UI.
- Campaign Maintenance UI.
- Focused editor flows rather than an all-fields settings page.
- Tests for session start, roster selection, and maintenance persistence.

### Success criteria

- A DM can prepare campaign data without encountering live timer controls.
- A DM can run a session without navigating through maintenance forms.
- Session start performs the defined reset/restore transition.
- Full reset is protected from accidental activation.
- The maintenance mode can later be extracted into its own route without changing its concepts.

## Phase 9: Roster and profile foundation

### Purpose

Support five expected permanent players, inactive players, guest-heavy sessions, and cosmetic identity without imposing a fixed five-player runtime limit.

### Work

- Add permanent player profiles.
- Add active/inactive state.
- Add temporary player profiles.
- Enforce a maximum active roster of nine.
- Allow guest-only sessions with permanent profiles disabled.
- Give guests names and timer configuration without requiring portraits.
- Add DM-managed accent colors.
- Add optional portraits for permanent players only.
- Replace a player's old portrait when a new one is uploaded.
- Enforce practical image size/type limits.
- Keep portraits visually subordinate to timer state.

### Dependencies

Phases 4, 5, and 8.

### Deliverables

- Roster data model.
- Active roster/session setup UI.
- Guest lifecycle.
- Player identity display data.
- Portrait storage and replacement behavior.

### Success criteria

- Any mix of permanent and temporary players up to nine can be activated.
- Inactive permanent players are hidden from the TV.
- A guest does not overwrite a permanent profile.
- Guest-only sessions work.
- A portrait upload replaces the prior image and rejects invalid/oversized files clearly.

## Phase 10: Core cooldown combat and TV display

### Purpose

Build the primary shared combat experience around active player cooldowns.

### Work

- Implement permanent and temporary player timer cards.
- Preserve initiative-based default cooldown adjustment.
- Support player and DM timer control.
- Add player conditions to timer cards.
- Add optional compact HP bars without numeric HP on the TV.
- Add enemy entities with grouped or individual representation.
- Keep enemy timers on DM control only.
- Show enemy names and conditions in a bounded static status area on the TV.
- Use grouping when enemies act or are tracked collectively.
- Avoid scrolling text unless a real session proves it necessary.
- Preserve theme, timer-complete sound, and hand-raise sound.

### Dependencies

Phases 4 through 9, especially the realtime cleanup.

### Deliverables

- Timer display.
- DM phone live controls.
- Player timer controls.
- Enemy management.
- Shared TV combat view.

### Success criteria

- A normal combat session can run without using the laptop for frequent timer corrections.
- Players can take actions and see cooldown state update quickly.
- The TV prioritizes player timers, then HP/conditions, then enemy status.
- DM can pause, lock, reset, override, and set timers from the phone.
- Enemy countdowns are not shown on the TV.
- Grouped and individual enemies are both usable.

### Gate

Run a real or simulated combat session before adding more information to the TV. Confirm that the display remains readable at the actual TV distance and that the DM phone is faster than returning to the laptop.

## Phase 11: Player Control, Spellbook, and Resources

### Purpose

Solve the most important current table interruption: looking up spell behavior outside the application.

### Player phone structure

- `Control`: no-scroll primary cooldown controls.
- `Spellbook`: known spells only, shown as a compact list.
- `Resources`: spell slots and HP as secondary resource workflows.

### Work

- Add per-player known-spell lists.
- Add user-managed spell details, including effect, casting, duration, concentration, cooldown/action information, and campaign notes as needed.
- Use one focused detail view at a time rather than expanding many long entries.
- Add search/categories only if the approximately ten-spell lists become difficult to scan.
- Add standard per-level spell-slot counters with maximum and remaining values.
- Keep slots independent from individual spells.
- Support unusual resource notes or groups without implementing a full class-rule engine.
- Allow players to expend or restore their current slots within configured maxima.
- Allow players to adjust current HP.
- Keep DM override and full restore controls.
- Restore HP and slots at session start and through manual restore.
- Validate the mobile layout at real phone sizes.

### Dependencies

Phases 5, 8, 9, and 10.

### Deliverables

- Player Control view.
- Spellbook view.
- Resources view.
- Spell editor and spell assignment flow in Campaign Maintenance.
- Resource tests and mobile interaction checks.

### Success criteria

- A player can find and read a known spell without leaving the app.
- Primary timer controls do not require scrolling.
- Spell details do not crowd the timer view.
- Slot usage can represent the party's classes without tying slots to specific spells.
- Players cannot exceed configured HP or slot maxima through normal controls.
- Session start and manual full restore produce the expected values.
- The resource views remain usable on a phone.

### Gate

Use the app during a combat session or a realistic rehearsal. If HP and slots together make the player experience too dense, defer HP presentation before compromising Control and Spellbook usability.

## Phase 12: Campaign display tabs

### Purpose

Add low-frequency campaign context to the TV without competing with the combat view.

### Work

Add display modes:

- Timers.
- World Map.
- Objectives.
- Recaps.

World Map:

- Static campaign map.
- Movable party and objective markers.
- Labels and optional links to objectives.
- No tactical combat map behavior.

Objectives:

- Current objective list.
- Status and priority where useful.
- Short next step or note.

Recaps:

- Durable session history.
- Add/edit workflow from Campaign Maintenance.
- Avoid historical character configuration versioning.

The DM phone can change the active display tab. The Timers tab remains the default combat view.

### Dependencies

Phases 5, 8, and 10. Map/recap persistence must be available.

### Deliverables

- TV tab navigation.
- World map view and marker editor.
- Objectives view and editor.
- Recaps view and editor.
- DM phone tab control.

### Success criteria

- The DM can switch the TV between information modes from the DM phone.
- Timers remain the default combat view.
- Map markers can be moved without editing the map image itself.
- Objectives and recaps are separate concepts.
- Campaign data persists across deployments.
- Players do not need map or recap controls on their phones.

## Phase 13: Polish, accessibility, and session rehearsal

### Purpose

Turn the feature-complete system into a dependable tool for weekly sessions.

### Work

- Review all phone layouts for thumb reach, no-scroll requirements, and accidental taps.
- Review TV readability from the actual viewing distance.
- Improve loading, saving, retry, and connection error states.
- Preserve and verify theme and sound behavior.
- Add clear session status indicators.
- Add confirmation and/or undo protection for destructive actions such as reset all.
- Remove redundant controls and low-value configuration.
- Test absent players, guests, full nine-player rosters, disconnected phones, reconnects, and server restarts.
- Run at least one rehearsal with the complete hardware setup.

### Dependencies

Phases 10 through 12.

### Deliverables

- Usability fixes from rehearsal.
- Error/retry behavior.
- Final focused control layout.
- Session-readiness checklist.

### Success criteria

- The DM can run a session primarily from the phone.
- Players can control their own timers and look up spells without leaving the app.
- The TV is readable and not overloaded.
- Failure states are visible and recoverable.
- The workflow is faster and less interruptive than the current application.

## Phase 14: Documentation and repository cleanup

### Purpose

Make the finished project understandable and remove obsolete distribution assumptions.

### Work

- Rewrite README around the dedicated application.
- Document local setup and `python app.py`.
- Document optional VS Code F5 debugging.
- Document Vercel deployment and environment variables without exposing secrets.
- Document database setup, migrations, seed data, free-tier limits, and recovery/export.
- Document route/device responsibilities.
- Document session start/reset behavior.
- Document campaign maintenance workflows.
- Remove obsolete build instructions, executable instructions, and Cloudflare tunnel instructions if no longer supported.
- Remove or disable obsolete GitHub release automation.
- Remove unused dependencies and dead files after verifying no references remain.

### Dependencies

Phases 1 through 13, especially deployment verification.

### Deliverables

- Current README.
- Deployment/setup guide.
- Database setup/recovery notes.
- Clean repository structure.
- No obsolete build pipeline.

### Success criteria

- A technically capable future maintainer can run the app locally from the README.
- Deployment can be reproduced from documented Vercel settings and environment variables.
- Database setup does not depend on undocumented manual steps.
- Repository contents match the dedicated app's actual architecture.

## Cross-cutting testing strategy

### Unit/domain tests

Test pure rules and transitions without Flask, Socket.IO, or a database:

- Cooldowns.
- Initiative offsets.
- Pause/reset/override.
- HP bounds.
- Spell-slot bounds and restoration.
- Session-start transition.
- Active roster and nine-profile limit.
- Grouped versus individual enemies.

### Persistence tests

Run against a local test adapter and, where practical, a disposable provider database:

- Campaign save/load.
- Spell assignment.
- Player profile updates.
- Portrait replacement metadata.
- Map/objective/recap persistence.
- Migration behavior.
- Failure and rollback behavior.

### Realtime tests

- Command validation.
- State mutation ownership.
- Canonical broadcast.
- Reconnect bootstrap.
- Two-client convergence.
- Database failure reporting.
- Lock and permission behavior as currently defined.

### Integration tests

- Flask route responses.
- Application factory creation.
- Session Control workflows.
- Campaign Maintenance workflows.
- Local database configuration.
- Vercel deployment proof checks.

UI tests are not a first priority. Manual checks on the actual phone and TV should supplement Python and integration tests for layout and readability.

## Risk register and responses

| Risk | Response |
| --- | --- |
| Vercel does not support the current Socket.IO/background timer model | Discover in Phase 1 and select a compatible hosting/realtime arrangement before feature work |
| Database writes make live controls feel slow | Keep live state in the runtime authority; persist deliberate changes only |
| Free-tier quotas or connection limits are too restrictive | Verify limits early; retain provider abstraction and Neon fallback |
| State reset erases durable campaign data | Enforce explicit state boundaries and test reset transitions |
| Player phone becomes crowded | Keep Control no-scroll; separate Spellbook and Resources; defer HP presentation if needed |
| Nine-player TV layout becomes unreadable | Test actual viewing distance; preserve active roster limit and simplify cards |
| Portrait uploads add deployment/storage complexity | Keep optional, DM-managed, size-limited, and removable without affecting combat |
| Socket.IO event cleanup introduces regressions | Inventory first, add characterization tests, migrate event families incrementally |
| Feature scope expands again | Use phase gates and explicit non-goals; require a real session benefit for additions |
| Old build automation remains active | Remove the GitHub workflow, build files, dependency, and release documentation together |

## First implementation milestone

The first milestone should not be the full redesigned UI. It should be a stable foundation that proves the application can be changed safely:

- Deployment behavior understood.
- Source package in place.
- Root `app.py` thin and runnable.
- State categories defined.
- Persistence provider selected and connected on the free tier.
- Repository interfaces present.
- Existing cooldown behavior protected by tests.
- Socket.IO event inventory complete or cleanup underway.
- Obsolete build path ready for removal.

When this milestone passes, feature implementation can begin with confidence that the new player and campaign workflows are not being added to an opaque monolith.

## Feature implementation order after foundation

1. Session Control and Campaign Maintenance shell.
2. Permanent/temporary roster and profile data.
3. Core cooldown timer display and DM phone controls.
4. HP bars and enemy grouped/individual status.
5. Player Control, Spellbook, and Resources.
6. World Map, Objectives, and Recaps tabs.
7. Portrait polish, sounds, error states, and session rehearsal.
8. README and final cleanup.

This order keeps the primary combat loop ahead of lower-frequency campaign views and ensures every later feature has a stable state, persistence, and realtime foundation beneath it.
