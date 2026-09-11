# Phase 04 State Model

Status: Implemented locally; broader persistence integration belongs to Phase 05.

## Boundaries

### Application configuration

Presentation/runtime preferences that do not describe a live combat session:

- Theme.
- Custom background URL.
- Timer-complete sound.
- Hand-raise sound.

### Campaign state

Durable campaign content:

- Permanent player profiles.
- Known spells and descriptions.
- World maps.
- Objectives.
- Session recaps.

### Session state

Current session setup and navigation:

- Active permanent profile IDs.
- Temporary guest profiles.
- Timer templates/defaults retained from the legacy app.
- Selected display tab.
- Whether a session is active.

### Combat state

Disposable live state:

- Current timers.
- Enemies.
- Current HP.
- Remaining spell slots.
- Conditions.
- Lock/adjust controls.
- Timer finish order.

## Migration behavior

`migrate_legacy_settings()` converts the mixed legacy `settings.json` shape into `ApplicationState`:

- Preserves theme and sound choices.
- Preserves timer names, cooldown defaults, and remote visibility as session timer templates.
- Discards persisted live timer values.
- Ignores the legacy `cooldown_mode` switch; the dedicated app's model is cooldown-based.
- Starts with empty campaign data because the legacy application had no campaign model.

`persistence.load_application_state()` is the initialization entry point for this migration. Database/repository loading belongs to Phase 05.

## Session transitions

`start_session()`:

- Activates the chosen profile IDs.
- Marks the session active.
- Selects the Timers display tab.
- Clears old timers, enemies, conditions, and finish order.
- Restores current HP from each active profile's `max_hp`.
- Restores spell slots from each active profile's `spell_slots_max`.

`reset_combat()`:

- Clears disposable combat state.
- Preserves campaign data.
- Preserves session active state, roster, and selected display tab.
- Preserves adjust-control configuration.

## Deliberate limitations

- The existing `timers.py` runtime has not yet been migrated to use `ApplicationState` directly. That coupling is intentional for this phase and is a Phase 05/06 follow-up.
- State is currently in-memory after migration. Durable repository/database integration belongs to Phase 05.
- Player, spell, enemy, and guest schemas remain minimal until their feature phases define the required fields.
