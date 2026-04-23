import hashlib
import json
import re
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from AnkiDeckBuilder.AppConfig import (
    DatabasePath,
    SupportedImageExtensions,
    SupportedVideoExtensions,
)
from AnkiDeckBuilder.WorkspaceService import EnsureWorkspaceDirectories

AllowedCardFieldsToUpdate = {"kanji", "kana", "english", "notes", "schema_key", "media_type"}
CardColumnDefinitions = {
    "dictionary_entry_id": "TEXT NOT NULL DEFAULT ''",
    "dictionary_headword": "TEXT NOT NULL DEFAULT ''",
    "dictionary_reading": "TEXT NOT NULL DEFAULT ''",
    "dictionary_gloss": "TEXT NOT NULL DEFAULT ''",
    "dictionary_pos": "TEXT NOT NULL DEFAULT ''",
    "dictionary_pos_tags": "TEXT NOT NULL DEFAULT '[]'",
    "verb_type": "TEXT NOT NULL DEFAULT ''",
    "word_form": "TEXT NOT NULL DEFAULT 'dictionary'",
}
GlobalCardColumnDefinitions = {
    "kanji": "TEXT NOT NULL DEFAULT ''",
    "kana": "TEXT NOT NULL DEFAULT ''",
    "english": "TEXT NOT NULL DEFAULT ''",
    "notes": "TEXT NOT NULL DEFAULT ''",
    "kanji_masu": "TEXT NOT NULL DEFAULT ''",
    "kana_masu": "TEXT NOT NULL DEFAULT ''",
    "kanji_te": "TEXT NOT NULL DEFAULT ''",
    "kana_te": "TEXT NOT NULL DEFAULT ''",
    "kanji_past": "TEXT NOT NULL DEFAULT ''",
    "kana_past": "TEXT NOT NULL DEFAULT ''",
    "kanji_negative": "TEXT NOT NULL DEFAULT ''",
    "kana_negative": "TEXT NOT NULL DEFAULT ''",
    "image_files_json": "TEXT NOT NULL DEFAULT '[]'",
    "video_files_json": "TEXT NOT NULL DEFAULT '[]'",
    "tags_json": "TEXT NOT NULL DEFAULT '[]'",
    "dictionary_entry_id": "TEXT NOT NULL DEFAULT ''",
    "dictionary_headword": "TEXT NOT NULL DEFAULT ''",
    "dictionary_reading": "TEXT NOT NULL DEFAULT ''",
    "dictionary_gloss": "TEXT NOT NULL DEFAULT ''",
    "dictionary_pos": "TEXT NOT NULL DEFAULT ''",
    "dictionary_pos_tags": "TEXT NOT NULL DEFAULT '[]'",
    "verb_type": "TEXT NOT NULL DEFAULT ''",
    "unique_key": "TEXT NOT NULL DEFAULT ''",
    "created_at": "REAL NOT NULL DEFAULT 0",
}
AiScenarioColumnDefinitions = {
    "deck_id": "TEXT NOT NULL DEFAULT ''",
    "mode": "TEXT NOT NULL DEFAULT ''",
    "title": "TEXT NOT NULL DEFAULT ''",
    "summary": "TEXT NOT NULL DEFAULT ''",
    "topic_hint": "TEXT NOT NULL DEFAULT ''",
    "difficulty": "TEXT NOT NULL DEFAULT 'intermediate'",
    "style": "TEXT NOT NULL DEFAULT ''",
    "question_count": "INTEGER NOT NULL DEFAULT 4",
    "tags_json": "TEXT NOT NULL DEFAULT '[]'",
    "is_custom": "INTEGER NOT NULL DEFAULT 0",
    "times_used": "INTEGER NOT NULL DEFAULT 0",
    "times_completed": "INTEGER NOT NULL DEFAULT 0",
    "created_at": "REAL NOT NULL DEFAULT 0",
    "updated_at": "REAL NOT NULL DEFAULT 0",
}
ReadingMaterialColumnDefinitions = {
    "scenario_id": "TEXT NOT NULL DEFAULT ''",
    "deck_id": "TEXT NOT NULL DEFAULT ''",
    "title": "TEXT NOT NULL DEFAULT ''",
    "source_note": "TEXT NOT NULL DEFAULT ''",
    "passage": "TEXT NOT NULL DEFAULT ''",
    "new_words_json": "TEXT NOT NULL DEFAULT '[]'",
    "created_at": "REAL NOT NULL DEFAULT 0",
    "updated_at": "REAL NOT NULL DEFAULT 0",
}
ConversationSessionColumnDefinitions = {
    "scenario_id": "TEXT NOT NULL DEFAULT ''",
    "deck_id": "TEXT NOT NULL DEFAULT ''",
    "messages_json": "TEXT NOT NULL DEFAULT '[]'",
    "summary_json": "TEXT NOT NULL DEFAULT '{}'",
    "status": "TEXT NOT NULL DEFAULT 'active'",
    "created_at": "REAL NOT NULL DEFAULT 0",
    "updated_at": "REAL NOT NULL DEFAULT 0",
}
WordFormFieldByKey = {
    "dictionary": ("kanji", "kana"),
    "masu": ("kanji_masu", "kana_masu"),
    "te": ("kanji_te", "kana_te"),
    "past": ("kanji_past", "kana_past"),
    "negative": ("kanji_negative", "kana_negative"),
}


