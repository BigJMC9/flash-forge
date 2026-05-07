import sys
import unittest
from pathlib import Path
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from AnkiDeckBuilder.OpenAiService import (  # noqa: E402
    BuildTextConversationHistory,
    GenerateReadingQuestionsFromPassage,
    GenerateScenarioSuggestions,
)


class OpenAiServiceJsonShapeTests(unittest.TestCase):
    def test_text_conversation_history_strips_audio_payloads(self) -> None:
        result = BuildTextConversationHistory(
            [
                {
                    "role": "assistant",
                    "content": "こんにちは。",
                    "audio_base64": "a" * 50000,
                    "audio_mime_type": "audio/mpeg",
                },
                {
                    "role": "user",
                    "content": "長い返事" * 500,
                    "input_mode": "voice",
                },
            ],
            12,
        )

        self.assertEqual(result[0], {"role": "assistant", "content": "こんにちは。"})
        self.assertEqual(result[1]["role"], "user")
        self.assertNotIn("audio_base64", result[0])
        self.assertLessEqual(len(result[1]["content"]), 1203)

    @patch("AnkiDeckBuilder.OpenAiService.RequestResponseText")
    def test_generate_scenario_suggestions_accepts_top_level_list(
        self,
        mock_request_response_text,
    ) -> None:
        mock_request_response_text.return_value = """
        [
          {
            "title": "駅での朝",
            "summary": "通勤と電車の語彙を中心にした朝の場面。",
            "topic_hint": "駅, 通勤, 電車",
            "difficulty": "intermediate",
            "style": "story",
            "question_count": 4,
            "tags": ["station", "commute"]
          },
          {
            "title": "昼休みの買い物",
            "summary": "買い物と時間の語彙を使う短い場面。",
            "topic_hint": "買い物, 昼休み",
            "difficulty": "beginner",
            "style": "story",
            "question_count": 3,
            "tags": ["shopping"]
          }
        ]
        """

        result = GenerateScenarioSuggestions(
            client=object(),  # type: ignore[arg-type]
            model="gpt-test",
            preferredVocabulary=[{"word": "駅", "reading": "えき", "meaning": "station"}],
            supportVocabulary=[],
            mode="reading",
            count=6,
        )

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["title"], "駅での朝")
        self.assertEqual(result[0]["tags"], ["station", "commute"])
        self.assertEqual(result[1]["question_count"], 3)

    @patch("AnkiDeckBuilder.OpenAiService.RequestResponseText")
    def test_generate_reading_questions_accepts_top_level_list(
        self,
        mock_request_response_text,
    ) -> None:
        mock_request_response_text.return_value = """
        [
          {
            "id": "q1",
            "question": "主人公はどこへ行きますか。",
            "choices": ["学校", "駅", "病院", "図書館"],
            "correct_index": 1,
            "explanation": "本文で駅へ行くと書かれています。"
          },
          {
            "id": "q2",
            "question": "朝の天気はどうですか。",
            "choices": ["晴れ", "雨", "雪", "くもり"],
            "correct_index": 0,
            "explanation": "最初の文で晴れだと述べています。"
          },
          {
            "id": "q3",
            "question": "何を買いますか。",
            "choices": ["本", "水", "パン", "シャツ"],
            "correct_index": 2,
            "explanation": "店でパンを買います。"
          }
        ]
        """

        result = GenerateReadingQuestionsFromPassage(
            client=object(),  # type: ignore[arg-type]
            model="gpt-test",
            title="朝の話",
            passage="テスト本文",
            questionCount=3,
            variationHint="run-1",
        )

        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["id"], "q1")
        self.assertEqual(result[1]["correct_index"], 0)
        self.assertEqual(result[2]["choices"][2], "パン")


if __name__ == "__main__":
    unittest.main()
