import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from python_sidecar.main import (  # noqa: E402
    build_deck_card_search_terms,
    detect_practice_adjective_bucket,
)


class PracticeAdjectiveBucketTests(unittest.TestCase):
    def test_detects_jmdict_na_adjective_labels(self) -> None:
        card = {
            "dictionary_pos": "noun (common) (futsuumeishi), adjectival nouns or quasi-adjectives (keiyodoshi)",
            "dictionary_reading": "げんき",
            "kana": "げんき",
        }

        self.assertEqual(detect_practice_adjective_bucket(card), "na_adj")

    def test_detects_i_adjective_labels(self) -> None:
        card = {
            "dictionary_pos": "adjective (keiyoushi), adverb (fukushi)",
            "dictionary_reading": "つよい",
            "kana": "つよい",
        }

        self.assertEqual(detect_practice_adjective_bucket(card), "i_adj")

    def test_na_adjective_search_terms_use_na_adjective_forms(self) -> None:
        card = {
            "kanji": "綺麗",
            "kana": "きれい",
            "english": "pretty",
            "notes": "",
            "dictionary_entry_id": "100",
            "dictionary_headword": "綺麗",
            "dictionary_reading": "きれい",
            "dictionary_gloss": "pretty",
            "dictionary_pos": "adjectival nouns or quasi-adjectives (keiyodoshi)",
            "word_form": "dictionary",
            "verb_type": "",
        }

        terms = build_deck_card_search_terms(card)

        self.assertIn("きれいじゃない", terms)
        self.assertIn("綺麗だった", terms)
        self.assertNotIn("きれいくない", terms)


if __name__ == "__main__":
    unittest.main()
