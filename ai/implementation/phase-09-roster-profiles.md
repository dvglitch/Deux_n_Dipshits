# Phase 09 - Roster and Profiles

Status: Complete. Roster manager, capacity constraints (max 9), and portrait storage/upload services implemented.

## Objective
Support permanent party members, inactive players, guest-heavy sessions, and optional cosmetic identity.

## Scope
- Permanent and temporary profiles.
- Active/inactive roster state.
- Maximum of nine active profiles.
- Guest-only sessions.
- DM-managed colors and optional portraits for permanent players.
- Replacement and validation for portraits.

## Deliverables
- `PlayerProfile` and `RosterManager` in `src/dnd_clock/domain/roster.py`.
- Roster combination logic with 9 combatant max enforcement and guest separation.
- `PortraitStorageService` in `src/dnd_clock/services/portrait_service.py` supporting Supabase Storage bucket (`player-portraits`) and local static file fallback.
- Portrait upload API endpoint `/api/campaign/upload_portrait`.
- UI file upload and color picker on Campaign Maintenance Party Profiles editor.
- Automated unit tests in `tests/test_roster.py`.

## Completed validation
- All 32 unit, state, persistence, socket, campaign API, and roster tests pass cleanly.
- Verified file extension and size validation on portrait uploads.
- Verified roster cap of 9 active players/guests.

## Success criteria
All roster combinations up to nine work; inactive players are hidden; guests do not overwrite permanent profiles; invalid images fail clearly.

## Handoff
Phase 09 is complete. Permanent and temporary profiles, roster constraints, and portrait handling are established. Phase 10 can proceed to enhance the core combat display (HP bars, conditions, enemy ribbon, and DM live phone controls).