def OpenDatabaseConnection() -> sqlite3.Connection:
    EnsureWorkspaceDirectories()
    connection = sqlite3.connect(DatabasePath, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    EnsureDatabaseSchema(connection)
    return connection


def EnsureDatabaseSchema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS collections (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            created_at REAL NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS decks (
            id TEXT PRIMARY KEY,
            collection_id TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at REAL NOT NULL,
            UNIQUE(collection_id, name),
            FOREIGN KEY(collection_id) REFERENCES collections(id)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY,
            deck_id TEXT NOT NULL,
            kanji TEXT NOT NULL DEFAULT '',
            kana TEXT NOT NULL DEFAULT '',
            english TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            source_text TEXT NOT NULL DEFAULT '',
            schema_key TEXT NOT NULL,
            media_type TEXT NOT NULL DEFAULT 'none',
            media_files_json TEXT NOT NULL DEFAULT '[]',
            tags_json TEXT NOT NULL DEFAULT '[]',
            dictionary_entry_id TEXT NOT NULL DEFAULT '',
            dictionary_headword TEXT NOT NULL DEFAULT '',
            dictionary_reading TEXT NOT NULL DEFAULT '',
            dictionary_gloss TEXT NOT NULL DEFAULT '',
            dictionary_pos TEXT NOT NULL DEFAULT '',
            dictionary_pos_tags TEXT NOT NULL DEFAULT '[]',
            verb_type TEXT NOT NULL DEFAULT '',
            word_form TEXT NOT NULL DEFAULT 'dictionary',
            unique_key TEXT NOT NULL,
            created_at REAL NOT NULL,
            UNIQUE(deck_id, unique_key),
            FOREIGN KEY(deck_id) REFERENCES decks(id)
        )
        """
    )
    EnsureCardsTableColumns(connection)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS global_cards (
            id TEXT PRIMARY KEY,
            kanji TEXT NOT NULL DEFAULT '',
            kana TEXT NOT NULL DEFAULT '',
            english TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            kanji_masu TEXT NOT NULL DEFAULT '',
            kana_masu TEXT NOT NULL DEFAULT '',
            kanji_te TEXT NOT NULL DEFAULT '',
            kana_te TEXT NOT NULL DEFAULT '',
            kanji_past TEXT NOT NULL DEFAULT '',
            kana_past TEXT NOT NULL DEFAULT '',
            kanji_negative TEXT NOT NULL DEFAULT '',
            kana_negative TEXT NOT NULL DEFAULT '',
            image_files_json TEXT NOT NULL DEFAULT '[]',
            video_files_json TEXT NOT NULL DEFAULT '[]',
            tags_json TEXT NOT NULL DEFAULT '[]',
            dictionary_entry_id TEXT NOT NULL DEFAULT '',
            dictionary_headword TEXT NOT NULL DEFAULT '',
            dictionary_reading TEXT NOT NULL DEFAULT '',
            dictionary_gloss TEXT NOT NULL DEFAULT '',
            dictionary_pos TEXT NOT NULL DEFAULT '',
            dictionary_pos_tags TEXT NOT NULL DEFAULT '[]',
            verb_type TEXT NOT NULL DEFAULT '',
            unique_key TEXT NOT NULL,
            created_at REAL NOT NULL,
            UNIQUE(unique_key)
        )
        """
    )
    EnsureGlobalCardsTableColumns(connection)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_scenarios (
            id TEXT PRIMARY KEY,
            deck_id TEXT NOT NULL DEFAULT '',
            mode TEXT NOT NULL DEFAULT '',
            title TEXT NOT NULL DEFAULT '',
            summary TEXT NOT NULL DEFAULT '',
            topic_hint TEXT NOT NULL DEFAULT '',
            difficulty TEXT NOT NULL DEFAULT 'intermediate',
            style TEXT NOT NULL DEFAULT '',
            question_count INTEGER NOT NULL DEFAULT 4,
            tags_json TEXT NOT NULL DEFAULT '[]',
            is_custom INTEGER NOT NULL DEFAULT 0,
            times_used INTEGER NOT NULL DEFAULT 0,
            times_completed INTEGER NOT NULL DEFAULT 0,
            created_at REAL NOT NULL DEFAULT 0,
            updated_at REAL NOT NULL DEFAULT 0
        )
        """
    )
    EnsureAiScenariosTableColumns(connection)
    connection.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_scenarios_unique
        ON ai_scenarios(deck_id, mode, title, topic_hint, difficulty, style)
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS reading_materials (
            id TEXT PRIMARY KEY,
            scenario_id TEXT NOT NULL DEFAULT '',
            deck_id TEXT NOT NULL DEFAULT '',
            title TEXT NOT NULL DEFAULT '',
            source_note TEXT NOT NULL DEFAULT '',
            passage TEXT NOT NULL DEFAULT '',
            new_words_json TEXT NOT NULL DEFAULT '[]',
            created_at REAL NOT NULL DEFAULT 0,
            updated_at REAL NOT NULL DEFAULT 0
        )
        """
    )
    EnsureReadingMaterialsTableColumns(connection)
    connection.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_materials_scenario
        ON reading_materials(scenario_id)
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS conversation_sessions (
            id TEXT PRIMARY KEY,
            scenario_id TEXT NOT NULL DEFAULT '',
            deck_id TEXT NOT NULL DEFAULT '',
            messages_json TEXT NOT NULL DEFAULT '[]',
            summary_json TEXT NOT NULL DEFAULT '{}',
            status TEXT NOT NULL DEFAULT 'active',
            created_at REAL NOT NULL DEFAULT 0,
            updated_at REAL NOT NULL DEFAULT 0
        )
        """
    )
    EnsureConversationSessionsTableColumns(connection)
    connection.commit()


def EnsureCardsTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(cards)").fetchall()
    }
    for columnName, definition in CardColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE cards ADD COLUMN {columnName} {definition}")


def EnsureGlobalCardsTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(global_cards)").fetchall()
    }
    for columnName, definition in GlobalCardColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE global_cards ADD COLUMN {columnName} {definition}")


def EnsureAiScenariosTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(ai_scenarios)").fetchall()
    }
    for columnName, definition in AiScenarioColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE ai_scenarios ADD COLUMN {columnName} {definition}")


def EnsureReadingMaterialsTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(reading_materials)").fetchall()
    }
    for columnName, definition in ReadingMaterialColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE reading_materials ADD COLUMN {columnName} {definition}")


def EnsureConversationSessionsTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(conversation_sessions)").fetchall()
    }
    for columnName, definition in ConversationSessionColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE conversation_sessions ADD COLUMN {columnName} {definition}")


def NormalizeText(value: str) -> str:
    normalizedValue = (value or "").strip().lower()
    normalizedValue = re.sub(r"\s+", " ", normalizedValue)
    return normalizedValue


def BuildCardUniqueKey(schemaKey: str, kanji: str, kana: str) -> str:
    raw = "|".join([NormalizeText(schemaKey), NormalizeText(kanji), NormalizeText(kana)])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def BuildGlobalCardUniqueKey(kanji: str, kana: str) -> str:
    raw = "|".join([NormalizeText(kanji), NormalizeText(kana)])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def DecodeJsonStringList(raw: str) -> List[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []

    normalizedItems: List[str] = []
    for item in parsed:
        value = str(item).strip()
        if not value or value in normalizedItems:
            continue
        normalizedItems.append(value)
    return normalizedItems


def DecodeJsonObjectList(raw: str) -> List[Dict[str, Any]]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []

    normalizedItems: List[Dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        normalizedItems.append(dict(item))
    return normalizedItems


def DecodeJsonObject(raw: str) -> Dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    return dict(parsed)


def NormalizeStringList(values: List[Any]) -> List[str]:
    normalizedItems: List[str] = []
    for rawValue in values or []:
        value = str(rawValue).strip()
        if not value or value in normalizedItems:
            continue
        normalizedItems.append(value)
    return normalizedItems


def NormalizeDictionaryPosTags(values: List[Any]) -> List[str]:
    normalizedTags: List[str] = []
    for rawValue in values or []:
        tag = str(rawValue or "").strip().lower()
        if not tag or tag in normalizedTags:
            continue
        normalizedTags.append(tag)
    return normalizedTags


def BuildMediaTypeFromGlobalCard(imageFiles: List[str], videoFiles: List[str]) -> str:
    if imageFiles and not videoFiles:
        return "image"
    if videoFiles and not imageFiles:
        return "video"
    if imageFiles or videoFiles:
        return "none"
    return "none"


def SelectSurfaceFromGlobalCard(globalCard: sqlite3.Row, requestedWordForm: str) -> Tuple[str, str, str]:
    selectedWordForm = (requestedWordForm or "dictionary").strip() or "dictionary"
    if selectedWordForm not in WordFormFieldByKey:
        selectedWordForm = "dictionary"

    defaultKanji = (globalCard["kanji"] or "").strip()
    defaultKana = (globalCard["kana"] or "").strip()

    if selectedWordForm == "dictionary":
        return defaultKanji, defaultKana, "dictionary"

    kanjiField, kanaField = WordFormFieldByKey[selectedWordForm]
    formKanji = (globalCard[kanjiField] or "").strip()
    formKana = (globalCard[kanaField] or "").strip()
    if formKanji and formKana:
        return formKanji, formKana, selectedWordForm
    return defaultKanji, defaultKana, "dictionary"


def CardWordExistsInSchema(
    connection: sqlite3.Connection,
    deckId: str,
    schemaKey: str,
    kanji: str,
    kana: str,
    excludeCardId: Optional[str] = None,
) -> bool:
    targetKey = BuildCardUniqueKey(schemaKey, kanji, kana)
    rows = connection.execute(
        "SELECT id, schema_key, kanji, kana FROM cards WHERE deck_id = ? AND schema_key = ?",
        (deckId, schemaKey),
    ).fetchall()
    for row in rows:
        if excludeCardId and row["id"] == excludeCardId:
            continue
        rowKey = BuildCardUniqueKey(row["schema_key"], row["kanji"], row["kana"])
        if rowKey == targetKey:
            return True
    return False


def ListCollections(connection: sqlite3.Connection) -> List[Dict[str, Any]]:
    return [dict(row) for row in connection.execute("SELECT * FROM collections ORDER BY name")]


def ListDecks(
    connection: sqlite3.Connection,
    collectionId: Optional[str] = None,
    includeCollectionName: bool = False,
) -> List[Dict[str, Any]]:
    parameters: tuple = ()
    if includeCollectionName:
        query = """
            SELECT decks.*, collections.name AS collection_name
            FROM decks
            JOIN collections ON collections.id = decks.collection_id
        """
    else:
        query = "SELECT * FROM decks"

    if collectionId:
        query += " WHERE collection_id = ?"
        parameters = (collectionId,)

    if includeCollectionName:
        query += " ORDER BY collections.name, decks.name"
    else:
        query += " ORDER BY name"
    return [dict(row) for row in connection.execute(query, parameters)]


def CreateCollection(connection: sqlite3.Connection, name: str) -> None:
    connection.execute(
        "INSERT INTO collections (id, name, created_at) VALUES (?, ?, ?)",
        (str(uuid.uuid4()), name.strip(), time.time()),
    )
    connection.commit()


def RenameCollection(connection: sqlite3.Connection, collectionId: str, newName: str) -> None:
    connection.execute("UPDATE collections SET name = ? WHERE id = ?", (newName.strip(), collectionId))
    connection.commit()


def CreateDeck(connection: sqlite3.Connection, collectionId: str, name: str) -> None:
    connection.execute(
        "INSERT INTO decks (id, collection_id, name, created_at) VALUES (?, ?, ?, ?)",
        (str(uuid.uuid4()), collectionId, name.strip(), time.time()),
    )
    connection.commit()


def RenameDeck(connection: sqlite3.Connection, deckId: str, newName: str) -> None:
    connection.execute("UPDATE decks SET name = ? WHERE id = ?", (newName.strip(), deckId))
    connection.commit()


def GetDeckRow(connection: sqlite3.Connection, deckId: str) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT decks.id AS deck_id, decks.name AS deck_name, collections.name AS collection_name
        FROM decks
        JOIN collections ON collections.id = decks.collection_id
        WHERE decks.id = ?
        """,
        (deckId,),
    ).fetchone()
    if row is None:
        raise RuntimeError("Deck not found.")
    return row


