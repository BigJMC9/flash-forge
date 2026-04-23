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
    CreateDeck,
    DeleteCollection,
    DeleteDeck,
    EnsureDatabaseSchema,
)


def build_card_payload(unique_suffix: str) -> dict:
    return {
        "kanji": f"道{unique_suffix}",
        "kana": f"みち{unique_suffix}",
        "english": "road",
        "notes": "",
        "source_text": "test",
        "schema_key": "kana_kanji_front_english_back",
        "media_type": "none",
        "media_files": [],
        "tags": [],
        "dictionary_entry_id": "",
        "dictionary_headword": "",
        "dictionary_reading": "",
        "dictionary_gloss": "",
        "dictionary_pos": "",
        "dictionary_pos_tags": [],
        "verb_type": "",
        "word_form": "dictionary",
    }


class CollectionDeckDeletionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        EnsureDatabaseSchema(self.connection)
        self.owner_user_id = "user-1"

    def test_delete_deck_removes_deck_and_cards(self) -> None:
        CreateCollection(self.connection, "Collection", self.owner_user_id)
        collection_id = self.connection.execute(
            "SELECT id FROM collections WHERE owner_user_id = ? LIMIT 1",
            (self.owner_user_id,),
        ).fetchone()["id"]
        CreateDeck(self.connection, collection_id, "Deck", self.owner_user_id)
        deck_id = self.connection.execute(
            "SELECT id FROM decks WHERE collection_id = ? LIMIT 1",
            (collection_id,),
        ).fetchone()["id"]

        self.assertTrue(AddCard(self.connection, deck_id, build_card_payload("1")))

        deleted = DeleteDeck(self.connection, deck_id, self.owner_user_id)

        self.assertEqual(deleted, 1)
        self.assertIsNone(
            self.connection.execute("SELECT id FROM decks WHERE id = ?", (deck_id,)).fetchone()
        )
        self.assertEqual(
            self.connection.execute(
                "SELECT COUNT(*) FROM cards WHERE deck_id = ?",
                (deck_id,),
            ).fetchone()[0],
            0,
        )

    def test_delete_collection_removes_owned_decks_and_cards(self) -> None:
        CreateCollection(self.connection, "Collection", self.owner_user_id)
        collection_id = self.connection.execute(
            "SELECT id FROM collections WHERE owner_user_id = ? LIMIT 1",
            (self.owner_user_id,),
        ).fetchone()["id"]
        CreateDeck(self.connection, collection_id, "Deck A", self.owner_user_id)
        CreateDeck(self.connection, collection_id, "Deck B", self.owner_user_id)
        deck_rows = self.connection.execute(
            "SELECT id FROM decks WHERE collection_id = ? ORDER BY display_name",
            (collection_id,),
        ).fetchall()

        for index, deck_row in enumerate(deck_rows, start=1):
            self.assertTrue(AddCard(self.connection, deck_row["id"], build_card_payload(str(index))))

        deleted = DeleteCollection(self.connection, collection_id, self.owner_user_id)

        self.assertEqual(deleted, 1)
        self.assertIsNone(
            self.connection.execute(
                "SELECT id FROM collections WHERE id = ?",
                (collection_id,),
            ).fetchone()
        )
        self.assertEqual(
            self.connection.execute(
                "SELECT COUNT(*) FROM decks WHERE collection_id = ?",
                (collection_id,),
            ).fetchone()[0],
            0,
        )
        self.assertEqual(
            self.connection.execute("SELECT COUNT(*) FROM cards").fetchone()[0],
            0,
        )


if __name__ == "__main__":
    unittest.main()
