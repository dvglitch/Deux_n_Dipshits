import copy
import unittest
from unittest.mock import patch

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dnd_clock import game_logic, persistence, timers
from dnd_clock.database.repositories import RepositoryError, SQLiteCampaignRepository
from dnd_clock.database.factory import create_campaign_repository
from dnd_clock.domain.state import migrate_legacy_settings, reset_combat, start_session


class TimerBehaviorTests(unittest.TestCase):
    def setUp(self):
        self.original_timers = copy.deepcopy(timers.timers)
        self.original_finish_order = list(timers.finish_order)
        self.original_control_state = dict(timers.control_state)
        self.original_default_duration = timers.DEFAULT_DURATION
        self.original_save = timers.save_current_state

        timers.save_current_state = lambda: None
        timers.timers = {
            1: {
                "remaining": 20,
                "running": False,
                "last_update": 0,
                "name": "One",
                "finished": False,
                "raised_hand": False,
                "condition": "",
                "duration": 45,
                "cooldown_duration": 45,
                "show_on_remote": True,
            },
            2: {
                "remaining": 30,
                "running": False,
                "last_update": 0,
                "name": "Two",
                "finished": False,
                "raised_hand": False,
                "condition": "",
                "duration": 60,
                "cooldown_duration": 60,
                "show_on_remote": True,
            },
        }
        timers.finish_order = []
        timers.control_state["locked"] = False
        timers.control_state["cooldown_mode"] = True

    def tearDown(self):
        timers.timers = self.original_timers
        timers.finish_order = self.original_finish_order
        timers.control_state.clear()
        timers.control_state.update(self.original_control_state)
        timers.DEFAULT_DURATION = self.original_default_duration
        timers.save_current_state = self.original_save

    def test_reset_uses_cooldown_duration_and_can_start(self):
        timers.reset_timer(1, start=True)

        self.assertEqual(timers.timers[1]["remaining"], 45)
        self.assertTrue(timers.timers[1]["running"])
        self.assertFalse(timers.timers[1]["finished"])

    def test_locked_timer_cannot_toggle(self):
        timers.control_state["locked"] = True

        timers.toggle_timer(1)

        self.assertFalse(timers.timers[1]["running"])

    def test_unlocked_timer_can_toggle(self):
        timers.toggle_timer(1)

        self.assertTrue(timers.timers[1]["running"])

    def test_condition_is_stored_on_timer(self):
        timers.set_condition(1, "Stunned")

        self.assertEqual(timers.timers[1]["condition"], "Stunned")


class InitiativeBehaviorTests(unittest.TestCase):
    def setUp(self):
        self.original_timers = copy.deepcopy(timers.timers)
        self.original_finish_order = list(timers.finish_order)
        self.original_control_state = dict(timers.control_state)
        self.original_save = timers.save_current_state

        timers.save_current_state = lambda: None
        timers.timers = {
            1: {"remaining": 10, "duration": 60, "running": True, "finished": False},
            2: {"remaining": 10, "duration": 60, "running": True, "finished": False},
        }
        timers.finish_order = []
        timers.control_state["cooldown_mode"] = True

    def tearDown(self):
        timers.timers = self.original_timers
        timers.finish_order = self.original_finish_order
        timers.control_state.clear()
        timers.control_state.update(self.original_control_state)
        timers.save_current_state = self.original_save

    def test_cooldown_initiative_assigns_minimum_to_best_rank(self):
        game_logic.calculate_initiatives(
            mode="proportional",
            interval=30,
            ranks={"1": 1, "2": 3},
            min_seconds=20,
            max_seconds=40,
        )

        self.assertEqual(timers.timers[1]["duration"], 20)
        self.assertEqual(timers.timers[2]["duration"], 40)
        self.assertEqual(timers.timers[1]["remaining"], 0)
        self.assertEqual(timers.timers[2]["remaining"], 0)
        self.assertTrue(timers.timers[1]["finished"])
        self.assertTrue(timers.timers[2]["finished"])


class PersistenceTests(unittest.TestCase):
    def test_save_and_load_round_trip(self):
        settings = {"theme": "tavern", "timer_names": {"1": "Angel"}}

        with patch.object(persistence, "SETTINGS_FILE", "test-settings.json"):
            with patch("builtins.open", unittest.mock.mock_open()) as mocked_open:
                persistence.save_settings(settings)
                mocked_open.assert_called_once()

    def test_invalid_json_returns_defaults(self):
        with patch.object(persistence, "SETTINGS_FILE", "broken-settings.json"):
            with patch("os.path.exists", return_value=True):
                with patch("builtins.open", unittest.mock.mock_open(read_data="not json")):
                    loaded = persistence.load_settings()

        self.assertEqual(loaded["theme"], persistence.DEFAULT_SETTINGS["theme"])
        self.assertEqual(loaded["cooldown_mode"], persistence.DEFAULT_SETTINGS["cooldown_mode"])