def GetDeckCards(connection: sqlite3.Connection, deckId: str) -> List[sqlite3.Row]:
    return list(
        connection.execute(
            "SELECT * FROM cards WHERE deck_id = ? ORDER BY created_at DESC",
            (deckId,),
        )
    )


def CountCardsInDeck(connection: sqlite3.Connection, deckId: str) -> int:
    return int(connection.execute("SELECT COUNT(*) FROM cards WHERE deck_id = ?", (deckId,)).fetchone()[0])


def GetDeckCardCounts(connection: sqlite3.Connection) -> Dict[str, int]:
    rows = connection.execute(
        """
        SELECT deck_id, COUNT(*) AS count
        FROM cards
        GROUP BY deck_id
        """
    ).fetchall()
    return {row["deck_id"]: int(row["count"]) for row in rows}


def AddCard(connection: sqlite3.Connection, deckId: str, card: Dict[str, Any]) -> bool:
    schemaKey = card.get("schema_key") or "kana_kanji_front_english_back"
    kanji = (card.get("kanji") or "").strip()
    kana = (card.get("kana") or "").strip()
    english = (card.get("english") or "").strip()
    dictionaryEntryId = (card.get("dictionary_entry_id") or "").strip()
    dictionaryHeadword = (card.get("dictionary_headword") or "").strip()
    dictionaryReading = (card.get("dictionary_reading") or "").strip()
    dictionaryGloss = (card.get("dictionary_gloss") or "").strip()
    dictionaryPos = (card.get("dictionary_pos") or "").strip()
    dictionaryPosTags = NormalizeDictionaryPosTags(card.get("dictionary_pos_tags") or [])
    verbType = (card.get("verb_type") or "").strip()
    wordForm = (card.get("word_form") or "dictionary").strip() or "dictionary"

    if CardWordExistsInSchema(connection, deckId, schemaKey, kanji, kana):
        return False

    uniqueKey = BuildCardUniqueKey(schemaKey, kanji, kana)
    try:
        connection.execute(
            """
            INSERT INTO cards (
                id, deck_id, kanji, kana, english, notes, source_text, schema_key,
                media_type, media_files_json, tags_json,
                dictionary_entry_id, dictionary_headword, dictionary_reading,
                dictionary_gloss, dictionary_pos, dictionary_pos_tags, verb_type, word_form,
                unique_key, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                deckId,
                kanji,
                kana,
                english,
                (card.get("notes") or "").strip(),
                (card.get("source_text") or "").strip(),
                schemaKey,
                card.get("media_type") or "none",
                json.dumps(card.get("media_files") or [], ensure_ascii=False),
                json.dumps(card.get("tags") or [], ensure_ascii=False),
                dictionaryEntryId,
                dictionaryHeadword,
                dictionaryReading,
                dictionaryGloss,
                dictionaryPos,
                json.dumps(dictionaryPosTags, ensure_ascii=False),
                verbType,
                wordForm,
                uniqueKey,
                time.time(),
            ),
        )
        connection.commit()
        return True
    except sqlite3.IntegrityError:
        return False


def GlobalCardExists(
    connection: sqlite3.Connection,
    kanji: str,
    kana: str,
    excludeCardId: Optional[str] = None,
) -> bool:
    uniqueKey = BuildGlobalCardUniqueKey(kanji, kana)
    if excludeCardId:
        row = connection.execute(
            "SELECT 1 FROM global_cards WHERE unique_key = ? AND id != ? LIMIT 1",
            (uniqueKey, excludeCardId),
        ).fetchone()
    else:
        row = connection.execute(
            "SELECT 1 FROM global_cards WHERE unique_key = ? LIMIT 1",
            (uniqueKey,),
        ).fetchone()
    return row is not None


def AddGlobalCard(connection: sqlite3.Connection, card: Dict[str, Any]) -> bool:
    kanji = (card.get("kanji") or "").strip()
    kana = (card.get("kana") or "").strip()
    english = (card.get("english") or "").strip()
    if not kanji or not kana or not english:
        return False

    if GlobalCardExists(connection, kanji, kana):
        return False

    kanjiMasu = (card.get("kanji_masu") or "").strip()
    kanaMasu = (card.get("kana_masu") or "").strip()
    kanjiTe = (card.get("kanji_te") or "").strip()
    kanaTe = (card.get("kana_te") or "").strip()
    kanjiPast = (card.get("kanji_past") or "").strip()
    kanaPast = (card.get("kana_past") or "").strip()
    kanjiNegative = (card.get("kanji_negative") or "").strip()
    kanaNegative = (card.get("kana_negative") or "").strip()
    notes = (card.get("notes") or "").strip()
    dictionaryEntryId = (card.get("dictionary_entry_id") or "").strip()
    dictionaryHeadword = (card.get("dictionary_headword") or "").strip()
    dictionaryReading = (card.get("dictionary_reading") or "").strip()
    dictionaryGloss = (card.get("dictionary_gloss") or "").strip()
    dictionaryPos = (card.get("dictionary_pos") or "").strip()
    dictionaryPosTags = NormalizeDictionaryPosTags(card.get("dictionary_pos_tags") or [])
    verbType = (card.get("verb_type") or "").strip()

    imageFiles = NormalizeStringList(card.get("image_files") or [])
    videoFiles = NormalizeStringList(card.get("video_files") or [])
    tags = NormalizeStringList(card.get("tags") or [])
    uniqueKey = BuildGlobalCardUniqueKey(kanji, kana)

    try:
        connection.execute(
            """
            INSERT INTO global_cards (
                id, kanji, kana, english, notes,
                kanji_masu, kana_masu, kanji_te, kana_te,
                kanji_past, kana_past, kanji_negative, kana_negative,
                image_files_json, video_files_json, tags_json,
                dictionary_entry_id, dictionary_headword, dictionary_reading,
                dictionary_gloss, dictionary_pos, dictionary_pos_tags, verb_type,
                unique_key, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                kanji,
                kana,
                english,
                notes,
                kanjiMasu,
                kanaMasu,
                kanjiTe,
                kanaTe,
                kanjiPast,
                kanaPast,
                kanjiNegative,
                kanaNegative,
                json.dumps(imageFiles, ensure_ascii=False),
                json.dumps(videoFiles, ensure_ascii=False),
                json.dumps(tags, ensure_ascii=False),
                dictionaryEntryId,
                dictionaryHeadword,
                dictionaryReading,
                dictionaryGloss,
                dictionaryPos,
                json.dumps(dictionaryPosTags, ensure_ascii=False),
                verbType,
                uniqueKey,
                time.time(),
            ),
        )
        connection.commit()
        return True
    except sqlite3.IntegrityError:
        return False


