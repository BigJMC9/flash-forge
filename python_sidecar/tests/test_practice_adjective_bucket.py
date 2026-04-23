import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from python_sidecar.main import (
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

    def test_detects_structured_adj_i_tag(self) -> None:
        card = {
            "dictionary_pos_tags": ["adj-i", "adv"],
            "dictionary_reading": "つよい",
            "kana": "つよい",
        }
        self.assertEqual(detect_practice_adjective_bucket(card), "i_adj")

    def test_detects_structured_adj_na_tag(self) -> None:
        card = {
            "dictionary_pos_tags": ["n", "adj-na"],
            "dictionary_reading": "げんき",
            "kana": "げんき",
        }
        self.assertEqual(detect_practice_adjective_bucket(card), "na_adj")

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

    def test_does_not_misclassify_noun_ending_in_i_as_i_adjective(self) -> None:
        card = {
            "dictionary_pos": "noun (common) (futsuumeishi)",
            "dictionary_reading": "せんせい",
            "kana": "せんせい",
        }
        self.assertEqual(detect_practice_adjective_bucket(card), "")

    def test_does_not_misclassify_suru_noun_ending_in_i_as_i_adjective(self) -> None:
        card = {
            "dictionary_pos": "noun or participle which takes the aux. verb suru",
            "dictionary_reading": "しょうかい",
            "kana": "しょうかい",
        }
        self.assertEqual(detect_practice_adjective_bucket(card), "")

    def test_filters_non_adjectives(self) -> None:
        card = {
            "dictionary_pos": "adverb (fukushi)",
            "dictionary_reading": "たぶん",
            "kana": "たぶん",
        }
        self.assertEqual(detect_practice_adjective_bucket(card), "")

    def test_adverb_is_filtered_out_of_adjective_practice(self) -> None:
        card = {
            "dictionary_pos_tags": ["adv"],
            "dictionary_reading": "たぶん",
            "kana": "たぶん",
        }
        self.assertEqual(detect_practice_adjective_bucket(card), "")


    def test_noun_and_adverb_is_filtered_out_of_adjective_practice(self) -> None:
        card = {
            "dictionary_pos_tags": ["n", "adv"],
            "dictionary_reading": "たぶん",
            "kana": "たぶん",
        }
        self.assertEqual(detect_practice_adjective_bucket(card), "")

    def test_legacy_adverb_text_is_filtered_out(self) -> None:
        card = {
            "dictionary_pos": "adverb (fukushi)",
            "dictionary_reading": "たぶん",
            "kana": "たぶん",
        }
        self.assertEqual(detect_practice_adjective_bucket(card), "")

    def test_non_adjective_card_search_terms_do_not_include_i_adjective_forms(self) -> None:
        card = {
            "kanji": "先生",
            "kana": "せんせい",
            "english": "teacher",
            "notes": "",
            "dictionary_entry_id": "200",
            "dictionary_headword": "先生",
            "dictionary_reading": "せんせい",
            "dictionary_gloss": "teacher",
            "dictionary_pos": "noun (common) (futsuumeishi)",
            "word_form": "dictionary",
            "verb_type": "",
        }

        terms = build_deck_card_search_terms(card)
        self.assertNotIn("せんせくない", terms)
        self.assertNotIn("先生くない", terms)
        self.assertNotIn("せんせかった", terms)
        self.assertNotIn("先生かった", terms)

if __name__ == "__main__":
    unittest.main()