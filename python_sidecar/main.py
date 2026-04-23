from __future__ import annotations

import argparse
import json
import mimetypes
import os
import random
import shutil
import sqlite3
import sys
import time
import traceback
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

if "ANKI_APP_DIR" not in os.environ:
    os.environ["ANKI_APP_DIR"] = str((PROJECT_ROOT / "anki_workspace").resolve())

from dotenv import load_dotenv

from AnkiDeckBuilder.AppConfig import (
    AppTitle,
    CardSchemas,
    DefaultModel,
    MediaDir,
    SupportedAudioExtensions,
    SupportedImageExtensions,
    SupportedVideoExtensions,
)
from AnkiDeckBuilder.CsvService import ImportCsvCards
from AnkiDeckBuilder.DatabaseService import (
    AcceptDeckInvite,
    AcceptDeckInviteById,
    AddCard,
    AddGlobalCard,
    AuthenticateUser,
    CloneTemplateDataToUser,
    CountUsers,
    CountCardsInDeck,
    CountGlobalCards,
    CreateDeckInvite,
    CreateConversationSession,
    CreateCollection,
    CreateDeck,
    CreateUser,
    CreateUserSession,
    DeckHasCandidate,
    DeckHasKanjiWordForm,
    DecodeJsonStringList,
    DeleteCardsByIds,
    DeleteGlobalCardsByIds,
    DeleteUserSession,
    GetDashboardRows,
    GetAiScenario,
    GetConversationSession,
    GetDeckCardCounts,
    GetDeckAccessRow,
    GetDeckCards,
    GetReadingMaterialByScenarioId,
    GetTotalCardCount,
    GetTotalDeckCount,
    GetSessionUser,
    GetUserById,
    IncrementAiScenarioCompletion,
    IncrementAiScenarioUsage,
    ImportDeckCardsToGlobal,
    ImportGlobalCardsToDeck,
    ListAiScenarios,
    ListCollections,
    ListDeckCollaborators,
    ListDeckInvites,
    ListDecks,
    ListGlobalCards,
    ListPendingInvitesForUser,
    ListUsers,
    OpenDatabaseConnection,
    RenameCollection,
    RenameDeck,
    RemoveDeckCollaborator,
    SaveAiScenario,
    SaveReadingMaterial,
    SerializeUserRow,
    UpdateUserPassword,
    UpdateUserPermissions,
    UpdateConversationSession,
    UpdateCardContent,
    UpdateCardField,
    UpdateCardMedia,
    UpdateCardsSchemaByIds,
)
from AnkiDeckBuilder.ExportService import ExportDeckPackage
from AnkiDeckBuilder.JamdictService import (
    BuildDictionaryPosTags,
    BuildCardFromDictionaryEntry,
    BuildConjugatedForms,
    BuildGlobalCardFromDictionaryEntry,
    ConjugateVerbSurface,
    FormatDictionaryEntryOption,
    GetDictionaryEntryById,
    IsVerbEntry,
    LooksLikePoliteMasuSurface,
    ResolveBestDictionaryEntry,
    SearchDictionaryEntries,
    VerbFormLabels,
    VerbTypeLabels,
)
from AnkiDeckBuilder.OpenAiService import (
    ExtractCardsFromImages,
    GenerateConversationFeedback,
    GenerateConversationOpening,
    GenerateConversationReply,
    GenerateReadingMaterial,
    GenerateReadingQuestionsFromPassage,
    GenerateReadingComprehensionPackage,
    GenerateScenarioSuggestions,
    GetOpenAiClient,
)
from AnkiDeckBuilder.Pages import (
    BuildScanCandidateNote,
    ExpandExtractedScanCandidates,
    ParseCommaSeparatedTags,
)
from AnkiDeckBuilder.WorkspaceService import EnsureWorkspaceDirectories


load_dotenv(PROJECT_ROOT / ".env")


_CONNECTION: Optional[sqlite3.Connection] = None
_CURRENT_USER: Optional[Dict[str, Any]] = None
_CURRENT_SESSION_TOKEN: str = ""

PUBLIC_ACTIONS = {
    "bootstrap",
    "login_user",
    "register_user",
}

PRACTICE_BASE_CORRECT_POINTS = 10
PRACTICE_INCORRECT_PENALTY_POINTS = 2
DEFAULT_PRACTICE_ROUND_SIZE = 18
DEFAULT_VERB_CONJUGATION_FORMS = ["te", "past", "negative"]
DEFAULT_ADJECTIVE_CONJUGATION_FORMS = ["past", "negative"]
DEFAULT_READING_COMPREHENSION_LEVEL = "intermediate"
DEFAULT_READING_COMPREHENSION_SOURCE = "story"
PRACTICE_MODE_OPTIONS = [
    {"key": "verb_sort", "label": "Verb Sort (Ichidan vs Godan vs Suru)"},
    {"key": "adjective_sort", "label": "Adjective Sort (い vs な)"},
    {"key": "word_class_sort", "label": "Word Class Bucket Sort"},
    {"key": "adjective_conjugation", "label": "Adjective Conjugation Builder"},
    {"key": "verb_conjugation", "label": "Verb Conjugation Builder"},
]
PRACTICE_VERB_SORT_BUCKET_ORDER = ["ichidan", "godan", "suru"]
PRACTICE_ADJECTIVE_SORT_BUCKET_ORDER = ["i_adj", "na_adj"]
PRACTICE_WORD_CLASS_BUCKET_ORDER = [
    "verb",
    "i_adj",
    "na_adj",
    "noun",
    "adverb",
    "particle",
    "expression",
    "conjunction",
]
PRACTICE_BUCKET_LABELS = {
    "verb": "Verb",
    "ichidan": "Ichidan",
    "godan": "Godan",
    "suru": "Suru",
    "i_adj": "I-adjective (い)",
    "na_adj": "Na-adjective (な)",
    "noun": "Noun",
    "adverb": "Adverb",
    "particle": "Particle",
    "expression": "Expression",
    "conjunction": "Conjunction",
}
PRACTICE_VERB_FORM_LABELS = {
    "masu": "Masu Form",
    "te": "Te Form",
    "past": "Past Form (た)",
    "negative": "Negative Form",
    "potential": "Potential Form",
    "passive": "Passive Form",
    "causative": "Causative Form",
}
PRACTICE_ADJECTIVE_FORM_LABELS = {
    "past": "Past Form",
    "negative": "Negative Form",
}
GODAN_E_ROW_MAP = {
    "う": "え",
    "く": "け",
    "ぐ": "げ",
    "す": "せ",
    "つ": "て",
    "ぬ": "ね",
    "ぶ": "べ",
    "む": "め",
    "る": "れ",
}
GODAN_A_ROW_MAP = {
    "う": "わ",
    "く": "か",
    "ぐ": "が",
    "す": "さ",
    "つ": "た",
    "ぬ": "な",
    "ぶ": "ば",
    "む": "ま",
    "る": "ら",
}


@dataclass
class LocalInputFile:
    name: str
    type: str
    _data: bytes

    def getbuffer(self) -> memoryview:
        return memoryview(self._data)

    def getvalue(self) -> bytes:
        return self._data


def get_connection() -> sqlite3.Connection:
    global _CONNECTION
    if _CONNECTION is None:
        EnsureWorkspaceDirectories()
        _CONNECTION = OpenDatabaseConnection()
    return _CONNECTION


def set_request_user(user: Optional[sqlite3.Row], session_token: str = "") -> None:
    global _CURRENT_USER, _CURRENT_SESSION_TOKEN
    _CURRENT_SESSION_TOKEN = normalize_text(session_token)
    _CURRENT_USER = SerializeUserRow(user) if user is not None else None


def get_request_user() -> Optional[Dict[str, Any]]:
    return _CURRENT_USER


def require_request_user() -> Dict[str, Any]:
    user = get_request_user()
    if not user:
        raise RuntimeError("Authentication required.")
    return user


def require_admin_user() -> Dict[str, Any]:
    user = require_request_user()
    if not bool(user.get("is_admin")):
        raise RuntimeError("Administrator access is required.")
    return user


def require_ai_user() -> Dict[str, Any]:
    user = require_request_user()
    if not bool(user.get("can_use_ai")):
        raise RuntimeError("Your account does not have AI privileges enabled.")
    return user


def require_ocr_user() -> Dict[str, Any]:
    user = require_request_user()
    if not bool(user.get("can_use_ocr")):
        raise RuntimeError("OCR access is disabled for your account. Ask an administrator to enable it.")
    return user


def get_request_user_id() -> str:
    user = require_request_user()
    return normalize_text(user.get("id", ""))


def get_optional_request_user_id() -> str:
    user = get_request_user()
    return normalize_text(user.get("id", "")) if user else ""


def require_owned_collection(collection_id: str) -> sqlite3.Row:
    connection = get_connection()
    row = connection.execute(
        """
        SELECT id, owner_user_id, COALESCE(NULLIF(display_name, ''), name) AS name
        FROM collections
        WHERE id = ? AND owner_user_id = ?
        LIMIT 1
        """,
        (normalize_text(collection_id), get_request_user_id()),
    ).fetchone()
    if row is None:
        raise RuntimeError("Collection not found or not owned by the current user.")
    return row


def require_accessible_deck(deck_id: str, require_write: bool = True) -> sqlite3.Row:
    deck_row = GetDeckAccessRow(get_connection(), normalize_text(deck_id), get_request_user_id())
    if deck_row is None or not bool(deck_row["can_access"]):
        raise RuntimeError("Deck not found or access denied.")
    if require_write and not bool(deck_row["can_access"]):
        raise RuntimeError("Deck write access denied.")
    return deck_row


def build_bootstrap_defaults() -> Dict[str, Any]:
    return {
        "schema_key": "kana_kanji_front_english_back",
        "word_form": "dictionary",
        "practice_modes": PRACTICE_MODE_OPTIONS,
    }


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def normalize_search_text(value: Any) -> str:
    return "".join(normalize_text(value).lower().split())


def normalize_string_list(values: Any) -> List[str]:
    result: List[str] = []
    for raw in values or []:
        text = normalize_text(raw)
        if text and text not in result:
            result.append(text)
    return result


def parse_tags(value: Any) -> List[str]:
    if isinstance(value, list):
        return normalize_string_list(value)
    return ParseCommaSeparatedTags(normalize_text(value))


def get_card_text(card: Any, field_name: str) -> str:
    try:
        value = card[field_name]
    except Exception:
        if isinstance(card, dict):
            value = card.get(field_name, "")
        else:
            value = ""
    return normalize_text(value)

def get_card_list(card: Any, field_name: str) -> List[str]:
    try:
        value = card[field_name]
    except Exception:
        if isinstance(card, dict):
            value = card.get(field_name, [])
        else:
            value = []

    if isinstance(value, list):
        return normalize_string_list(value)

    if isinstance(value, str):
        text = normalize_text(value)
        if not text:
            return []
        try:
            parsed = json.loads(text)
        except Exception:
            return []
        if isinstance(parsed, list):
            return normalize_string_list(parsed)

    return []

def get_dictionary_pos_tags(card: Any) -> List[str]:
    tags = [tag.lower() for tag in get_card_list(card, "dictionary_pos_tags")]
    if tags:
        return normalize_string_list(tags)

    # legacy fallback for old cards
    pos_text = get_card_text(card, "dictionary_pos")
    if not pos_text:
        return []
    return normalize_string_list(BuildDictionaryPosTags([pos_text]))


def classify_practice_adjective_tags(pos_tags: List[str]) -> str:
    normalized_tags = [tag.lower() for tag in pos_tags]
    if "adj-i" in normalized_tags:
        return "i_adj"
    if "adj-na" in normalized_tags and "adv" not in normalized_tags:
        return "na_adj"
    return ""


def normalize_practice_option_list(
    raw_values: Any,
    allowed_keys: List[str],
    default_keys: List[str],
) -> List[str]:
    requested = normalize_string_list(raw_values if isinstance(raw_values, list) else [])
    normalized = [key for key in allowed_keys if key in requested]
    return normalized or list(default_keys)


def normalize_practice_round_size(raw_value: Any) -> int:
    try:
        round_size = int(raw_value)
    except (TypeError, ValueError):
        round_size = DEFAULT_PRACTICE_ROUND_SIZE
    return max(6, min(round_size, 40))


def normalize_boolean_option(raw_value: Any, default: bool) -> bool:
    if isinstance(raw_value, bool):
        return raw_value
    if raw_value is None:
        return default
    return str(raw_value).strip().lower() in {"1", "true", "yes", "on"}


def normalize_question_count(raw_value: Any, default: int = 4) -> int:
    try:
        question_count = int(raw_value)
    except (TypeError, ValueError):
        question_count = default
    return max(3, min(question_count, 6))