def GetGlobalCardBySurface(connection: sqlite3.Connection, kanji: str, kana: str) -> Optional[sqlite3.Row]:
    uniqueKey = BuildGlobalCardUniqueKey(kanji, kana)
    return connection.execute(
        "SELECT * FROM global_cards WHERE unique_key = ? LIMIT 1",
        (uniqueKey,),
    ).fetchone()


def MergeOptionalText(existingValue: str, incomingValue: str) -> str:
    normalizedExisting = (existingValue or "").strip()
    normalizedIncoming = (incomingValue or "").strip()
    return normalizedExisting or normalizedIncoming


def MergeNotes(existingValue: str, incomingValue: str) -> str:
    normalizedExisting = (existingValue or "").strip()
    normalizedIncoming = (incomingValue or "").strip()
    if not normalizedExisting:
        return normalizedIncoming
    if not normalizedIncoming or normalizedIncoming == normalizedExisting:
        return normalizedExisting
    return f"{normalizedExisting} | {normalizedIncoming}"


def MergeGlobalCard(connection: sqlite3.Connection, existingCard: sqlite3.Row, incomingCard: Dict[str, Any]) -> bool:
    mergedValues = {
        "kanji": MergeOptionalText(existingCard["kanji"], incomingCard.get("kanji", "")),
        "kana": MergeOptionalText(existingCard["kana"], incomingCard.get("kana", "")),
        "english": MergeOptionalText(existingCard["english"], incomingCard.get("english", "")),
        "notes": MergeNotes(existingCard["notes"], incomingCard.get("notes", "")),
        "kanji_masu": MergeOptionalText(existingCard["kanji_masu"], incomingCard.get("kanji_masu", "")),
        "kana_masu": MergeOptionalText(existingCard["kana_masu"], incomingCard.get("kana_masu", "")),
        "kanji_te": MergeOptionalText(existingCard["kanji_te"], incomingCard.get("kanji_te", "")),
        "kana_te": MergeOptionalText(existingCard["kana_te"], incomingCard.get("kana_te", "")),
        "kanji_past": MergeOptionalText(existingCard["kanji_past"], incomingCard.get("kanji_past", "")),
        "kana_past": MergeOptionalText(existingCard["kana_past"], incomingCard.get("kana_past", "")),
        "kanji_negative": MergeOptionalText(
            existingCard["kanji_negative"],
            incomingCard.get("kanji_negative", ""),
        ),
        "kana_negative": MergeOptionalText(
            existingCard["kana_negative"],
            incomingCard.get("kana_negative", ""),
        ),
        "dictionary_entry_id": MergeOptionalText(
            existingCard["dictionary_entry_id"],
            incomingCard.get("dictionary_entry_id", ""),
        ),
        "dictionary_headword": MergeOptionalText(
            existingCard["dictionary_headword"],
            incomingCard.get("dictionary_headword", ""),
        ),
        "dictionary_reading": MergeOptionalText(
            existingCard["dictionary_reading"],
            incomingCard.get("dictionary_reading", ""),
        ),
        "dictionary_gloss": MergeOptionalText(
            existingCard["dictionary_gloss"],
            incomingCard.get("dictionary_gloss", ""),
        ),
        "dictionary_pos": MergeOptionalText(
            existingCard["dictionary_pos"],
            incomingCard.get("dictionary_pos", ""),
        ),
        "verb_type": MergeOptionalText(existingCard["verb_type"], incomingCard.get("verb_type", "")),
    }
    mergedDictionaryPosTags = NormalizeDictionaryPosTags(
        DecodeJsonStringList(existingCard["dictionary_pos_tags"])
        + NormalizeDictionaryPosTags(incomingCard.get("dictionary_pos_tags") or [])
    )
    mergedImageFiles = NormalizeStringList(
        DecodeJsonStringList(existingCard["image_files_json"]) + NormalizeStringList(incomingCard.get("image_files") or [])
    )
    mergedVideoFiles = NormalizeStringList(
        DecodeJsonStringList(existingCard["video_files_json"]) + NormalizeStringList(incomingCard.get("video_files") or [])
    )
    mergedTags = NormalizeStringList(
        DecodeJsonStringList(existingCard["tags_json"]) + NormalizeStringList(incomingCard.get("tags") or [])
    )

    hasChanges = False
    for key, mergedValue in mergedValues.items():
        if (existingCard[key] or "").strip() != mergedValue:
            hasChanges = True
            break
    if not hasChanges and mergedImageFiles != DecodeJsonStringList(existingCard["image_files_json"]):
        hasChanges = True
    if not hasChanges and mergedVideoFiles != DecodeJsonStringList(existingCard["video_files_json"]):
        hasChanges = True
    if not hasChanges and mergedTags != DecodeJsonStringList(existingCard["tags_json"]):
        hasChanges = True
    if not hasChanges and mergedDictionaryPosTags != DecodeJsonStringList(existingCard["dictionary_pos_tags"]):
        hasChanges = True

    if not hasChanges:
        return False

    connection.execute(
        """
        UPDATE global_cards
        SET
            kanji = ?,
            kana = ?,
            english = ?,
            notes = ?,
            kanji_masu = ?,
            kana_masu = ?,
            kanji_te = ?,
            kana_te = ?,
            kanji_past = ?,
            kana_past = ?,
            kanji_negative = ?,
            kana_negative = ?,
            image_files_json = ?,
            video_files_json = ?,
            tags_json = ?,
            dictionary_entry_id = ?,
            dictionary_headword = ?,
            dictionary_reading = ?,
            dictionary_gloss = ?,
            dictionary_pos = ?,
            dictionary_pos_tags = ?,
            verb_type = ?
        WHERE id = ?
        """,
        (
            mergedValues["kanji"],
            mergedValues["kana"],
            mergedValues["english"],
            mergedValues["notes"],
            mergedValues["kanji_masu"],
            mergedValues["kana_masu"],
            mergedValues["kanji_te"],
            mergedValues["kana_te"],
            mergedValues["kanji_past"],
            mergedValues["kana_past"],
            mergedValues["kanji_negative"],
            mergedValues["kana_negative"],
            json.dumps(mergedImageFiles, ensure_ascii=False),
            json.dumps(mergedVideoFiles, ensure_ascii=False),
            json.dumps(mergedTags, ensure_ascii=False),
            mergedValues["dictionary_entry_id"],
            mergedValues["dictionary_headword"],
            mergedValues["dictionary_reading"],
            mergedValues["dictionary_gloss"],
            mergedValues["dictionary_pos"],
            json.dumps(mergedDictionaryPosTags, ensure_ascii=False),
            mergedValues["verb_type"],
            existingCard["id"],
        ),
    )
    connection.commit()
    return True


