import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from dnd_clock.app import create_app
from dnd_clock.database.repositories import SQLiteCampaignRepository
from dnd_clock import timers as tm


class CampaignApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_campaign.db"
        self.test_settings_path = Path(self.temp_dir.name) / "test_settings.json"
        
        self.settings_patcher = patch("dnd_clock.persistence.SETTINGS_FILE", str(self.test_settings_path))
        self.settings_patcher.start()

        self.app, self.socketio = create_app(start_background_task=False)
        self.client = self.app.test_client()
        self.repo_patcher = patch(
            "dnd_clock.routes.campaign.create_campaign_repository",
            side_effect=lambda: SQLiteCampaignRepository(self.db_path),
        )
        self.repo_patcher.start()

    def tearDown(self):
        self.repo_patcher.stop()
        self.settings_patcher.stop()
        self.temp_dir.cleanup()

    def test_get_empty_collection(self):
        res = self.client.get("/api/campaign/player_profiles")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["collection"], "player_profiles")
        self.assertEqual(data["records"], [])

    def test_invalid_collection_rejected(self):
        res = self.client.get("/api/campaign/unknown_table")
        self.assertEqual(res.status_code, 400)

    def test_save_and_get_collection(self):
        payload = {
            "records": [
                {"id": "p1", "name": "Thorin", "max_hp": 45, "accent_color": "#d4af37"},
                {"id": "p2", "name": "Gandalf", "max_hp": 30, "accent_color": "#4a90e2"},
            ]
        }
        res = self.client.post("/api/campaign/player_profiles", json=payload)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["status"], "saved")

        get_res = self.client.get("/api/campaign/player_profiles")
        self.assertEqual(get_res.status_code, 200)
        records = get_res.get_json()["records"]
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0]["name"], "Thorin")
        self.assertEqual(records[1]["name"], "Gandalf")

    def test_saving_player_profiles_refreshes_live_timer_configuration(self):
        payload = {
            "records": [{
                "id": "player_1",
                "name": "Thorin",
                "max_hp": 45,
                "default_cooldown": 90,
                "accent_color": "#4a90e2",
                "spell_slots_max": {"1": 2, "2": 5, "3": 1},
            }]
        }

        response = self.client.post("/api/campaign/player_profiles", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(tm.timers[1]["max_hp"], 45)
        self.assertEqual(tm.timers[1]["duration"], 90)
        self.assertEqual(tm.timers[1]["accent_color"], "#4a90e2")
        slots = tm.timers[1]["spell_slots"]
        self.assertEqual({level: info["max"] for level, info in slots.items()}, {"1": 2, "2": 5, "3": 1})
        self.assertTrue(all(info["current"] <= info["max"] for info in slots.values()))

    def test_spells_action_type_and_cooldown_persistence(self):
        payload = {
            "records": [
                {
                    "id": "spell_1",
                    "name": "Misty Step",
                    "level": 2,
                    "action_type": "Bonus Action",
                    "resets_timer": False,
                    "duration": "Instantaneous",
                    "concentration": False,
                    "assigned_to": ["Thorin"]
                },
                {
                    "id": "spell_2",
                    "name": "Fireball",
                    "level": 3,
                    "action_type": "Action",
                    "resets_timer": True,
                    "duration": "Instantaneous",
                    "concentration": False,
                    "assigned_to": []
                }
            ]
        }
        res = self.client.post("/api/campaign/spells", json=payload)
        self.assertEqual(res.status_code, 200)
        get_res = self.client.get("/api/campaign/spells")
        spells = get_res.get_json()["records"]
        self.assertEqual(len(spells), 2)
        self.assertEqual(spells[0]["action_type"], "Bonus Action")
        self.assertFalse(spells[0]["resets_timer"])
        self.assertEqual(spells[1]["action_type"], "Action")
        self.assertTrue(spells[1]["resets_timer"])

    def test_delete_collection(self):
        self.client.post(
            "/api/campaign/objectives",
            json={"records": [{"id": "obj1", "title": "Find the relic"}]},
        )
        del_res = self.client.delete("/api/campaign/objectives")
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.get_json()["status"], "deleted")

        get_res = self.client.get("/api/campaign/objectives")
        self.assertEqual(get_res.get_json()["records"], [])

    def test_world_maps_with_pins_persistence(self):
        payload = {
            "records": [
                {
                    "id": "map_1",
                    "name": "Sword Coast",
                    "image_url": "https://example.com/map.jpg",
                    "pins": "Party: 45%, 60% | Dungeon: 70%, 30%",
                    "notes": "Main region map"
                }
            ]
        }
        res = self.client.post("/api/campaign/world_maps", json=payload)
        self.assertEqual(res.status_code, 200)

        get_res = self.client.get("/api/campaign/world_maps")
        self.assertEqual(get_res.status_code, 200)
        records = get_res.get_json()["records"]
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["pins"], "Party: 45%, 60% | Dungeon: 70%, 30%")

    def test_recaps_and_objectives_persistence(self):
        # Objectives
        obj_payload = {
            "records": [
                {"id": "obj_1", "title": "Defeat the Dragon", "status": "Active", "priority": "High"},
                {"id": "obj_2", "title": "Find the Inn", "status": "Completed", "priority": "Low"},
            ]
        }
        res_obj = self.client.post("/api/campaign/objectives", json=obj_payload)
        self.assertEqual(res_obj.status_code, 200)

        # Recaps
        recap_payload = {
            "records": [
                {
                    "id": "recap_1",
                    "session_number": 1,
                    "date": "2026-09-01",
                    "title": "The Journey Begins",
                    "summary": "Party met at the tavern."
                }
            ]
        }
        res_rec = self.client.post("/api/campaign/recaps", json=recap_payload)
        self.assertEqual(res_rec.status_code, 200)

        get_rec = self.client.get("/api/campaign/recaps")
        self.assertEqual(len(get_rec.get_json()["records"]), 1)
        self.assertEqual(get_rec.get_json()["records"][0]["title"], "The Journey Begins")

    def test_map_upload_and_list_api(self):
        import io
        # 1. Test listing maps
        list_res = self.client.get("/api/maps")
        self.assertEqual(list_res.status_code, 200)
        self.assertIsInstance(list_res.get_json(), list)

        # 2. Test map upload
        fake_image = (io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"), "test_dungeon_map.png")
        data = {
            "file": fake_image
        }
        upload_res = self.client.post("/api/campaign/upload_map", data=data, content_type="multipart/form-data")
        self.assertEqual(upload_res.status_code, 200)
        res_json = upload_res.get_json()
        self.assertEqual(res_json["status"], "uploaded")
        self.assertTrue(res_json["map_url"].startswith("/static/maps/"))


if __name__ == "__main__":
    unittest.main()
