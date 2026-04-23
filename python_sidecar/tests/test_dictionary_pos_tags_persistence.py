import sqlite3
import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from AnkiDeckBuilder.DatabaseService import (  # noqa: E402
    AddCard,
    AddGlobalCard,
    BuildDeckCardPayloadFromGlobalCard,
    CreateCollection,
    CreateDeck,
    EnsureDatabaseSchema,
    GetDeckCards,
    GetGlobalCardsByIds,
    ListGlobalCards,
    ListDecks,
)
from AnkiDeckBuilder.JamdictService import (  # noqa: E402
    BuildCardFromDictionaryEntry,
    BuildGlobalCardFromDictionaryEntry,
)
from python_sidecar.main import get_dictionary_pos_tags  # noqa: E402


class DictionaryPosTagsPersistenceTests(unittest.TestCase):
    def test_dictionary_entry_payload_builders_include_pos_tags(self) -> None:
        entry = {
            "entry_id": "123",
            "headword": "元気",
            "reading": "げんき",
            "english": "healthy; energetic",
            "pos_labels": [
                "noun (common) (futsuumeishi)",
                "adjectival nouns or quasi-adjectives (keiyodoshi)",
                "adverb (fukushi)",
            ],
            "pos_tags": ["n", "adj-na", "adv"],
            "verb_type": "other",
        }

        deck_payload = BuildCardFromDictionaryEntry(
            entry,
            "kana_kanji_front_english_back",
            "dictionary",
            [],
            "",
        )
        global_payload = BuildGlobalCardFromDictionaryEntry(entry)

        self.assertEqual(deck_payload["dictionary_pos_tags"], ["n", "adj-na", "adv"])
        self.assertEqual(global_payload["dictionary_pos_tags"], ["n", "adj-na", "adv"])

    def test_pos_tags_roundtrip_through_cards_and_global_cards(self) -> None:
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        EnsureDatabaseSchema(connection)

        CreateCollection(connection, "Collection")
        collection_id = connection.execute("SELECT id FROM collections LIMIT 1").fetchone()["id"]
        CreateDeck(connection, collection_id, "Deck")
        deck_id = ListDecks(connection)[0]["id"]

        card_payload = {
            "kanji": "元気",
            "kana": "げんき",
            "english": "healthy",
            "notes": "",
            "source_text": "test",
            "schema_key": "kana_kanji_front_english_back",
            "media_type": "none",
            "media_files": [],
            "tags": [],
            "dictionary_entry_id": "123",
            "dictionary_headword": "元気",
            "dictionary_reading": "げんき",
            "dictionary_gloss": "healthy",
            "dictionary_pos": "noun (common) (futsuumeishi), adjectival nouns or quasi-adjectives (keiyodoshi)",
            "dictionary_pos_tags": ["n", "adj-na"],
            "verb_type": "",
            "word_form": "dictionary",
        }

        self.assertTrue(AddCard(connection, deck_id, card_payload))
        deck_card = GetDeckCards(connection, deck_id)[0]
        self.assertEqual(get_dictionary_pos_tags(deck_card), ["n", "adj-na"])

        global_payload = {
            "kanji": "元気",
            "kana": "げんき",
            "english": "healthy",
            "notes": "",
            "kanji_masu": "",
            "kana_masu": "",
            "kanji_te": "",
            "kana_te": "",
            "kanji_past": "",
            "kana_past": "",
            "kanji_negative": "",
            "kana_negative": "",
            "image_files": [],
            "video_files": [],
            "tags": [],
            "dictionary_entry_id": "123",
            "dictionary_headword": "元気",
            "dictionary_reading": "げんき",
            "dictionary_gloss": "healthy",
            "dictionary_pos": "noun (common) (futsuumeishi), adjectival nouns or quasi-adjectives (keiyodoshi)",
            "dictionary_pos_tags": ["n", "adj-na"],
            "verb_type": "",
        }

        self.assertTrue(AddGlobalCard(connection, global_payload))
        global_card = ListGlobalCards(connection)[0]
        self.assertEqual(get_dictionary_pos_tags(global_card), ["n", "adj-na"])

        rebuilt_deck_payload = BuildDeckCardPayloadFromGlobalCard(
            global_card,
            "kana_kanji_front_english_back",
            "dictionary",
        )
        self.assertEqual(rebuilt_deck_payload["dictionary_pos_tags"], ["n", "adj-na"])

        global_ids = [global_card["id"]]
        fetched_global = GetGlobalCardsByIds(connection, global_ids)[0]
        self.assertEqual(get_dictionary_pos_tags(fetched_global), ["n", "adj-na"])


if __name__ == "__main__":
    unittest.main()
