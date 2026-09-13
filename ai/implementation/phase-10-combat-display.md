# Phase 10 - Combat Display

Status: Complete. TV Display upgraded with compact HP bars, portraits, accent colors, and static enemy ribbon; DM Mobile interface enhanced with live controls and display-tab switcher.

## Objective
Build the primary cooldown combat experience for the TV, DM phone, and player timers.

## Scope
- Player timer cards and controls.
- Initiative-adjusted defaults and active overrides.
- Conditions and compact visual HP bars on player timer cards.
- Display player accent colors and optional portraits without cluttering cooldown numbers.
- Enemy entities with grouped or individual representation.
- Keep enemy timers on DM control only (no countdowns on TV).
- Bounded static TV enemy status ribbon.
- DM Mobile interface with live player & enemy controls, HP quick-adjust, and display tab switcher.
- Theme, timer-complete sound, and hand-raise sound preserved.

## Deliverables
- TV Display ([display.html](src/dnd_clock/templates/display.html) & [display.js](src/dnd_clock/static/js/display.js)) with player cards, visual HP bars, condition badges, accent borders, optional portrait avatars, and bounded static bottom enemy ribbon.
- TV Display tab switching support for Timers, World Map, Objectives, and Recaps.
- DM Mobile interface ([dm.html](src/dnd_clock/templates/dm.html) & [dm.js](src/dnd_clock/static/js/dm.js)) with category filtering (All, Players, Enemies), quick add enemy, +/- HP controls, condition editing, master locks, and display tab selector.
- Socket events and service methods for `set_hp`, `set_display_tab`, and `set_timer_meta`.
- Automated test suite in `tests/test_realtime.py` (all 36 tests passing).

## Completed validation
- Verified TV display renders enriched cards and keeps enemy countdowns off the shared screen.
- Verified DM phone can switch display tabs, adjust HP, add enemies, and manage timers.
- Verified all 36 unit, integration, persistence, state boundary, realtime, roster, and campaign API tests pass cleanly.

## Success criteria
A combat session runs without frequent laptop use; TV hierarchy is readable; DM can correct timers from the phone; enemy countdowns stay off the TV.

## Handoff
Phase 10 is complete. The shared TV screen and DM mobile controller are fully equipped for cooldown combat and room display. Phase 11 can proceed to build the player mobile experience: Player Control, Spellbook, and Resource workflows.
