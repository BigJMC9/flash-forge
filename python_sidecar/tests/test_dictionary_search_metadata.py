import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from AnkiDeckBuilder.JamdictService import (  # noqa: E402
    BuildDictionaryEntryWordFields,
    BuildDictionarySearchMatch,
    InferDictionaryStemCandidates,
)


class DictionarySearchMetadataTests(unittest.TestCase):
    def test_infers_common_stem_candidates(self) -> None:
        self.assertIn("\u98df\u3079\u308b", InferDictionaryStemCandidates("\u98df\u3079\u3066"))
        self.assertIn("\u66f8\u304f", InferDictionaryStemCandidates("\u66f8\u304d\u307e\u3059"))
        self.assertIn("\u7dba\u9e97", InferDictionaryStemCandidates("\u7dba\u9e97\u3058\u3083\u306a\u3044"))

    def test_marks_inflected_match_as_child(self) -> None:
        entry = {
            "headword": "\u98df\u3079\u308b",
            "reading": "\u305f\u3079\u308b",
            "verb_type": "ichidan",
            "pos_labels": ["Ichidan verb"],
            "kanji_forms": ["\u98df\u3079\u308b"],
            "kana_forms": ["\u305f\u3079\u308b"],
            "glosses": ["to eat"],
        }

        match = BuildDictionarySearchMatch(entry, "\u98df\u3079\u3066")

        self.assertEqual(match["relation"], "child")
        self.assertEqual(match["field_key"], "te")
        self.assertEqual(match["matched_text"], "\u98df\u3079\u3066")

    def test_builds_adjective_word_fields(self) -> None:
        entry = {
            "headword": "\u7dba\u9e97",
            "reading": "\u304d\u308c\u3044",
            "verb_type": "other",
            "pos_labels": ["adjectival nouns or quasi-adjectives (keiyodoshi)"],
        }

        fields = BuildDictionaryEntryWordFields(entry)
        by_key = {field["key"]: field for field in fields}

        self.assertEqual(by_key["dictionary"]["word"], "\u7dba\u9e97")
        self.assertEqual(by_key["negative"]["word"], "\u7dba\u9e97\u3058\u3083\u306a\u3044")
        self.assertEqual(by_key["past"]["reading"], "\u304d\u308c\u3044\u3060\u3063\u305f")


if __name__ == "__main__":
    unittest.main()
