import copy
import unittest
from unittest.mock import patch

import game_logic
import persistence
import timers


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


if __name__ == "__main__":
    unittest.main()
