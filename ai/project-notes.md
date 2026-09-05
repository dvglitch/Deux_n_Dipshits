# Project Notes

The implementation roadmap is in [project-plan.md](project-plan.md). Use this file for product context, decisions, questions, and working preferences; use the plan for phase order, dependencies, deliverables, and success criteria.

## Current context

- This project began as a replacement for DnD's turn-based combat system.
- Its central model is a cooldown-based combat system: players may take actions at any time when the relevant cooldown has finished.
- The project accumulated features in response to player feedback and has become somewhat feature-bloated.
- The current real users are the DM and one party of five players. It is not currently serving multiple groups.
- Until the user explicitly asks for implementation, discussion should stay at the level of product direction, UX, architecture, tradeoffs, and questions. Do not modify application behavior during ideation.
- The existing general application will remain available as a separate source of ideas and possible future expansion. The dedicated app should be allowed to remove features without treating that as permanent loss.

## Strategic direction under consideration

Shift from a general-purpose, highly configurable tool toward a focused tool tailored to this specific DnD group. The main benefit would be a clearer interface and faster, more reliable use during sessions. Generality should only be retained where it does not add meaningful complexity or weaken the group's workflow.

The dedicated app should use a deliberately small set of interface responsibilities:

- `home`: opening landing page, not a session workspace.
- `control`: DM laptop page for setup, settings, and less time-sensitive administration.
- `dm`: DM phone page for frequent, simple live controls, especially enemy timers and other operations that are awkward from the laptop.
- `display`: shared TV page for everyone; primarily a read-only view of live party combat state and the selected campaign-information view.
- `remote`: player phone page for that player's own permanent player control.
- `qr`: utility page for generating the player control QR code.

The key workflow principle is "right control on the right device": laptop for preparation, DM phone for live DM actions, player phones for personal actions, and TV for glanceable shared state.

## Ideas raised by the user

- Permanent timers for all five players.
- Dedicated player timer areas containing spell information and descriptions.
- Optional player stats or other player information, depending on page density.
- DM display tabs for:
  - Timers, as they work now.
  - Map view.
  - Current objectives.
- A campaign/session recap log as another possible display tab.
- Removal of the timer-based combat mode so the dedicated app fully commits to cooldown-based combat.
- Persistent party data across sessions, hosted on a Vercel server.
- Support for five expected players while allowing fewer active players or a temporary guest.
- Optional HP tracking and possibly spell-slot tracking as frequently changing resources.
- A player-phone navigation control that switches between player control and a spellbook without requiring scrolling on the primary control screen.
- A spellbook presented as a compact list of spell buttons; selecting one expands or opens its details, including what it does, duration, and casting information.
- DM controls split between setup/settings on the computer and high-frequency live controls on the phone.
- The dedicated app should remain a focused version of the general application; removed features may remain available in the general app for later reconsideration.
- Permanent player profiles may include character art/icons and theme colors for TV timer cards.
- A possible maintenance route could manage world maps, session recaps, player max HP, known spells, and other between-session campaign edits.
- Player presentation settings should be DM-managed from the laptop control or maintenance workflow. Players do not need profile customization on their phones.
- Player portrait uploads are acceptable because this is a trusted private application. Keep the scope small: one optional image per permanent player, replace the old image when changed, and enforce a practical file-size limit. Guests do not need a default portrait.
- The dedicated combat workflow is intended to reset HP and spell slots at the beginning of each session, with a separate manual restore action available during play.
- Spell-slot restoration should support both a prominent full restore and precise individual adjustments in the underlying controls. The normal DM workflow should favor full restore because that is the expected real-world use; individual adjustment is a fallback for corrections rather than a primary recovery mechanic.

## Initial product feedback

### Strong direction

Permanent player timers are likely the best first focus. They make the app immediately legible during play and turn the display into a party dashboard rather than a generic timer surface. Five fixed player slots can be intentionally designed around the actual party instead of being generated as an abstract list.

### Risks and pushback