def normalize_practice_options(mode: str, raw_options: Any) -> Dict[str, Any]:
    options = raw_options if isinstance(raw_options, dict) else {}
    normalized = {
        "round_size": normalize_practice_round_size(options.get("round_size", DEFAULT_PRACTICE_ROUND_SIZE)),
        "verb_forms": list(DEFAULT_VERB_CONJUGATION_FORMS),
        "adjective_forms": list(DEFAULT_ADJECTIVE_CONJUGATION_FORMS),
        "verb_sort_only_ru_endings": normalize_boolean_option(
            options.get("verb_sort_only_ru_endings"),
            False,
        ),
        "verb_sort_include_suru_verbs": normalize_boolean_option(
            options.get("verb_sort_include_suru_verbs"),
            True,
        ),
        "verb_sort_include_suru_nouns": normalize_boolean_option(
            options.get("verb_sort_include_suru_nouns"),
            True,
        ),
        "adjective_sort_only_i_endings": normalize_boolean_option(
            options.get("adjective_sort_only_i_endings"),
            False,
        ),
        "reading_level": normalize_text(
            options.get("reading_level", DEFAULT_READING_COMPREHENSION_LEVEL)
        ).lower()
        or DEFAULT_READING_COMPREHENSION_LEVEL,
        "reading_source": normalize_text(
            options.get("reading_source", DEFAULT_READING_COMPREHENSION_SOURCE)
        ).lower()
        or DEFAULT_READING_COMPREHENSION_SOURCE,
        "reading_topic": normalize_text(options.get("reading_topic", "")),
        "reading_question_count": max(
            3,
            min(6, normalize_question_count(options.get("reading_question_count", 4), 4)),
        ),
    }
    if mode == "verb_conjugation":
        normalized["verb_forms"] = normalize_practice_option_list(
            options.get("verb_forms", DEFAULT_VERB_CONJUGATION_FORMS),
            list(PRACTICE_VERB_FORM_LABELS.keys()),
            DEFAULT_VERB_CONJUGATION_FORMS,
        )
    if mode == "adjective_conjugation":
        normalized["adjective_forms"] = normalize_practice_option_list(
            options.get("adjective_forms", DEFAULT_ADJECTIVE_CONJUGATION_FORMS),
            list(PRACTICE_ADJECTIVE_FORM_LABELS.keys()),
            DEFAULT_ADJECTIVE_CONJUGATION_FORMS,
        )
    if normalized["reading_level"] not in {"beginner", "intermediate", "advanced"}:
        normalized["reading_level"] = DEFAULT_READING_COMPREHENSION_LEVEL
    if normalized["reading_source"] not in {"story", "news_style"}:
        normalized["reading_source"] = DEFAULT_READING_COMPREHENSION_SOURCE
    return normalized


def build_practice_expected_display(word: str, reading: str) -> str:
    normalized_word = normalize_text(word)
    normalized_reading = normalize_text(reading)
    if normalized_word and normalized_reading and normalized_word != normalized_reading:
        return f"{normalized_word} [{normalized_reading}]"
    return normalized_word or normalized_reading


def build_text_entry_round_row(
    dedupe_key: str,
    card: Any,
    form_key: str,
    form_label: str,
    word: str,
    reading: str,
) -> Optional[Dict[str, Any]]:
    prompt = build_practice_prompt(card)
    if not prompt:
        return None

    expected_display = build_practice_expected_display(word, reading)
    if not expected_display:
        return None

    accepted_answers: List[str] = []
    for answer in [word, reading]:
        normalized_answer = normalize_practice_answer(answer)
        if normalized_answer and normalized_answer not in accepted_answers:
            accepted_answers.append(normalized_answer)
    if not accepted_answers:
        return None

    return {
        "id": dedupe_key,
        "prompt": prompt,
        "hint": build_practice_hint(card),
        "expected": expected_display,
        "expected_display": expected_display,
        "accepted_answers": accepted_answers,
        "form_key": form_key,
        "form_label": form_label,
    }


def build_card_face_text(card: Any, field_names: List[str]) -> str:
    values: List[str] = []
    for field_name in field_names:
        text = get_card_text(card, field_name)
        if text and text not in values:
            values.append(text)
    return " | ".join(values)


def get_base_word_and_reading(card: Any) -> Tuple[str, str]:
    base_word = get_card_text(card, "dictionary_headword") or get_card_text(card, "kanji")
    base_reading = get_card_text(card, "dictionary_reading") or get_card_text(card, "kana")
    if not base_word:
        base_word = base_reading
    return base_word, base_reading


def word_or_reading_ends_with(card: Any, ending: str) -> bool:
    base_word, base_reading = get_base_word_and_reading(card)
    return base_reading.endswith(ending) or base_word.endswith(ending)


def build_practice_prompt(card: Any) -> str:
    base_word, base_reading = get_base_word_and_reading(card)
    if base_word and base_reading and base_word != base_reading:
        return f"{base_word} [{base_reading}]"
    return base_word or base_reading


def build_practice_hint(card: Any) -> str:
    return get_card_text(card, "dictionary_gloss") or get_card_text(card, "english")


def detect_practice_verb_bucket(card: Any) -> str:
    verb_type = get_card_text(card, "verb_type")
    if verb_type in {"ichidan", "godan"}:
        return verb_type

    pos_text = get_card_text(card, "dictionary_pos").lower()
    if "ichidan verb" in pos_text:
        return "ichidan"
    if "godan verb" in pos_text:
        return "godan"
    return ""


def detect_practice_verb_type(card: Any) -> str:
    verb_type = get_card_text(card, "verb_type")
    if verb_type in {"ichidan", "godan", "suru", "suru_noun", "kuru"}:
        return verb_type

    pos_text = get_card_text(card, "dictionary_pos").lower()
    if "kuru verb" in pos_text:
        return "kuru"
    if "noun or participle which takes the aux. verb suru" in pos_text:
        return "suru_noun"
    if "suru verb" in pos_text:
        return "suru"
    if "ichidan verb" in pos_text:
        return "ichidan"
    if "godan verb" in pos_text:
        return "godan"

    dictionary_reading = get_card_text(card, "dictionary_reading") or get_card_text(card, "kana")
    dictionary_headword = get_card_text(card, "dictionary_headword") or get_card_text(card, "kanji")
    if dictionary_reading.endswith("する") or dictionary_headword.endswith("する"):
        return "suru"
    if dictionary_reading.endswith("くる") or dictionary_headword.endswith("来る"):
        return "kuru"
    return ""


def detect_practice_verb_sort_bucket(card: Any, options: Dict[str, Any]) -> str:
    verb_type = detect_practice_verb_type(card)
    if not verb_type:
        return ""

    if options.get("verb_sort_only_ru_endings") and not word_or_reading_ends_with(card, "る"):
        return ""

    if verb_type in {"suru", "kuru"}:
        if not options.get("verb_sort_include_suru_verbs", True):
            return ""
        return "suru"

    if verb_type == "suru_noun":
        if not options.get("verb_sort_include_suru_verbs", True):
            return ""
        if not options.get("verb_sort_include_suru_nouns", True):
            return ""
        return "suru"

    if verb_type in {"ichidan", "godan"}:
        return verb_type
    return ""


def detect_practice_word_class_bucket(card: Any) -> str:
    pos_tags = get_dictionary_pos_tags(card)
    normalized_tags = [tag.lower() for tag in pos_tags]

    if "prt" in normalized_tags:
        return "particle"
    if "conj" in normalized_tags:
        return "conjunction"
    if "exp" in normalized_tags:
        return "expression"

    if detect_practice_verb_type(card):
        return "verb"

    adjective_bucket = classify_practice_adjective_tags(normalized_tags)
    if adjective_bucket:
        return adjective_bucket

    if "adv" in normalized_tags:
        return "adverb"
    if "n" in normalized_tags:
        return "noun"
    return ""


def detect_practice_adjective_bucket(card: Any) -> str:
    return classify_practice_adjective_tags(get_dictionary_pos_tags(card))


def detect_practice_adjective_sort_bucket(card: Any, options: Dict[str, Any]) -> str:
    adjective_bucket = detect_practice_adjective_bucket(card)
    if not adjective_bucket:
        return ""
    if options.get("adjective_sort_only_i_endings") and not word_or_reading_ends_with(card, "い"):
        return ""
    return adjective_bucket

def explain_adjective_filter(card: Any) -> str:
    pos_tags = get_dictionary_pos_tags(card)
    adjective_bucket = classify_practice_adjective_tags(pos_tags)

    if adjective_bucket == "i_adj":
        return "included:adj-i"
    if adjective_bucket == "na_adj":
        return "included:adj-na"
    if "adj-na" in pos_tags and "adv" in pos_tags:
        return f"filtered:mixed_adverb_entry ({', '.join(pos_tags)})"
    if pos_tags:
        return f"filtered:no_supported_adjective_tag ({', '.join(pos_tags)})"
    return "filtered:no_pos_tags"

def build_practice_dedupe_key(card: Any, bucket: str) -> str:
    dictionary_entry_id = get_card_text(card, "dictionary_entry_id")
    if dictionary_entry_id:
        return f"{dictionary_entry_id}:{bucket}"
    return "|".join(
        [
            bucket,
            get_card_text(card, "dictionary_headword") or get_card_text(card, "kanji"),
            get_card_text(card, "dictionary_reading") or get_card_text(card, "kana"),
        ]
    )


def normalize_practice_answer(value: str) -> str:
    normalized = normalize_text(value)
    return "".join(normalized.split())


def build_extended_verb_forms(word: str, reading: str, verb_type: str) -> Dict[str, Dict[str, str]]:
    dictionary_word = normalize_text(word)
    dictionary_reading = normalize_text(reading)
    normalized_verb_type = normalize_text(verb_type) or "other"

    forms = {
        "dictionary": {"word": dictionary_word, "reading": dictionary_reading},
        "masu": {"word": "", "reading": ""},
        "te": {"word": "", "reading": ""},
        "past": {"word": "", "reading": ""},
        "negative": {"word": "", "reading": ""},
        "potential": {"word": "", "reading": ""},
        "passive": {"word": "", "reading": ""},
        "causative": {"word": "", "reading": ""},
    }

    if not dictionary_reading:
        return forms

    if normalized_verb_type in {"ichidan", "godan", "suru", "suru_noun", "kuru"}:
        for form_key in VerbFormLabels.keys():
            conjugated_word, conjugated_reading = ConjugateVerbSurface(
                dictionary_word,
                dictionary_reading,
                normalized_verb_type,
                form_key,
                isIkuSpecial=False,
            )
            forms[form_key] = {"word": conjugated_word, "reading": conjugated_reading}

    if normalized_verb_type == "ichidan" and dictionary_reading.endswith("る"):
        stem_reading = dictionary_reading[:-1]
        stem_word = dictionary_word[:-1] if dictionary_word.endswith("る") else dictionary_word
        forms["potential"] = {"word": f"{stem_word}られる", "reading": f"{stem_reading}られる"}
        forms["passive"] = {"word": f"{stem_word}られる", "reading": f"{stem_reading}られる"}
        forms["causative"] = {"word": f"{stem_word}させる", "reading": f"{stem_reading}させる"}
        return forms

    if normalized_verb_type in {"suru", "suru_noun"}:
        base_word = dictionary_word[:-2] if dictionary_word.endswith("する") else dictionary_word
        base_reading = dictionary_reading[:-2] if dictionary_reading.endswith("する") else dictionary_reading
        forms["potential"] = {"word": f"{base_word}できる", "reading": f"{base_reading}できる"}
        forms["passive"] = {"word": f"{base_word}される", "reading": f"{base_reading}される"}
        forms["causative"] = {"word": f"{base_word}させる", "reading": f"{base_reading}させる"}
        return forms

    if normalized_verb_type == "kuru":
        if dictionary_word.endswith("来る"):
            base_word = dictionary_word[:-2]
            forms["potential"] = {"word": f"{base_word}来られる", "reading": "こられる"}
            forms["passive"] = {"word": f"{base_word}来られる", "reading": "こられる"}
            forms["causative"] = {"word": f"{base_word}来させる", "reading": "こさせる"}
        else:
            forms["potential"] = {"word": "こられる", "reading": "こられる"}
            forms["passive"] = {"word": "こられる", "reading": "こられる"}
            forms["causative"] = {"word": "こさせる", "reading": "こさせる"}
        return forms

    if normalized_verb_type == "godan" and dictionary_reading:
        ending = dictionary_reading[-1]
        stem_reading = dictionary_reading[:-1]
        stem_word = dictionary_word[:-1] if dictionary_word else dictionary_word
        e_row = GODAN_E_ROW_MAP.get(ending)
        a_row = GODAN_A_ROW_MAP.get(ending)
        if e_row:
            forms["potential"] = {"word": f"{stem_word}{e_row}る", "reading": f"{stem_reading}{e_row}る"}
        if a_row:
            forms["passive"] = {"word": f"{stem_word}{a_row}れる", "reading": f"{stem_reading}{a_row}れる"}
            forms["causative"] = {"word": f"{stem_word}{a_row}せる", "reading": f"{stem_reading}{a_row}せる"}
    return forms