def ListGlobalCards(connection: sqlite3.Connection) -> List[sqlite3.Row]:
    return list(
        connection.execute(
            "SELECT * FROM global_cards ORDER BY created_at DESC"
        )
    )


def CountGlobalCards(connection: sqlite3.Connection) -> int:
    return int(connection.execute("SELECT COUNT(*) FROM global_cards").fetchone()[0])


def GetGlobalCardsByIds(connection: sqlite3.Connection, globalCardIds: List[str]) -> List[sqlite3.Row]:
    if not globalCardIds:
        return []
    placeholders = ", ".join(["?"] * len(globalCardIds))
    return list(
        connection.execute(
            f"SELECT * FROM global_cards WHERE id IN ({placeholders})",
            globalCardIds,
        )
    )


def BuildDeckCardPayloadFromGlobalCard(
    globalCard: sqlite3.Row,
    schemaKey: str,
    requestedWordForm: str,
    extraTags: Optional[List[str]] = None,
) -> Dict[str, Any]:
    kanji, kana, appliedWordForm = SelectSurfaceFromGlobalCard(globalCard, requestedWordForm)
    imageFiles = DecodeJsonStringList(globalCard["image_files_json"])
    videoFiles = DecodeJsonStringList(globalCard["video_files_json"])
    mediaFiles = NormalizeStringList([*imageFiles, *videoFiles])
    mediaType = BuildMediaTypeFromGlobalCard(imageFiles, videoFiles)
    baseTags = DecodeJsonStringList(globalCard["tags_json"])
    tags = NormalizeStringList([*baseTags, *(extraTags or []), "global_pool"])

    return {
        "kanji": kanji,
        "kana": kana,
        "english": (globalCard["english"] or "").strip(),
        "notes": (globalCard["notes"] or "").strip(),
        "source_text": f"global:{globalCard['id']}",
        "schema_key": (schemaKey or "").strip() or "kana_kanji_front_english_back",
        "media_type": mediaType,
        "media_files": mediaFiles,
        "tags": tags,
        "dictionary_entry_id": (globalCard["dictionary_entry_id"] or "").strip(),
        "dictionary_headword": (globalCard["dictionary_headword"] or "").strip(),
        "dictionary_reading": (globalCard["dictionary_reading"] or "").strip(),
        "dictionary_gloss": (globalCard["dictionary_gloss"] or "").strip(),
        "dictionary_pos": (globalCard["dictionary_pos"] or "").strip(),
        "dictionary_pos_tags": DecodeJsonStringList(globalCard["dictionary_pos_tags"]),
        "verb_type": (globalCard["verb_type"] or "").strip(),
        "word_form": appliedWordForm,
    }


def ImportDeckCardsToGlobal(connection: sqlite3.Connection, deckId: str) -> Tuple[int, int]:
    cards = GetDeckCards(connection, deckId)
    added = 0
    skipped = 0
    for card in cards:
        sourceWordForm = (card["word_form"] or "dictionary").strip() or "dictionary"
        baseKanji = (card["dictionary_headword"] or "").strip() or (card["kanji"] or "").strip()
        baseKana = (card["dictionary_reading"] or "").strip() or (card["kana"] or "").strip()
        if not baseKanji or not baseKana:
            skipped += 1
            continue

        mediaFiles = DecodeJsonStringList(card["media_files_json"])
        imageFiles: List[str] = []
        videoFiles: List[str] = []
        mediaType = (card["media_type"] or "").strip()
        if mediaType == "image":
            imageFiles = NormalizeStringList(mediaFiles)
        elif mediaType == "video":
            videoFiles = NormalizeStringList(mediaFiles)
        else:
            for mediaPath in mediaFiles:
                suffix = Path(mediaPath).suffix.lower()
                if suffix in SupportedImageExtensions:
                    imageFiles.append(mediaPath)
                elif suffix in SupportedVideoExtensions:
                    videoFiles.append(mediaPath)
            imageFiles = NormalizeStringList(imageFiles)
            videoFiles = NormalizeStringList(videoFiles)

        globalCard: Dict[str, Any] = {
            "kanji": baseKanji,
            "kana": baseKana,
            "english": (card["dictionary_gloss"] or "").strip() or (card["english"] or "").strip(),
            "notes": (card["notes"] or "").strip(),
            "kanji_masu": "",
            "kana_masu": "",
            "kanji_te": "",
            "kana_te": "",
            "kanji_past": "",
            "kana_past": "",
            "kanji_negative": "",
            "kana_negative": "",
            "image_files": imageFiles,
            "video_files": videoFiles,
            "tags": DecodeJsonStringList(card["tags_json"]),
            "dictionary_entry_id": (card["dictionary_entry_id"] or "").strip(),
            "dictionary_headword": (card["dictionary_headword"] or "").strip(),
            "dictionary_reading": (card["dictionary_reading"] or "").strip(),
            "dictionary_gloss": (card["dictionary_gloss"] or "").strip(),
            "dictionary_pos": (card["dictionary_pos"] or "").strip(),
            "dictionary_pos_tags": DecodeJsonStringList(card["dictionary_pos_tags"]),
            "verb_type": (card["verb_type"] or "").strip(),
        }

        if sourceWordForm in WordFormFieldByKey and sourceWordForm != "dictionary":
            kanjiField, kanaField = WordFormFieldByKey[sourceWordForm]
            globalCard[kanjiField] = (card["kanji"] or "").strip()
            globalCard[kanaField] = (card["kana"] or "").strip()

        existingGlobalCard = GetGlobalCardBySurface(connection, baseKanji, baseKana)
        if existingGlobalCard is not None:
            isMerged = MergeGlobalCard(connection, existingGlobalCard, globalCard)
            added += int(isMerged)
            skipped += int(not isMerged)
            continue

        isAdded = AddGlobalCard(connection, globalCard)
        added += int(isAdded)
        skipped += int(not isAdded)

    return added, skipped