- Putting full spell descriptions directly beside every timer could make the main display too dense, slow to scan, and difficult to use at a distance. Consider showing only the next available actions, short labels, icons, or a focused detail panel on selection.
- Player stats can become a second character sheet and compete with the combat state. Include them only when they answer a frequent in-session question. Otherwise, keep them behind a player detail view or a separate tab.
- Map and objectives are different attention modes from live cooldown tracking. Tabs make sense, but the DM should not lose critical timer awareness while switching views. Consider a persistent compact timer strip, a split view, or a quick-access overlay.
- Tailoring to one party does not require hard-coding every piece of content into the UI. Keep content/data separate from presentation where inexpensive; this preserves maintainability without returning to a sprawling configuration system.
- A permanent display needs an explicit state model for session reset, player absence, downed/unavailable states, paused timers, and stale data. These operational states may matter more than adding more information.
- A spellbook tab is a strong fit for the actual pain point, but it should not become a second full character sheet or a general spell database. The primary interaction should be quick search or a compact known-spells list, followed by one focused detail view.
- The player control page should remain no-scroll for its primary timer controls. A separate navigation mode is preferable to putting timers, spells, HP, and slots into one vertically expanding page.
- Spell slots may belong in player control because they are a changing resource, but adding HP at the same time could overload the phone UI. Treat HP as the first candidate to defer if the player control becomes crowded.
- Standard per-level spell-slot counters are a reasonable shared model for this party's druid, ranger, bard, paladin, and warlock. They should be independent from individual spells: a spell has a level, while casting consumes a slot according to the player's rules.
- Do not model "number of spells known" in the app. The spellbook should contain the player's configured known spells, while slot availability remains a separate resource list.
- The spell-slot model must allow class-specific configuration without encoding class rules into individual spells. Warlock pact slots and other unusual recovery rules may need a recharge/reset note or a configurable slot grouping later.
- The current preferred slot behavior is simple: restore spell slots automatically when a new session begins and allow the DM to restore them manually. In-game day/rest rules do not need to be modeled initially.
- A persistent five-player roster should not require all five players to be active. Model expected party members separately from active session participants, and make inactive slots visually quiet rather than deleting their identity.
- A guest should be a temporary active slot with a clear lifecycle, not a mutation of a permanent player's profile. Multiple guests should be supported, and a one-shot may use only temporary guests while all permanent players are disabled.
- Dynamic player capacity should be retained. Five permanent profiles are a convenience, not a hard limit on the active roster.
- The active roster should have a practical maximum of nine profiles. This can be any combination of permanent players and temporary guests, including a guest-only session.
- A world map is campaign context, not a combat map. The likely useful interaction is a static map with movable party/objective markers, not tactical tokens or encounter simulation.
- A recap log can be valuable, but it is less immediate than timers, objectives, and map position. It should follow those views unless session continuity is a major recurring problem.
- Removing the timer-based mode is strategically sensible for the dedicated app, but should happen after confirming that no existing live workflow depends on it. The general application can preserve it for later reference.
- Enemy timers do not need to be on the shared display. The display may show a compact enemy name-and-condition status area, while the DM phone owns enemy timer controls and detailed enemy actions.
- Enemy groups should be represented as one combat entity when they act or are tracked collectively, such as `Goblin Group`. Individual enemy entries should remain available when separate timers or conditions matter, such as `Goblin 1` and `Goblin 2`.
- A scrolling enemy ribbon is a fallback for unusually busy encounters, not the default solution. It can hide information, compete with the player timers, and be hard to scan when names move. Prefer grouping first and a bounded static ribbon second.
- The timer tab is expected to be the primary combat view. A persistent party ribbon should remain lower priority and should not be added merely to avoid switching tabs.
- Player controls should be optimized for a no-scroll primary timer view; spellbook, HP, and spell slots can be separate navigation modes or compact secondary panels.
- HP is most useful as a compact bar on each active player timer, alongside or below the timer and conditions overlay, rather than as a separate display tab. It should be deferred if it compromises timer readability.
- Player character art and theme colors can improve recognition and make the TV display feel like the group's tool, but they are presentation metadata, not a reason to add player-facing settings.
- Player customization should be DM-managed initially. Allowing uploads and color selection from player phones adds permissions, validation, storage, and accidental-edit concerns for little session value.
- Character art should remain optional and visually subordinate to timer state, HP, and conditions. It should not be used as a large background behind critical status information.
- A separate maintenance route is justified only if campaign editing becomes a distinct workflow with enough fields and frequency to make the session-control page difficult to scan. Route separation should follow responsibility, not merely create more navigation.
- The maintenance workflow should be laptop-oriented and distinct from live control even if it initially shares components or remains under one route with clear sections.
- The immediate direction is a single laptop control surface with two explicit modes: live/session control and campaign maintenance. Both should be reachable from the home landing page.
- The two modes should have distinct navigation, headings, and task groupings so maintenance does not visually contaminate live controls. They may share backend models and reusable form components.
- A later split into separate routes should be treated as an extraction of an already-separated workflow, not as a change to the underlying product concepts.
- Do not build a generic administrative editor. Maintenance should expose focused campaign objects and common tasks rather than every stored field.

