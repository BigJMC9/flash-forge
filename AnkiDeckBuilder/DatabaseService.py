import hashlib
import json
import re
import secrets
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from AnkiDeckBuilder.AppConfig import (
    CardSchemaFields,
    CardSchemas,
    DatabasePath,
    DefaultSchemaKey,
    SupportedImageExtensions,
    SupportedVideoExtensions,
)
from AnkiDeckBuilder.WorkspaceService import EnsureWorkspaceDirectories

AllowedCardFieldsToUpdate = {
    "kanji",
    "kana",
    "english",
    "notes",
    "schema_key",
    "media_type",
    "kanji_on_readings",
    "kanji_kun_readings",
    "kanji_nanori_readings",
    "radical_position",
}
CollectionColumnDefinitions = {
    "owner_user_id": "TEXT NOT NULL DEFAULT ''",
    "display_name": "TEXT NOT NULL DEFAULT ''",
}
DeckColumnDefinitions = {
    "owner_user_id": "TEXT NOT NULL DEFAULT ''",
    "display_name": "TEXT NOT NULL DEFAULT ''",
}
CardColumnDefinitions = {
    "dictionary_entry_id": "TEXT NOT NULL DEFAULT ''",
    "dictionary_headword": "TEXT NOT NULL DEFAULT ''",
    "dictionary_reading": "TEXT NOT NULL DEFAULT ''",
    "dictionary_gloss": "TEXT NOT NULL DEFAULT ''",
    "dictionary_pos": "TEXT NOT NULL DEFAULT ''",
    "dictionary_pos_tags": "TEXT NOT NULL DEFAULT '[]'",
    "verb_type": "TEXT NOT NULL DEFAULT ''",
    "word_form": "TEXT NOT NULL DEFAULT 'dictionary'",
    "kanji_on_readings": "TEXT NOT NULL DEFAULT ''",
    "kanji_kun_readings": "TEXT NOT NULL DEFAULT ''",
    "kanji_nanori_readings": "TEXT NOT NULL DEFAULT ''",
    "radical_position": "TEXT NOT NULL DEFAULT ''",
}
GlobalCardColumnDefinitions = {
    "owner_user_id": "TEXT NOT NULL DEFAULT ''",
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
    "kanji_on_readings": "TEXT NOT NULL DEFAULT ''",
    "kanji_kun_readings": "TEXT NOT NULL DEFAULT ''",
    "kanji_nanori_readings": "TEXT NOT NULL DEFAULT ''",
    "radical_position": "TEXT NOT NULL DEFAULT ''",
    "unique_key": "TEXT NOT NULL DEFAULT ''",
    "created_at": "REAL NOT NULL DEFAULT 0",
}
CustomCardSchemaColumnDefinitions = {
    "owner_user_id": "TEXT NOT NULL DEFAULT ''",
    "label": "TEXT NOT NULL DEFAULT ''",
    "front_fields_json": "TEXT NOT NULL DEFAULT '[]'",
    "back_fields_json": "TEXT NOT NULL DEFAULT '[]'",
    "field_labels_json": "TEXT NOT NULL DEFAULT '{}'",
    "created_at": "REAL NOT NULL DEFAULT 0",
    "updated_at": "REAL NOT NULL DEFAULT 0",
}
AiScenarioColumnDefinitions = {
    "owner_user_id": "TEXT NOT NULL DEFAULT ''",
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
    "owner_user_id": "TEXT NOT NULL DEFAULT ''",
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
    "owner_user_id": "TEXT NOT NULL DEFAULT ''",
    "scenario_id": "TEXT NOT NULL DEFAULT ''",
    "deck_id": "TEXT NOT NULL DEFAULT ''",
    "messages_json": "TEXT NOT NULL DEFAULT '[]'",
    "summary_json": "TEXT NOT NULL DEFAULT '{}'",
    "status": "TEXT NOT NULL DEFAULT 'active'",
    "created_at": "REAL NOT NULL DEFAULT 0",
    "updated_at": "REAL NOT NULL DEFAULT 0",
}
UserColumnDefinitions = {
    "username": "TEXT NOT NULL DEFAULT ''",
    "email": "TEXT NOT NULL DEFAULT ''",
    "password_salt": "TEXT NOT NULL DEFAULT ''",
    "password_hash": "TEXT NOT NULL DEFAULT ''",
    "is_admin": "INTEGER NOT NULL DEFAULT 0",
    "can_use_ai": "INTEGER NOT NULL DEFAULT 1",
    "can_use_ocr": "INTEGER NOT NULL DEFAULT 0",
    "is_active": "INTEGER NOT NULL DEFAULT 1",
    "created_at": "REAL NOT NULL DEFAULT 0",
    "updated_at": "REAL NOT NULL DEFAULT 0",
}
UserSessionColumnDefinitions = {
    "user_id": "TEXT NOT NULL DEFAULT ''",
    "token_hash": "TEXT NOT NULL DEFAULT ''",
    "expires_at": "REAL NOT NULL DEFAULT 0",
    "created_at": "REAL NOT NULL DEFAULT 0",
    "last_seen_at": "REAL NOT NULL DEFAULT 0",
}
DeckCollaboratorColumnDefinitions = {
    "deck_id": "TEXT NOT NULL DEFAULT ''",
    "user_id": "TEXT NOT NULL DEFAULT ''",
    "role": "TEXT NOT NULL DEFAULT 'editor'",
    "created_at": "REAL NOT NULL DEFAULT 0",
}
DeckInviteColumnDefinitions = {
    "deck_id": "TEXT NOT NULL DEFAULT ''",
    "invited_email": "TEXT NOT NULL DEFAULT ''",
    "invited_username": "TEXT NOT NULL DEFAULT ''",
    "token_hash": "TEXT NOT NULL DEFAULT ''",
    "token_preview": "TEXT NOT NULL DEFAULT ''",
    "invited_by_user_id": "TEXT NOT NULL DEFAULT ''",
    "accepted_by_user_id": "TEXT NOT NULL DEFAULT ''",
    "expires_at": "REAL NOT NULL DEFAULT 0",
    "created_at": "REAL NOT NULL DEFAULT 0",
}
SessionLifetimeSeconds = 60 * 60 * 24 * 14
InviteLifetimeSeconds = 60 * 60 * 24 * 7
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
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA synchronous = NORMAL")
    EnsureDatabaseSchema(connection)
    return connection


def EnsureDatabaseSchema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_salt TEXT NOT NULL DEFAULT '',
            password_hash TEXT NOT NULL DEFAULT '',
            is_admin INTEGER NOT NULL DEFAULT 0,
            can_use_ai INTEGER NOT NULL DEFAULT 1,
            can_use_ocr INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
        """
    )
    EnsureUsersTableColumns(connection)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS user_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            expires_at REAL NOT NULL,
            created_at REAL NOT NULL,
            last_seen_at REAL NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )
    EnsureUserSessionsTableColumns(connection)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS deck_collaborators (
            id TEXT PRIMARY KEY,
            deck_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'editor',
            created_at REAL NOT NULL,
            UNIQUE(deck_id, user_id),
            FOREIGN KEY(deck_id) REFERENCES decks(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )
    EnsureDeckCollaboratorsTableColumns(connection)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS deck_invites (
            id TEXT PRIMARY KEY,
            deck_id TEXT NOT NULL,
            invited_email TEXT NOT NULL DEFAULT '',
            invited_username TEXT NOT NULL DEFAULT '',
            token_hash TEXT UNIQUE NOT NULL,
            token_preview TEXT NOT NULL DEFAULT '',
            invited_by_user_id TEXT NOT NULL,
            accepted_by_user_id TEXT NOT NULL DEFAULT '',
            expires_at REAL NOT NULL,
            created_at REAL NOT NULL,
            FOREIGN KEY(deck_id) REFERENCES decks(id),
            FOREIGN KEY(invited_by_user_id) REFERENCES users(id)
        )
        """
    )
    EnsureDeckInvitesTableColumns(connection)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS collections (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            created_at REAL NOT NULL
        )
        """
    )
    EnsureCollectionsTableColumns(connection)
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
    EnsureDecksTableColumns(connection)
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
            kanji_on_readings TEXT NOT NULL DEFAULT '',
            kanji_kun_readings TEXT NOT NULL DEFAULT '',
            kanji_nanori_readings TEXT NOT NULL DEFAULT '',
            radical_position TEXT NOT NULL DEFAULT '',
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
            kanji_on_readings TEXT NOT NULL DEFAULT '',
            kanji_kun_readings TEXT NOT NULL DEFAULT '',
            kanji_nanori_readings TEXT NOT NULL DEFAULT '',
            radical_position TEXT NOT NULL DEFAULT '',
            unique_key TEXT NOT NULL,
            created_at REAL NOT NULL,
            UNIQUE(unique_key)
        )
        """
    )
    EnsureGlobalCardsTableColumns(connection)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS custom_card_schemas (
            id TEXT PRIMARY KEY,
            owner_user_id TEXT NOT NULL DEFAULT '',
            label TEXT NOT NULL DEFAULT '',
            front_fields_json TEXT NOT NULL DEFAULT '[]',
            back_fields_json TEXT NOT NULL DEFAULT '[]',
            field_labels_json TEXT NOT NULL DEFAULT '{}',
            created_at REAL NOT NULL DEFAULT 0,
            updated_at REAL NOT NULL DEFAULT 0
        )
        """
    )
    EnsureCustomCardSchemasTableColumns(connection)
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_custom_card_schemas_owner
        ON custom_card_schemas(owner_user_id, created_at)
        """
    )
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
    BackfillScopedTemplateColumns(connection)
    connection.commit()


def EnsureCardsTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(cards)").fetchall()
    }
    for columnName, definition in CardColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE cards ADD COLUMN {columnName} {definition}")


def EnsureCollectionsTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(collections)").fetchall()
    }
    for columnName, definition in CollectionColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE collections ADD COLUMN {columnName} {definition}")


def EnsureDecksTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(decks)").fetchall()
    }
    for columnName, definition in DeckColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE decks ADD COLUMN {columnName} {definition}")


def EnsureGlobalCardsTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(global_cards)").fetchall()
    }
    for columnName, definition in GlobalCardColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE global_cards ADD COLUMN {columnName} {definition}")


def EnsureCustomCardSchemasTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(custom_card_schemas)").fetchall()
    }
    for columnName, definition in CustomCardSchemaColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE custom_card_schemas ADD COLUMN {columnName} {definition}")


def EnsureUsersTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(users)").fetchall()
    }
    for columnName, definition in UserColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE users ADD COLUMN {columnName} {definition}")


def EnsureUserSessionsTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(user_sessions)").fetchall()
    }
    for columnName, definition in UserSessionColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE user_sessions ADD COLUMN {columnName} {definition}")


def EnsureDeckCollaboratorsTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(deck_collaborators)").fetchall()
    }
    for columnName, definition in DeckCollaboratorColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE deck_collaborators ADD COLUMN {columnName} {definition}")


def EnsureDeckInvitesTableColumns(connection: sqlite3.Connection) -> None:
    existingColumns = {
        row["name"] for row in connection.execute("PRAGMA table_info(deck_invites)").fetchall()
    }
    for columnName, definition in DeckInviteColumnDefinitions.items():
        if columnName in existingColumns:
            continue
        connection.execute(f"ALTER TABLE deck_invites ADD COLUMN {columnName} {definition}")


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


def BuildGlobalCardUniqueKey(ownerUserId: str, kanji: str, kana: str) -> str:
    raw = "|".join(
        [
            NormalizeText(ownerUserId),
            NormalizeText(kanji),
            NormalizeText(kana),
        ]
    )
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


def BuildBuiltinCardSchemaDefinition(schemaKey: str, definition: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "Key": schemaKey,
        "Label": (definition.get("Label") or schemaKey).strip(),
        "FrontFields": NormalizeCardSchemaFields(definition.get("FrontFields", [])),
        "BackFields": NormalizeCardSchemaFields(definition.get("BackFields", [])),
        "FieldLabels": NormalizeCardSchemaFieldLabels(definition.get("FieldLabels", {})),
        "IsBuiltin": True,
    }


def NormalizeCardSchemaFields(values: List[Any]) -> List[str]:
    allowedFields = set(CardSchemaFields.keys())
    normalizedFields: List[str] = []
    for rawValue in values or []:
        fieldName = str(rawValue or "").strip()
        if not fieldName or fieldName in normalizedFields:
            continue
        if fieldName not in allowedFields:
            raise ValueError(f"Unsupported card schema field: {fieldName}")
        normalizedFields.append(fieldName)
    return normalizedFields


def NormalizeCardSchemaFieldLabels(values: Dict[str, Any]) -> Dict[str, str]:
    if not isinstance(values, dict):
        return {}
    allowedFields = set(CardSchemaFields.keys())
    labels: Dict[str, str] = {}
    for rawFieldName, rawLabel in values.items():
        fieldName = str(rawFieldName or "").strip()
        if fieldName not in allowedFields:
            continue
        label = str(rawLabel or "").strip()
        if not label:
            continue
        labels[fieldName] = label
    return labels


def ValidateCardSchemaShape(frontFields: List[str], backFields: List[str]) -> None:
    if not frontFields:
        raise ValueError("Select at least one front field.")
    if not backFields:
        raise ValueError("Select at least one back field.")
    selectedFields = set(frontFields + backFields)
    for requiredField in ("kanji", "english"):
        if requiredField not in selectedFields:
            label = CardSchemaFields[requiredField]["Label"]
            raise ValueError(f"Custom schemas must include {label}.")


def BuildCustomCardSchemaKey(connection: sqlite3.Connection, label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (label or "").strip().lower()).strip("_")
    slug = slug[:36].strip("_") or "schema"
    while True:
        candidate = f"custom_{slug}_{secrets.token_hex(4)}"
        if candidate in CardSchemas:
            continue
        row = connection.execute(
            "SELECT 1 FROM custom_card_schemas WHERE id = ? LIMIT 1",
            (candidate,),
        ).fetchone()
        if row is None:
            return candidate


def SerializeCardSchemaDefinition(schemaKey: str, definition: Dict[str, Any]) -> Dict[str, Any]:
    frontFields = NormalizeCardSchemaFields(definition.get("FrontFields", []))
    backFields = NormalizeCardSchemaFields(definition.get("BackFields", []))
    return {
        "key": schemaKey,
        "label": (definition.get("Label") or schemaKey).strip(),
        "front_fields": frontFields,
        "back_fields": backFields,
        "field_labels": NormalizeCardSchemaFieldLabels(definition.get("FieldLabels", {})),
        "is_builtin": bool(definition.get("IsBuiltin")),
    }


def BuildCustomCardSchemaDefinition(row: sqlite3.Row) -> Dict[str, Any]:
    frontFields = NormalizeCardSchemaFields(DecodeJsonStringList(row["front_fields_json"]))
    backFields = NormalizeCardSchemaFields(DecodeJsonStringList(row["back_fields_json"]))
    fieldLabels = NormalizeCardSchemaFieldLabels(DecodeJsonObject(row["field_labels_json"]))
    return {
        "Key": row["id"],
        "Label": (row["label"] or row["id"]).strip(),
        "FrontFields": frontFields,
        "BackFields": backFields,
        "FieldLabels": fieldLabels,
        "IsBuiltin": False,
        "OwnerUserId": (row["owner_user_id"] or "").strip(),
    }


def ListCardSchemaDefinitions(connection: sqlite3.Connection, ownerUserId: str = "") -> List[Dict[str, Any]]:
    definitions = [
        BuildBuiltinCardSchemaDefinition(schemaKey, definition)
        for schemaKey, definition in CardSchemas.items()
    ]
    normalizedOwnerUserId = (ownerUserId or "").strip()
    if normalizedOwnerUserId:
        rows = connection.execute(
            """
            SELECT *
            FROM custom_card_schemas
            WHERE owner_user_id = ?
            ORDER BY created_at ASC, label ASC
            """,
            (normalizedOwnerUserId,),
        ).fetchall()
        definitions.extend(BuildCustomCardSchemaDefinition(row) for row in rows)
    return definitions


def ListCardSchemaOptions(connection: sqlite3.Connection, ownerUserId: str = "") -> List[Dict[str, Any]]:
    return [
        SerializeCardSchemaDefinition(definition["Key"], definition)
        for definition in ListCardSchemaDefinitions(connection, ownerUserId)
    ]


def GetCustomCardSchemaRow(connection: sqlite3.Connection, schemaKey: str) -> Optional[sqlite3.Row]:
    normalizedSchemaKey = (schemaKey or "").strip()
    if not normalizedSchemaKey:
        return None
    return connection.execute(
        "SELECT * FROM custom_card_schemas WHERE id = ? LIMIT 1",
        (normalizedSchemaKey,),
    ).fetchone()


def GetCardSchemaDefinition(connection: sqlite3.Connection, schemaKey: str) -> Optional[Dict[str, Any]]:
    normalizedSchemaKey = (schemaKey or "").strip()
    if normalizedSchemaKey in CardSchemas:
        return BuildBuiltinCardSchemaDefinition(normalizedSchemaKey, CardSchemas[normalizedSchemaKey])

    row = GetCustomCardSchemaRow(connection, normalizedSchemaKey)
    if row is None:
        return None
    return BuildCustomCardSchemaDefinition(row)


def ResolveCardSchemaDefinition(connection: sqlite3.Connection, schemaKey: str) -> Dict[str, Any]:
    definition = GetCardSchemaDefinition(connection, schemaKey)
    if definition is not None:
        return definition
    return {
        **BuildBuiltinCardSchemaDefinition(DefaultSchemaKey, CardSchemas[DefaultSchemaKey]),
        "Key": (schemaKey or "").strip() or DefaultSchemaKey,
        "Label": (schemaKey or "").strip() or CardSchemas[DefaultSchemaKey]["Label"],
    }


