from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class ApplicationConfig:
    theme: str = "tavern"
    custom_bg_url: str = ""
    timer_done_sound: str = "synthetic"
    hand_raise_sound: str = "synthetic"


@dataclass
class TimerTemplate:
    name: str
    cooldown_duration: int
    show_on_remote: bool = True


@dataclass
class CampaignState:
    player_profiles: dict[str, dict[str, Any]] = field(default_factory=dict)
    spells: dict[str, dict[str, Any]] = field(default_factory=dict)
    world_maps: list[dict[str, Any]] = field(default_factory=list)
    objectives: list[dict[str, Any]] = field(default_factory=list)
    recaps: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class SessionState:
    active_profile_ids: list[str] = field(default_factory=list)
    guest_profiles: dict[str, dict[str, Any]] = field(default_factory=dict)
    timer_templates: dict[str, TimerTemplate] = field(default_factory=dict)
    selected_display_tab: str = "timers"
    active: bool = False


@dataclass
class CombatState:
    timers: dict[str, dict[str, Any]] = field(default_factory=dict)
    enemies: dict[str, dict[str, Any]] = field(default_factory=dict)
    current_hp: dict[str, int] = field(default_factory=dict)
    spell_slots_remaining: dict[str, dict[str, int]] = field(default_factory=dict)
    conditions: dict[str, list[str]] = field(default_factory=dict)
    locked: bool = False
    adjust_locked: bool = True
    adjust_interval: int = 15
    finish_order: list[str] = field(default_factory=list)


@dataclass
class ApplicationState:
    config: ApplicationConfig = field(default_factory=ApplicationConfig)
    campaign: CampaignState = field(default_factory=CampaignState)
    session: SessionState = field(default_factory=SessionState)
    combat: CombatState = field(default_factory=CombatState)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def migrate_legacy_settings(settings: dict[str, Any]) -> ApplicationState:
    """Convert mixed legacy settings into explicit state boundaries.

    Runtime timer values are intentionally omitted because combat state is
    disposable. The old timer-mode switch is also intentionally ignored.
    """
    names = settings.get("timer_names", {})
    cooldowns = settings.get("timer_cooldown_durations", {})
    durations = settings.get("timer_durations", {})
    visibility = settings.get("timer_show_on_remote", {})
    active_ids = settings.get("active_timer_ids", [])
    default_duration = int(settings.get("DEFAULT_DURATION", 180))

    timer_templates = {}
    for timer_id in active_ids:
        key = str(timer_id)
        timer_templates[key] = TimerTemplate(
            name=str(names.get(key, f"Timer {timer_id}")),
            cooldown_duration=int(cooldowns.get(key, durations.get(key, default_duration))),
            show_on_remote=bool(visibility.get(key, True)),
        )

    return ApplicationState(
        config=ApplicationConfig(
            theme=str(settings.get("theme", "tavern")),
            custom_bg_url=str(settings.get("custom_bg_url", "")),
            timer_done_sound=str(settings.get("timer_done_sound", "synthetic")),
            hand_raise_sound=str(settings.get("hand_raise_sound", "synthetic")),
        ),
        session=SessionState(timer_templates=timer_templates),
        combat=CombatState(
            adjust_locked=bool(settings.get("adjust_locked", True)),
            adjust_interval=int(settings.get("adjust_interval", 15)),
        ),
    )


def start_session(state: ApplicationState, active_profile_ids: list[str] | None = None) -> ApplicationState:
    """Start a session and initialize disposable resources from campaign data."""
    state.session.active_profile_ids = list(active_profile_ids or state.session.active_profile_ids)
    state.session.active = True
    state.session.selected_display_tab = "timers"
    state.combat.enemies.clear()
    state.combat.timers.clear()
    state.combat.finish_order.clear()
    state.combat.conditions.clear()
    state.combat.current_hp = {
        profile_id: int(profile.get("max_hp", 0))
        for profile_id, profile in state.campaign.player_profiles.items()
        if profile_id in state.session.active_profile_ids
    }
    state.combat.spell_slots_remaining = {
        profile_id: {
            level: int(maximum)
            for level, maximum in profile.get("spell_slots_max", {}).items()
        }
        for profile_id, profile in state.campaign.player_profiles.items()
        if profile_id in state.session.active_profile_ids
    }
    return state


def reset_combat(state: ApplicationState) -> ApplicationState:
    """Clear live combat state without touching campaign or session setup."""
    state.combat = CombatState(
        adjust_locked=state.combat.adjust_locked,
        adjust_interval=state.combat.adjust_interval,
    )
    return state
