import os
from pathlib import Path

AppTitle = "Flash Forge"

AppDir = Path(os.getenv("ANKI_APP_DIR", "./anki_workspace")).expanduser().resolve()
ProjectRoot = Path(__file__).resolve().parents[1]
CollectionsDir = AppDir / "collections"
MediaDir = AppDir / "media"
TempDir = AppDir / "tmp"
DatabasePath = AppDir / "app.db"
ExportDir = AppDir / "exports"
PublicIconDir = ProjectRoot / "public" / "icons"

DefaultModel = "gpt-4o"

SupportedImageExtensions = {".png", ".jpg", ".jpeg", ".webp"}
SupportedVideoExtensions = {".mp4", ".webm", ".mov"}
SupportedAudioExtensions = {".mp3", ".wav", ".m4a", ".ogg"}

DefaultSchemaKey = "kana_kanji_front_english_back"

CardSchemaFields = {
    "kanji": {"Label": "Kanji", "Placeholder": "食べる"},
    "kana": {"Label": "Kana", "Placeholder": "たべる"},
    "english": {"Label": "English", "Placeholder": "to eat"},
    "kanji_on_readings": {"Label": "ON Reading", "Placeholder": "オン, いん"},
    "kanji_kun_readings": {"Label": "Kun Reading", "Placeholder": "おと, ね"},
    "kanji_nanori_readings": {"Label": "Nanori", "Placeholder": "Optional name reading"},
    "radical_position": {"Label": "Radical Position", "Placeholder": ""},
    "notes": {"Label": "Notes", "Placeholder": "Optional notes or mnemonic"},
}

CardSchemas = {
    DefaultSchemaKey: {
        "Label": "Front: Hiragana/Katakana + Kanji | Back: English",
        "FrontFields": ["kana", "kanji"],
        "BackFields": ["english"],
    },
    "kanji_front_kana_english_back": {
        "Label": "Front: Kanji | Back: Hiragana/Katakana + English",
        "FrontFields": ["kanji"],
        "BackFields": ["kana", "english"],
    },
    "kanji_okurigana_front_reading_english_back": {
        "Label": "Front: Kanji With Okurigana | Back: Full Reading + English",
        "FrontFields": ["kanji"],
        "BackFields": ["kana", "english"],
    },
    "kana_front_kanji_english_back": {
        "Label": "Front: Hiragana/Katakana | Back: Kanji + English",
        "FrontFields": ["kana"],
        "BackFields": ["kanji", "english"],
    },
    "english_front_japanese_back": {
        "Label": "Front: English | Back: Kanji + Hiragana/Katakana",
        "FrontFields": ["english"],
        "BackFields": ["kanji", "kana"],
    },
    "kanji_detail_front_back": {
        "Label": "Front: Kanji | Back: Meaning + ON/Kun/Nanori + Radical Position",
        "FrontFields": ["kanji"],
        "BackFields": [
            "english",
            "kanji_on_readings",
            "kanji_kun_readings",
            "kanji_nanori_readings",
            "radical_position",
        ],
        "FieldLabels": {
            "english": "Meaning",
            "kanji_on_readings": "ON",
            "kanji_kun_readings": "Kun",
            "kanji_nanori_readings": "Nanori",
            "radical_position": "Radical Position",
        },
    },
}

RadicalPositionOptions = {
    "hen": {"Label": "へん", "Icon": "hen.png"},
    "tsukuri": {"Label": "つくり", "Icon": "tsukuri.png"},
    "kanmuri": {"Label": "かんむり", "Icon": "kanmuri.png"},
    "ashi": {"Label": "あし", "Icon": "ashi.png"},
    "tare": {"Label": "たれ", "Icon": "tare.png"},
    "nyou": {"Label": "にょう", "Icon": "nyou.png"},
    "kunigamae": {"Label": "くにがまえ", "Icon": "kunigamae.png"},
    "mongamae": {"Label": "もんがまえ", "Icon": "mongamae.png"},
    "gyougamae": {"Label": "ぎょうがまえ", "Icon": "gyougamae.png"},
    "hakogamae": {"Label": "はこがまえ", "Icon": "hakogamae.png"},
    "keigamae": {"Label": "けいがまえ", "Icon": "keigamae.png"},
    "kigamae": {"Label": "きがまえ", "Icon": "kigamae.png"},
    "tsutsumigamae": {"Label": "つつみがまえ", "Icon": "tsutsumigamae.png"},
}

NoteModelId = 1894375291

ImageOcrPrompt = """
Read the image carefully and extract Japanese words or short phrases that are clearly visible.
Return only valid JSON with this schema:
{
  "items": [
    {
      "visible_text": "",
      "kanji": "",
      "kana": "",
      "english": "",
      "confidence": 0.0
    }
  ]
}
Rules:
- Only include Japanese text that is actually visible in the image.
- Prefer canonical kanji with okurigana when visible (for example: 食べる, 行きます).
- confidence must be between 0 and 1.
- If kana is uncertain, do your best but keep visible_text exact.
- Do not include duplicates.
""".strip()