## Promising additions to consider

- A compact party status row: player name, availability/state, current action, and next-ready time.
- A player focus view that reveals spells, cooldowns, resources, conditions, and notes for one selected player without crowding all five cards.
- DM-only controls and annotations, separated from what players see.
- Objectives with status, priority, and a short next step rather than a long quest log.
- Map pins or markers tied to objectives, NPCs, encounters, or player locations.
- Session controls: start, pause, reset, undo, and clear visual indication of whether the display is live.
- A configurable "session layout" chosen from a small number of intentional views, rather than a large set of generic settings.
- Keyboard shortcuts or large controls for fast DM operation during play.
- Persistence and backup for party data, with a clear distinction between campaign data and temporary combat/session state.
- A focused player-phone spellbook with known spells only, categorized or searchable if the list grows, and one expanded detail area at a time.
- Spell-slot counters as a likely first resource tracker; HP remains optional and lower priority until the layout proves it can carry the extra state.
- A roster model with permanent party profiles, active/inactive session state, and a temporary guest slot.
- A static world map with movable party and objective markers, with marker labels and optional objective links.
- A small session recap history, likely edited from the DM setup surface and viewed from the display tab.
- A compact enemy status ribbon on the TV showing active enemy names and conditions, without enemy countdown timers.
- DM phone quick controls for start all, reset all, master lock, individual timer start/reset/set-time/default-cooldown, display-tab selection, player timers, and enemy timers.
- A class-agnostic spell resource panel showing available and maximum slots by spell level, separate from the spell list.
- A compact HP bar on player timer cards, with numeric values available in player control or DM control if needed.
- Optional DM-managed player presentation settings: display name, accent color, and optional character portrait/icon.
- A campaign-maintenance workspace for editing maps, objectives, recaps, player max HP, known spells, and resource configuration.
- Two-mode laptop control surface: `Session Control` for live/session tasks and `Campaign Maintenance` for durable campaign data, with both linked from the home page.

## Device responsibility model

| Surface | Primary user | Primary responsibility |
| --- | --- | --- |
| Home | None | Opening route and entry point |
| Control | DM on laptop | Settings, party setup, spell/content maintenance, campaign administration |
| DM | DM on phone | Frequent live controls, especially enemy timers and quick session actions |
| Display | Everyone on TV | Glanceable shared state: timers plus selected campaign tab |
| Remote | Individual player on phone | That player's timer controls, spells, and possibly changing resources |
| QR | None | Generate or present player-control access |

This table should be used during the feature cleanup. Every existing feature should have a clear surface owner; features that require several surfaces need a specific workflow justification.

## Data boundaries

- Permanent campaign data: player profiles, known spells and spell details, spell-slot maximums, world map, objectives, and recap history.
- Session configuration: which expected players are active, guest details, selected display tab, and session-specific visibility.
- Live combat state: action cooldowns, enemy timers, active conditions, current resources, and temporary markers or notes.
- Spell slots are a changing resource with permanent maximum/configuration data and session-specific remaining counts. Slot usage should reset according to the chosen session/reset rule without changing the player's known spells.
- HP follows the same broad lifecycle as spell slots for this project: restore at session start, with manual adjustment and restoration available during play. The exact editor permissions remain open.
- A session reset should clear live combat state without erasing campaign data. The UI should make this distinction visible before destructive actions.

## Working principles