def build_i_adjective_forms(word: str, reading: str) -> Dict[str, Dict[str, str]]:
    normalized_word = normalize_text(word)
    normalized_reading = normalize_text(reading)
    forms = {
        "dictionary": {"word": normalized_word, "reading": normalized_reading},
        "past": {"word": normalized_word, "reading": normalized_reading},
        "negative": {"word": normalized_word, "reading": normalized_reading},
    }
    if normalized_reading.endswith("い"):
        reading_stem = normalized_reading[:-1]
        forms["past"]["reading"] = f"{reading_stem}かった"
        forms["negative"]["reading"] = f"{reading_stem}くない"
    if normalized_word.endswith("い"):
        word_stem = normalized_word[:-1]
        forms["past"]["word"] = f"{word_stem}かった"
        forms["negative"]["word"] = f"{word_stem}くない"
    return forms


def build_na_adjective_forms(word: str, reading: str) -> Dict[str, Dict[str, str]]:
    normalized_word = normalize_text(word)
    normalized_reading = normalize_text(reading)
    forms = {
        "dictionary": {"word": normalized_word, "reading": normalized_reading},
        "past": {"word": f"{normalized_word}だった", "reading": f"{normalized_reading}だった"},
        "negative": {"word": f"{normalized_word}じゃない", "reading": f"{normalized_reading}じゃない"},
    }
    return forms


def build_search_terms_from_forms(forms: Dict[str, Dict[str, str]]) -> List[str]:
    terms: List[str] = []
    for value in forms.values():
        word = normalize_text(value.get("word", ""))
        reading = normalize_text(value.get("reading", ""))
        if word:
            terms.append(word)
        if reading:
            terms.append(reading)
    return normalize_string_list(terms)


def build_deck_card_search_terms(card: sqlite3.Row) -> List[str]:
    terms: List[str] = [
        card["kanji"] or "",
        card["kana"] or "",
        card["english"] or "",
        card["notes"] or "",
        card["dictionary_entry_id"] or "",
        card["dictionary_headword"] or "",
        card["dictionary_reading"] or "",
        card["dictionary_gloss"] or "",
        card["dictionary_pos"] or "",
        card["word_form"] or "",
    ]

    verb_type = normalize_text(card["verb_type"])
    base_word = normalize_text(card["dictionary_headword"]) or normalize_text(card["kanji"])
    base_reading = normalize_text(card["dictionary_reading"]) or normalize_text(card["kana"])
    if verb_type in {"ichidan", "godan", "suru", "suru_noun", "kuru"} and base_reading:
        terms.extend(build_search_terms_from_forms(build_extended_verb_forms(base_word, base_reading, verb_type)))

    adjective_bucket = detect_practice_adjective_bucket(card)
    if adjective_bucket == "i_adj":
        terms.extend(build_search_terms_from_forms(build_i_adjective_forms(base_word, base_reading)))
    elif adjective_bucket == "na_adj":
        terms.extend(build_search_terms_from_forms(build_na_adjective_forms(base_word, base_reading)))

    return normalize_string_list(terms)


def build_global_card_search_terms(card: sqlite3.Row) -> List[str]:
    terms: List[str] = [
        card["kanji"] or "",
        card["kana"] or "",
        card["english"] or "",
        card["notes"] or "",
        card["kanji_masu"] or "",
        card["kana_masu"] or "",
        card["kanji_te"] or "",
        card["kana_te"] or "",
        card["kanji_past"] or "",
        card["kana_past"] or "",
        card["kanji_negative"] or "",
        card["kana_negative"] or "",
        card["dictionary_entry_id"] or "",
        card["dictionary_headword"] or "",
        card["dictionary_reading"] or "",
        card["dictionary_gloss"] or "",
        card["dictionary_pos"] or "",
    ]
    terms.extend(DecodeJsonStringList(card["tags_json"]))

    verb_type = normalize_text(card["verb_type"])
    base_word = normalize_text(card["dictionary_headword"]) or normalize_text(card["kanji"])
    base_reading = normalize_text(card["dictionary_reading"]) or normalize_text(card["kana"])
    if verb_type in {"ichidan", "godan", "suru", "suru_noun", "kuru"} and base_reading:
        terms.extend(build_search_terms_from_forms(build_extended_verb_forms(base_word, base_reading, verb_type)))
    return normalize_string_list(terms)


def matches_search(normalized_query: str, terms: List[str]) -> bool:
    if not normalized_query:
        return True
    for term in terms:
        normalized_term = normalize_search_text(term)
        if normalized_term and normalized_query in normalized_term:
            return True
    return False


def resolve_media_type_from_paths(paths: List[str]) -> str:
    if not paths:
        return "none"

    image_count = 0
    video_count = 0
    audio_count = 0
    for path in paths:
        suffix = Path(path).suffix.lower()
        if suffix in SupportedImageExtensions:
            image_count += 1
        elif suffix in SupportedVideoExtensions:
            video_count += 1
        elif suffix in SupportedAudioExtensions:
            audio_count += 1

    if image_count and not video_count and not audio_count:
        return "image"
    if video_count and not image_count and not audio_count:
        return "video"
    if audio_count and not image_count and not video_count:
        return "audio"
    return "none"


def split_global_media(paths: List[str]) -> Tuple[List[str], List[str]]:
    image_files: List[str] = []
    video_files: List[str] = []
    for path in paths:
        suffix = Path(path).suffix.lower()
        if suffix in SupportedImageExtensions:
            image_files.append(path)
        elif suffix in SupportedVideoExtensions:
            video_files.append(path)
    return normalize_string_list(image_files), normalize_string_list(video_files)


def read_local_file(path_text: str) -> LocalInputFile:
    path = Path(path_text)
    if not path.exists() or not path.is_file():
        raise RuntimeError(f"File does not exist: {path}")
    mime_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return LocalInputFile(name=path.name, type=mime_type, _data=path.read_bytes())


