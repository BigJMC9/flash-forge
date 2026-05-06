import sqlite3
import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from AnkiDeckBuilder.DatabaseService import (  # noqa: E402
    AddCard,
    CreateCollection,
    CreateCustomCardSchema,
    CreateDeck,
    EnsureDatabaseSchema,
    ListCardSchemaOptions,
)
from AnkiDeckBuilder.ExportService import BuildNoteFields  # noqa: E402


class KanjiCardFormatTests(unittest.TestCase):
    def test_kanji_detail_schema_renders_readings_and_radical_position_icon(self) -> None:
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        EnsureDatabaseSchema(connection)

        owner_user_id = "user-1"
        CreateCollection(connection, "Kanji", owner_user_id)
        collection_id = connection.execute(
            "SELECT id FROM collections WHERE owner_user_id = ? LIMIT 1",
            (owner_user_id,),
        ).fetchone()["id"]
        CreateDeck(connection, collection_id, "Radicals", owner_user_id)
        deck_id = connection.execute(
            "SELECT id FROM decks WHERE collection_id = ? LIMIT 1",
            (collection_id,),
        ).fetchone()["id"]

        added = AddCard(
            connection,
            deck_id,
            {
                "kanji": "休",
                "kana": "",
                "english": "rest",
                "notes": "",
                "source_text": "test",
                "schema_key": "kanji_detail_front_back",
                "media_type": "none",
                "media_files": [],
                "tags": [],
                "word_form": "dictionary",
                "kanji_on_readings": "キュウ",
                "kanji_kun_readings": "やすむ",
                "kanji_nanori_readings": "やす",
                "radical_position": "hen",
            },
        )

        self.assertTrue(added)
        card = connection.execute("SELECT * FROM cards WHERE deck_id = ? LIMIT 1", (deck_id,)).fetchone()
        front_html, back_html, _ = BuildNoteFields(card)

        self.assertEqual(front_html, "休")
        self.assertIn("Meaning", back_html)
        self.assertIn("rest", back_html)
        self.assertIn("ON", back_html)
        self.assertIn("キュウ", back_html)
        self.assertIn("Kun", back_html)
        self.assertIn("やすむ", back_html)
        self.assertIn("Nanori", back_html)
        self.assertIn("やす", back_html)
        self.assertIn("へん", back_html)
        self.assertIn("hen.png", back_html)

    def test_custom_schema_renders_configured_front_and_back_fields(self) -> None:
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        EnsureDatabaseSchema(connection)

        owner_user_id = "user-1"
        CreateCollection(connection, "Custom", owner_user_id)
        collection_id = connection.execute(
            "SELECT id FROM collections WHERE owner_user_id = ? LIMIT 1",
            (owner_user_id,),
        ).fetchone()["id"]
        CreateDeck(connection, collection_id, "Formats", owner_user_id)
        deck_id = connection.execute(
            "SELECT id FROM decks WHERE collection_id = ? LIMIT 1",
            (collection_id,),
        ).fetchone()["id"]

        schema = CreateCustomCardSchema(
            connection,
            owner_user_id,
            "English prompt",
            ["english"],
            ["kanji", "kana"],
            {},
        )
        added = AddCard(
            connection,
            deck_id,
            {
                "kanji": "読む",
                "kana": "よむ",
                "english": "to read",
                "notes": "",
                "source_text": "test",
                "schema_key": schema["key"],
                "media_type": "none",
                "media_files": [],
                "tags": [],
                "word_form": "dictionary",
            },
        )

        self.assertTrue(added)
        self.assertTrue(
            any(item["key"] == schema["key"] for item in ListCardSchemaOptions(connection, owner_user_id))
        )
        card = connection.execute("SELECT * FROM cards WHERE deck_id = ? LIMIT 1", (deck_id,)).fetchone()
        front_html, back_html, _ = BuildNoteFields(card, connection)

        self.assertEqual(front_html, "to read")
        self.assertEqual(back_html, "読む<br>よむ")


if __name__ == "__main__":
    unittest.main()
