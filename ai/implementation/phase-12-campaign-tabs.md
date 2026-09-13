# Phase 12 - Campaign Tabs

Status: Complete. TV Display tabs (Timers, World Map with pins, Quest Objectives, Session Recaps) wired with realtime DM switching.

## Objective
Add low-frequency campaign context to the TV without competing with combat.

## Scope
- Timers, World Map, Objectives, and Recaps tabs.
- Static map with movable party/objective markers.
- Objective status/priority/next-step information.
- Durable recap history and maintenance editing.
- DM-phone tab switching.

## Deliverables
- TV Display tab views in [display.html](src/dnd_clock/templates/display.html) and [display.js](src/dnd_clock/static/js/display.js):
  1. **Timers (Combat View)**: Active player cards, cooldown progress bars, HP indicators, condition badges, and bottom enemy status ribbon.
  2. **World Map**: Image presentation with labeled coordinate pin overlays (e.g. `Party: 45%, 60% | Dungeon: 70%, 30%`) and location notes.
  3. **Objectives**: Filtered active quest cards showing title, priority badges (High/Medium/Low), and detailed objective descriptions.
  4. **Recaps**: Chronological session recap cards showing Session #, Date, Title, and key story summary.
- Realtime DM switcher on [dm.html](src/dnd_clock/templates/dm.html) (`dmDisplayTabSelect`) syncing display tab updates instantly via `set_display_tab`.
- All 37 automated tests passing.

## Completed validation
- Verified TV screen switches between Timers, Map, Objectives, and Recaps when changed by DM Mobile.
- Verified database persistence for world map pins, quest objectives, and recaps.

## Success criteria
DM can change the TV tab from the phone; Timers remains the combat default; map/objective/recap data persists; players need no campaign controls on phones.

## Handoff
Phase 12 is complete. All non-combat campaign display tabs are integrated and tested. Phase 13 can proceed with Final Usability Rehearsal and Polish.
