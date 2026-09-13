import io
import unittest
from dnd_clock.domain.roster import RosterManager, MAX_ACTIVE_ROSTER, MAX_PORTRAIT_BYTES
from dnd_clock.services.portrait_service import PortraitStorageService


class RosterManagerTests(unittest.TestCase):
    def test_active_roster_combines_permanent_and_guests(self):
        permanent = [
            {"id": "p1", "name": "Alice"},
            {"id": "p2", "name": "Bob"},
            {"id": "p3", "name": "Charlie"},
        ]
        guests = [{"id": "g1", "name": "Guest 1"}]
        active_ids = ["p1", "p3"]

        active = RosterManager.set_active_roster(permanent, active_ids, guests)
        self.assertEqual(len(active), 3)
        self.assertEqual([p["name"] for p in active], ["Alice", "Charlie", "Guest 1"])
        self.assertFalse(active[0]["is_guest"])
        self.assertTrue(active[2]["is_guest"])

    def test_guest_only_session(self):
        permanent = [{"id": "p1", "name": "Alice"}]
        guests = [{"name": "Guest 1"}, {"name": "Guest 2"}]
        active_ids = []

        active = RosterManager.set_active_roster(permanent, active_ids, guests)
        self.assertEqual(len(active), 2)
        self.assertTrue(all(p["is_guest"] for p in active))

    def test_roster_cap_rejects_more_than_nine(self):
        permanent = [{"id": f"p{i}", "name": f"P{i}"} for i in range(1, 10)]
        guests = [{"name": "Extra Guest"}]
        active_ids = [f"p{i}" for i in range(1, 10)]

        with self.assertRaises(ValueError):
            RosterManager.set_active_roster(permanent, active_ids, guests)

    def test_portrait_validation_rejects_invalid_extension(self):
        with self.assertRaises(ValueError) as ctx:
            RosterManager.validate_portrait("malicious.exe", b"fake content")
        self.assertIn("Unsupported image type", str(ctx.exception))

    def test_portrait_validation_rejects_oversized_file(self):
        large_bytes = b"x" * (MAX_PORTRAIT_BYTES + 10)
        with self.assertRaises(ValueError) as ctx:
            RosterManager.validate_portrait("photo.png", large_bytes)
        self.assertIn("exceeds max size", str(ctx.exception))

    def test_portrait_storage_local_save(self):
        service = PortraitStorageService()
        url = service.save_portrait("player_1", "test.png", b"\x89PNG\r\n\x1a\nfakeimagecontent")
        self.assertTrue(url.startswith("/static/images/portraits/portrait_player_1_"))
        self.assertTrue(url.endswith(".png"))
        # Clean up created test file
        from dnd_clock.services.portrait_service import LOCAL_UPLOADS_DIR
        for p in LOCAL_UPLOADS_DIR.glob("portrait_player_1_*"):
            try:
                p.unlink()
            except OSError:
                pass


if __name__ == "__main__":
    unittest.main()
