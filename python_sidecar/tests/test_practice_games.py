import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from python_sidecar.main import (  # noqa: E402
    build_adjective_conjugation_rows,
    build_verb_conjugation_rows,
    build_word_class_sort_rows,
    detect_practice_word_class_bucket,
)


class PracticeGamesTests(unittest.TestCase):
    def test_detects_supported_word_classes(self) -> None:
        cards = {
            "verb": {
                "dictionary_headword": "書く",
                "dictionary_reading": "かく",
                "verb_type": "godan",
            },
            "i_adj": {
                "dictionary_headword": "強い",
                "dictionary_reading": "つよい",
                "dictionary_pos_tags": ["adj-i", "adv"],
            },
            "na_adj": {
                "dictionary_headword": "元気",
                "dictionary_reading": "げんき",
                "dictionary_pos_tags": ["n", "adj-na"],
            },
            "noun": {
                "dictionary_headword": "先生",
                "dictionary_reading": "せんせい",
                "dictionary_pos_tags": ["n"],
            },
            "adverb": {
                "dictionary_headword": "たぶん",
                "dictionary_reading": "たぶん",
                "dictionary_pos_tags": ["adv"],
            },
            "particle": {
                "dictionary_headword": "は",
                "dictionary_reading": "は",
                "dictionary_pos_tags": ["prt"],
            },
            "expression": {
                "dictionary_headword": "おはよう",
                "dictionary_reading": "おはよう",
                "dictionary_pos_tags": ["exp"],
            },
            "conjunction": {
                "dictionary_headword": "しかし",
                "dictionary_reading": "しかし",
                "dictionary_pos_tags": ["conj"],
            },
        }

        for expected_bucket, card in cards.items():
            with self.subTest(expected_bucket=expected_bucket):
                self.assertEqual(
                    detect_practice_word_class_bucket(card),
                    expected_bucket,
                )

    def test_builds_word_class_sort_rows(self) -> None:
        cards = [
            {
                "dictionary_headword": "書く",
                "dictionary_reading": "かく",
                "dictionary_gloss": "to write",
                "verb_type": "godan",
            },
            {
                "dictionary_headword": "元気",
                "dictionary_reading": "げんき",
                "dictionary_gloss": "healthy",
                "dictionary_pos_tags": ["n", "adj-na"],
            },
            {
                "dictionary_headword": "先生",
                "dictionary_reading": "せんせい",
                "dictionary_gloss": "teacher",
                "dictionary_pos_tags": ["n"],
            },
        ]

        result = build_word_class_sort_rows(cards)
        by_prompt = {row["prompt"]: row["expected"] for row in result["rows"]}

        self.assertEqual(by_prompt["書く [かく]"], "verb")
        self.assertEqual(by_prompt["元気 [げんき]"], "na_adj")
        self.assertEqual(by_prompt["先生 [せんせい]"], "noun")

    def test_builds_adjective_conjugation_rows(self) -> None:
        cards = [
            {
                "dictionary_headword": "高い",
                "dictionary_reading": "たかい",
                "dictionary_gloss": "high",
                "dictionary_pos_tags": ["adj-i"],
            },
            {
                "dictionary_headword": "元気",
                "dictionary_reading": "げんき",
                "dictionary_gloss": "healthy",
                "dictionary_pos_tags": ["n", "adj-na"],
            },
        ]

        result = build_adjective_conjugation_rows(cards, ["negative"])
        by_prompt = {row["prompt"]: row for row in result["rows"]}

        self.assertEqual(by_prompt["高い [たかい]"]["expected"], "高くない [たかくない]")
        self.assertEqual(by_prompt["高い [たかい]"]["form_key"], "negative")
        self.assertEqual(by_prompt["元気 [げんき]"]["expected"], "元気じゃない [げんきじゃない]")

    def test_builds_selected_verb_conjugation_rows(self) -> None:
        cards = [
            {
                "dictionary_headword": "書く",
                "dictionary_reading": "かく",
                "dictionary_gloss": "to write",
                "verb_type": "godan",
            }
        ]

        result = build_verb_conjugation_rows(cards, ["te", "past"])
        rows = result["rows"]

        self.assertEqual({row["form_key"] for row in rows}, {"te", "past"})
        by_form = {row["form_key"]: row for row in rows}

        self.assertEqual(by_form["te"]["expected"], "書いて [かいて]")
        self.assertIn("かいて", by_form["te"]["accepted_answers"])
        self.assertEqual(by_form["past"]["expected"], "書いた [かいた]")


if __name__ == "__main__":
    unittest.main()