def ImportGlobalCardsToDeck(
    connection: sqlite3.Connection,
    deckId: str,
    globalCardIds: List[str],
    schemaKey: str,
    requestedWordForm: str,
    extraTags: Optional[List[str]] = None,
) -> Tuple[int, int]:
    globalCards = GetGlobalCardsByIds(connection, globalCardIds)
    added = 0
    skipped = 0
    for globalCard in globalCards:
        deckCard = BuildDeckCardPayloadFromGlobalCard(
            globalCard,
            schemaKey,
            requestedWordForm,
            extraTags=extraTags or [],
        )
        if not (deckCard.get("kanji") or "").strip() or not (deckCard.get("kana") or "").strip():
            skipped += 1
            continue

        isAdded = AddCard(connection, deckId, deckCard)
        added += int(isAdded)
        skipped += int(not isAdded)

    return added, skipped


def UpdateCardContent(
    connection: sqlite3.Connection,
    deckId: str,
    cardId: str,
    kanji: str,
    kana: str,
    english: str,
    notes: str,
    schemaKey: str,
) -> bool:
    normalizedKanji = (kanji or "").strip()
    normalizedKana = (kana or "").strip()
    normalizedEnglish = (english or "").strip()
    normalizedNotes = (notes or "").strip()
    normalizedSchemaKey = (schemaKey or "").strip() or "kana_kanji_front_english_back"

    if CardWordExistsInSchema(
        connection,
        deckId,
        normalizedSchemaKey,
        normalizedKanji,
        normalizedKana,
        excludeCardId=cardId,
    ):
        return False

    uniqueKey = BuildCardUniqueKey(normalizedSchemaKey, normalizedKanji, normalizedKana)
    try:
        cursor = connection.execute(
            """
            UPDATE cards
            SET kanji = ?, kana = ?, english = ?, notes = ?, schema_key = ?, unique_key = ?
            WHERE id = ? AND deck_id = ?
            """,
            (
                normalizedKanji,
                normalizedKana,
                normalizedEnglish,
                normalizedNotes,
                normalizedSchemaKey,
                uniqueKey,
                cardId,
                deckId,
            ),
        )
        connection.commit()
        return max(cursor.rowcount, 0) > 0
    except sqlite3.IntegrityError:
        return False


def UpdateCardField(connection: sqlite3.Connection, cardId: str, fieldName: str, value: str) -> None:
    if fieldName not in AllowedCardFieldsToUpdate:
        raise ValueError("Invalid field")

    if fieldName not in {"kanji", "kana", "schema_key"}:
        connection.execute(f"UPDATE cards SET {fieldName} = ? WHERE id = ?", (value, cardId))
        connection.commit()
        return

    cardRow = connection.execute(
        "SELECT deck_id, schema_key, kanji, kana FROM cards WHERE id = ?",
        (cardId,),
    ).fetchone()
    if cardRow is None:
        raise RuntimeError("Card not found.")

    updatedSchemaKey = cardRow["schema_key"]
    updatedKanji = cardRow["kanji"]
    updatedKana = cardRow["kana"]

    if fieldName == "schema_key":
        updatedSchemaKey = value
    elif fieldName == "kanji":
        updatedKanji = value
    elif fieldName == "kana":
        updatedKana = value

    if CardWordExistsInSchema(
        connection,
        cardRow["deck_id"],
        updatedSchemaKey,
        updatedKanji,
        updatedKana,
        excludeCardId=cardId,
    ):
        raise sqlite3.IntegrityError("Duplicate word in the selected card format.")

    uniqueKey = BuildCardUniqueKey(updatedSchemaKey, updatedKanji, updatedKana)
    connection.execute(
        f"UPDATE cards SET {fieldName} = ?, unique_key = ? WHERE id = ?",
        (value, uniqueKey, cardId),
    )
    connection.commit()


def UpdateCardMedia(connection: sqlite3.Connection, cardId: str, mediaType: str, mediaFiles: List[str]) -> None:
    connection.execute(
        "UPDATE cards SET media_type = ?, media_files_json = ? WHERE id = ?",
        (mediaType, json.dumps(mediaFiles, ensure_ascii=False), cardId),
    )
    connection.commit()


def UpdateCardsSchemaByIds(
    connection: sqlite3.Connection,
    deckId: str,
    cardIds: List[str],
    schemaKey: str,
) -> int:
    if not cardIds:
        return 0

    placeholders = ", ".join(["?"] * len(cardIds))
    selectedRows = connection.execute(
        f"SELECT id, kanji, kana FROM cards WHERE deck_id = ? AND id IN ({placeholders})",
        [deckId, *cardIds],
    ).fetchall()

    updatedCount = 0
    for row in selectedRows:
        if CardWordExistsInSchema(
            connection,
            deckId,
            schemaKey,
            row["kanji"],
            row["kana"],
            excludeCardId=row["id"],
        ):
            continue

        uniqueKey = BuildCardUniqueKey(schemaKey, row["kanji"], row["kana"])
        cursor = connection.execute(
            "UPDATE cards SET schema_key = ?, unique_key = ? WHERE deck_id = ? AND id = ?",
            (schemaKey, uniqueKey, deckId, row["id"]),
        )
        updatedCount += max(cursor.rowcount, 0)

    connection.commit()
    return updatedCount


def DeleteCardsByIds(connection: sqlite3.Connection, deckId: str, cardIds: List[str]) -> int:
    if not cardIds:
        return 0

    placeholders = ", ".join(["?"] * len(cardIds))
    parameters: List[str] = [deckId, *cardIds]
    cursor = connection.execute(
        f"DELETE FROM cards WHERE deck_id = ? AND id IN ({placeholders})",
        parameters,
    )
    connection.commit()
    return max(cursor.rowcount, 0)