class StateBoundaryTests(unittest.TestCase):
    def test_legacy_settings_migrate_without_live_combat_state(self):
        state = migrate_legacy_settings(
            {
                "theme": "forest",
                "timer_done_sound": "ding.mp3",
                "hand_raise_sound": "hand.mp3",
                "cooldown_mode": False,
                "active_timer_ids": [1],
                "timer_names": {"1": "Angel"},
                "timer_cooldown_durations": {"1": 45},
                "timer_durations": {"1": 90},
                "timer_show_on_remote": {"1": False},
                "timers": {"1": {"remaining": 12, "running": True}},
            }
        )

        self.assertEqual(state.config.theme, "forest")
        self.assertEqual(state.config.timer_done_sound, "ding.mp3")
        self.assertEqual(state.session.timer_templates["1"].name, "Angel")
        self.assertEqual(state.session.timer_templates["1"].cooldown_duration, 45)
        self.assertFalse(state.session.timer_templates["1"].show_on_remote)
        self.assertFalse(state.combat.timers)
        self.assertFalse(hasattr(state, "cooldown_mode"))

    def test_start_session_restores_resources_and_selects_timers(self):
        state = migrate_legacy_settings({})
        state.campaign.player_profiles = {
            "angel": {"max_hp": 30, "spell_slots_max": {"1": 4, "2": 2}},
            "inactive": {"max_hp": 20, "spell_slots_max": {"1": 2}},
        }
        state.session.active_profile_ids = ["angel"]
        state.session.selected_display_tab = "objectives"
        state.combat.timers = {"old": {"remaining": 1}}
        state.combat.enemies = {"goblin": {"remaining": 2}}

        start_session(state)

        self.assertTrue(state.session.active)
        self.assertEqual(state.session.selected_display_tab, "timers")
        self.assertEqual(state.combat.current_hp, {"angel": 30})
        self.assertEqual(state.combat.spell_slots_remaining, {"angel": {"1": 4, "2": 2}})
        self.assertFalse(state.combat.timers)
        self.assertFalse(state.combat.enemies)

    def test_reset_combat_preserves_campaign_and_session(self):
        state = migrate_legacy_settings({"active_timer_ids": [1]})
        state.campaign.player_profiles["angel"] = {"max_hp": 30}
        state.session.active = True
        state.session.selected_display_tab = "objectives"
        state.combat.timers = {"1": {"remaining": 0}}
        state.combat.current_hp = {"angel": 4}

        reset_combat(state)

        self.assertEqual(state.campaign.player_profiles["angel"]["max_hp"], 30)
        self.assertTrue(state.session.active)
        self.assertEqual(state.session.selected_display_tab, "objectives")
        self.assertFalse(state.combat.timers)
        self.assertFalse(state.combat.current_hp)


class CampaignRepositoryTests(unittest.TestCase):
    def setUp(self):
        self.repository = SQLiteCampaignRepository()

    def tearDown(self):
        self.repository.close()

    def test_campaign_collection_round_trip(self):
        records = [{"id": "angel", "name": "Angel", "max_hp": 30}]

        self.repository.save_collection("player_profiles", records)

        self.assertEqual(self.repository.load_collection("player_profiles"), records)

    def test_campaign_collections_are_isolated(self):
        self.repository.save_collection("spells", [{"id": "shield", "level": 1}])

        self.assertEqual(self.repository.load_collection("player_profiles"), [])
        self.assertEqual(self.repository.load_collection("spells")[0]["id"], "shield")

    def test_invalid_collection_is_rejected(self):
        with self.assertRaises(ValueError):
            self.repository.load_collection("combat_state")

    def test_save_replaces_a_collection_atomically(self):
        self.repository.save_collection("objectives", [{"id": "old"}])
        self.repository.save_collection("objectives", [{"id": "new"}])

        self.assertEqual(self.repository.load_collection("objectives"), [{"id": "new"}])

    def test_factory_uses_sqlite_without_database_configuration(self):
        repository = create_campaign_repository(database_url_override="")
        try:
            self.assertIsInstance(repository, SQLiteCampaignRepository)
        finally:
            repository.close()

    def test_persistence_health_endpoint_reports_database_status(self):
        from dnd_clock.app import create_app

        class FakeRepository:
            def load_collection(self, collection):
                self.collection = collection
                return []

            def close(self):
                self.closed = True

        with patch("dnd_clock.app.create_campaign_repository", return_value=FakeRepository()):
            flask_app, _ = create_app(start_background_task=False)
            response = flask_app.test_client().get("/api/persistence/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["database"], "ok")


if __name__ == "__main__":
    unittest.main()
