# Phase 11 - Spellbook and Resources

Status: Complete. Player Remote reconstructed with no-scroll Cooldown hero card, searchable Spellbook with detail modal/slot-casting, and Resources panel with interactive spell-slot bubbles and HP controls.

## Objective
Let players answer spell questions and manage resources without leaving the app or crowding primary controls.

## Scope
- No-scroll player Control view (`⏱️ Cooldown`).
- Known-spell list and one focused detail view (`✨ Spellbook`).
- User-managed spell details and campaign notes.
- Independent per-level/resource-group slots (`🛡️ Resources`).
- Player current HP and slot expenditure/restoration within DM-configured maxima.
- DM override and full restore.
- Session-start restore.

## Deliverables
- Rebuilt [remote.html](src/dnd_clock/templates/remote.html) and [remote.js](src/dnd_clock/static/js/remote.js) featuring bottom 3-tab navigation bar:
  1. **Cooldown**: Compact, no-scroll primary card showing remaining cooldown time in giant typography, ready/running/paused status, quick visual HP bar, condition warnings, huge `Action Taken (Reset Cooldown)` button, Start/Pause toggle, and Raise Hand.
  2. **Spellbook**: Searchable list of all known spells from PostgreSQL with level tags, concentration badges, and a focused Spell Detail Modal with description and "Expend Slot & Cast" action.
  3. **Resources**: Interactive spell-slot bubbles (● / ○) for each spell level supporting tap-to-expend/restore, Full Restore button, and rapid +/- HP adjustments clamped to Max HP.
- Realtime socket handlers for `set_spell_slot`, `adjust_spell_slot`, and `restore_all_slots`.
- Automated test suite in `tests/test_realtime.py` (all 37 tests passing).

## Completed validation
- All 37 unit, integration, persistence, state boundary, realtime, roster, and campaign API tests pass cleanly.
- Verified spell search, modal details, and slot expenditure.

## Success criteria
A player finds a known spell quickly; timer controls remain no-scroll; slots are independent of spells; bounds and restore behavior are correct.

## Handoff
Phase 11 is complete. Players now have a dedicated mobile interface for combat cooldowns, spell lookup, and resource management. Phase 12 can proceed with Campaign Display Tabs (World Map with pins, Quest Objectives, and Session Recaps).
