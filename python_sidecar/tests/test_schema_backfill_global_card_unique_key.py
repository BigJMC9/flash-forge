import sqlite3
import sys
import time
import unittest
import uuid
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from AnkiDeckBuilder.DatabaseService import (  # noqa: E402
    BackfillScopedTemplateColumns,
    BuildGlobalCardUniqueKey,
    EnsureDatabaseSchema,
)


class SchemaBackfillGlobalCardUniqueKeyTests(unittest.TestCase):
    def test_backfill_updates_template_global_card_unique_key_without_error(self) -> None:
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        EnsureDatabaseSchema(connection)

        card_id = str(uuid.uuid4())
        connection.execute(
            """
            INSERT INTO global_cards (id, owner_user_id, kanji, kana, unique_key, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (card_id, "", "食べる", "たべる", "", time.time()),
        )
        connection.commit()

        BackfillScopedTemplateColumns(connection)

        row = connection.execute(
            "SELECT owner_user_id, kanji, kana, unique_key FROM global_cards WHERE id = ?",
            (card_id,),
        ).fetchone()
        self.assertIsNotNone(row)
        expected_key = BuildGlobalCardUniqueKey(row["owner_user_id"], row["kanji"], row["kana"])
        self.assertEqual(expected_key, row["unique_key"])


if __name__ == "__main__":
    unittest.main()
