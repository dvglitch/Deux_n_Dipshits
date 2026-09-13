import unittest
from unittest.mock import patch

from dnd_clock.app import create_app
from dnd_clock import timers as tm


class RealtimeSocketTests(unittest.TestCase):
    def setUp(self):
        self.app, self.socketio = create_app(start_background_task=False)
        self.client = self.socketio.test_client(self.app)
        # Clear out initial connection messages
        self.client.get_received()

    def tearDown(self):
        if self.client.is_connected():
            self.client.disconnect()

    def test_connect_receives_control_update(self):
        new_client = self.socketio.test_client(self.app)
        received = new_client.get_received()
        new_client.disconnect()

        event_names = [e["name"] for e in received]
        self.assertIn("control_update", event_names)
        control_update = next(e for e in received if e["name"] == "control_update")
        self.assertIn("locked", control_update["args"][0])
        self.assertIn("theme", control_update["args"][0])

    def test_malformed_payload_does_not_crash_server(self):
        # Emitting malformed non-dict / missing keys should not crash
        self.client.emit("toggle", "not a dict")
        self.client.emit("toggle", {})
        self.client.emit("set_timer", {"timer": "invalid_id", "seconds": "not_int"})
        self.client.emit("set_condition", {"timer": None})
        self.client.emit("adjust_timer", {"timer": 1, "delta": "abc"})

        # Client should still be connected and functional
        self.assertTrue(self.client.is_connected())

    def test_lock_controls_broadcasts_state(self):
        self.client.emit("lock_controls", {"locked": True})
        received = self.client.get_received()
        events = [e for e in received if e["name"] == "control_update"]
        self.assertTrue(len(events) > 0)
        self.assertTrue(events[-1]["args"][0]["locked"])

        # Reset back to False
        self.client.emit("lock_controls", {"locked": False})
        self.client.get_received()

    def test_locked_state_prevents_client_toggle_and_adjust(self):
        tm.control_state["locked"] = True
        tm.timers[1]["running"] = False
        initial_remaining = tm.timers[1]["remaining"]

        self.client.emit("toggle", {"timer": 1})
        self.assertFalse(tm.timers[1]["running"])

        self.client.emit("adjust_timer", {"timer": 1, "delta": 15})
        self.assertEqual(tm.timers[1]["remaining"], initial_remaining)

        tm.control_state["locked"] = False

    def test_theme_and_sound_updates_broadcast_new_state(self):
        self.client.emit("set_theme", {"theme": "forest"})
        received = self.client.get_received()
        theme_events = [e for e in received if e["name"] == "control_update"]
        self.assertTrue(len(theme_events) > 0)
        self.assertEqual(theme_events[-1]["args"][0]["theme"], "forest")

        self.client.emit("set_timer_done_sound", {"sound": "ding.mp3"})
        received = self.client.get_received()
        sound_events = [e for e in received if e["name"] == "control_update"]
        self.assertTrue(len(sound_events) > 0)
        self.assertEqual(sound_events[-1]["args"][0]["timer_done_sound"], "ding.mp3")

    def test_set_hp_updates_combatant_hp(self):
        self.client.emit("set_hp", {"timer": 1, "current_hp": 18, "max_hp": 35})
        self.assertEqual(tm.timers[1]["current_hp"], 18)
        self.assertEqual(tm.timers[1]["max_hp"], 35)

    def test_set_display_tab_broadcasts_state(self):
        self.client.emit("set_display_tab", {"tab": "objectives"})
        received = self.client.get_received()
        tab_events = [e for e in received if e["name"] == "control_update"]
        self.assertTrue(len(tab_events) > 0)
        self.assertEqual(tab_events[-1]["args"][0]["display_tab"], "objectives")

        # Reset back to timers
        self.client.emit("set_display_tab", {"tab": "timers"})
        self.client.get_received()

    def test_set_timer_meta_updates_metadata(self):
        self.client.emit("set_timer_meta", {
            "timer": 1,
            "accent_color": "#3498db",
            "character_name": "Thorin",
            "is_enemy": False
        })
        self.assertEqual(tm.timers[1]["accent_color"], "#3498db")
        self.assertEqual(tm.timers[1]["character_name"], "Thorin")
        self.assertFalse(tm.timers[1]["is_enemy"])

    def test_add_enemy_timer_creates_enemy_combatant(self):
        self.client.emit("add_timer", {"is_enemy": True, "name": "Goblin Raider"})
        newest_id = max(tm.timers.keys())
        self.assertEqual(tm.timers[newest_id]["name"], "Goblin Raider")
        self.assertTrue(tm.timers[newest_id]["is_enemy"])
        self.assertFalse(tm.timers[newest_id]["show_on_remote"])


if __name__ == "__main__":
    unittest.main()
