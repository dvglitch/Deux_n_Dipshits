# Phase 08 - Control Modes

Status: Complete. Two distinct laptop control modes implemented (Session Control & Campaign Maintenance).

## Objective
Create separate laptop workflows for live session operation and campaign maintenance.

## Scope
- Session Control: start/reset/restore, roster, guests, timers, enemies, locks, overrides, and display-tab control.
- Campaign Maintenance: players, spells, resource maxima, HP maxima, portraits/colors, maps, objectives, and recaps.

## Deliverables
- Two-mode control surface reachable from Home (`/control?mode=session` vs `/control?mode=maintenance`).
- Mode switcher UI on `/control` allowing fast toggling without page reload.
- Dedicated Campaign Maintenance REST API (`/api/campaign/<collection>`) supporting GET, POST/PUT, and DELETE.
- Interactive Campaign Maintenance editors for Party Profiles, Spellbook, World Maps, Quest Objectives, and Session Recaps.
- Automated API test suite in `tests/test_campaign_api.py`.

## Completed validation
- All 26 unit, integration, persistence, state boundary, realtime, and campaign API tests passing.
- Verified mode deep-linking and state preservation.

## Success criteria
A DM can run a session without maintenance forms and edit campaign data without encountering live-control clutter. The maintenance mode remains extractable into its own route later.

## Handoff
Phase 08 is complete. The laptop control surface is cleanly split into Session Control and Campaign Maintenance. Phase 09 can proceed with building out detailed permanent and temporary player roster profiles and portrait storage integration.
