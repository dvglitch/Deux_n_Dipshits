import unittest
from dnd_clock.domain.roster import RosterManager, MAX_ACTIVE_ROSTER


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


if __name__ == "__main__":
    unittest.main()