- Optimize for the DM's and this party's real session workflow before hypothetical users.
- Prefer glanceability and fast interaction over maximum information density.
- Every visible field should justify itself by answering a recurring table-side question.
- Separate durable campaign content from temporary live-session state.
- Keep the number of views and controls small enough that the DM can operate them under pressure.
- Preserve flexibility only when it is cheap, invisible to the user, and does not complicate the primary workflow.
- Treat this document as a living record of decisions, rejected ideas, open questions, and future experiments.
- Validate information density on the actual phone before committing to HP and spell slots together. The first successful combat workflow matters more than fitting every useful field into one screen.
- Keep the display's combat hierarchy stable: player timers first, conditions and HP second, enemy names/conditions third. Do not let a scrolling enemy ribbon or extra party information compete with the cooldown state.
- Use a flexible, controllable DM workflow where that flexibility has clear value, but make player-facing workflows opinionated, polished, and difficult to misuse.
- Prefer a quick recommendation and tradeoff summary while exploring ideas; before committing to a decision, provide a deeper comparison of alternatives.
- Reason through most uncertain features before implementation. Use a focused prototype when discussion cannot confidently resolve usability or complexity.
- Challenge proposed features directly when their complexity is not justified by the value they add.
- Explain architecture, database, deployment, UI, and code-organization decisions at a technical level appropriate for someone with software-engineering training and about one year of professional development experience.
- Evaluate automation by its effect on maintenance and session usability rather than automating by default. Extra implementation complexity is acceptable when it meaningfully simplifies recurring use.
- Keep cosmetic identity data low-risk and optional. Do not let portraits, colors, or uploads complicate the live combat state.
- Separate a route when it reduces cognitive load for a distinct workflow; do not create routes solely to mirror database categories.
- Design mode boundaries before route boundaries. A later route split is cheap when the workflows, components, and data ownership are already separated.

## Questions to resolve

1. Who is the primary display audience: the DM, the players, or both at different times?
2. What devices and screen sizes are actually used for the DM and the player-facing display?
3. Are all five players always present, and should absent players remain visible?
4. What information does the DM look up most often during combat: cooldowns, spell effects, HP/resources, conditions, initiative-like ordering, or something else?
5. What does a timer represent in practice: action availability, spell recovery, movement, concentration, encounter events, or multiple timer types?
6. Do players control their own timers, or does the DM control the canonical state?
7. Should spell information be editable in the app, imported from a file, or treated as fixed campaign data?
8. How frequently do objectives change, and should they be visible to players or DM-only?
9. What map workflow is expected: a static image with pins, a battle map with tokens, a campaign map, or several map types?
10. Which existing features feel essential in actual sessions, and which feel like leftovers from the general-purpose direction?
11. Is network access reliable at the table, and does the app need a strong offline/local-first mode?
12. What is the smallest useful version of the tailored dashboard that could be tried in one session?
13. Should the DM phone control enemy timers only, or also pause/reset the session and edit player state?
14. Should players see the world map, objectives, and recap log on the TV only, or should those be available from their phones too?
15. How many known spells does each player typically have, and do players need search, categories, or only a short button list?
16. Are spell details fixed for this campaign, or do homebrew and house-rule changes need easy editing?
17. Should spell slots be tracked per level, as a count of remaining slots, or with another simplified model?
18. For a guest, should the app provide a temporary generic control page or assign the guest a reusable named profile?
19. What should happen when a permanent player is absent: hide the slot, show it as inactive, or allow another player to occupy it temporarily?
20. What are the current DM phone actions that would save the most time compared with using the laptop?
21. Which existing features should be preserved in the general application but removed from the dedicated app?
22. Should spell slots reset at the start of every session, be manually restored, or support both options?
23. For warlock slots and similar cases, should the UI call them "spell slots" universally or allow a player-specific resource label?
24. Should HP be DM-editable only, player-editable only, or editable by both with the latest value treated as canonical?
25. Should the enemy ribbon show all active enemies, only enemies with conditions, or a small DM-selected set?
26. Should the DM phone's display-tab control change the TV immediately, or require an explicit confirmation?
27. What is the minimum useful guest setup: name and timer, or name, timer, spells, slots, and HP?
28. Should session start restore HP and spell slots in one combined action, or offer separate restore controls?
29. Should a grouped enemy have one shared condition list, or support notes for individual members within the group?
30. Should HP be editable from the player phone, DM phone, both, or only the laptop setup page?
31. Should player portraits be uploaded files, selected from a built-in set, or external image URLs?
32. Should portraits be shown on all displays, only the TV, or only in maintenance/player details?
33. How many campaign-maintenance fields will exist before a single control page becomes difficult to scan?
34. Should the maintenance workspace support editing completed recaps, or primarily add new recap entries?
35. What specific live/session tasks must remain immediately visible in Session Control?
36. Which maintenance objects should have their own focused editor first: players, spells, maps, objectives, or recaps?

