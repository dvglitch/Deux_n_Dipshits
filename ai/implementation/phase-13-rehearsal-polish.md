# Phase 13 - Rehearsal and Polish

Status: Complete. Ergonomics, UI bounds, failure protections, and session start workflow polished across all surfaces.

## Objective
Make the feature-complete app dependable for weekly sessions.

## Scope
- Phone ergonomics and no-scroll review on `/remote` and `/dm`.
- TV readability at viewing distance on `/display`.
- Loading, retry, connection, and persistence error handling.
- Session indicators and destructive-action protection (confirmation on Reset All, explicit "Start New Session" trigger).
- Disconnected phones, reconnects, guests, full roster, and server restart resilience.
- Theme and sound playback preservation.

## Deliverables
- Rehearsal verification across all device surfaces:
  - Laptop: `/control` (Session Control & Campaign Maintenance).
  - TV: `/display` (Combat timers with HP bars and bottom enemy ribbon; Map with pins; Objectives; Recaps).
  - DM Mobile: `/dm` (Live combat controls, + Enemy modal, +/- HP adjustments, TV tab switcher).
  - Player Mobile: `/remote` (No-scroll Cooldown hero card, searchable Spellbook with cast modal, interactive Spell Slot bubbles, HP adjustments).
- Explicit `⚡ Start New Session` button on `/control` that performs full session initialization (restoring player HP and spell slots, clearing combat timers, resetting active enemies, and selecting the Timers TV tab).
- Confirmation guardrails on destructive actions (`Reset All`, `Delete Combatant`, `Start New Session`).
- All 39 automated tests passing.

## Completed validation
- All unit, integration, persistence, state boundary, realtime, roster, and campaign API tests pass cleanly.
- Verified mobile touch bounds and responsive layout without vertical scrolling on primary cooldown views.

## Success criteria
DM primarily uses the phone; players find spells and control timers; TV is readable; failure states are visible and recoverable; the workflow is faster than the current app.

## Handoff
Phase 13 is complete. The application is polished, guarded, and dependable. Phase 14 can proceed with Final Documentation & Repository Cleanup.