def copy_media_paths_to_workspace(paths: List[str], deck_id: str) -> List[str]:
    if not paths:
        return []
    target_dir = MediaDir / normalize_text(deck_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    saved_paths: List[str] = []
    for raw_path in paths:
        source_path = Path(raw_path)
        if not source_path.exists() or not source_path.is_file():
            continue
        suffix = source_path.suffix.lower()
        safe_name = f"{uuid.uuid4().hex}{suffix}"
        target_path = target_dir / safe_name
        shutil.copy2(source_path, target_path)
        saved_paths.append(str(target_path))
    return saved_paths


def serialize_collection(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": normalize_text(row.get("id", "")),
        "name": normalize_text(row.get("name", "")),
    }


def serialize_deck(row: Dict[str, Any], card_count_by_id: Dict[str, int]) -> Dict[str, Any]:
    collection_name = normalize_text(row.get("collection_name", ""))
    deck_name = normalize_text(row.get("name", ""))
    return {
        "id": normalize_text(row.get("id", "")),
        "collection_id": normalize_text(row.get("collection_id", "")),
        "collection_name": collection_name,
        "name": deck_name,
        "label": f"{collection_name} :: {deck_name}" if collection_name else deck_name,
        "card_count": int(card_count_by_id.get(normalize_text(row.get("id", "")), 0)),
        "is_owner": bool(row.get("is_owner", True)),
    }


def serialize_dictionary_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    payload = {
        **entry,
        "option_label": FormatDictionaryEntryOption(entry),
        "is_verb": IsVerbEntry(entry),
    }
    if IsVerbEntry(entry):
        payload["forms"] = BuildConjugatedForms(entry)
    else:
        payload["forms"] = {"dictionary": {"kanji": entry.get("headword", ""), "kana": entry.get("reading", "")}}
    return payload


def serialize_global_card(row: sqlite3.Row) -> Dict[str, Any]:
    image_files = DecodeJsonStringList(row["image_files_json"])
    video_files = DecodeJsonStringList(row["video_files_json"])
    tags = DecodeJsonStringList(row["tags_json"])
    return {
        "id": row["id"],
        "kanji": normalize_text(row["kanji"]),
        "kana": normalize_text(row["kana"]),
        "english": normalize_text(row["english"]),
        "notes": normalize_text(row["notes"]),
        "kanji_masu": normalize_text(row["kanji_masu"]),
        "kana_masu": normalize_text(row["kana_masu"]),
        "kanji_te": normalize_text(row["kanji_te"]),
        "kana_te": normalize_text(row["kana_te"]),
        "kanji_past": normalize_text(row["kanji_past"]),
        "kana_past": normalize_text(row["kana_past"]),
        "kanji_negative": normalize_text(row["kanji_negative"]),
        "kana_negative": normalize_text(row["kana_negative"]),
        "dictionary_entry_id": normalize_text(row["dictionary_entry_id"]),
        "dictionary_headword": normalize_text(row["dictionary_headword"]),
        "dictionary_reading": normalize_text(row["dictionary_reading"]),
        "dictionary_gloss": normalize_text(row["dictionary_gloss"]),
        "dictionary_pos": normalize_text(row["dictionary_pos"]),
        "dictionary_pos_tags": DecodeJsonStringList(row["dictionary_pos_tags"]),
        "verb_type": normalize_text(row["verb_type"]),
        "image_files": image_files,
        "video_files": video_files,
        "tags": tags,
        "media_type": "image" if image_files and not video_files else "video" if video_files and not image_files else "none",
    }


def serialize_deck_card(card: sqlite3.Row, index: int) -> Dict[str, Any]:
    schema_key = normalize_text(card["schema_key"]) or "kana_kanji_front_english_back"
    schema_label = CardSchemas.get(schema_key, {}).get("Label", schema_key)
    return {
        "id": card["id"],
        "index": index,
        "kanji": normalize_text(card["kanji"]),
        "kana": normalize_text(card["kana"]),
        "english": normalize_text(card["english"]),
        "notes": normalize_text(card["notes"]),
        "schema_key": schema_key,
        "schema_label": schema_label,
        "word_form": normalize_text(card["word_form"]) or "dictionary",
        "dictionary_entry_id": normalize_text(card["dictionary_entry_id"]),
        "dictionary_headword": normalize_text(card["dictionary_headword"]),
        "dictionary_reading": normalize_text(card["dictionary_reading"]),
        "dictionary_gloss": normalize_text(card["dictionary_gloss"]),
        "dictionary_pos": normalize_text(card["dictionary_pos"]),
        "dictionary_pos_tags": DecodeJsonStringList(card["dictionary_pos_tags"]),
        "verb_type": normalize_text(card["verb_type"]),
        "media_type": normalize_text(card["media_type"]) or "none",
        "media_files": DecodeJsonStringList(card["media_files_json"]),
        "tags": DecodeJsonStringList(card["tags_json"]),
    }


def choose_surface_by_word_form(
    base_kanji: str,
    base_kana: str,
    verb_type: str,
    forms: Dict[str, Dict[str, str]],
    word_form: str,
) -> Tuple[str, str, str]:
    normalized_word_form = normalize_text(word_form) or "dictionary"
    if normalized_word_form not in {"dictionary", "masu", "te", "past", "negative"}:
        normalized_word_form = "dictionary"

    if verb_type not in {"ichidan", "godan", "suru", "suru_noun", "kuru"}:
        return base_kanji, base_kana, "dictionary"

    if normalized_word_form == "dictionary":
        return base_kanji, base_kana, normalized_word_form

    selected = forms.get(normalized_word_form, {})
    selected_word = normalize_text(selected.get("word", "")) or base_kanji
    selected_reading = normalize_text(selected.get("reading", "")) or base_kana
    return selected_word, selected_reading, normalized_word_form


def action_bootstrap(_: Dict[str, Any]) -> Dict[str, Any]:
    connection = get_connection()
    user = get_request_user()

    base_payload = {
        "app_title": AppTitle,
        "card_schemas": [{"key": key, "label": definition["Label"]} for key, definition in CardSchemas.items()],
        "verb_forms": [{"key": key, "label": label} for key, label in VerbFormLabels.items()],
        "verb_types": [
            {"key": "other", "label": "Non-verb / Other"},
            {"key": "ichidan", "label": VerbTypeLabels.get("ichidan", "Ichidan")},
            {"key": "godan", "label": VerbTypeLabels.get("godan", "Godan")},
            {"key": "suru", "label": VerbTypeLabels.get("suru", "Suru irregular")},
            {"key": "suru_noun", "label": VerbTypeLabels.get("suru_noun", "Suru noun")},
            {"key": "kuru", "label": VerbTypeLabels.get("kuru", "Kuru irregular")},
            {"key": "i_adj", "label": "I-adjective"},
            {"key": "na_adj", "label": "Na-adjective"},
            {"key": "noun", "label": "Noun"},
        ],
        "defaults": build_bootstrap_defaults(),
        "auth": {
            "is_authenticated": bool(user),
            "user": user,
            "pending_invites": [],
        },
    }

    if not user:
        return {
            **base_payload,
            "collections": [],
            "decks": [],
            "dashboard": {
                "collection_count": 0,
                "deck_count": 0,
                "card_count": 0,
                "global_card_count": 0,
                "rows": [],
            },
        }

    user_id = normalize_text(user.get("id", ""))
    collections = ListCollections(connection, user_id)
    decks = ListDecks(connection, user_id, includeCollectionName=True)
    card_count_by_id = GetDeckCardCounts(connection, user_id)
    deck_rows = [serialize_deck(deck, card_count_by_id) for deck in decks]

    return {
        **base_payload,
        "collections": [serialize_collection(row) for row in collections],
        "decks": deck_rows,
        "dashboard": {
            "collection_count": len(collections),
            "deck_count": GetTotalDeckCount(connection, user_id),
            "card_count": GetTotalCardCount(connection, user_id),
            "global_card_count": CountGlobalCards(connection, user_id),
            "rows": [
                {
                    "collection_name": row["collection_name"],
                    "deck_name": row["deck_name"],
                    "card_count": int(row["card_count"]),
                }
                for row in GetDashboardRows(connection, user_id)
            ],
        },
        "auth": {
            "is_authenticated": True,
            "user": user,
            "pending_invites": ListPendingInvitesForUser(
                connection,
                user_id,
                normalize_text(user.get("email", "")),
                normalize_text(user.get("username", "")),
            ),
        },
    }


def action_register_user(payload: Dict[str, Any]) -> Dict[str, Any]:
    username = normalize_text(payload.get("username", ""))
    email = normalize_text(payload.get("email", ""))
    password = normalize_text(payload.get("password", ""))
    seed_from_template = bool(payload.get("seed_from_template", True))

    if len(password) < 8:
        raise RuntimeError("Password must be at least 8 characters.")

    connection = get_connection()
    is_first_user = CountUsers(connection) == 0
    user_row = CreateUser(
        connection,
        username,
        email,
        password,
        isAdmin=is_first_user,
        canUseAi=is_first_user,
        canUseOcr=False,
    )
    if seed_from_template:
        CloneTemplateDataToUser(connection, user_row["id"])
    session_token = CreateUserSession(connection, user_row["id"])
    return {
        "registered": True,
        "session_token": session_token,
        "user": SerializeUserRow(user_row),
    }


def action_login_user(payload: Dict[str, Any]) -> Dict[str, Any]:
    identifier = normalize_text(payload.get("identifier", ""))
    password = normalize_text(payload.get("password", ""))
    if not identifier or not password:
        raise RuntimeError("identifier and password are required.")

    user_row = AuthenticateUser(get_connection(), identifier, password)
    if user_row is None:
        raise RuntimeError("Invalid username/email or password.")
    session_token = CreateUserSession(get_connection(), user_row["id"])
    return {
        "authenticated": True,
        "session_token": session_token,
        "user": SerializeUserRow(user_row),
    }


def action_logout_user(_: Dict[str, Any]) -> Dict[str, Any]:
    if _CURRENT_SESSION_TOKEN:
        DeleteUserSession(get_connection(), _CURRENT_SESSION_TOKEN)
    set_request_user(None, "")
    return {"logged_out": True}


def action_change_password(payload: Dict[str, Any]) -> Dict[str, Any]:
    user = require_request_user()
    current_password = normalize_text(payload.get("current_password", ""))
    new_password = normalize_text(payload.get("new_password", ""))
    if len(new_password) < 8:
        raise RuntimeError("New password must be at least 8 characters.")

    user_row = AuthenticateUser(get_connection(), user["username"], current_password)
    if user_row is None or normalize_text(user_row["id"]) != normalize_text(user["id"]):
        raise RuntimeError("Current password is incorrect.")
    UpdateUserPassword(get_connection(), user["id"], new_password)
    return {"updated": True}


def action_list_users(_: Dict[str, Any]) -> Dict[str, Any]:
    require_admin_user()
    return {"rows": ListUsers(get_connection())}


def action_admin_update_user(payload: Dict[str, Any]) -> Dict[str, Any]:
    require_admin_user()
    user_id = normalize_text(payload.get("user_id", ""))
    if not user_id:
        raise RuntimeError("user_id is required.")
    UpdateUserPermissions(
        get_connection(),
        user_id,
        isAdmin=payload.get("is_admin") if "is_admin" in payload else None,
        canUseAi=payload.get("can_use_ai") if "can_use_ai" in payload else None,
        canUseOcr=payload.get("can_use_ocr") if "can_use_ocr" in payload else None,
        isActive=payload.get("is_active") if "is_active" in payload else None,
    )
    user_row = GetUserById(get_connection(), user_id)
    if user_row is None:
        raise RuntimeError("User not found.")
    return {"updated": True, "user": SerializeUserRow(user_row)}


def action_admin_reset_password(payload: Dict[str, Any]) -> Dict[str, Any]:
    require_admin_user()
    user_id = normalize_text(payload.get("user_id", ""))
    new_password = normalize_text(payload.get("new_password", ""))
    if not user_id or len(new_password) < 8:
        raise RuntimeError("user_id and a password of at least 8 characters are required.")
    UpdateUserPassword(get_connection(), user_id, new_password)
    return {"updated": True}


def action_list_pending_invites(_: Dict[str, Any]) -> Dict[str, Any]:
    user = require_request_user()
    return {
        "rows": ListPendingInvitesForUser(
            get_connection(),
            user["id"],
            user["email"],
            user["username"],
        )
    }


def action_accept_deck_invite(payload: Dict[str, Any]) -> Dict[str, Any]:
    invite_token = normalize_text(payload.get("invite_token", ""))
    invite_id = normalize_text(payload.get("invite_id", ""))
    user = require_request_user()
    if invite_token:
        invite = AcceptDeckInvite(get_connection(), invite_token, user["id"])
    elif invite_id:
        invite = AcceptDeckInviteById(
            get_connection(),
            invite_id,
            user["id"],
            user["email"],
            user["username"],
        )
    else:
        raise RuntimeError("invite_token or invite_id is required.")
    if invite is None:
        raise RuntimeError("Invite is invalid or expired.")
    return {"accepted": True, "deck_id": invite["deck_id"]}


def action_list_deck_collaboration(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    deck_row = require_accessible_deck(deck_id, require_write=False)
    return {
        "deck_id": deck_id,
        "is_owner": bool(deck_row["is_owner"]),
        "collaborators": ListDeckCollaborators(get_connection(), deck_id),
        "invites": ListDeckInvites(get_connection(), deck_id) if bool(deck_row["is_owner"]) else [],
    }


def action_create_deck_invite(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    deck_row = require_accessible_deck(deck_id, require_write=True)
    if not bool(deck_row["is_owner"]):
        raise RuntimeError("Only the deck owner can create invites.")
    invite = CreateDeckInvite(
        get_connection(),
        deck_id,
        get_request_user_id(),
        invitedEmail=normalize_text(payload.get("invited_email", "")),
        invitedUsername=normalize_text(payload.get("invited_username", "")),
    )
    return {"invite": invite}


def action_remove_deck_collaborator(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    collaborator_user_id = normalize_text(payload.get("collaborator_user_id", ""))
    deck_row = require_accessible_deck(deck_id, require_write=True)
    if not bool(deck_row["is_owner"]):
        raise RuntimeError("Only the deck owner can remove collaborators.")
    removed = RemoveDeckCollaborator(get_connection(), deck_id, collaborator_user_id)
    return {"removed": int(removed)}


def action_create_collection(payload: Dict[str, Any]) -> Dict[str, Any]:
    name = normalize_text(payload.get("name", ""))
    if not name:
        raise RuntimeError("Collection name is required.")
    CreateCollection(get_connection(), name, get_request_user_id())
    return {"created": True, "name": name}


def action_rename_collection(payload: Dict[str, Any]) -> Dict[str, Any]:
    collection_id = normalize_text(payload.get("collection_id", ""))
    name = normalize_text(payload.get("name", ""))
    if not collection_id:
        raise RuntimeError("collection_id is required.")
    if not name:
        raise RuntimeError("New collection name is required.")
    require_owned_collection(collection_id)
    RenameCollection(get_connection(), collection_id, name, get_request_user_id())
    return {"updated": True, "collection_id": collection_id, "name": name}


def action_create_deck(payload: Dict[str, Any]) -> Dict[str, Any]:
    collection_id = normalize_text(payload.get("collection_id", ""))
    name = normalize_text(payload.get("name", ""))
    if not collection_id:
        raise RuntimeError("collection_id is required.")
    if not name:
        raise RuntimeError("Deck name is required.")
    require_owned_collection(collection_id)
    CreateDeck(get_connection(), collection_id, name, get_request_user_id())
    return {"created": True, "collection_id": collection_id, "name": name}


def action_rename_deck(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    name = normalize_text(payload.get("name", ""))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    if not name:
        raise RuntimeError("New deck name is required.")
    deck_row = require_accessible_deck(deck_id, require_write=True)
    if not bool(deck_row["is_owner"]):
        raise RuntimeError("Only the deck owner can rename the deck.")
    RenameDeck(get_connection(), deck_id, name, get_request_user_id())
    return {"updated": True, "deck_id": deck_id, "name": name}


def action_search_dictionary(payload: Dict[str, Any]) -> Dict[str, Any]:
    query = normalize_text(payload.get("query", ""))
    limit = int(payload.get("limit", 50) or 50)
    if not query:
        return {"query": query, "results": []}

    results = SearchDictionaryEntries(query, limit=limit)
    return {
        "query": query,
        "results": [serialize_dictionary_entry(entry) for entry in results],
    }


def action_add_dictionary_entries(payload: Dict[str, Any]) -> Dict[str, Any]:
    entry_ids = normalize_string_list(payload.get("entry_ids", []))
    destination = normalize_text(payload.get("destination", "global")) or "global"
    deck_id = normalize_text(payload.get("deck_id", ""))
    schema_key = normalize_text(payload.get("schema_key", "")) or "kana_kanji_front_english_back"
    word_form = normalize_text(payload.get("word_form", "")) or "dictionary"
    tags = parse_tags(payload.get("tags", []))
    notes = normalize_text(payload.get("notes", ""))
    english_override = normalize_text(payload.get("english_override", ""))

    if not entry_ids:
        raise RuntimeError("Select one or more dictionary entries first.")
    if destination == "deck" and not deck_id:
        raise RuntimeError("deck_id is required when destination is deck.")
    if destination == "deck":
        require_accessible_deck(deck_id, require_write=True)

    connection = get_connection()
    user_id = get_request_user_id()
    added = 0
    skipped = 0
    missing: List[str] = []

    for entry_id in entry_ids:
        entry = GetDictionaryEntryById(entry_id)
        if not entry:
            missing.append(entry_id)
            skipped += 1
            continue

        if destination == "global":
            card_payload = BuildGlobalCardFromDictionaryEntry(
                entry,
                tags=tags,
                notes=notes,
                englishOverride=english_override,
            )
            card_payload["owner_user_id"] = user_id
            is_added = AddGlobalCard(connection, card_payload)
        else:
            card_payload = BuildCardFromDictionaryEntry(
                entry,
                schema_key,
                word_form,
                tags,
                notes,
                englishOverride=english_override,
            )
            is_added = AddCard(connection, deck_id, card_payload)

        added += int(is_added)
        skipped += int(not is_added)

    return {
        "added": added,
        "skipped": skipped,
        "missing_entry_ids": missing,
        "destination": destination,
    }


def action_quick_add_dictionary_entry(payload: Dict[str, Any]) -> Dict[str, Any]:
    return action_add_dictionary_entries(
        {
            "entry_ids": [normalize_text(payload.get("entry_id", ""))],
            "destination": payload.get("destination", "global"),
            "deck_id": payload.get("deck_id", ""),
            "schema_key": payload.get("schema_key", "kana_kanji_front_english_back"),
            "word_form": payload.get("word_form", "dictionary"),
            "tags": payload.get("tags", []),
            "notes": payload.get("notes", ""),
            "english_override": payload.get("english_override", ""),
        }
    )


def action_build_word_forms(payload: Dict[str, Any]) -> Dict[str, Any]:
    word = normalize_text(payload.get("word", ""))
    reading = normalize_text(payload.get("reading", ""))
    word_kind = normalize_text(payload.get("word_kind", "noun")) or "noun"

    if word_kind in {"ichidan", "godan", "suru", "suru_noun", "kuru"}:
        forms = build_extended_verb_forms(word, reading, word_kind)
    elif word_kind == "i_adj":
        forms = build_i_adjective_forms(word, reading)
    elif word_kind == "na_adj":
        forms = build_na_adjective_forms(word, reading)
    else:
        forms = {"dictionary": {"word": word, "reading": reading}}

    return {"word_kind": word_kind, "forms": forms}


def action_add_manual_card(payload: Dict[str, Any]) -> Dict[str, Any]:
    destination = normalize_text(payload.get("destination", "global")) or "global"
    deck_id = normalize_text(payload.get("deck_id", ""))
    schema_key = normalize_text(payload.get("schema_key", "")) or "kana_kanji_front_english_back"
    word_form = normalize_text(payload.get("word_form", "")) or "dictionary"
    word_kind = normalize_text(payload.get("word_kind", "noun")) or "noun"

    kanji = normalize_text(payload.get("kanji", ""))
    kana = normalize_text(payload.get("kana", ""))
    english = normalize_text(payload.get("english", ""))
    notes = normalize_text(payload.get("notes", ""))
    tags = parse_tags(payload.get("tags", []))
    media_paths = normalize_string_list(payload.get("media_paths", []))

    if not kanji or not kana or not english:
        raise RuntimeError("kanji, kana, and english are required.")
    if destination == "deck" and not deck_id:
        raise RuntimeError("deck_id is required when destination is deck.")
    if destination == "deck":
        require_accessible_deck(deck_id, require_write=True)

    forms_payload = payload.get("forms", {}) or {}
    forms = {
        "dictionary": {
            "word": normalize_text(forms_payload.get("dictionary", {}).get("word", "")) or kanji,
            "reading": normalize_text(forms_payload.get("dictionary", {}).get("reading", "")) or kana,
        },
        "masu": {
            "word": normalize_text(forms_payload.get("masu", {}).get("word", "")),
            "reading": normalize_text(forms_payload.get("masu", {}).get("reading", "")),
        },
        "te": {
            "word": normalize_text(forms_payload.get("te", {}).get("word", "")),
            "reading": normalize_text(forms_payload.get("te", {}).get("reading", "")),
        },
        "past": {
            "word": normalize_text(forms_payload.get("past", {}).get("word", "")),
            "reading": normalize_text(forms_payload.get("past", {}).get("reading", "")),
        },
        "negative": {
            "word": normalize_text(forms_payload.get("negative", {}).get("word", "")),
            "reading": normalize_text(forms_payload.get("negative", {}).get("reading", "")),
        },
    }

    dictionary_entry_id = normalize_text(payload.get("dictionary_entry_id", ""))
    dictionary_headword = normalize_text(payload.get("dictionary_headword", "")) or kanji
    dictionary_reading = normalize_text(payload.get("dictionary_reading", "")) or kana
    dictionary_gloss = normalize_text(payload.get("dictionary_gloss", "")) or english
    dictionary_pos = normalize_text(payload.get("dictionary_pos", ""))
    dictionary_pos_tags = [tag.lower() for tag in parse_tags(payload.get("dictionary_pos_tags", []))]
    verb_type = normalize_text(payload.get("verb_type", ""))
    if not verb_type and word_kind in {"ichidan", "godan", "suru", "suru_noun", "kuru"}:
        verb_type = word_kind

    media_deck_id = deck_id if destination == "deck" else "_global_pool"
    saved_media_paths = copy_media_paths_to_workspace(media_paths, media_deck_id)
    image_files, video_files = split_global_media(saved_media_paths)

    connection = get_connection()
    user_id = get_request_user_id()
    if destination == "global":
        global_payload = {
            "owner_user_id": user_id,
            "kanji": kanji,
            "kana": kana,
            "english": english,
            "notes": notes,
            "kanji_masu": forms["masu"]["word"],
            "kana_masu": forms["masu"]["reading"],
            "kanji_te": forms["te"]["word"],
            "kana_te": forms["te"]["reading"],
            "kanji_past": forms["past"]["word"],
            "kana_past": forms["past"]["reading"],
            "kanji_negative": forms["negative"]["word"],
            "kana_negative": forms["negative"]["reading"],
            "image_files": image_files,
            "video_files": video_files,
            "tags": tags,
            "dictionary_entry_id": dictionary_entry_id,
            "dictionary_headword": dictionary_headword,
            "dictionary_reading": dictionary_reading,
            "dictionary_gloss": dictionary_gloss,
            "dictionary_pos": dictionary_pos,
            "dictionary_pos_tags": dictionary_pos_tags,
            "verb_type": verb_type,
        }
        is_added = AddGlobalCard(connection, global_payload)
        return {"destination": "global", "added": bool(is_added), "saved_media_paths": saved_media_paths}

    selected_kanji, selected_kana, selected_word_form = choose_surface_by_word_form(
        kanji,
        kana,
        verb_type,
        forms,
        word_form,
    )

    deck_payload = {
        "kanji": selected_kanji,
        "kana": selected_kana,
        "english": english,
        "notes": notes,
        "source_text": "manual:custom",
        "schema_key": schema_key,
        "media_type": resolve_media_type_from_paths(saved_media_paths),
        "media_files": saved_media_paths,
        "tags": tags,
        "dictionary_entry_id": dictionary_entry_id,
        "dictionary_headword": dictionary_headword,
        "dictionary_reading": dictionary_reading,
        "dictionary_gloss": dictionary_gloss,
        "dictionary_pos": dictionary_pos,
        "dictionary_pos_tags": dictionary_pos_tags,
        "verb_type": verb_type,
        "word_form": selected_word_form,
    }
    is_added = AddCard(connection, deck_id, deck_payload)
    return {
        "destination": "deck",
        "deck_id": deck_id,
        "added": bool(is_added),
        "saved_media_paths": saved_media_paths,
        "word_form": selected_word_form,
    }


def action_import_deck_to_global(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    require_accessible_deck(deck_id, require_write=True)
    added, skipped = ImportDeckCardsToGlobal(get_connection(), deck_id, get_request_user_id())
    return {"deck_id": deck_id, "added": int(added), "skipped": int(skipped)}


def action_list_global_cards(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized_query = normalize_search_text(payload.get("search", ""))
    rows: List[Dict[str, Any]] = []
    for row in ListGlobalCards(get_connection(), get_request_user_id()):
        if not matches_search(normalized_query, build_global_card_search_terms(row)):
            continue
        rows.append(serialize_global_card(row))

    return {
        "search": normalize_text(payload.get("search", "")),
        "count": len(rows),
        "rows": rows,
    }


def action_delete_global_cards(payload: Dict[str, Any]) -> Dict[str, Any]:
    ids = normalize_string_list(payload.get("ids", []))
    if not ids:
        raise RuntimeError("Select one or more global cards first.")
    deleted = DeleteGlobalCardsByIds(get_connection(), ids, get_request_user_id())
    return {"deleted": int(deleted)}


def action_import_global_to_deck(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    ids = normalize_string_list(payload.get("global_card_ids", []))
    schema_key = normalize_text(payload.get("schema_key", "")) or "kana_kanji_front_english_back"
    word_form = normalize_text(payload.get("word_form", "")) or "dictionary"
    tags = parse_tags(payload.get("tags", []))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    if not ids:
        raise RuntimeError("Select one or more global cards first.")
    require_accessible_deck(deck_id, require_write=True)
    added, skipped = ImportGlobalCardsToDeck(
        get_connection(),
        deck_id,
        ids,
        schema_key,
        word_form,
        extraTags=tags,
        ownerUserId=get_request_user_id(),
    )
    return {"added": int(added), "skipped": int(skipped), "deck_id": deck_id}


def action_list_deck_cards(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if not deck_id:
        return {"deck_id": "", "count": 0, "rows": []}
    require_accessible_deck(deck_id, require_write=False)

    normalized_query = normalize_search_text(payload.get("search", ""))
    rows: List[Dict[str, Any]] = []
    for index, card in enumerate(GetDeckCards(get_connection(), deck_id), start=1):
        if not matches_search(normalized_query, build_deck_card_search_terms(card)):
            continue
        rows.append(serialize_deck_card(card, index))
    return {"deck_id": deck_id, "count": len(rows), "rows": rows}


def action_bulk_update_card_schema(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    card_ids = normalize_string_list(payload.get("card_ids", []))
    schema_key = normalize_text(payload.get("schema_key", "")) or "kana_kanji_front_english_back"
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    if not card_ids:
        raise RuntimeError("Select one or more cards first.")
    require_accessible_deck(deck_id, require_write=True)
    updated = UpdateCardsSchemaByIds(get_connection(), deck_id, card_ids, schema_key)
    return {
        "updated": int(updated),
        "skipped": max(0, len(card_ids) - int(updated)),
    }


def action_delete_deck_cards(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    card_ids = normalize_string_list(payload.get("card_ids", []))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    if not card_ids:
        raise RuntimeError("Select one or more cards first.")
    require_accessible_deck(deck_id, require_write=True)
    deleted = DeleteCardsByIds(get_connection(), deck_id, card_ids)
    return {"deleted": int(deleted)}


def action_update_card(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    card_id = normalize_text(payload.get("card_id", ""))
    if not deck_id or not card_id:
        raise RuntimeError("deck_id and card_id are required.")
    require_accessible_deck(deck_id, require_write=True)
    updated = UpdateCardContent(
        get_connection(),
        deck_id,
        card_id,
        normalize_text(payload.get("kanji", "")),
        normalize_text(payload.get("kana", "")),
        normalize_text(payload.get("english", "")),
        normalize_text(payload.get("notes", "")),
        normalize_text(payload.get("schema_key", "")) or "kana_kanji_front_english_back",
    )
    return {"updated": bool(updated)}


def action_replace_card_media(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    card_id = normalize_text(payload.get("card_id", ""))
    replace_target = normalize_text(payload.get("replace_target", "none")) or "none"
    media_type = normalize_text(payload.get("media_type", "image")) or "image"
    media_paths = normalize_string_list(payload.get("media_paths", []))

    if not deck_id or not card_id:
        raise RuntimeError("deck_id and card_id are required.")
    if replace_target not in {"kanji", "kana", "english", "none"}:
        raise RuntimeError("replace_target must be one of: kanji, kana, english, none.")
    if media_type not in {"image", "audio", "video"}:
        raise RuntimeError("media_type must be one of: image, audio, video.")
    if not media_paths:
        raise RuntimeError("Select at least one media file.")
    require_accessible_deck(deck_id, require_write=True)

    saved_paths = copy_media_paths_to_workspace(media_paths, deck_id)
    if not saved_paths:
        raise RuntimeError("No media files were copied.")

    if replace_target in {"kanji", "kana", "english"}:
        UpdateCardField(get_connection(), card_id, replace_target, f"[{media_type.upper()}]")
    UpdateCardMedia(get_connection(), card_id, media_type, saved_paths)
    return {"updated": True, "saved_media_paths": saved_paths}


def action_scan_images(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    image_paths = normalize_string_list(payload.get("image_paths", []))
    scan_schema_key = normalize_text(payload.get("schema_key", "")) or "kana_kanji_front_english_back"
    scan_word_form = normalize_text(payload.get("word_form", "")) or "dictionary"
    scan_tags = parse_tags(payload.get("tags", []))

    if not deck_id:
        raise RuntimeError("deck_id is required.")
    if not image_paths:
        raise RuntimeError("Select one or more image files first.")
    require_accessible_deck(deck_id, require_write=True)
    require_ocr_user()

    upload_adapters = [read_local_file(path) for path in image_paths]
    connection = get_connection()
    client = GetOpenAiClient()

    extracted_candidates, errors = ExtractCardsFromImages(
        client,
        DefaultModel,
        upload_adapters,
        progressCallback=None,
    )
    expanded_candidates = ExpandExtractedScanCandidates(
        extracted_candidates,
        dictionaryLookup=lambda query: SearchDictionaryEntries(query, limit=1),
    )

    resolved_cards: List[Dict[str, Any]] = []
    preview_rows: List[Dict[str, Any]] = []
    dictionary_matched_count = 0
    dictionary_miss_count = 0
    polite_surface_skipped_count = 0
    duplicate_entry_skipped_count = 0
    seen_surface_and_form = set()

    for candidate in expanded_candidates:
        resolved_entry = ResolveBestDictionaryEntry(
            sourceKanji=candidate.get("kanji", ""),
            sourceKana=candidate.get("kana", ""),
            visibleText=candidate.get("visible_text", ""),
        )
        note_text = BuildScanCandidateNote(candidate)
        source_text = candidate.get("origin_visible_text") or candidate.get("visible_text", "")

        if resolved_entry:
            card = BuildCardFromDictionaryEntry(
                resolved_entry,
                scan_schema_key,
                scan_word_form,
                scan_tags + ["image_ocr"],
                notes=note_text,
                sourceText=source_text,
            )
        else:
            dictionary_miss_count += 1
            continue

        if scan_word_form == "dictionary" and (
            LooksLikePoliteMasuSurface(card.get("kanji", "")) or LooksLikePoliteMasuSurface(card.get("kana", ""))
        ):
            polite_surface_skipped_count += 1
            continue

        card_word_form = normalize_text(card.get("word_form", "dictionary")) or "dictionary"
        surface_key = normalize_text(card.get("kanji", "")) or normalize_text(card.get("dictionary_headword", "")) or normalize_text(card.get("kana", ""))
        dedupe_key = (surface_key, card_word_form)
        if surface_key and dedupe_key in seen_surface_and_form:
            duplicate_entry_skipped_count += 1
            continue
        if surface_key:
            seen_surface_and_form.add(dedupe_key)

        dictionary_matched_count += 1
        resolved_cards.append(card)
        preview_rows.append(
            {
                "visible_text": candidate.get("visible_text", ""),
                "source_text": candidate.get("origin_visible_text", ""),
                "dictionary_entry_id": card.get("dictionary_entry_id", ""),
                "kanji": card.get("kanji", ""),
                "kana": card.get("kana", ""),
                "english": card.get("english", ""),
            }
        )

    added = 0
    duplicates = 0
    for card in resolved_cards:
        if DeckHasKanjiWordForm(
            connection,
            deck_id,
            card.get("schema_key", ""),
            card.get("word_form", "dictionary"),
            card.get("kanji", ""),
        ):
            duplicates += 1
            continue
        if DeckHasCandidate(connection, deck_id, card):
            duplicates += 1
            continue
        if AddCard(connection, deck_id, card):
            added += 1

    summary = (
        f"Scanned {len(upload_adapters)} images. Added {added} new cards and skipped {duplicates} duplicates.\n"
        f"OCR produced {len(extracted_candidates)} raw candidate(s), expanded to {len(expanded_candidates)} term candidate(s).\n"
        f"Dictionary matched {dictionary_matched_count} candidate(s); "
        f"skipped {dictionary_miss_count} unmatched candidate(s); "
        f"skipped {polite_surface_skipped_count} candidate(s) that still looked like polite/masu while dictionary form was selected; "
        f"skipped {duplicate_entry_skipped_count} duplicate dictionary-entry candidate(s)."
    )

    return {
        "added": added,
        "duplicates": duplicates,
        "summary": summary,
        "preview_rows": preview_rows,
        "errors": errors,
    }


def action_import_csv(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    csv_path = normalize_text(payload.get("csv_path", ""))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    if not csv_path:
        raise RuntimeError("csv_path is required.")
    require_accessible_deck(deck_id, require_write=True)
    csv_file = read_local_file(csv_path)
    added, skipped = ImportCsvCards(get_connection(), deck_id, csv_file)
    return {"added": int(added), "skipped": int(skipped)}


def action_export_deck(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    require_accessible_deck(deck_id, require_write=False)
    export_path = ExportDeckPackage(get_connection(), deck_id)
    return {"export_path": str(export_path), "filename": export_path.name}


def action_get_revision_cards(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if not deck_id:
        return {"deck_id": "", "rows": []}
    require_accessible_deck(deck_id, require_write=False)

    rows: List[Dict[str, Any]] = []
    for card in GetDeckCards(get_connection(), deck_id):
        schema_key = normalize_text(card["schema_key"]) or "kana_kanji_front_english_back"
        schema = CardSchemas.get(schema_key, {})
        front_fields = schema.get("FrontFields", ["kana", "kanji"])
        back_fields = schema.get("BackFields", ["english"])
        front_text = build_card_face_text(card, front_fields) or build_card_face_text(card, ["kana", "kanji"])
        back_text = build_card_face_text(card, back_fields) or build_card_face_text(card, ["english", "kana", "kanji"])
        rows.append(
            {
                "id": card["id"],
                "front": front_text,
                "back": back_text,
                "notes": normalize_text(card["notes"]),
                "schema_label": CardSchemas.get(schema_key, {}).get("Label", schema_key),
                "word_form": normalize_text(card["word_form"]) or "dictionary",
            }
        )
    return {"deck_id": deck_id, "rows": rows}


def build_verb_sort_rows(cards: List[Any], options: Dict[str, Any]) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = []
    filtered_rows: List[Dict[str, Any]] = []
    seen_keys = set()

    for card in cards:
        bucket = detect_practice_verb_sort_bucket(card, options)
        if not bucket:
            filtered_rows.append(
                {
                    "prompt": build_practice_prompt(card),
                    "hint": build_practice_hint(card),
                    "dictionary_pos": get_card_text(card, "dictionary_pos"),
                    "dictionary_pos_tags": get_dictionary_pos_tags(card),
                    "reason": "filtered:verb_sort_options_or_type",
                }
            )
            continue

        dedupe_key = build_practice_dedupe_key(card, f"verb_sort:{bucket}")
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)

        prompt = build_practice_prompt(card)
        if not prompt:
            continue
        rows.append(
            {
                "id": dedupe_key,
                "prompt": prompt,
                "hint": build_practice_hint(card),
                "expected": bucket,
            }
        )

    return {"rows": rows, "filtered_rows": filtered_rows}


def build_adjective_sort_rows(cards: List[Any], options: Dict[str, Any]) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = []
    filtered_rows: List[Dict[str, Any]] = []
    seen_keys = set()

    for card in cards:
        bucket = detect_practice_adjective_sort_bucket(card, options)
        if not bucket:
            filtered_rows.append(
                {
                    "prompt": build_practice_prompt(card),
                    "hint": build_practice_hint(card),
                    "dictionary_pos": get_card_text(card, "dictionary_pos"),
                    "dictionary_pos_tags": get_dictionary_pos_tags(card),
                    "reason": explain_adjective_filter(card),
                }
            )
            continue

        dedupe_key = build_practice_dedupe_key(card, f"adjective_sort:{bucket}")
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)

        prompt = build_practice_prompt(card)
        if not prompt:
            continue
        rows.append(
            {
                "id": dedupe_key,
                "prompt": prompt,
                "hint": build_practice_hint(card),
                "expected": bucket,
            }
        )

    return {"rows": rows, "filtered_rows": filtered_rows}


def build_word_class_sort_rows(cards: List[Any]) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = []
    filtered_rows: List[Dict[str, Any]] = []
    seen_keys = set()

    for card in cards:
        bucket = detect_practice_word_class_bucket(card)
        if not bucket:
            filtered_rows.append(
                {
                    "prompt": build_practice_prompt(card),
                    "hint": build_practice_hint(card),
                    "dictionary_pos": get_card_text(card, "dictionary_pos"),
                    "dictionary_pos_tags": get_dictionary_pos_tags(card),
                    "reason": "filtered:no_supported_word_class",
                }
            )
            continue

        dedupe_key = build_practice_dedupe_key(card, bucket)
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)

        prompt = build_practice_prompt(card)
        if not prompt:
            continue
        rows.append(
            {
                "id": dedupe_key,
                "prompt": prompt,
                "hint": build_practice_hint(card),
                "expected": bucket,
            }
        )

    return {"rows": rows, "filtered_rows": filtered_rows}


def build_adjective_conjugation_rows(cards: List[Any], form_keys: List[str]) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = []
    filtered_rows: List[Dict[str, Any]] = []
    seen_keys = set()

    for card in cards:
        adjective_bucket = detect_practice_adjective_bucket(card)
        if not adjective_bucket:
            filtered_rows.append(
                {
                    "prompt": build_practice_prompt(card),
                    "hint": build_practice_hint(card),
                    "dictionary_pos": get_card_text(card, "dictionary_pos"),
                    "dictionary_pos_tags": get_dictionary_pos_tags(card),
                    "reason": explain_adjective_filter(card),
                }
            )
            continue

        base_word = get_card_text(card, "dictionary_headword") or get_card_text(card, "kanji")
        base_reading = get_card_text(card, "dictionary_reading") or get_card_text(card, "kana")
        if not base_reading:
            continue
        if not base_word:
            base_word = base_reading

        forms = (
            build_i_adjective_forms(base_word, base_reading)
            if adjective_bucket == "i_adj"
            else build_na_adjective_forms(base_word, base_reading)
        )

        base_key = build_practice_dedupe_key(card, f"adjective_conjugation:{adjective_bucket}")
        for form_key in form_keys:
            if form_key not in PRACTICE_ADJECTIVE_FORM_LABELS:
                continue
            dedupe_key = f"{base_key}:{form_key}"
            if dedupe_key in seen_keys:
                continue
            seen_keys.add(dedupe_key)

            form = forms.get(form_key, {})
            row = build_text_entry_round_row(
                dedupe_key,
                card,
                form_key,
                PRACTICE_ADJECTIVE_FORM_LABELS[form_key],
                form.get("word", ""),
                form.get("reading", ""),
            )
            if row is not None:
                rows.append(row)

    return {"rows": rows, "filtered_rows": filtered_rows}


def build_verb_conjugation_rows(cards: List[Any], form_keys: List[str]) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = []
    filtered_rows: List[Dict[str, Any]] = []
    seen_keys = set()

    for card in cards:
        verb_type = detect_practice_verb_type(card)
        if not verb_type:
            filtered_rows.append(
                {
                    "prompt": build_practice_prompt(card),
                    "hint": build_practice_hint(card),
                    "dictionary_pos": get_card_text(card, "dictionary_pos"),
                    "dictionary_pos_tags": get_dictionary_pos_tags(card),
                    "reason": "filtered:no_supported_verb_type",
                }
            )
            continue

        base_word = get_card_text(card, "dictionary_headword") or get_card_text(card, "kanji")
        base_reading = get_card_text(card, "dictionary_reading") or get_card_text(card, "kana")
        if not base_reading:
            continue
        if not base_word:
            base_word = base_reading

        forms = build_extended_verb_forms(base_word, base_reading, verb_type)
        base_key = build_practice_dedupe_key(card, f"verb_conjugation:{verb_type}")
        for form_key in form_keys:
            if form_key not in PRACTICE_VERB_FORM_LABELS:
                continue
            dedupe_key = f"{base_key}:{form_key}"
            if dedupe_key in seen_keys:
                continue
            seen_keys.add(dedupe_key)

            form = forms.get(form_key, {})
            row = build_text_entry_round_row(
                dedupe_key,
                card,
                form_key,
                PRACTICE_VERB_FORM_LABELS[form_key],
                form.get("word", ""),
                form.get("reading", ""),
            )
            if row is not None:
                rows.append(row)

    return {"rows": rows, "filtered_rows": filtered_rows}


def build_practice_round_cards(deck_id: str, mode: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not deck_id:
        return {
            "rows": [],
            "filtered_rows": [],
            "game_type": "reading_quiz"
            if mode == "reading_comprehension"
            else "text_entry"
            if mode in {"adjective_conjugation", "verb_conjugation"}
            else "bucket_sort",
            "bucket_order": list(PRACTICE_VERB_SORT_BUCKET_ORDER)
            if mode == "verb_sort"
            else list(PRACTICE_ADJECTIVE_SORT_BUCKET_ORDER)
            if mode == "adjective_sort"
            else list(PRACTICE_WORD_CLASS_BUCKET_ORDER)
            if mode == "word_class_sort"
            else [],
            "options_used": normalize_practice_options(mode, options),
        }

    normalized_options = normalize_practice_options(mode, options)
    cards = list(GetDeckCards(get_connection(), deck_id))

    if mode == "reading_comprehension":
        result = {"rows": [], "filtered_rows": []}
        game_type = "reading_quiz"
        bucket_order = []
    elif mode == "verb_sort":
        result = build_verb_sort_rows(cards, normalized_options)
        game_type = "bucket_sort"
        bucket_order = list(PRACTICE_VERB_SORT_BUCKET_ORDER)
    elif mode == "adjective_sort":
        result = build_adjective_sort_rows(cards, normalized_options)
        game_type = "bucket_sort"
        bucket_order = list(PRACTICE_ADJECTIVE_SORT_BUCKET_ORDER)
    elif mode == "adjective_conjugation":
        result = build_adjective_conjugation_rows(cards, normalized_options["adjective_forms"])
        game_type = "text_entry"
        bucket_order: List[str] = []
    elif mode == "verb_conjugation":
        result = build_verb_conjugation_rows(cards, normalized_options["verb_forms"])
        game_type = "text_entry"
        bucket_order = []
    else:
        result = build_word_class_sort_rows(cards)
        game_type = "bucket_sort"
        bucket_order = list(PRACTICE_WORD_CLASS_BUCKET_ORDER)

    rows = list(result["rows"])
    random.shuffle(rows)
    round_size = normalized_options["round_size"]
    return {
        "rows": rows[:round_size],
        "filtered_rows": result["filtered_rows"],
        "game_type": game_type,
        "bucket_order": bucket_order,
        "options_used": normalized_options,
    }


def action_get_practice_round(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    mode = normalize_text(payload.get("mode", "word_class_sort")) or "word_class_sort"
    include_filtered = bool(payload.get("include_filtered", False))
    require_accessible_deck(deck_id, require_write=False)

    if mode not in {option["key"] for option in PRACTICE_MODE_OPTIONS}:
        mode = "word_class_sort"

    result = build_practice_round_cards(deck_id, mode, payload.get("options", {}))

    response = {
        "deck_id": deck_id,
        "mode": mode,
        "game_type": result["game_type"],
        "rows": result["rows"],
        "bucket_order": result["bucket_order"],
        "options_used": result["options_used"],
        "scoring": {
            "base_correct_points": PRACTICE_BASE_CORRECT_POINTS,
            "incorrect_penalty_points": PRACTICE_INCORRECT_PENALTY_POINTS,
            "bucket_labels": PRACTICE_BUCKET_LABELS,
        },
    }
    if include_filtered:
        response["filtered_rows"] = result["filtered_rows"]
    return response


def build_vocabulary_seed_from_rows(
    rows: List[Any],
    source_label: str,
    limit: int,
) -> List[Dict[str, str]]:
    items: List[Dict[str, str]] = []
    seen = set()
    for row in rows:
        if len(items) >= limit:
            break
        word = normalize_text(row["dictionary_headword"] or row["kanji"])
        reading = normalize_text(row["dictionary_reading"] or row["kana"]) or word
        meaning = normalize_text(row["dictionary_gloss"] or row["english"])
        if not word or not reading:
            continue
        dedupe_key = f"{word}|{reading}"
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        items.append(
            {
                "word": word,
                "reading": reading,
                "meaning": meaning,
                "source": source_label,
            }
        )
    return items


def build_reading_topic_hint(deck_rows: List[Any], explicit_topic: str) -> str:
    if explicit_topic:
        return explicit_topic

    topic_tags: List[str] = []
    for row in deck_rows:
        for tag in DecodeJsonStringList(row["tags_json"]):
            normalized_tag = normalize_text(tag)
            if normalized_tag and normalized_tag not in topic_tags:
                topic_tags.append(normalized_tag)
            if len(topic_tags) >= 8:
                break
        if len(topic_tags) >= 8:
            break

    return ", ".join(topic_tags)


def build_learning_vocabulary_context(
    deck_id: str,
) -> Tuple[sqlite3.Connection, List[Any], List[Any], List[Dict[str, str]], List[Dict[str, str]]]:
    connection = get_connection()
    deck_rows = list(GetDeckCards(connection, deck_id)) if deck_id else []
    global_rows = list(ListGlobalCards(connection, get_request_user_id()))
    preferred_vocabulary = build_vocabulary_seed_from_rows(deck_rows, "deck", limit=48)
    support_vocabulary = build_vocabulary_seed_from_rows(global_rows, "global", limit=96)

    if not preferred_vocabulary:
        preferred_vocabulary = support_vocabulary[:48]

    if not preferred_vocabulary and not support_vocabulary:
        raise RuntimeError("No deck or global cards are available yet.")

    return connection, deck_rows, global_rows, preferred_vocabulary, support_vocabulary


def build_scenario_generation_meta(scenarios: List[Dict[str, Any]]) -> Dict[str, Any]:
    scenario_count = len(scenarios)
    completed_count = sum(1 for scenario in scenarios if int(scenario.get("times_completed", 0)) > 0)

    if scenario_count == 0:
        return {
            "should_generate_more": True,
            "recommended_reason": "No cached scenarios are available yet.",
        }
    if scenario_count < 4:
        return {
            "should_generate_more": True,
            "recommended_reason": "Only a small scenario pool is cached for this deck.",
        }
    if completed_count >= max(2, scenario_count // 2):
        return {
            "should_generate_more": True,
            "recommended_reason": "You have completed enough scenarios that fresh suggestions would make sense.",
        }
    return {
        "should_generate_more": False,
        "recommended_reason": "",
    }


def build_scenario_prompt_payload(scenario: Any) -> Dict[str, Any]:
    if isinstance(scenario, sqlite3.Row):
        tags = DecodeJsonStringList(scenario["tags_json"])
        return {
            "id": (scenario["id"] or "").strip(),
            "title": (scenario["title"] or "").strip(),
            "summary": (scenario["summary"] or "").strip(),
            "topic_hint": (scenario["topic_hint"] or "").strip(),
            "difficulty": (scenario["difficulty"] or "").strip(),
            "style": (scenario["style"] or "").strip(),
            "question_count": int(scenario["question_count"] or 0),
            "tags": tags,
            "is_custom": bool(scenario["is_custom"]),
        }

    return {
        "id": normalize_text(scenario.get("id", "")),
        "title": normalize_text(scenario.get("title", "")),
        "summary": normalize_text(scenario.get("summary", "")),
        "topic_hint": normalize_text(scenario.get("topic_hint", "")),
        "difficulty": normalize_text(scenario.get("difficulty", "intermediate")) or "intermediate",
        "style": normalize_text(scenario.get("style", "")),
        "question_count": normalize_question_count(scenario.get("question_count", 4), default=4),
        "tags": normalize_string_list(scenario.get("tags", [])),
        "is_custom": bool(scenario.get("is_custom", False)),
    }


def build_custom_scenario_defaults(
    deck_rows: List[Any],
    explicit_topic: str,
    fallback_title: str,
) -> Tuple[str, str]:
    topic_hint = build_reading_topic_hint(deck_rows, explicit_topic)
    title = normalize_text(fallback_title) or topic_hint or "Custom Scenario"
    return title, topic_hint or title


def append_conversation_message(
    messages: List[Dict[str, Any]],
    role: str,
    content: str,
) -> List[Dict[str, Any]]:
    next_messages = list(messages)
    next_messages.append(
        {
            "role": normalize_text(role),
            "content": normalize_text(content),
            "timestamp": time.time(),
        }
    )
    return next_messages


def action_list_reading_scenarios(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    require_accessible_deck(deck_id, require_write=False)

    scenarios = ListAiScenarios(get_connection(), get_request_user_id(), deck_id, "reading")
    meta = build_scenario_generation_meta(scenarios)
    return {
        "deck_id": deck_id,
        "scenarios": scenarios,
        **meta,
    }


def action_generate_reading_scenarios(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    require_accessible_deck(deck_id, require_write=False)
    require_ai_user()

    count = max(3, min(8, normalize_question_count(payload.get("count", 6), default=6)))
    connection, _, _, preferred_vocabulary, support_vocabulary = build_learning_vocabulary_context(deck_id)
    existing_scenarios = ListAiScenarios(connection, get_request_user_id(), deck_id, "reading")
    client = GetOpenAiClient()
    suggestions = GenerateScenarioSuggestions(
        client,
        DefaultModel,
        preferred_vocabulary,
        support_vocabulary,
        "reading",
        existingTitles=[scenario["title"] for scenario in existing_scenarios],
        count=count,
    )

    for suggestion in suggestions:
        SaveAiScenario(
            connection,
            get_request_user_id(),
            deck_id,
            "reading",
            suggestion["title"],
            suggestion["summary"],
            suggestion.get("topic_hint", suggestion["title"]),
            suggestion.get("difficulty", DEFAULT_READING_COMPREHENSION_LEVEL),
            suggestion.get("style", DEFAULT_READING_COMPREHENSION_SOURCE),
            normalize_question_count(suggestion.get("question_count", 4), default=4),
            suggestion.get("tags", []),
            isCustom=False,
        )

    scenarios = ListAiScenarios(connection, get_request_user_id(), deck_id, "reading")
    meta = build_scenario_generation_meta(scenarios)
    return {
        "deck_id": deck_id,
        "generated_count": len(suggestions),
        "scenarios": scenarios,
        **meta,
    }


def action_create_reading_scenario(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    require_accessible_deck(deck_id, require_write=False)

    _, deck_rows, _, _, _ = build_learning_vocabulary_context(deck_id)
    options = normalize_practice_options("reading_comprehension", payload.get("options", {}))
    explicit_title = normalize_text(payload.get("title", ""))
    explicit_summary = normalize_text(payload.get("summary", ""))
    title, topic_hint = build_custom_scenario_defaults(deck_rows, options.get("reading_topic", ""), explicit_title)
    summary = explicit_summary or f"{title} focused on deck-relevant vocabulary."

    scenario = SaveAiScenario(
        get_connection(),
        get_request_user_id(),
        deck_id,
        "reading",
        title,
        summary,
        topic_hint,
        options.get("reading_level", DEFAULT_READING_COMPREHENSION_LEVEL),
        options.get("reading_source", DEFAULT_READING_COMPREHENSION_SOURCE),
        options.get("reading_question_count", 4),
        normalize_string_list(payload.get("tags", [])),
        isCustom=True,
    )
    return {"scenario": scenario}


def action_start_reading_session(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    scenario_id = normalize_text(payload.get("scenario_id", ""))
    refresh_material = bool(payload.get("refresh_material", False))

    if not deck_id or not scenario_id:
        raise RuntimeError("deck_id and scenario_id are required.")
    require_accessible_deck(deck_id, require_write=False)
    require_ai_user()

    connection, _, _, preferred_vocabulary, support_vocabulary = build_learning_vocabulary_context(deck_id)
    scenario_row = GetAiScenario(connection, scenario_id)
    if normalize_text(scenario_row["deck_id"]) != deck_id or normalize_text(scenario_row["owner_user_id"]) != get_request_user_id():
        raise RuntimeError("Scenario does not belong to the selected deck.")
    scenario = build_scenario_prompt_payload(scenario_row)

    material = None if refresh_material else GetReadingMaterialByScenarioId(connection, get_request_user_id(), scenario_id)
    used_cached_material = material is not None
    client = GetOpenAiClient()
    if material is None:
        generated_material = GenerateReadingMaterial(
            client,
            DefaultModel,
            preferred_vocabulary,
            support_vocabulary,
            scenario,
        )
        material = SaveReadingMaterial(
            connection,
            get_request_user_id(),
            scenario_id,
            deck_id,
            generated_material["title"],
            generated_material["source_note"],
            generated_material["passage"],
            generated_material["new_words"],
        )

    questions = GenerateReadingQuestionsFromPassage(
        client,
        DefaultModel,
        material["title"],
        material["passage"],
        questionCount=scenario.get("question_count", 4),
        variationHint=f"{scenario_id}:{time.time()}",
    )
    IncrementAiScenarioUsage(connection, scenario_id)

    return {
        "deck_id": deck_id,
        "scenario": scenario,
        "title": material["title"],
        "source_note": material["source_note"],
        "passage": material["passage"],
        "questions": questions,
        "new_words": material["new_words"],
        "cached_material": used_cached_material,
    }


def action_complete_reading_session(payload: Dict[str, Any]) -> Dict[str, Any]:
    scenario_id = normalize_text(payload.get("scenario_id", ""))
    if not scenario_id:
        raise RuntimeError("scenario_id is required.")

    connection = get_connection()
    scenario_row = GetAiScenario(connection, scenario_id)
    if normalize_text(scenario_row["owner_user_id"]) != get_request_user_id():
        raise RuntimeError("Scenario not found.")
    IncrementAiScenarioCompletion(connection, scenario_id)
    return {"scenario": build_scenario_prompt_payload(scenario_row)}


def action_list_conversation_scenarios(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    require_accessible_deck(deck_id, require_write=False)

    scenarios = ListAiScenarios(get_connection(), get_request_user_id(), deck_id, "conversation")
    meta = build_scenario_generation_meta(scenarios)
    return {
        "deck_id": deck_id,
        "scenarios": scenarios,
        **meta,
    }


def action_generate_conversation_scenarios(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    require_accessible_deck(deck_id, require_write=False)
    require_ai_user()

    count = max(3, min(8, normalize_question_count(payload.get("count", 6), default=6)))
    connection, _, _, preferred_vocabulary, support_vocabulary = build_learning_vocabulary_context(deck_id)
    existing_scenarios = ListAiScenarios(connection, get_request_user_id(), deck_id, "conversation")
    client = GetOpenAiClient()
    suggestions = GenerateScenarioSuggestions(
        client,
        DefaultModel,
        preferred_vocabulary,
        support_vocabulary,
        "conversation",
        existingTitles=[scenario["title"] for scenario in existing_scenarios],
        count=count,
    )

    for suggestion in suggestions:
        SaveAiScenario(
            connection,
            get_request_user_id(),
            deck_id,
            "conversation",
            suggestion["title"],
            suggestion["summary"],
            suggestion.get("topic_hint", suggestion["title"]),
            suggestion.get("difficulty", DEFAULT_READING_COMPREHENSION_LEVEL),
            suggestion.get("style", "casual"),
            0,
            suggestion.get("tags", []),
            isCustom=False,
        )

    scenarios = ListAiScenarios(connection, get_request_user_id(), deck_id, "conversation")
    meta = build_scenario_generation_meta(scenarios)
    return {
        "deck_id": deck_id,
        "generated_count": len(suggestions),
        "scenarios": scenarios,
        **meta,
    }


def action_create_conversation_scenario(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    require_accessible_deck(deck_id, require_write=False)

    _, deck_rows, _, _, _ = build_learning_vocabulary_context(deck_id)
    explicit_title = normalize_text(payload.get("title", ""))
    explicit_summary = normalize_text(payload.get("summary", ""))
    topic_hint = normalize_text(payload.get("topic_hint", ""))
    difficulty = normalize_text(payload.get("difficulty", DEFAULT_READING_COMPREHENSION_LEVEL))
    style = normalize_text(payload.get("style", "casual")) or "casual"
    title, normalized_topic_hint = build_custom_scenario_defaults(deck_rows, topic_hint, explicit_title)
    summary = explicit_summary or f"{title} conversation focused on deck-relevant vocabulary."

    scenario = SaveAiScenario(
        get_connection(),
        get_request_user_id(),
        deck_id,
        "conversation",
        title,
        summary,
        normalized_topic_hint,
        difficulty,
        style,
        0,
        normalize_string_list(payload.get("tags", [])),
        isCustom=True,
    )
    return {"scenario": scenario}


def action_start_conversation_session(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    scenario_id = normalize_text(payload.get("scenario_id", ""))
    if not deck_id or not scenario_id:
        raise RuntimeError("deck_id and scenario_id are required.")
    require_accessible_deck(deck_id, require_write=False)
    require_ai_user()

    connection, _, _, preferred_vocabulary, support_vocabulary = build_learning_vocabulary_context(deck_id)
    scenario_row = GetAiScenario(connection, scenario_id)
    if normalize_text(scenario_row["deck_id"]) != deck_id or normalize_text(scenario_row["owner_user_id"]) != get_request_user_id():
        raise RuntimeError("Scenario does not belong to the selected deck.")
    scenario = build_scenario_prompt_payload(scenario_row)

    client = GetOpenAiClient()
    opening = GenerateConversationOpening(
        client,
        DefaultModel,
        preferred_vocabulary,
        support_vocabulary,
        scenario,
    )
    messages = append_conversation_message([], "assistant", opening["opening_message"])
    session = CreateConversationSession(connection, get_request_user_id(), scenario_id, deck_id, messages)
    IncrementAiScenarioUsage(connection, scenario_id)

    return {
        "deck_id": deck_id,
        "scenario": scenario,
        "session_id": session["id"],
        "partner_name": opening["partner_name"],
        "messages": session["messages"],
    }


def action_send_conversation_message(payload: Dict[str, Any]) -> Dict[str, Any]:
    session_id = normalize_text(payload.get("session_id", ""))
    user_message = normalize_text(payload.get("message", ""))
    if not session_id or not user_message:
        raise RuntimeError("session_id and message are required.")
    require_ai_user()

    connection = get_connection()
    session_row = GetConversationSession(connection, session_id)
    if normalize_text(session_row["owner_user_id"]) != get_request_user_id():
        raise RuntimeError("Conversation session not found.")
    if normalize_text(session_row["status"]) != "active":
        raise RuntimeError("Conversation session is already completed.")

    scenario_row = GetAiScenario(connection, normalize_text(session_row["scenario_id"]))
    scenario = build_scenario_prompt_payload(scenario_row)
    _, _, _, preferred_vocabulary, support_vocabulary = build_learning_vocabulary_context(
        normalize_text(session_row["deck_id"])
    )
    current_messages = json.loads(session_row["messages_json"] or "[]")
    if not isinstance(current_messages, list):
        current_messages = []

    client = GetOpenAiClient()
    reply = GenerateConversationReply(
        client,
        DefaultModel,
        preferred_vocabulary,
        support_vocabulary,
        scenario,
        current_messages,
        user_message,
    )

    next_messages = append_conversation_message(current_messages, "user", user_message)
    next_messages = append_conversation_message(next_messages, "assistant", reply["reply"])
    session = UpdateConversationSession(connection, session_id, next_messages)

    return {
        "session_id": session_id,
        "messages": session["messages"],
        "assistant_message": reply["reply"],
        "should_wrap_up": bool(reply["should_wrap_up"]),
    }


def action_complete_conversation_session(payload: Dict[str, Any]) -> Dict[str, Any]:
    session_id = normalize_text(payload.get("session_id", ""))
    if not session_id:
        raise RuntimeError("session_id is required.")
    require_ai_user()

    connection = get_connection()
    session_row = GetConversationSession(connection, session_id)
    if normalize_text(session_row["owner_user_id"]) != get_request_user_id():
        raise RuntimeError("Conversation session not found.")
    scenario_row = GetAiScenario(connection, normalize_text(session_row["scenario_id"]))
    scenario = build_scenario_prompt_payload(scenario_row)
    history = json.loads(session_row["messages_json"] or "[]")
    if not isinstance(history, list):
        history = []

    client = GetOpenAiClient()
    feedback = GenerateConversationFeedback(
        client,
        DefaultModel,
        scenario,
        history,
    )
    session = UpdateConversationSession(
        connection,
        session_id,
        history,
        summary=feedback,
        status="completed",
    )
    IncrementAiScenarioCompletion(connection, scenario["id"])

    return {
        "session_id": session_id,
        "feedback": feedback,
        "messages": session["messages"],
        "status": session["status"],
    }


def action_generate_reading_comprehension(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if not deck_id:
        raise RuntimeError("deck_id is required.")
    require_accessible_deck(deck_id, require_write=False)
    require_ai_user()

    options = normalize_practice_options("reading_comprehension", payload.get("options", {}))
    connection = get_connection()
    deck_rows = list(GetDeckCards(connection, deck_id))
    if not deck_rows:
        raise RuntimeError("No deck cards are available for reading comprehension.")

    global_rows = list(ListGlobalCards(connection, get_request_user_id()))
    preferred_vocabulary = build_vocabulary_seed_from_rows(deck_rows, "deck", limit=48)
    support_vocabulary = build_vocabulary_seed_from_rows(global_rows, "global", limit=96)
    topic_hint = build_reading_topic_hint(deck_rows, options.get("reading_topic", ""))

    client = GetOpenAiClient()
    package = GenerateReadingComprehensionPackage(
        client,
        DefaultModel,
        preferred_vocabulary,
        support_vocabulary,
        readingLevel=options.get("reading_level", DEFAULT_READING_COMPREHENSION_LEVEL),
        sourceStyle=options.get("reading_source", DEFAULT_READING_COMPREHENSION_SOURCE),
        topicHint=topic_hint,
        questionCount=options.get("reading_question_count", 4),
    )

    return {
        "deck_id": deck_id,
        "title": package["title"],
        "source_note": package["source_note"],
        "passage": package["passage"],
        "questions": package["questions"],
        "new_words": package["new_words"],
        "options_used": options,
    }


def action_add_reading_new_word(payload: Dict[str, Any]) -> Dict[str, Any]:
    destination = normalize_text(payload.get("destination", "global")) or "global"
    deck_id = normalize_text(payload.get("deck_id", ""))
    word = normalize_text(payload.get("word", ""))
    reading = normalize_text(payload.get("reading", "")) or word
    meaning = normalize_text(payload.get("meaning", ""))
    part_of_speech = normalize_text(payload.get("part_of_speech", ""))
    note = normalize_text(payload.get("note", ""))

    if not word:
        raise RuntimeError("word is required.")
    if destination == "deck" and not deck_id:
        raise RuntimeError("deck_id is required when destination is deck.")
    if destination == "deck":
        require_accessible_deck(deck_id, require_write=True)

    connection = get_connection()
    user_id = get_request_user_id()
    tags = ["reading_comprehension", "new_vocab"]
    notes = " | ".join(
        [value for value in ["Added from reading comprehension", part_of_speech, note] if value]
    )

    resolved_entry = ResolveBestDictionaryEntry(
        sourceKanji=word,
        sourceKana=reading,
        visibleText=word,
    )
    if resolved_entry:
        if destination == "global":
            global_payload = BuildGlobalCardFromDictionaryEntry(
                resolved_entry,
                tags=tags,
                notes=notes,
                englishOverride=meaning,
            )
            global_payload["owner_user_id"] = user_id
            added = AddGlobalCard(connection, global_payload)
        else:
            added = AddCard(
                connection,
                deck_id,
                BuildCardFromDictionaryEntry(
                    resolved_entry,
                    "kana_kanji_front_english_back",
                    "dictionary",
                    tags,
                    notes,
                    englishOverride=meaning,
                ),
            )
        return {
            "added": bool(added),
            "method": "dictionary",
            "dictionary_entry_id": resolved_entry.get("entry_id", ""),
        }

    if destination == "global":
        added = AddGlobalCard(
            connection,
            {
                "owner_user_id": user_id,
                "kanji": word,
                "kana": reading,
                "english": meaning,
                "notes": notes,
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
                "tags": tags,
                "dictionary_entry_id": "",
                "dictionary_headword": word,
                "dictionary_reading": reading,
                "dictionary_gloss": meaning,
                "dictionary_pos": part_of_speech,
                "dictionary_pos_tags": [],
                "verb_type": "",
            },
        )
    else:
        added = AddCard(
            connection,
            deck_id,
            {
                "kanji": word,
                "kana": reading,
                "english": meaning,
                "notes": notes,
                "source_text": "reading_comprehension",
                "schema_key": "kana_kanji_front_english_back",
                "media_type": "none",
                "media_files": [],
                "tags": tags,
                "dictionary_entry_id": "",
                "dictionary_headword": word,
                "dictionary_reading": reading,
                "dictionary_gloss": meaning,
                "dictionary_pos": part_of_speech,
                "dictionary_pos_tags": [],
                "verb_type": "",
                "word_form": "dictionary",
            },
        )

    return {
        "added": bool(added),
        "method": "manual",
        "dictionary_entry_id": "",
    }


def action_get_counts(payload: Dict[str, Any]) -> Dict[str, Any]:
    deck_id = normalize_text(payload.get("deck_id", ""))
    if deck_id:
        require_accessible_deck(deck_id, require_write=False)
    return {
        "global_card_count": CountGlobalCards(get_connection(), get_request_user_id()),
        "deck_card_count": CountCardsInDeck(get_connection(), deck_id) if deck_id else 0,
    }


ACTIONS = {
    "bootstrap": action_bootstrap,
    "register_user": action_register_user,
    "login_user": action_login_user,
    "logout_user": action_logout_user,
    "change_password": action_change_password,
    "list_users": action_list_users,
    "admin_update_user": action_admin_update_user,
    "admin_reset_password": action_admin_reset_password,
    "list_pending_invites": action_list_pending_invites,
    "accept_deck_invite": action_accept_deck_invite,
    "list_deck_collaboration": action_list_deck_collaboration,
    "create_deck_invite": action_create_deck_invite,
    "remove_deck_collaborator": action_remove_deck_collaborator,
    "create_collection": action_create_collection,
    "rename_collection": action_rename_collection,
    "create_deck": action_create_deck,
    "rename_deck": action_rename_deck,
    "search_dictionary": action_search_dictionary,
    "add_dictionary_entries": action_add_dictionary_entries,
    "quick_add_dictionary_entry": action_quick_add_dictionary_entry,
    "build_word_forms": action_build_word_forms,
    "add_manual_card": action_add_manual_card,
    "import_deck_to_global": action_import_deck_to_global,
    "list_global_cards": action_list_global_cards,
    "delete_global_cards": action_delete_global_cards,
    "import_global_to_deck": action_import_global_to_deck,
    "list_deck_cards": action_list_deck_cards,
    "bulk_update_card_schema": action_bulk_update_card_schema,
    "delete_deck_cards": action_delete_deck_cards,
    "update_card": action_update_card,
    "replace_card_media": action_replace_card_media,
    "scan_images": action_scan_images,
    "import_csv": action_import_csv,
    "export_deck": action_export_deck,
    "get_revision_cards": action_get_revision_cards,
    "get_practice_round": action_get_practice_round,
    "list_reading_scenarios": action_list_reading_scenarios,
    "generate_reading_scenarios": action_generate_reading_scenarios,
    "create_reading_scenario": action_create_reading_scenario,
    "start_reading_session": action_start_reading_session,
    "complete_reading_session": action_complete_reading_session,
    "list_conversation_scenarios": action_list_conversation_scenarios,
    "generate_conversation_scenarios": action_generate_conversation_scenarios,
    "create_conversation_scenario": action_create_conversation_scenario,
    "start_conversation_session": action_start_conversation_session,
    "send_conversation_message": action_send_conversation_message,
    "complete_conversation_session": action_complete_conversation_session,
    "generate_reading_comprehension": action_generate_reading_comprehension,
    "add_reading_new_word": action_add_reading_new_word,
    "get_counts": action_get_counts,
}


def parse_payload(payload_json: str, payload_file: str) -> Dict[str, Any]:
    if payload_file:
        payload_text = Path(payload_file).read_text(encoding="utf-8")
    else:
        payload_text = payload_json
    if not payload_text.strip():
        return {}
    payload = json.loads(payload_text)
    if payload is None:
        return {}
    if not isinstance(payload, dict):
        raise RuntimeError("Payload must be a JSON object.")
    return payload


def print_envelope(ok: bool, data: Any = None, error: str = "", include_trace: bool = False) -> None:
    payload: Dict[str, Any] = {"ok": ok}
    if ok:
        payload["data"] = data
    else:
        payload["error"] = {"message": error}
        if include_trace:
            payload["error"]["traceback"] = traceback.format_exc()
    print(json.dumps(payload, ensure_ascii=False))


def run_action(action: str, payload: Dict[str, Any]) -> Any:
    session_token = normalize_text(payload.pop("_session_token", ""))
    if action in PUBLIC_ACTIONS:
        set_request_user(GetSessionUser(get_connection(), session_token), session_token)
    else:
        user_row = GetSessionUser(get_connection(), session_token)
        if user_row is None:
            raise RuntimeError("Authentication required.")
        set_request_user(user_row, session_token)

    handler = ACTIONS.get(action)
    if handler is None:
        raise RuntimeError(f"Unknown action: {action}")
    return handler(payload)


def main() -> int:
    parser = argparse.ArgumentParser(description="Anki Card Generator Python sidecar")
    parser.add_argument("--ping", action="store_true", help="simple health check")
    parser.add_argument("--action", default="", help="action name")
    parser.add_argument("--payload-json", default="", help="inline JSON payload")
    parser.add_argument("--payload-file", default="", help="path to JSON payload")
    parser.add_argument("--debug-errors", action="store_true", help="include traceback in error payload")
    args = parser.parse_args()

    if args.ping:
        print("pong")
        return 0

    try:
        action = normalize_text(args.action)
        if not action:
            raise RuntimeError("Missing --action argument.")
        payload = parse_payload(args.payload_json, args.payload_file)
        result = run_action(action, payload)
        print_envelope(True, data=result)
        return 0
    except sqlite3.IntegrityError as exc:
        print_envelope(False, error=str(exc), include_trace=args.debug_errors)
        return 1
    except Exception as exc:
        print_envelope(False, error=str(exc), include_trace=args.debug_errors)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