## User and maintenance context

- The user wants to preserve useful DM flexibility but recognizes that excessive generality caused the current app to become unpolished. The dedicated branch should be tailored to this group's actual workflow.
- The player side should prioritize polished, opinionated workflows over exposing every possible configuration.
- The user prefers quick recommendations during exploration and deeper comparison before final decisions.
- The user is comfortable maintaining the app between sessions. Typical maintenance includes spell and player updates when the party levels up, moving world-map markers, and updating objectives and recaps after sessions.
- Sessions occur every Monday from approximately 7 PM to 11 PM. The user has a few hours during the week for maintenance, recap writing, and future-session brainstorming.
- The user values preserving old session history most. Historical character configurations are not important; completed objectives may be useful but are secondary.
- Current session recaps live in a Google Doc. The in-app recap feature should eventually provide durable session history without making historical character versioning a priority.
- The user enjoys the existing background theme, timer-complete sound, and hand-raise sound. These cosmetic features are worth preserving unless they interfere with usability or architecture.
- Quick adjust is a current feature the user has almost never used and is a strong candidate for removal during feature cleanup.
- The user has a BS in software engineering and understands basic architecture, database design, and code organization. They have about one year of software-development experience, less deployment experience, and are more comfortable describing UI changes than implementing HTML.

## Decision log

- No application implementation changes have been made from this discussion.
- Tailoring the product to the current party is a working direction, not yet a final commitment.
- The main display is intended to be tabbed by information mode; the timer tab is the combat view and is expected to be the only displayed view during combat.
- A persistent party-status ribbon is lower priority and should not be allowed to delay the core dashboard.
- Player spells belong on the player phone's player-control surface, accessed through navigation to a separate spellbook mode; they do not belong on the TV timer display or DM player-selection flow by default.
- The map means a static world map with movable markers, not a tactical combat map.
- The laptop/phone split is a core workflow direction: setup and settings on the laptop, high-frequency live DM controls on the phone.
- The first feature to defer if information density becomes a problem is HP tracking; spell lookup and likely spell slots address more immediate pain points.
- Spell-slot tracking is provisionally supported as a separate, standard-per-level resource panel on player control, pending a phone-layout review.
- Spell slots are not tied to individual spells and the app does not track how many spells a player knows.
- Multiple temporary guests and guest-only sessions should remain possible; permanent profiles can be disabled without limiting dynamic active-player capacity.
- The active roster should support up to nine profiles at once, mixing permanent players and temporary guests.
- Enemy timers are DM-phone-only. The TV may show enemy names and conditions in a compact ribbon, but not enemy countdowns.
- Enemy groups are preferred over a continuously scrolling ribbon when multiple enemies share behavior; individual enemy entries remain available when separate tracking is useful.
- HP is provisionally best represented as a compact bar on each player timer card, subject to a real display-density review.
- Session start should restore both HP and spell slots, and the DM should have a separate manual restore action available.
- The first target session is a fast, low-interruption combat session that helps players answer spell questions without leaving the app.
- The implementation plan and project plan should be discussed only after the product-direction discussion is complete. The timer-mode research spike belongs inside that later planning phase.
- The implementation plan should begin with repository/deployment verification, source-package reorganization, state/persistence separation, Socket.IO event cleanup, and Python tests before UI and campaign feature work.
- The Socket.IO event surface deserves its own research spike. Inventory event names, payloads, mutation ownership, broadcasts, and client listeners before renaming or consolidating events.
- The implementation plan should include a persistence spike before feature work: verify the Vercel runtime, compare a small set of hosted database options, define the minimal schema and repository contracts, and prove read/write behavior from the deployed app.
- The persistence spike should include a reproducible free-tier setup guide: create the provider project, create the database schema, configure least-privilege application credentials, store deployment secrets in Vercel, configure local development variables, apply migrations, seed initial data, and verify backup/export or recovery steps.
- The Vercel verification spike should test an HTTP request, a database read/write, two concurrent clients observing the same update, Socket.IO connection/reconnection behavior, timer progression, background-task lifecycle, and a deployment restart or instance change. Record any limitation before committing to the hosting model.
- The implementation plan should include a cost guardrail: no paid tier, usage overage, or billing requirement should be introduced without an explicit decision. Free-tier quotas and failure behavior should be documented.