def DeleteGlobalCardsByIds(connection: sqlite3.Connection, globalCardIds: List[str]) -> int:
    if not globalCardIds:
        return 0

    placeholders = ", ".join(["?"] * len(globalCardIds))
    cursor = connection.execute(
        f"DELETE FROM global_cards WHERE id IN ({placeholders})",
        list(globalCardIds),
    )
    connection.commit()
    return max(cursor.rowcount, 0)


def DeckNameToId(connection: sqlite3.Connection, collectionName: str, deckName: str) -> Optional[str]:
    row = connection.execute(
        """
        SELECT decks.id
        FROM decks
        JOIN collections ON collections.id = decks.collection_id
        WHERE collections.name = ? AND decks.name = ?
        """,
        (collectionName, deckName),
    ).fetchone()
    return row[0] if row else None


def DeckHasCandidate(connection: sqlite3.Connection, deckId: str, card: Dict[str, Any]) -> bool:
    schemaKey = card.get("schema_key") or "kana_kanji_front_english_back"
    kanji = card.get("kanji", "")
    kana = card.get("kana", "")
    return CardWordExistsInSchema(connection, deckId, schemaKey, kanji, kana)


def DeckHasKanjiWordForm(
    connection: sqlite3.Connection,
    deckId: str,
    schemaKey: str,
    wordForm: str,
    kanji: str,
) -> bool:
    normalizedKanji = (kanji or "").strip()
    if not normalizedKanji:
        return False

    row = connection.execute(
        """
        SELECT 1
        FROM cards
        WHERE deck_id = ?
          AND schema_key = ?
          AND word_form = ?
          AND lower(trim(kanji)) = lower(trim(?))
        LIMIT 1
        """,
        (
            deckId,
            (schemaKey or "").strip() or "kana_kanji_front_english_back",
            (wordForm or "dictionary").strip() or "dictionary",
            normalizedKanji,
        ),
    ).fetchone()
    return row is not None


def SerializeAiScenarioRow(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "deck_id": (row["deck_id"] or "").strip(),
        "mode": (row["mode"] or "").strip(),
        "title": (row["title"] or "").strip(),
        "summary": (row["summary"] or "").strip(),
        "topic_hint": (row["topic_hint"] or "").strip(),
        "difficulty": (row["difficulty"] or "").strip(),
        "style": (row["style"] or "").strip(),
        "question_count": int(row["question_count"] or 0),
        "tags": DecodeJsonStringList(row["tags_json"]),
        "is_custom": bool(row["is_custom"]),
        "times_used": int(row["times_used"] or 0),
        "times_completed": int(row["times_completed"] or 0),
        "created_at": float(row["created_at"] or 0),
        "updated_at": float(row["updated_at"] or 0),
        "has_cached_material": bool(row["has_cached_material"]) if "has_cached_material" in row.keys() else False,
        "reading_material_updated_at": float(row["reading_material_updated_at"] or 0)
        if "reading_material_updated_at" in row.keys()
        else 0.0,
    }


def GetAiScenario(connection: sqlite3.Connection, scenarioId: str) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT
            ai_scenarios.*,
            CASE WHEN reading_materials.id IS NULL THEN 0 ELSE 1 END AS has_cached_material,
            COALESCE(reading_materials.updated_at, 0) AS reading_material_updated_at
        FROM ai_scenarios
        LEFT JOIN reading_materials ON reading_materials.scenario_id = ai_scenarios.id
        WHERE ai_scenarios.id = ?
        LIMIT 1
        """,
        (scenarioId,),
    ).fetchone()
    if row is None:
        raise RuntimeError("Scenario not found.")
    return row


def ListAiScenarios(connection: sqlite3.Connection, deckId: str, mode: str) -> List[Dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT
            ai_scenarios.*,
            CASE WHEN reading_materials.id IS NULL THEN 0 ELSE 1 END AS has_cached_material,
            COALESCE(reading_materials.updated_at, 0) AS reading_material_updated_at
        FROM ai_scenarios
        LEFT JOIN reading_materials ON reading_materials.scenario_id = ai_scenarios.id
        WHERE ai_scenarios.deck_id = ?
          AND ai_scenarios.mode = ?
        ORDER BY ai_scenarios.is_custom DESC, ai_scenarios.times_completed DESC,
                 ai_scenarios.times_used ASC, ai_scenarios.updated_at DESC, ai_scenarios.created_at DESC
        """,
        (deckId, mode),
    ).fetchall()
    return [SerializeAiScenarioRow(row) for row in rows]


def SaveAiScenario(
    connection: sqlite3.Connection,
    deckId: str,
    mode: str,
    title: str,
    summary: str,
    topicHint: str,
    difficulty: str,
    style: str,
    questionCount: int,
    tags: List[str],
    isCustom: bool = False,
) -> Dict[str, Any]:
    normalizedDeckId = (deckId or "").strip()
    normalizedMode = (mode or "").strip()
    normalizedTitle = (title or "").strip()
    normalizedSummary = (summary or "").strip()
    normalizedTopicHint = (topicHint or "").strip()
    normalizedDifficulty = (difficulty or "intermediate").strip() or "intermediate"
    normalizedStyle = (style or "").strip()
    normalizedQuestionCount = max(1, int(questionCount or 1))
    normalizedTags = NormalizeStringList(tags or [])

    if not normalizedDeckId or not normalizedMode or not normalizedTitle:
        raise RuntimeError("deckId, mode, and title are required.")

    existingRow = connection.execute(
        """
        SELECT id
        FROM ai_scenarios
        WHERE deck_id = ?
          AND mode = ?
          AND title = ?
          AND topic_hint = ?
          AND difficulty = ?
          AND style = ?
        LIMIT 1
        """,
        (
            normalizedDeckId,
            normalizedMode,
            normalizedTitle,
            normalizedTopicHint,
            normalizedDifficulty,
            normalizedStyle,
        ),
    ).fetchone()

    now = time.time()
    if existingRow is None:
        scenarioId = str(uuid.uuid4())
        connection.execute(
            """
            INSERT INTO ai_scenarios (
                id, deck_id, mode, title, summary, topic_hint, difficulty, style,
                question_count, tags_json, is_custom, times_used, times_completed,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
            """,
            (
                scenarioId,
                normalizedDeckId,
                normalizedMode,
                normalizedTitle,
                normalizedSummary,
                normalizedTopicHint,
                normalizedDifficulty,
                normalizedStyle,
                normalizedQuestionCount,
                json.dumps(normalizedTags, ensure_ascii=False),
                int(bool(isCustom)),
                now,
                now,
            ),
        )
    else:
        scenarioId = existingRow["id"]
        currentRow = GetAiScenario(connection, scenarioId)
        mergedTags = NormalizeStringList(
            DecodeJsonStringList(currentRow["tags_json"]) + normalizedTags
        )
        connection.execute(
            """
            UPDATE ai_scenarios
            SET summary = ?,
                question_count = ?,
                tags_json = ?,
                is_custom = CASE WHEN is_custom = 1 OR ? = 1 THEN 1 ELSE 0 END,
                updated_at = ?
            WHERE id = ?
            """,
            (
                normalizedSummary or (currentRow["summary"] or "").strip(),
                normalizedQuestionCount or int(currentRow["question_count"] or 0),
                json.dumps(mergedTags, ensure_ascii=False),
                int(bool(isCustom)),
                now,
                scenarioId,
            ),
        )

    connection.commit()
    return SerializeAiScenarioRow(GetAiScenario(connection, scenarioId))