def CardSchemaUsesField(connection: sqlite3.Connection, schemaKey: str, fieldName: str) -> bool:
    definition = ResolveCardSchemaDefinition(connection, schemaKey)
    return fieldName in set(definition["FrontFields"] + definition["BackFields"])


def CreateCustomCardSchema(
    connection: sqlite3.Connection,
    ownerUserId: str,
    label: str,
    frontFields: List[Any],
    backFields: List[Any],
    fieldLabels: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    normalizedOwnerUserId = (ownerUserId or "").strip()
    normalizedLabel = (label or "").strip()
    if not normalizedOwnerUserId:
        raise ValueError("owner_user_id is required.")
    if not normalizedLabel:
        raise ValueError("Schema name is required.")

    normalizedFrontFields = NormalizeCardSchemaFields(frontFields)
    normalizedBackFields = NormalizeCardSchemaFields(backFields)
    ValidateCardSchemaShape(normalizedFrontFields, normalizedBackFields)
    normalizedFieldLabels = NormalizeCardSchemaFieldLabels(fieldLabels or {})
    schemaKey = BuildCustomCardSchemaKey(connection, normalizedLabel)
    now = time.time()

    connection.execute(
        """
        INSERT INTO custom_card_schemas (
            id, owner_user_id, label, front_fields_json, back_fields_json,
            field_labels_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            schemaKey,
            normalizedOwnerUserId,
            normalizedLabel,
            json.dumps(normalizedFrontFields, ensure_ascii=False),
            json.dumps(normalizedBackFields, ensure_ascii=False),
            json.dumps(normalizedFieldLabels, ensure_ascii=False),
            now,
            now,
        ),
    )
    connection.commit()
    definition = GetCardSchemaDefinition(connection, schemaKey)
    return SerializeCardSchemaDefinition(schemaKey, definition or {})


def UpdateCustomCardSchema(
    connection: sqlite3.Connection,
    ownerUserId: str,
    schemaKey: str,
    label: str,
    frontFields: List[Any],
    backFields: List[Any],
    fieldLabels: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    normalizedOwnerUserId = (ownerUserId or "").strip()
    normalizedSchemaKey = (schemaKey or "").strip()
    normalizedLabel = (label or "").strip()
    if not normalizedOwnerUserId:
        raise ValueError("owner_user_id is required.")
    if not normalizedSchemaKey:
        raise ValueError("schema_key is required.")
    if normalizedSchemaKey in CardSchemas:
        raise ValueError("Built-in schemas cannot be edited.")
    if not normalizedLabel:
        raise ValueError("Schema name is required.")

    existing = connection.execute(
        """
        SELECT 1
        FROM custom_card_schemas
        WHERE id = ? AND owner_user_id = ?
        LIMIT 1
        """,
        (normalizedSchemaKey, normalizedOwnerUserId),
    ).fetchone()
    if existing is None:
        raise ValueError("Custom schema not found.")

    normalizedFrontFields = NormalizeCardSchemaFields(frontFields)
    normalizedBackFields = NormalizeCardSchemaFields(backFields)
    ValidateCardSchemaShape(normalizedFrontFields, normalizedBackFields)
    normalizedFieldLabels = NormalizeCardSchemaFieldLabels(fieldLabels or {})

    connection.execute(
        """
        UPDATE custom_card_schemas
        SET label = ?,
            front_fields_json = ?,
            back_fields_json = ?,
            field_labels_json = ?,
            updated_at = ?
        WHERE id = ? AND owner_user_id = ?
        """,
        (
            normalizedLabel,
            json.dumps(normalizedFrontFields, ensure_ascii=False),
            json.dumps(normalizedBackFields, ensure_ascii=False),
            json.dumps(normalizedFieldLabels, ensure_ascii=False),
            time.time(),
            normalizedSchemaKey,
            normalizedOwnerUserId,
        ),
    )
    connection.commit()
    definition = GetCardSchemaDefinition(connection, normalizedSchemaKey)
    return SerializeCardSchemaDefinition(normalizedSchemaKey, definition or {})


def DeleteCustomCardSchema(connection: sqlite3.Connection, ownerUserId: str, schemaKey: str) -> bool:
    normalizedOwnerUserId = (ownerUserId or "").strip()
    normalizedSchemaKey = (schemaKey or "").strip()
    if not normalizedOwnerUserId:
        raise ValueError("owner_user_id is required.")
    if normalizedSchemaKey in CardSchemas:
        raise ValueError("Built-in schemas cannot be deleted.")
    if not normalizedSchemaKey:
        raise ValueError("schema_key is required.")

    inUse = connection.execute(
        "SELECT 1 FROM cards WHERE schema_key = ? LIMIT 1",
        (normalizedSchemaKey,),
    ).fetchone()
    if inUse is not None:
        raise ValueError("This schema is still used by one or more cards.")

    cursor = connection.execute(
        "DELETE FROM custom_card_schemas WHERE id = ? AND owner_user_id = ?",
        (normalizedSchemaKey, normalizedOwnerUserId),
    )
    connection.commit()
    return cursor.rowcount > 0


def NormalizeEmail(value: str) -> str:
    return NormalizeText(value)


def BuildScopedName(ownerUserId: str, displayName: str) -> str:
    normalizedOwner = (ownerUserId or "").strip()
    normalizedDisplayName = (displayName or "").strip()
    if not normalizedOwner:
        return normalizedDisplayName
    return f"{normalizedOwner}::{normalizedDisplayName}"


def DecodeScopedDisplayName(rawName: str) -> str:
    normalizedName = (rawName or "").strip()
    if "::" not in normalizedName:
        return normalizedName
    return normalizedName.split("::", 1)[1].strip() or normalizedName


def HashToken(token: str) -> str:
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()


def GeneratePasswordSalt() -> str:
    return secrets.token_hex(16)


def HashPassword(password: str, salt: str) -> str:
    derivedKey = hashlib.pbkdf2_hmac(
        "sha256",
        (password or "").encode("utf-8"),
        (salt or "").encode("utf-8"),
        200000,
    )
    return derivedKey.hex()


def VerifyPassword(password: str, salt: str, expectedHash: str) -> bool:
    candidateHash = HashPassword(password, salt)
    return secrets.compare_digest(candidateHash, expectedHash or "")


def SerializeUserRow(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "username": (row["username"] or "").strip(),
        "email": (row["email"] or "").strip(),
        "is_admin": bool(row["is_admin"]),
        "can_use_ai": bool(row["can_use_ai"]),
        "can_use_ocr": bool(row["can_use_ocr"]),
        "is_active": bool(row["is_active"]),
        "created_at": float(row["created_at"] or 0),
        "updated_at": float(row["updated_at"] or 0),
    }


def BackfillScopedTemplateColumns(connection: sqlite3.Connection) -> None:
    for row in connection.execute("SELECT id, name, display_name, owner_user_id FROM collections").fetchall():
        displayName = (row["display_name"] or "").strip() or DecodeScopedDisplayName(row["name"])
        ownerUserId = (row["owner_user_id"] or "").strip()
        if displayName != (row["display_name"] or "").strip():
            connection.execute(
                "UPDATE collections SET display_name = ? WHERE id = ?",
                (displayName, row["id"]),
            )
        if (row["owner_user_id"] or "").strip() != ownerUserId:
            connection.execute(
                "UPDATE collections SET owner_user_id = ? WHERE id = ?",
                (ownerUserId, row["id"]),
            )

    for row in connection.execute(
        """
        SELECT decks.id, decks.name, decks.display_name, decks.owner_user_id, collections.owner_user_id AS collection_owner
        FROM decks
        JOIN collections ON collections.id = decks.collection_id
        """
    ).fetchall():
        displayName = (row["display_name"] or "").strip() or DecodeScopedDisplayName(row["name"])
        ownerUserId = (row["owner_user_id"] or "").strip() or (row["collection_owner"] or "").strip()
        if displayName != (row["display_name"] or "").strip():
            connection.execute(
                "UPDATE decks SET display_name = ? WHERE id = ?",
                (displayName, row["id"]),
            )
        if ownerUserId != (row["owner_user_id"] or "").strip():
            connection.execute(
                "UPDATE decks SET owner_user_id = ? WHERE id = ?",
                (ownerUserId, row["id"]),
            )

    for row in connection.execute("SELECT id, owner_user_id, kanji, kana, unique_key FROM global_cards").fetchall():
        ownerUserId = (row["owner_user_id"] or "").strip()
        uniqueKey = BuildGlobalCardUniqueKey(ownerUserId, row["kanji"], row["kana"])
        if uniqueKey != (row["unique_key"] or "").strip():
            connection.execute(
                "UPDATE global_cards SET unique_key = ?, owner_user_id = ? WHERE id = ?",
                (uniqueKey, ownerUserId, row["id"]),
            )

    for row in connection.execute("SELECT id, owner_user_id FROM ai_scenarios").fetchall():
        if (row["owner_user_id"] or "").strip():
            continue
        connection.execute(
            """
            UPDATE ai_scenarios
            SET owner_user_id = COALESCE(
                (SELECT owner_user_id FROM decks WHERE decks.id = ai_scenarios.deck_id),
                ''
            )
            WHERE id = ?
            """,
            (row["id"],),
        )

    for row in connection.execute("SELECT id, owner_user_id FROM reading_materials").fetchall():
        if (row["owner_user_id"] or "").strip():
            continue
        connection.execute(
            """
            UPDATE reading_materials
            SET owner_user_id = COALESCE(
                (SELECT owner_user_id FROM ai_scenarios WHERE ai_scenarios.id = reading_materials.scenario_id),
                ''
            )
            WHERE id = ?
            """,
            (row["id"],),
        )

    for row in connection.execute("SELECT id, owner_user_id FROM conversation_sessions").fetchall():
        if (row["owner_user_id"] or "").strip():
            continue
        connection.execute(
            """
            UPDATE conversation_sessions
            SET owner_user_id = COALESCE(
                (SELECT owner_user_id FROM ai_scenarios WHERE ai_scenarios.id = conversation_sessions.scenario_id),
                ''
            )
            WHERE id = ?
            """,
            (row["id"],),
        )

    connection.execute("DELETE FROM user_sessions WHERE expires_at <= ?", (time.time(),))


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


def ListCollections(connection: sqlite3.Connection, ownerUserId: str = "") -> List[Dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT
            id,
            owner_user_id,
            COALESCE(NULLIF(display_name, ''), name) AS name,
            created_at
        FROM collections
        WHERE owner_user_id = ?
        ORDER BY COALESCE(NULLIF(display_name, ''), name)
        """,
        ((ownerUserId or "").strip(),),
    ).fetchall()
    return [dict(row) for row in rows]


def ListDecks(
    connection: sqlite3.Connection,
    ownerUserId: str = "",
    collectionId: Optional[str] = None,
    includeCollectionName: bool = False,
    includeCollaborations: bool = True,
) -> List[Dict[str, Any]]:
    normalizedOwnerUserId = (ownerUserId or "").strip()
    parameters: List[str] = [normalizedOwnerUserId]
    if includeCollectionName:
        query = """
            SELECT
                decks.id,
                decks.collection_id,
                decks.owner_user_id,
                COALESCE(NULLIF(decks.display_name, ''), decks.name) AS name,
                decks.created_at,
                COALESCE(NULLIF(collections.display_name, ''), collections.name) AS collection_name,
                CASE WHEN decks.owner_user_id = ? THEN 1 ELSE 0 END AS is_owner
            FROM decks
            JOIN collections ON collections.id = decks.collection_id
        """
    else:
        query = """
            SELECT
                decks.id,
                decks.collection_id,
                decks.owner_user_id,
                COALESCE(NULLIF(decks.display_name, ''), decks.name) AS name,
                decks.created_at,
                CASE WHEN decks.owner_user_id = ? THEN 1 ELSE 0 END AS is_owner
            FROM decks
        """

    accessClause = """
        (
            decks.owner_user_id = ?
            OR (
                ? = 1 AND EXISTS (
                    SELECT 1
                    FROM deck_collaborators
                    WHERE deck_collaborators.deck_id = decks.id
                      AND deck_collaborators.user_id = ?
                )
            )
        )
    """
    parameters.extend([normalizedOwnerUserId, int(bool(includeCollaborations)), normalizedOwnerUserId])
    query += f" WHERE {accessClause}"
    if collectionId:
        query += " AND decks.collection_id = ?"
        parameters.append(collectionId)

    if includeCollectionName:
        query += " ORDER BY collection_name, name"
    else:
        query += " ORDER BY name"
    return [dict(row) for row in connection.execute(query, tuple(parameters))]


def CreateCollection(connection: sqlite3.Connection, name: str, ownerUserId: str = "") -> None:
    displayName = name.strip()
    connection.execute(
        """
        INSERT INTO collections (id, owner_user_id, name, display_name, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            (ownerUserId or "").strip(),
            BuildScopedName(ownerUserId, displayName),
            displayName,
            time.time(),
        ),
    )
    connection.commit()


def RenameCollection(connection: sqlite3.Connection, collectionId: str, newName: str, ownerUserId: str = "") -> None:
    displayName = newName.strip()
    connection.execute(
        "UPDATE collections SET name = ?, display_name = ? WHERE id = ? AND owner_user_id = ?",
        (
            BuildScopedName(ownerUserId, displayName),
            displayName,
            collectionId,
            (ownerUserId or "").strip(),
        ),
    )
    connection.commit()


def CreateDeck(connection: sqlite3.Connection, collectionId: str, name: str, ownerUserId: str = "") -> None:
    displayName = name.strip()
    connection.execute(
        """
        INSERT INTO decks (id, collection_id, owner_user_id, name, display_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            collectionId,
            (ownerUserId or "").strip(),
            BuildScopedName(ownerUserId, displayName),
            displayName,
            time.time(),
        ),
    )
    connection.commit()


def RenameDeck(connection: sqlite3.Connection, deckId: str, newName: str, ownerUserId: str = "") -> None:
    displayName = newName.strip()
    connection.execute(
        """
        UPDATE decks
        SET name = ?, display_name = ?
        WHERE id = ? AND owner_user_id = ?
        """,
        (
            BuildScopedName(ownerUserId, displayName),
            displayName,
            deckId,
            (ownerUserId or "").strip(),
        ),
    )
    connection.commit()


def _DeleteDeckRelatedRecords(connection: sqlite3.Connection, deckId: str) -> None:
    normalizedDeckId = (deckId or "").strip()
    if not normalizedDeckId:
        return

    scenarioIds = [
        row["id"]
        for row in connection.execute(
            "SELECT id FROM ai_scenarios WHERE deck_id = ?",
            (normalizedDeckId,),
        ).fetchall()
    ]

    connection.execute("DELETE FROM cards WHERE deck_id = ?", (normalizedDeckId,))
    connection.execute("DELETE FROM deck_collaborators WHERE deck_id = ?", (normalizedDeckId,))
    connection.execute("DELETE FROM deck_invites WHERE deck_id = ?", (normalizedDeckId,))
    connection.execute("DELETE FROM reading_materials WHERE deck_id = ?", (normalizedDeckId,))
    connection.execute("DELETE FROM conversation_sessions WHERE deck_id = ?", (normalizedDeckId,))

    if scenarioIds:
        placeholders = ", ".join(["?"] * len(scenarioIds))
        connection.execute(
            f"DELETE FROM reading_materials WHERE scenario_id IN ({placeholders})",
            scenarioIds,
        )
        connection.execute(
            f"DELETE FROM conversation_sessions WHERE scenario_id IN ({placeholders})",
            scenarioIds,
        )

    connection.execute("DELETE FROM ai_scenarios WHERE deck_id = ?", (normalizedDeckId,))


def DeleteDeck(connection: sqlite3.Connection, deckId: str, ownerUserId: str = "") -> int:
    normalizedDeckId = (deckId or "").strip()
    normalizedOwnerUserId = (ownerUserId or "").strip()
    row = connection.execute(
        "SELECT id FROM decks WHERE id = ? AND owner_user_id = ? LIMIT 1",
        (normalizedDeckId, normalizedOwnerUserId),
    ).fetchone()
    if row is None:
        return 0

    _DeleteDeckRelatedRecords(connection, normalizedDeckId)
    cursor = connection.execute(
        "DELETE FROM decks WHERE id = ? AND owner_user_id = ?",
        (normalizedDeckId, normalizedOwnerUserId),
    )
    connection.commit()
    return max(cursor.rowcount, 0)


def DeleteCollection(connection: sqlite3.Connection, collectionId: str, ownerUserId: str = "") -> int:
    normalizedCollectionId = (collectionId or "").strip()
    normalizedOwnerUserId = (ownerUserId or "").strip()
    row = connection.execute(
        "SELECT id FROM collections WHERE id = ? AND owner_user_id = ? LIMIT 1",
        (normalizedCollectionId, normalizedOwnerUserId),
    ).fetchone()
    if row is None:
        return 0

    deckIds = [
        deckRow["id"]
        for deckRow in connection.execute(
            "SELECT id FROM decks WHERE collection_id = ? AND owner_user_id = ?",
            (normalizedCollectionId, normalizedOwnerUserId),
        ).fetchall()
    ]
    for deckId in deckIds:
        _DeleteDeckRelatedRecords(connection, deckId)

    connection.execute(
        "DELETE FROM decks WHERE collection_id = ? AND owner_user_id = ?",
        (normalizedCollectionId, normalizedOwnerUserId),
    )
    cursor = connection.execute(
        "DELETE FROM collections WHERE id = ? AND owner_user_id = ?",
        (normalizedCollectionId, normalizedOwnerUserId),
    )
    connection.commit()
    return max(cursor.rowcount, 0)


def GetDeckRow(connection: sqlite3.Connection, deckId: str) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT
            decks.id AS deck_id,
            COALESCE(NULLIF(decks.display_name, ''), decks.name) AS deck_name,
            COALESCE(NULLIF(collections.display_name, ''), collections.name) AS collection_name,
            decks.owner_user_id AS owner_user_id
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


def GetDeckCardCounts(connection: sqlite3.Connection, ownerUserId: str) -> Dict[str, int]:
    normalizedOwnerUserId = (ownerUserId or "").strip()
    rows = connection.execute(
        """
        SELECT cards.deck_id, COUNT(*) AS count
        FROM cards
        JOIN decks ON decks.id = cards.deck_id
        WHERE decks.owner_user_id = ?
           OR EXISTS (
                SELECT 1
                FROM deck_collaborators
                WHERE deck_collaborators.deck_id = decks.id
                  AND deck_collaborators.user_id = ?
           )
        GROUP BY cards.deck_id
        """,
        (normalizedOwnerUserId, normalizedOwnerUserId),
    ).fetchall()
    return {row["deck_id"]: int(row["count"]) for row in rows}


def AddCard(connection: sqlite3.Connection, deckId: str, card: Dict[str, Any]) -> bool:
    schemaKey = card.get("schema_key") or DefaultSchemaKey
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
    kanjiOnReadings = (card.get("kanji_on_readings") or "").strip()
    kanjiKunReadings = (card.get("kanji_kun_readings") or "").strip()
    kanjiNanoriReadings = (card.get("kanji_nanori_readings") or "").strip()
    radicalPosition = (card.get("radical_position") or "").strip()

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
                kanji_on_readings, kanji_kun_readings, kanji_nanori_readings, radical_position,
                unique_key, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                kanjiOnReadings,
                kanjiKunReadings,
                kanjiNanoriReadings,
                radicalPosition,
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
    ownerUserId: str,
    kanji: str,
    kana: str,
    excludeCardId: Optional[str] = None,
) -> bool:
    uniqueKey = BuildGlobalCardUniqueKey(ownerUserId, kanji, kana)
    if excludeCardId:
        row = connection.execute(
            "SELECT 1 FROM global_cards WHERE owner_user_id = ? AND unique_key = ? AND id != ? LIMIT 1",
            ((ownerUserId or "").strip(), uniqueKey, excludeCardId),
        ).fetchone()
    else:
        row = connection.execute(
            "SELECT 1 FROM global_cards WHERE owner_user_id = ? AND unique_key = ? LIMIT 1",
            ((ownerUserId or "").strip(), uniqueKey),
        ).fetchone()
    return row is not None


