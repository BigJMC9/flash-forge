import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from python_sidecar.main import (  # noqa: E402
    build_adjective_sort_rows,
    build_adjective_conjugation_rows,
    build_extended_verb_forms,
    build_verb_sort_rows,
    build_verb_conjugation_rows,
    build_word_class_sort_rows,
    detect_practice_adjective_sort_bucket,
    detect_practice_verb_sort_bucket,
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

    def test_builds_verb_sort_rows_with_suru_bucket(self) -> None:
        cards = [
            {
                "dictionary_headword": "食べる",
                "dictionary_reading": "たべる",
                "dictionary_gloss": "to eat",
                "verb_type": "ichidan",
            },
            {
                "dictionary_headword": "書く",
                "dictionary_reading": "かく",
                "dictionary_gloss": "to write",
                "verb_type": "godan",
            },
            {
                "dictionary_headword": "勉強する",
                "dictionary_reading": "べんきょうする",
                "dictionary_gloss": "to study",
                "verb_type": "suru_noun",
            },
        ]

        result = build_verb_sort_rows(
            cards,
            {
                "verb_sort_only_ru_endings": False,
                "verb_sort_include_suru_verbs": True,
                "verb_sort_include_suru_nouns": True,
            },
        )
        by_prompt = {row["prompt"]: row["expected"] for row in result["rows"]}

        self.assertEqual(by_prompt["食べる [たべる]"], "ichidan")
        self.assertEqual(by_prompt["書く [かく]"], "godan")
        self.assertEqual(by_prompt["勉強する [べんきょうする]"], "suru")

    def test_filters_suru_nouns_when_requested(self) -> None:
        card = {
            "dictionary_headword": "勉強する",
            "dictionary_reading": "べんきょうする",
            "verb_type": "suru_noun",
        }

        self.assertEqual(
            detect_practice_verb_sort_bucket(
                card,
                {
                    "verb_sort_only_ru_endings": False,
                    "verb_sort_include_suru_verbs": True,
                    "verb_sort_include_suru_nouns": False,
                },
            ),
            "",
        )

    def test_adjective_sort_can_limit_to_i_endings(self) -> None:
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
            {
                "dictionary_headword": "綺麗",
                "dictionary_reading": "きれい",
                "dictionary_gloss": "pretty",
                "dictionary_pos_tags": ["n", "adj-na"],
            },
        ]

        result = build_adjective_sort_rows(
            cards,
            {"adjective_sort_only_i_endings": True},
        )
        by_prompt = {row["prompt"]: row["expected"] for row in result["rows"]}

        self.assertEqual(by_prompt["高い [たかい]"], "i_adj")
        self.assertEqual(by_prompt["綺麗 [きれい]"], "na_adj")
        self.assertNotIn("元気 [げんき]", by_prompt)

    def test_detects_adjective_sort_bucket_without_i_filter(self) -> None:
        card = {
            "dictionary_headword": "元気",
            "dictionary_reading": "げんき",
            "dictionary_pos_tags": ["n", "adj-na"],
        }
        self.assertEqual(
            detect_practice_adjective_sort_bucket(
                card,
                {"adjective_sort_only_i_endings": False},
            ),
            "na_adj",
        )

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
        by_form = {row["form_key"]: row for row in rows}

        self.assertEqual({row["form_key"] for row in rows}, {"te", "past"})
        self.assertEqual(by_form["te"]["expected"], "書いて [かいて]")
        self.assertIn("かいて", by_form["te"]["accepted_answers"])
        self.assertEqual(by_form["past"]["expected"], "書いた [かいた]")

    def test_suru_noun_keeps_base_dictionary_form(self) -> None:
        forms = build_extended_verb_forms("勉強", "べんきょう", "suru_noun")

        self.assertEqual(forms["dictionary"]["word"], "勉強")
        self.assertEqual(forms["dictionary"]["reading"], "べんきょう")
        self.assertEqual(forms["masu"]["word"], "勉強します")
        self.assertEqual(forms["te"]["word"], "勉強して")


if __name__ == "__main__":
    unittest.main()