def IncrementAiScenarioUsage(connection: sqlite3.Connection, scenarioId: str) -> None:
    connection.execute(
        """
        UPDATE ai_scenarios
        SET times_used = times_used + 1,
            updated_at = ?
        WHERE id = ?
        """,
        (time.time(), scenarioId),
    )
    connection.commit()


def IncrementAiScenarioCompletion(connection: sqlite3.Connection, scenarioId: str) -> None:
    connection.execute(
        """
        UPDATE ai_scenarios
        SET times_completed = times_completed + 1,
            updated_at = ?
        WHERE id = ?
        """,
        (time.time(), scenarioId),
    )
    connection.commit()


def SerializeReadingMaterialRow(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "scenario_id": (row["scenario_id"] or "").strip(),
        "deck_id": (row["deck_id"] or "").strip(),
        "title": (row["title"] or "").strip(),
        "source_note": (row["source_note"] or "").strip(),
        "passage": (row["passage"] or "").strip(),
        "new_words": DecodeJsonObjectList(row["new_words_json"]),
        "created_at": float(row["created_at"] or 0),
        "updated_at": float(row["updated_at"] or 0),
    }


def GetReadingMaterialByScenarioId(
    connection: sqlite3.Connection,
    scenarioId: str,
) -> Optional[Dict[str, Any]]:
    row = connection.execute(
        "SELECT * FROM reading_materials WHERE scenario_id = ? LIMIT 1",
        (scenarioId,),
    ).fetchone()
    if row is None:
        return None
    return SerializeReadingMaterialRow(row)


def SaveReadingMaterial(
    connection: sqlite3.Connection,
    scenarioId: str,
    deckId: str,
    title: str,
    sourceNote: str,
    passage: str,
    newWords: List[Dict[str, Any]],
) -> Dict[str, Any]:
    normalizedScenarioId = (scenarioId or "").strip()
    normalizedDeckId = (deckId or "").strip()
    normalizedTitle = (title or "").strip()
    normalizedSourceNote = (sourceNote or "").strip()
    normalizedPassage = (passage or "").strip()
    normalizedNewWords = [dict(item) for item in (newWords or []) if isinstance(item, dict)]

    if not normalizedScenarioId or not normalizedDeckId or not normalizedPassage:
        raise RuntimeError("scenarioId, deckId, and passage are required.")

    existingRow = connection.execute(
        "SELECT id FROM reading_materials WHERE scenario_id = ? LIMIT 1",
        (normalizedScenarioId,),
    ).fetchone()
    now = time.time()
    if existingRow is None:
        materialId = str(uuid.uuid4())
        connection.execute(
            """
            INSERT INTO reading_materials (
                id, scenario_id, deck_id, title, source_note, passage,
                new_words_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                materialId,
                normalizedScenarioId,
                normalizedDeckId,
                normalizedTitle,
                normalizedSourceNote,
                normalizedPassage,
                json.dumps(normalizedNewWords, ensure_ascii=False),
                now,
                now,
            ),
        )
    else:
        materialId = existingRow["id"]
        connection.execute(
            """
            UPDATE reading_materials
            SET title = ?,
                source_note = ?,
                passage = ?,
                new_words_json = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                normalizedTitle,
                normalizedSourceNote,
                normalizedPassage,
                json.dumps(normalizedNewWords, ensure_ascii=False),
                now,
                materialId,
            ),
        )

    connection.commit()
    row = connection.execute(
        "SELECT * FROM reading_materials WHERE id = ? LIMIT 1",
        (materialId,),
    ).fetchone()
    if row is None:
        raise RuntimeError("Reading material was not saved.")
    return SerializeReadingMaterialRow(row)


def SerializeConversationSessionRow(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "scenario_id": (row["scenario_id"] or "").strip(),
        "deck_id": (row["deck_id"] or "").strip(),
        "messages": DecodeJsonObjectList(row["messages_json"]),
        "summary": DecodeJsonObject(row["summary_json"]),
        "status": (row["status"] or "").strip(),
        "created_at": float(row["created_at"] or 0),
        "updated_at": float(row["updated_at"] or 0),
    }


def GetConversationSession(connection: sqlite3.Connection, sessionId: str) -> sqlite3.Row:
    row = connection.execute(
        "SELECT * FROM conversation_sessions WHERE id = ? LIMIT 1",
        (sessionId,),
    ).fetchone()
    if row is None:
        raise RuntimeError("Conversation session not found.")
    return row


def CreateConversationSession(
    connection: sqlite3.Connection,
    scenarioId: str,
    deckId: str,
    messages: List[Dict[str, Any]],
) -> Dict[str, Any]:
    now = time.time()
    sessionId = str(uuid.uuid4())
    connection.execute(
        """
        INSERT INTO conversation_sessions (
            id, scenario_id, deck_id, messages_json, summary_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, '{}', 'active', ?, ?)
        """,
        (
            sessionId,
            (scenarioId or "").strip(),
            (deckId or "").strip(),
            json.dumps([dict(item) for item in (messages or []) if isinstance(item, dict)], ensure_ascii=False),
            now,
            now,
        ),
    )
    connection.commit()
    return SerializeConversationSessionRow(GetConversationSession(connection, sessionId))


def UpdateConversationSession(
    connection: sqlite3.Connection,
    sessionId: str,
    messages: List[Dict[str, Any]],
    summary: Optional[Dict[str, Any]] = None,
    status: Optional[str] = None,
) -> Dict[str, Any]:
    currentRow = GetConversationSession(connection, sessionId)
    nextSummary = summary if summary is not None else DecodeJsonObject(currentRow["summary_json"])
    nextStatus = (status or currentRow["status"] or "active").strip() or "active"
    connection.execute(
        """
        UPDATE conversation_sessions
        SET messages_json = ?,
            summary_json = ?,
            status = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            json.dumps([dict(item) for item in (messages or []) if isinstance(item, dict)], ensure_ascii=False),
            json.dumps(nextSummary, ensure_ascii=False),
            nextStatus,
            time.time(),
            sessionId,
        ),
    )
    connection.commit()
    return SerializeConversationSessionRow(GetConversationSession(connection, sessionId))


def GetDashboardRows(connection: sqlite3.Connection) -> List[sqlite3.Row]:
    return connection.execute(
        """
        SELECT collections.name AS collection_name, decks.name AS deck_name, COUNT(cards.id) AS card_count
        FROM decks
        JOIN collections ON collections.id = decks.collection_id
        LEFT JOIN cards ON cards.deck_id = decks.id
        GROUP BY decks.id
        ORDER BY collections.name, decks.name
        """
    ).fetchall()


def GetTotalDeckCount(connection: sqlite3.Connection) -> int:
    return int(connection.execute("SELECT COUNT(*) FROM decks").fetchone()[0])


def GetTotalCardCount(connection: sqlite3.Connection) -> int:
    return int(connection.execute("SELECT COUNT(*) FROM cards").fetchone()[0])
