import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from dnd_clock.app import create_app
from dnd_clock.database.repositories import SQLiteCampaignRepository


class CampaignApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_campaign.db"
        self.app, self.socketio = create_app(start_background_task=False)
        self.client = self.app.test_client()
        self.repo_patcher = patch(
            "dnd_clock.routes.campaign.create_campaign_repository",
            side_effect=lambda: SQLiteCampaignRepository(self.db_path),
        )
        self.repo_patcher.start()

    def tearDown(self):
        self.repo_patcher.stop()
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


if __name__ == "__main__":
    unittest.main()
