import sqlite3
import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from AnkiDeckBuilder.DatabaseService import (  # noqa: E402
    CreateUser,
    EnsureDatabaseSchema,
    SerializeUserRow,
    UpdateUserPermissions,
)


class UserPermissionTests(unittest.TestCase):
    def test_new_users_have_ocr_disabled_by_default(self) -> None:
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        EnsureDatabaseSchema(connection)

        user_row = CreateUser(
            connection,
            "tester",
            "tester@example.com",
            "password123",
            isAdmin=False,
            canUseAi=True,
        )

        serialized = SerializeUserRow(user_row)
        self.assertTrue(serialized["can_use_ai"])
        self.assertFalse(serialized["can_use_ocr"])

    def test_admin_permission_updates_can_toggle_ocr_independently(self) -> None:
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        EnsureDatabaseSchema(connection)

        user_row = CreateUser(
            connection,
            "ocr-user",
            "ocr-user@example.com",
            "password123",
            isAdmin=False,
            canUseAi=False,
        )

        UpdateUserPermissions(
            connection,
            user_row["id"],
            canUseAi=False,
            canUseOcr=True,
            isActive=True,
        )

        reloaded = connection.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_row["id"],),
        ).fetchone()
        serialized = SerializeUserRow(reloaded)
        self.assertFalse(serialized["can_use_ai"])
        self.assertTrue(serialized["can_use_ocr"])


if __name__ == "__main__":
    unittest.main()