## Final pre-planning questions

These are the remaining questions that could materially affect architecture or acceptance criteria. They are intentionally limited; new feature ideation should wait until the implementation plan is written.

- What is the current Vercel production URL/project access, and can deployment settings and logs be inspected during the foundation phase?
- Is the current live session state expected to survive a server restart or deployment, or is persistence only required for campaign data and deliberate session saves?
- What should happen if the network or database is temporarily unavailable during a session: block changes, allow local temporary state, or show an explicit degraded mode?
- Should the DM be the canonical editor for HP and spell slots, with player edits deferred until a later decision?
- What is the exact session-start action: restore HP and spell slots, clear combat timers and enemies, activate the selected roster, and choose the Timers display tab?
- Should player-control and DM-control access use simple unprotected URLs for now, or should the plan include non-authentication access tokens for avoiding accidental cross-device control?
- Are spell descriptions expected to be entered by the user as campaign notes, or should the app integrate with an external reference source? Prefer user-provided or properly licensed content for stored descriptions.
- What is the minimum acceptable local development workflow after reorganization: `python app.py`, a documented environment setup, and a local database seed command?

## Final decisions before planning

- Durable persistence is required for campaign data: permanent player profiles, known spells and descriptions, max HP, spell-slot maximums, portraits/colors, maps, objectives, and session recaps.
- Session and combat state is intentionally disposable. A server restart or deployment may reset active timers, temporary HP, used spell slots, active enemies, and other live session state.
- Because the hosted site remains running between weekly sessions, starting a session must be an explicit action rather than an inference from deployment or route access. It should restore HP and spell slots, clear enemies and combat timers, activate the selected roster, and switch the TV to the Timers tab.
- The application should show an explicit connection or persistence error and retry when the database or network is unavailable. It should not silently claim that a campaign change was saved.
- Timer progression and live combat state should not wait on a database request for every tick. Use an in-memory runtime state/cache for the active process or realtime authority, persist only deliberate campaign changes and session boundaries, and define how the runtime state is reinitialized after restart.
- Cache invalidation must be explicit. Campaign edits should update or invalidate the runtime copy before broadcasting the new canonical state; errors should preserve the last known good state and surface the failed save.
- The DM owns max HP and spell-slot maximum configuration. Players may modify their current HP and mark spell slots as expended or restored within those configured limits. The DM retains override and full-restore controls.
- Access remains intentionally unprotected for the first version. Lightweight access tokens or authentication are deferred unless accidental cross-device control becomes a real problem.
- Spell descriptions will initially be user-managed campaign data. External reference import may be investigated later, but stored content should be entered or adapted by the user and account for campaign house rules and licensing.
- Vercel project settings and deployment logs may be inspected during the foundation phase.
- The local development workflow should remain `python app.py`, with an optional VS Code F5/debug configuration if it improves convenience.
- The dedicated branch should preserve valued atmosphere and feedback sounds where practical, even while removing low-value controls such as quick adjust.
- Maintenance workflows should favor weekly post-session updates and occasional level-up administration rather than requiring constant configuration during play.
- Player portraits and colors are provisionally accepted as optional, DM-managed cosmetic profile metadata, pending a display-density review.
- Player portrait uploads are trusted-user functionality with one optional image per permanent player, replacement semantics, and a practical size limit. Guests have no default portrait.
- The immediate maintenance design is two modes on the laptop control surface: `Session Control` and `Campaign Maintenance`, both accessible from home.
- The maintenance mode should be built so it can later become a separate route if its scope makes the shared control route cumbersome.
- `Session Control` and `Campaign Maintenance` should have little overlap beyond the control needed to switch modes. They represent different workflows, not two sections of one combined admin page.
- Before implementation planning, the project should receive a maintainability pass: clarify source structure, separate application layers, remove obsolete local-distribution assumptions, and update documentation to describe the dedicated app.
- `app.py` should remain a thin development/deployment entry point. Core application behavior should move under a source package rather than living in top-level modules.
- The current `app.py` mixes PyInstaller resource resolution, external asset routes, Flask/Socket.IO construction, blueprint registration, socket registration, background timer startup, sound listing, and local development launch. The refactor should split those responsibilities while preserving a simple `python app.py` debug command.
- The preferred architectural direction is a modest layered structure: web routes/views, domain state and rules, persistence/data access, and realtime transport kept distinguishable without introducing unnecessary enterprise abstractions.
- The repository should treat `dist/`, `build.bat`, `DnD-Clock.spec`, and the local executable/tunnel workflow as removal candidates because the app is hosted on Vercel and is no longer intended for local distribution. Confirm deployment and rollback needs before deleting them.
- The current `.github/workflows/build.yml` still builds PyInstaller executables and publishes a Windows release on pushes to `main`. Removing the old distribution workflow requires disabling or deleting that GitHub Action, not just deleting local build files.
- The user confirmed that Vercel is connected to the GitHub deployment flow and that the old local-distribution `build.bat` logic can be removed. The GitHub PyInstaller release workflow should also be removed or replaced because it is no longer part of the intended deployment path.
- No Vercel configuration was found in the repository during the light architecture check. Verify the Vercel project dashboard and deployment logs for the connected GitHub repository, root directory, framework preset, build command, output settings, Python entry point, environment variables, and current deployment behavior before changing package paths.
- Because the app uses Flask-SocketIO, a background timer loop, and threaded mode, deployment verification must explicitly confirm whether the current Vercel deployment supports the required long-lived realtime behavior. Do not assume a conventional Flask server and a Vercel serverless function have identical lifecycle semantics.
- The README should be rewritten around the current hosted/local-debug workflow after the architecture and routes settle; old executable and Cloudflare instructions should not remain as the primary documentation.
- Add a focused test strategy during planning, especially for cooldown state transitions, session reset/restore behavior, roster activation and guest limits, persistence boundaries, and Socket.IO event handling.
- The user wants the foundation refactor and test baseline to happen before implementing the new campaign and combat features. This should be an explicit project phase rather than work mixed into feature tickets.
- The current `settings.json` mixes runtime timer state, timer configuration, names, visibility, theme, sound choices, and the cooldown-mode flag. Separating configuration, campaign data, session state, and combat state is a prerequisite for feature work.
- A production persistence decision should be made before implementing campaign features. The decision is driven by Vercel durability, concurrent realtime writes, and deployment lifecycle rather than expected data volume.
- Do not postpone persistence architecture until the data grows. Establish repository interfaces and a small schema now, then choose a durable hosted provider appropriate for the Vercel deployment. SQLite may remain useful for local tests or development, but should not be assumed to be the production store on a serverless filesystem.
- Managed PostgreSQL is the default long-term recommendation for campaign, session, and combat data because it is durable, transactional, inspectable, and flexible enough for the planned relationships. Supabase or Neon are plausible providers; the final choice should follow deployment, pricing, backup, and connection-behavior checks.
- The project must use free services only. Supabase is the provisional preferred provider because it can offer the PostgreSQL database and a small amount of object storage for the five permanent player portraits within one service boundary. Neon remains a valid database-only fallback if Supabase's free limits, deployment behavior, or storage model are a poor fit.
- Provider selection is not final until the implementation plan verifies current free-tier limits, required billing configuration, connection behavior from Vercel, database backups/export options, and portrait upload/storage behavior.
- Avoid introducing provider-specific features before the repository boundary exists. The application should be able to test against SQLite or an in-memory implementation while production uses the selected hosted database.
- Realtime synchronization and persistence are related but not identical. A database can store canonical state, but it does not by itself solve Socket.IO connection lifecycle or timer broadcasting on Vercel.