def AddGlobalCard(connection: sqlite3.Connection, card: Dict[str, Any]) -> bool:
    ownerUserId = (card.get("owner_user_id") or "").strip()
    kanji = (card.get("kanji") or "").strip()
    kana = (card.get("kana") or "").strip()
    english = (card.get("english") or "").strip()
    if not kanji or not english:
        return False

    if GlobalCardExists(connection, ownerUserId, kanji, kana):
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
    kanjiOnReadings = (card.get("kanji_on_readings") or "").strip()
    kanjiKunReadings = (card.get("kanji_kun_readings") or "").strip()
    kanjiNanoriReadings = (card.get("kanji_nanori_readings") or "").strip()
    radicalPosition = (card.get("radical_position") or "").strip()

    imageFiles = NormalizeStringList(card.get("image_files") or [])
    videoFiles = NormalizeStringList(card.get("video_files") or [])
    tags = NormalizeStringList(card.get("tags") or [])
    uniqueKey = BuildGlobalCardUniqueKey(ownerUserId, kanji, kana)

    try:
        connection.execute(
            """
            INSERT INTO global_cards (
                id, owner_user_id, kanji, kana, english, notes,
                kanji_masu, kana_masu, kanji_te, kana_te,
                kanji_past, kana_past, kanji_negative, kana_negative,
                image_files_json, video_files_json, tags_json,
                dictionary_entry_id, dictionary_headword, dictionary_reading,
                dictionary_gloss, dictionary_pos, dictionary_pos_tags, verb_type,
                kanji_on_readings, kanji_kun_readings, kanji_nanori_readings, radical_position,
                unique_key, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                ownerUserId,
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
                kanjiOnReadings,
                kanjiKunReadings,
                kanjiNanoriReadings,
                radicalPosition,
                uniqueKey,
                time.time(),
            ),
        )
        connection.commit()
        return True
    except sqlite3.IntegrityError:
        return False


def GetGlobalCardBySurface(connection: sqlite3.Connection, kanji: str, kana: str) -> Optional[sqlite3.Row]:
    raise RuntimeError("GetGlobalCardBySurface requires owner_user_id; use GetUserGlobalCardBySurface.")


def GetUserGlobalCardBySurface(
    connection: sqlite3.Connection,
    ownerUserId: str,
    kanji: str,
    kana: str,
) -> Optional[sqlite3.Row]:
    uniqueKey = BuildGlobalCardUniqueKey(ownerUserId, kanji, kana)
    return connection.execute(
        "SELECT * FROM global_cards WHERE owner_user_id = ? AND unique_key = ? LIMIT 1",
        ((ownerUserId or "").strip(), uniqueKey),
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
        "kanji_on_readings": MergeOptionalText(
            existingCard["kanji_on_readings"],
            incomingCard.get("kanji_on_readings", ""),
        ),
        "kanji_kun_readings": MergeOptionalText(
            existingCard["kanji_kun_readings"],
            incomingCard.get("kanji_kun_readings", ""),
        ),
        "kanji_nanori_readings": MergeOptionalText(
            existingCard["kanji_nanori_readings"],
            incomingCard.get("kanji_nanori_readings", ""),
        ),
        "radical_position": MergeOptionalText(
            existingCard["radical_position"],
            incomingCard.get("radical_position", ""),
        ),
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
            verb_type = ?,
            kanji_on_readings = ?,
            kanji_kun_readings = ?,
            kanji_nanori_readings = ?,
            radical_position = ?
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
            mergedValues["kanji_on_readings"],
            mergedValues["kanji_kun_readings"],
            mergedValues["kanji_nanori_readings"],
            mergedValues["radical_position"],
            existingCard["id"],
        ),
    )
    connection.commit()
    return True


def ListGlobalCards(connection: sqlite3.Connection, ownerUserId: str = "") -> List[sqlite3.Row]:
    return list(
        connection.execute(
            "SELECT * FROM global_cards WHERE owner_user_id = ? ORDER BY created_at DESC",
            ((ownerUserId or "").strip(),),
        )
    )


def CountGlobalCards(connection: sqlite3.Connection, ownerUserId: str = "") -> int:
    return int(
        connection.execute(
            "SELECT COUNT(*) FROM global_cards WHERE owner_user_id = ?",
            ((ownerUserId or "").strip(),),
        ).fetchone()[0]
    )


def GetGlobalCardsByIds(
    connection: sqlite3.Connection,
    globalCardIds: List[str],
    ownerUserId: str = "",
) -> List[sqlite3.Row]:
    if not globalCardIds:
        return []
    placeholders = ", ".join(["?"] * len(globalCardIds))
    return list(
        connection.execute(
            f"SELECT * FROM global_cards WHERE owner_user_id = ? AND id IN ({placeholders})",
            [(ownerUserId or "").strip(), *globalCardIds],
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
        "schema_key": (schemaKey or "").strip() or DefaultSchemaKey,
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
        "kanji_on_readings": (globalCard["kanji_on_readings"] or "").strip(),
        "kanji_kun_readings": (globalCard["kanji_kun_readings"] or "").strip(),
        "kanji_nanori_readings": (globalCard["kanji_nanori_readings"] or "").strip(),
        "radical_position": (globalCard["radical_position"] or "").strip(),
    }


def ImportDeckCardsToGlobal(connection: sqlite3.Connection, deckId: str, ownerUserId: str = "") -> Tuple[int, int]:
    cards = GetDeckCards(connection, deckId)
    added = 0
    skipped = 0
    for card in cards:
        sourceWordForm = (card["word_form"] or "dictionary").strip() or "dictionary"
        baseKanji = (card["dictionary_headword"] or "").strip() or (card["kanji"] or "").strip()
        baseKana = (card["dictionary_reading"] or "").strip() or (card["kana"] or "").strip()
        schemaKey = (card["schema_key"] or "").strip() or DefaultSchemaKey
        if not baseKanji or (not baseKana and CardSchemaUsesField(connection, schemaKey, "kana")):
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
            "owner_user_id": ownerUserId,
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
            "kanji_on_readings": (card["kanji_on_readings"] or "").strip(),
            "kanji_kun_readings": (card["kanji_kun_readings"] or "").strip(),
            "kanji_nanori_readings": (card["kanji_nanori_readings"] or "").strip(),
            "radical_position": (card["radical_position"] or "").strip(),
        }

        if sourceWordForm in WordFormFieldByKey and sourceWordForm != "dictionary":
            kanjiField, kanaField = WordFormFieldByKey[sourceWordForm]
            globalCard[kanjiField] = (card["kanji"] or "").strip()
            globalCard[kanaField] = (card["kana"] or "").strip()

        existingGlobalCard = GetUserGlobalCardBySurface(connection, ownerUserId, baseKanji, baseKana)
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
    ownerUserId: str = "",
) -> Tuple[int, int]:
    globalCards = GetGlobalCardsByIds(connection, globalCardIds, ownerUserId)
    added = 0
    skipped = 0
    for globalCard in globalCards:
        deckCard = BuildDeckCardPayloadFromGlobalCard(
            globalCard,
            schemaKey,
            requestedWordForm,
            extraTags=extraTags or [],
        )
        requiresKana = CardSchemaUsesField(connection, schemaKey, "kana")
        if not (deckCard.get("kanji") or "").strip() or (
            requiresKana and not (deckCard.get("kana") or "").strip()
        ):
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
    kanjiOnReadings: str = "",
    kanjiKunReadings: str = "",
    kanjiNanoriReadings: str = "",
    radicalPosition: str = "",
) -> bool:
    normalizedKanji = (kanji or "").strip()
    normalizedKana = (kana or "").strip()
    normalizedEnglish = (english or "").strip()
    normalizedNotes = (notes or "").strip()
    normalizedSchemaKey = (schemaKey or "").strip() or DefaultSchemaKey
    normalizedKanjiOnReadings = (kanjiOnReadings or "").strip()
    normalizedKanjiKunReadings = (kanjiKunReadings or "").strip()
    normalizedKanjiNanoriReadings = (kanjiNanoriReadings or "").strip()
    normalizedRadicalPosition = (radicalPosition or "").strip()

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
            SET kanji = ?,
                kana = ?,
                english = ?,
                notes = ?,
                schema_key = ?,
                kanji_on_readings = ?,
                kanji_kun_readings = ?,
                kanji_nanori_readings = ?,
                radical_position = ?,
                unique_key = ?
            WHERE id = ? AND deck_id = ?
            """,
            (
                normalizedKanji,
                normalizedKana,
                normalizedEnglish,
                normalizedNotes,
                normalizedSchemaKey,
                normalizedKanjiOnReadings,
                normalizedKanjiKunReadings,
                normalizedKanjiNanoriReadings,
                normalizedRadicalPosition,
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


def DeleteGlobalCardsByIds(connection: sqlite3.Connection, globalCardIds: List[str], ownerUserId: str = "") -> int:
    if not globalCardIds:
        return 0

    placeholders = ", ".join(["?"] * len(globalCardIds))
    cursor = connection.execute(
        f"DELETE FROM global_cards WHERE owner_user_id = ? AND id IN ({placeholders})",
        [(ownerUserId or "").strip(), *globalCardIds],
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
    schemaKey = card.get("schema_key") or DefaultSchemaKey
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
            (schemaKey or "").strip() or DefaultSchemaKey,
            (wordForm or "dictionary").strip() or "dictionary",
            normalizedKanji,
        ),
    ).fetchone()
    return row is not None


def CountUsers(connection: sqlite3.Connection) -> int:
    return int(connection.execute("SELECT COUNT(*) FROM users").fetchone()[0])


def GetUserById(connection: sqlite3.Connection, userId: str) -> Optional[sqlite3.Row]:
    return connection.execute("SELECT * FROM users WHERE id = ? LIMIT 1", ((userId or "").strip(),)).fetchone()


def GetUserByIdentifier(connection: sqlite3.Connection, identifier: str) -> Optional[sqlite3.Row]:
    normalizedIdentifier = (identifier or "").strip()
    normalizedEmail = NormalizeEmail(identifier)
    return connection.execute(
        """
        SELECT *
        FROM users
        WHERE lower(username) = lower(?)
           OR lower(email) = lower(?)
        LIMIT 1
        """,
        (normalizedIdentifier, normalizedEmail),
    ).fetchone()


def CreateUser(
    connection: sqlite3.Connection,
    username: str,
    email: str,
    password: str,
    isAdmin: bool = False,
    canUseAi: bool = True,
    canUseOcr: bool = False,
) -> sqlite3.Row:
    normalizedUsername = (username or "").strip()
    normalizedEmail = NormalizeEmail(email)
    if not normalizedUsername or not normalizedEmail or not password:
        raise RuntimeError("username, email, and password are required.")

    salt = GeneratePasswordSalt()
    now = time.time()
    userId = str(uuid.uuid4())
    connection.execute(
        """
        INSERT INTO users (
            id, username, email, password_salt, password_hash,
            is_admin, can_use_ai, can_use_ocr, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (
            userId,
            normalizedUsername,
            normalizedEmail,
            salt,
            HashPassword(password, salt),
            int(bool(isAdmin)),
            int(bool(canUseAi)),
            int(bool(canUseOcr)),
            now,
            now,
        ),
    )
    connection.commit()
    row = GetUserById(connection, userId)
    if row is None:
        raise RuntimeError("Failed to create user.")
    return row


def UpdateUserPassword(connection: sqlite3.Connection, userId: str, newPassword: str) -> None:
    salt = GeneratePasswordSalt()
    now = time.time()
    connection.execute(
        """
        UPDATE users
        SET password_salt = ?, password_hash = ?, updated_at = ?
        WHERE id = ?
        """,
        (salt, HashPassword(newPassword, salt), now, (userId or "").strip()),
    )
    connection.commit()


def AuthenticateUser(connection: sqlite3.Connection, identifier: str, password: str) -> Optional[sqlite3.Row]:
    userRow = GetUserByIdentifier(connection, identifier)
    if userRow is None or not bool(userRow["is_active"]):
        return None
    if not VerifyPassword(password, userRow["password_salt"], userRow["password_hash"]):
        return None
    return userRow


def CreateUserSession(connection: sqlite3.Connection, userId: str) -> str:
    rawToken = secrets.token_urlsafe(48)
    now = time.time()
    connection.execute(
        """
        INSERT INTO user_sessions (
            id, user_id, token_hash, expires_at, created_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            (userId or "").strip(),
            HashToken(rawToken),
            now + SessionLifetimeSeconds,
            now,
            now,
        ),
    )
    connection.commit()
    return rawToken


def DeleteUserSession(connection: sqlite3.Connection, rawToken: str) -> None:
    if not rawToken:
        return
    connection.execute("DELETE FROM user_sessions WHERE token_hash = ?", (HashToken(rawToken),))
    connection.commit()


def GetSessionUser(connection: sqlite3.Connection, rawToken: str) -> Optional[sqlite3.Row]:
    if not rawToken:
        return None
    now = time.time()
    row = connection.execute(
        """
        SELECT users.*
        FROM user_sessions
        JOIN users ON users.id = user_sessions.user_id
        WHERE user_sessions.token_hash = ?
          AND user_sessions.expires_at > ?
          AND users.is_active = 1
        LIMIT 1
        """,
        (HashToken(rawToken), now),
    ).fetchone()
    if row is None:
        return None
    connection.execute(
        """
        UPDATE user_sessions
        SET last_seen_at = ?, expires_at = ?
        WHERE token_hash = ?
        """,
        (now, now + SessionLifetimeSeconds, HashToken(rawToken)),
    )
    connection.commit()
    return row


def ListUsers(connection: sqlite3.Connection) -> List[Dict[str, Any]]:
    return [
        SerializeUserRow(row)
        for row in connection.execute("SELECT * FROM users ORDER BY created_at ASC").fetchall()
    ]


def UpdateUserPermissions(
    connection: sqlite3.Connection,
    userId: str,
    *,
    isAdmin: Optional[bool] = None,
    canUseAi: Optional[bool] = None,
    canUseOcr: Optional[bool] = None,
    isActive: Optional[bool] = None,
) -> None:
    fields: List[str] = []
    values: List[Any] = []
    if isAdmin is not None:
        fields.append("is_admin = ?")
        values.append(int(bool(isAdmin)))
    if canUseAi is not None:
        fields.append("can_use_ai = ?")
        values.append(int(bool(canUseAi)))
    if canUseOcr is not None:
        fields.append("can_use_ocr = ?")
        values.append(int(bool(canUseOcr)))
    if isActive is not None:
        fields.append("is_active = ?")
        values.append(int(bool(isActive)))
    if not fields:
        return
    fields.append("updated_at = ?")
    values.append(time.time())
    values.append((userId or "").strip())
    connection.execute(
        f"UPDATE users SET {', '.join(fields)} WHERE id = ?",
        values,
    )
    connection.commit()


def GetDeckAccessRow(
    connection: sqlite3.Connection,
    deckId: str,
    userId: str,
) -> Optional[sqlite3.Row]:
    normalizedUserId = (userId or "").strip()
    return connection.execute(
        """
        SELECT
            decks.*,
            COALESCE(NULLIF(decks.display_name, ''), decks.name) AS resolved_name,
            COALESCE(NULLIF(collections.display_name, ''), collections.name) AS resolved_collection_name,
            CASE WHEN decks.owner_user_id = ? THEN 1 ELSE 0 END AS is_owner,
            CASE
                WHEN decks.owner_user_id = ? THEN 1
                WHEN EXISTS (
                    SELECT 1
                    FROM deck_collaborators
                    WHERE deck_collaborators.deck_id = decks.id
                      AND deck_collaborators.user_id = ?
                ) THEN 1
                ELSE 0
            END AS can_access
        FROM decks
        JOIN collections ON collections.id = decks.collection_id
        WHERE decks.id = ?
        LIMIT 1
        """,
        (normalizedUserId, normalizedUserId, normalizedUserId, (deckId or "").strip()),
    ).fetchone()


def UserCanAccessDeck(connection: sqlite3.Connection, deckId: str, userId: str) -> bool:
    row = GetDeckAccessRow(connection, deckId, userId)
    return row is not None and bool(row["can_access"])


def UserCanEditDeck(connection: sqlite3.Connection, deckId: str, userId: str) -> bool:
    return UserCanAccessDeck(connection, deckId, userId)


def ListDeckCollaborators(connection: sqlite3.Connection, deckId: str) -> List[Dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT users.id, users.username, users.email, deck_collaborators.role, deck_collaborators.created_at
        FROM deck_collaborators
        JOIN users ON users.id = deck_collaborators.user_id
        WHERE deck_collaborators.deck_id = ?
        ORDER BY users.username
        """,
        ((deckId or "").strip(),),
    ).fetchall()
    return [dict(row) for row in rows]


def RemoveDeckCollaborator(connection: sqlite3.Connection, deckId: str, userId: str) -> int:
    cursor = connection.execute(
        "DELETE FROM deck_collaborators WHERE deck_id = ? AND user_id = ?",
        ((deckId or "").strip(), (userId or "").strip()),
    )
    connection.commit()
    return max(cursor.rowcount, 0)


def CreateDeckInvite(
    connection: sqlite3.Connection,
    deckId: str,
    invitedByUserId: str,
    invitedEmail: str = "",
    invitedUsername: str = "",
) -> Dict[str, Any]:
    normalizedEmail = NormalizeEmail(invitedEmail)
    normalizedUsername = (invitedUsername or "").strip()
    if not normalizedEmail and not normalizedUsername:
        raise RuntimeError("Either invitedEmail or invitedUsername is required.")

    rawToken = secrets.token_urlsafe(24)
    now = time.time()
    inviteId = str(uuid.uuid4())
    connection.execute(
        """
        INSERT INTO deck_invites (
            id, deck_id, invited_email, invited_username, token_hash, token_preview,
            invited_by_user_id, accepted_by_user_id, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)
        """,
        (
            inviteId,
            (deckId or "").strip(),
            normalizedEmail,
            normalizedUsername,
            HashToken(rawToken),
            rawToken[:8],
            (invitedByUserId or "").strip(),
            now + InviteLifetimeSeconds,
            now,
        ),
    )
    connection.commit()
    return {
        "id": inviteId,
        "deck_id": (deckId or "").strip(),
        "token": rawToken,
        "token_preview": rawToken[:8],
        "invited_email": normalizedEmail,
        "invited_username": normalizedUsername,
        "expires_at": now + InviteLifetimeSeconds,
    }


def ListDeckInvites(connection: sqlite3.Connection, deckId: str) -> List[Dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT id, deck_id, invited_email, invited_username, token_preview, invited_by_user_id,
               accepted_by_user_id, expires_at, created_at
        FROM deck_invites
        WHERE deck_id = ?
        ORDER BY created_at DESC
        """,
        ((deckId or "").strip(),),
    ).fetchall()
    return [dict(row) for row in rows]


def ListPendingInvitesForUser(
    connection: sqlite3.Connection,
    userId: str,
    email: str,
    username: str,
) -> List[Dict[str, Any]]:
    normalizedEmail = NormalizeEmail(email)
    normalizedUsername = (username or "").strip()
    rows = connection.execute(
        """
        SELECT
            deck_invites.id,
            deck_invites.deck_id,
            deck_invites.invited_email,
            deck_invites.invited_username,
            deck_invites.token_preview,
            deck_invites.expires_at,
            deck_invites.created_at,
            COALESCE(NULLIF(decks.display_name, ''), decks.name) AS deck_name,
            COALESCE(NULLIF(collections.display_name, ''), collections.name) AS collection_name,
            owners.username AS owner_username
        FROM deck_invites
        JOIN decks ON decks.id = deck_invites.deck_id
        JOIN collections ON collections.id = decks.collection_id
        JOIN users AS owners ON owners.id = decks.owner_user_id
        WHERE deck_invites.accepted_by_user_id = ''
          AND deck_invites.expires_at > ?
          AND (
                lower(deck_invites.invited_email) = lower(?)
                OR lower(deck_invites.invited_username) = lower(?)
              )
          AND NOT EXISTS (
                SELECT 1
                FROM deck_collaborators
                WHERE deck_collaborators.deck_id = deck_invites.deck_id
                  AND deck_collaborators.user_id = ?
          )
        ORDER BY deck_invites.created_at DESC
        """,
        (time.time(), normalizedEmail, normalizedUsername, (userId or "").strip()),
    ).fetchall()
    return [dict(row) for row in rows]


def AcceptDeckInvite(connection: sqlite3.Connection, rawToken: str, userId: str) -> Optional[Dict[str, Any]]:
    row = connection.execute(
        """
        SELECT *
        FROM deck_invites
        WHERE token_hash = ?
          AND accepted_by_user_id = ''
          AND expires_at > ?
        LIMIT 1
        """,
        (HashToken(rawToken), time.time()),
    ).fetchone()
    if row is None:
        return None

    connection.execute(
        """
        INSERT OR IGNORE INTO deck_collaborators (id, deck_id, user_id, role, created_at)
        VALUES (?, ?, ?, 'editor', ?)
        """,
        (str(uuid.uuid4()), row["deck_id"], (userId or "").strip(), time.time()),
    )
    connection.execute(
        "UPDATE deck_invites SET accepted_by_user_id = ? WHERE id = ?",
        ((userId or "").strip(), row["id"]),
    )
    connection.commit()
    return dict(row)


def AcceptDeckInviteById(
    connection: sqlite3.Connection,
    inviteId: str,
    userId: str,
    email: str,
    username: str,
) -> Optional[Dict[str, Any]]:
    normalizedEmail = NormalizeEmail(email)
    normalizedUsername = (username or "").strip()
    row = connection.execute(
        """
        SELECT *
        FROM deck_invites
        WHERE id = ?
          AND accepted_by_user_id = ''
          AND expires_at > ?
          AND (
                lower(invited_email) = lower(?)
                OR lower(invited_username) = lower(?)
              )
        LIMIT 1
        """,
        (
            (inviteId or "").strip(),
            time.time(),
            normalizedEmail,
            normalizedUsername,
        ),
    ).fetchone()
    if row is None:
        return None

    connection.execute(
        """
        INSERT OR IGNORE INTO deck_collaborators (id, deck_id, user_id, role, created_at)
        VALUES (?, ?, ?, 'editor', ?)
        """,
        (str(uuid.uuid4()), row["deck_id"], (userId or "").strip(), time.time()),
    )
    connection.execute(
        "UPDATE deck_invites SET accepted_by_user_id = ? WHERE id = ?",
        ((userId or "").strip(), row["id"]),
    )
    connection.commit()
    return dict(row)


def CloneTemplateDataToUser(connection: sqlite3.Connection, userId: str) -> None:
    normalizedUserId = (userId or "").strip()
    if not normalizedUserId:
        return

    globalRows = connection.execute(
        "SELECT * FROM global_cards WHERE owner_user_id = '' ORDER BY created_at ASC"
    ).fetchall()
    for globalRow in globalRows:
        payload = dict(globalRow)
        payload["owner_user_id"] = normalizedUserId
        payload["image_files"] = DecodeJsonStringList(globalRow["image_files_json"])
        payload["video_files"] = DecodeJsonStringList(globalRow["video_files_json"])
        payload["tags"] = DecodeJsonStringList(globalRow["tags_json"])
        payload["dictionary_pos_tags"] = DecodeJsonStringList(globalRow["dictionary_pos_tags"])
        AddGlobalCard(connection, payload)

    templateCollections = connection.execute(
        "SELECT * FROM collections WHERE owner_user_id = '' ORDER BY created_at ASC"
    ).fetchall()
    collectionIdMap: Dict[str, str] = {}
    deckIdMap: Dict[str, str] = {}

    for collectionRow in templateCollections:
        displayName = (collectionRow["display_name"] or "").strip() or DecodeScopedDisplayName(collectionRow["name"])
        CreateCollection(connection, displayName, normalizedUserId)
        createdCollection = connection.execute(
            """
            SELECT id
            FROM collections
            WHERE owner_user_id = ? AND display_name = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (normalizedUserId, displayName),
        ).fetchone()
        if createdCollection is None:
            continue
        collectionIdMap[collectionRow["id"]] = createdCollection["id"]

    templateDecks = connection.execute(
        "SELECT * FROM decks WHERE owner_user_id = '' ORDER BY created_at ASC"
    ).fetchall()
    for deckRow in templateDecks:
        newCollectionId = collectionIdMap.get(deckRow["collection_id"])
        if not newCollectionId:
            continue
        displayName = (deckRow["display_name"] or "").strip() or DecodeScopedDisplayName(deckRow["name"])
        CreateDeck(connection, newCollectionId, displayName, normalizedUserId)
        createdDeck = connection.execute(
            """
            SELECT id
            FROM decks
            WHERE owner_user_id = ? AND collection_id = ? AND display_name = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (normalizedUserId, newCollectionId, displayName),
        ).fetchone()
        if createdDeck is None:
            continue
        deckIdMap[deckRow["id"]] = createdDeck["id"]

    templateCards = connection.execute(
        """
        SELECT cards.*
        FROM cards
        JOIN decks ON decks.id = cards.deck_id
        WHERE decks.owner_user_id = ''
        ORDER BY cards.created_at ASC
        """
    ).fetchall()
    for cardRow in templateCards:
        newDeckId = deckIdMap.get(cardRow["deck_id"])
        if not newDeckId:
            continue
        AddCard(
            connection,
            newDeckId,
            {
                "kanji": cardRow["kanji"],
                "kana": cardRow["kana"],
                "english": cardRow["english"],
                "notes": cardRow["notes"],
                "source_text": cardRow["source_text"],
                "schema_key": cardRow["schema_key"],
                "media_type": cardRow["media_type"],
                "media_files": DecodeJsonStringList(cardRow["media_files_json"]),
                "tags": DecodeJsonStringList(cardRow["tags_json"]),
                "dictionary_entry_id": cardRow["dictionary_entry_id"],
                "dictionary_headword": cardRow["dictionary_headword"],
                "dictionary_reading": cardRow["dictionary_reading"],
                "dictionary_gloss": cardRow["dictionary_gloss"],
                "dictionary_pos": cardRow["dictionary_pos"],
                "dictionary_pos_tags": DecodeJsonStringList(cardRow["dictionary_pos_tags"]),
                "verb_type": cardRow["verb_type"],
                "word_form": cardRow["word_form"],
                "kanji_on_readings": cardRow["kanji_on_readings"],
                "kanji_kun_readings": cardRow["kanji_kun_readings"],
                "kanji_nanori_readings": cardRow["kanji_nanori_readings"],
                "radical_position": cardRow["radical_position"],
            },
        )


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


def ListAiScenarios(
    connection: sqlite3.Connection,
    ownerUserId: str,
    deckId: str,
    mode: str,
) -> List[Dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT
            ai_scenarios.*,
            CASE WHEN reading_materials.id IS NULL THEN 0 ELSE 1 END AS has_cached_material,
            COALESCE(reading_materials.updated_at, 0) AS reading_material_updated_at
        FROM ai_scenarios
        LEFT JOIN reading_materials ON reading_materials.scenario_id = ai_scenarios.id
        WHERE ai_scenarios.owner_user_id = ?
          AND ai_scenarios.deck_id = ?
          AND ai_scenarios.mode = ?
        ORDER BY ai_scenarios.is_custom DESC, ai_scenarios.times_completed DESC,
                 ai_scenarios.times_used ASC, ai_scenarios.updated_at DESC, ai_scenarios.created_at DESC
        """,
        ((ownerUserId or "").strip(), deckId, mode),
    ).fetchall()
    return [SerializeAiScenarioRow(row) for row in rows]


def SaveAiScenario(
    connection: sqlite3.Connection,
    ownerUserId: str,
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
    normalizedOwnerUserId = (ownerUserId or "").strip()
    normalizedDeckId = (deckId or "").strip()
    normalizedMode = (mode or "").strip()
    normalizedTitle = (title or "").strip()
    normalizedSummary = (summary or "").strip()
    normalizedTopicHint = (topicHint or "").strip()
    normalizedDifficulty = (difficulty or "intermediate").strip() or "intermediate"
    normalizedStyle = (style or "").strip()
    normalizedQuestionCount = max(1, int(questionCount or 1))
    normalizedTags = NormalizeStringList(tags or [])

    if not normalizedOwnerUserId or not normalizedDeckId or not normalizedMode or not normalizedTitle:
        raise RuntimeError("ownerUserId, deckId, mode, and title are required.")

    existingRow = connection.execute(
        """
        SELECT id
        FROM ai_scenarios
        WHERE owner_user_id = ?
          AND deck_id = ?
          AND mode = ?
          AND title = ?
          AND topic_hint = ?
          AND difficulty = ?
          AND style = ?
        LIMIT 1
        """,
        (
            normalizedOwnerUserId,
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
                id, owner_user_id, deck_id, mode, title, summary, topic_hint, difficulty, style,
                question_count, tags_json, is_custom, times_used, times_completed,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
            """,
            (
                scenarioId,
                normalizedOwnerUserId,
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
    ownerUserId: str,
    scenarioId: str,
) -> Optional[Dict[str, Any]]:
    row = connection.execute(
        "SELECT * FROM reading_materials WHERE owner_user_id = ? AND scenario_id = ? LIMIT 1",
        ((ownerUserId or "").strip(), scenarioId),
    ).fetchone()
    if row is None:
        return None
    return SerializeReadingMaterialRow(row)


def SaveReadingMaterial(
    connection: sqlite3.Connection,
    ownerUserId: str,
    scenarioId: str,
    deckId: str,
    title: str,
    sourceNote: str,
    passage: str,
    newWords: List[Dict[str, Any]],
) -> Dict[str, Any]:
    normalizedOwnerUserId = (ownerUserId or "").strip()
    normalizedScenarioId = (scenarioId or "").strip()
    normalizedDeckId = (deckId or "").strip()
    normalizedTitle = (title or "").strip()
    normalizedSourceNote = (sourceNote or "").strip()
    normalizedPassage = (passage or "").strip()
    normalizedNewWords = [dict(item) for item in (newWords or []) if isinstance(item, dict)]

    if not normalizedOwnerUserId or not normalizedScenarioId or not normalizedDeckId or not normalizedPassage:
        raise RuntimeError("ownerUserId, scenarioId, deckId, and passage are required.")

    existingRow = connection.execute(
        "SELECT id FROM reading_materials WHERE owner_user_id = ? AND scenario_id = ? LIMIT 1",
        (normalizedOwnerUserId, normalizedScenarioId),
    ).fetchone()
    now = time.time()
    if existingRow is None:
        materialId = str(uuid.uuid4())
        connection.execute(
            """
            INSERT INTO reading_materials (
                id, owner_user_id, scenario_id, deck_id, title, source_note, passage,
                new_words_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                materialId,
                normalizedOwnerUserId,
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
        "SELECT * FROM reading_materials WHERE owner_user_id = ? AND id = ? LIMIT 1",
        (normalizedOwnerUserId, materialId),
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
    ownerUserId: str,
    scenarioId: str,
    deckId: str,
    messages: List[Dict[str, Any]],
) -> Dict[str, Any]:
    now = time.time()
    sessionId = str(uuid.uuid4())
    connection.execute(
        """
        INSERT INTO conversation_sessions (
            id, owner_user_id, scenario_id, deck_id, messages_json, summary_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, '{}', 'active', ?, ?)
        """,
        (
            sessionId,
            (ownerUserId or "").strip(),
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


def GetDashboardRows(connection: sqlite3.Connection, ownerUserId: str) -> List[sqlite3.Row]:
    return connection.execute(
        """
        SELECT
            COALESCE(NULLIF(collections.display_name, ''), collections.name) AS collection_name,
            COALESCE(NULLIF(decks.display_name, ''), decks.name) AS deck_name,
            COUNT(cards.id) AS card_count
        FROM decks
        JOIN collections ON collections.id = decks.collection_id
        LEFT JOIN cards ON cards.deck_id = decks.id
        WHERE decks.owner_user_id = ?
           OR EXISTS (
                SELECT 1
                FROM deck_collaborators
                WHERE deck_collaborators.deck_id = decks.id
                  AND deck_collaborators.user_id = ?
           )
        GROUP BY decks.id
        ORDER BY collection_name, deck_name
        """,
        ((ownerUserId or "").strip(), (ownerUserId or "").strip()),
    ).fetchall()


def GetTotalDeckCount(connection: sqlite3.Connection, ownerUserId: str) -> int:
    return int(
        connection.execute(
            """
            SELECT COUNT(*)
            FROM decks
            WHERE owner_user_id = ?
               OR EXISTS (
                    SELECT 1
                    FROM deck_collaborators
                    WHERE deck_collaborators.deck_id = decks.id
                      AND deck_collaborators.user_id = ?
               )
            """,
            ((ownerUserId or "").strip(), (ownerUserId or "").strip()),
        ).fetchone()[0]
    )


def GetTotalCardCount(connection: sqlite3.Connection, ownerUserId: str) -> int:
    return int(
        connection.execute(
            """
            SELECT COUNT(*)
            FROM cards
            JOIN decks ON decks.id = cards.deck_id
            WHERE decks.owner_user_id = ?
               OR EXISTS (
                    SELECT 1
                    FROM deck_collaborators
                    WHERE deck_collaborators.deck_id = decks.id
                      AND deck_collaborators.user_id = ?
               )
            """,
            ((ownerUserId or "").strip(), (ownerUserId or "").strip()),
        ).fetchone()[0]
    )
