import hashlib
import html
import json
from pathlib import Path
from typing import Tuple

import genanki
import sqlite3

from AnkiDeckBuilder.AppConfig import (
    CardSchemas,
    ExportDir,
    NoteModelId,
    PublicIconDir,
    RadicalPositionOptions,
    SupportedAudioExtensions,
    SupportedImageExtensions,
    SupportedVideoExtensions,
)
from AnkiDeckBuilder.DatabaseService import GetDeckCards, GetDeckRow


def ResolveRadicalPosition(value: str) -> Tuple[str, str]:
    normalizedValue = (value or "").strip()
    if not normalizedValue:
        return "", ""

    if normalizedValue in RadicalPositionOptions:
        option = RadicalPositionOptions[normalizedValue]
        return option["Label"], option["Icon"]

    for option in RadicalPositionOptions.values():
        if normalizedValue == option["Label"]:
            return option["Label"], option["Icon"]

    return normalizedValue, ""


def RenderRadicalPosition(value: str, label: str) -> str:
    positionLabel, iconName = ResolveRadicalPosition(value)
    if not positionLabel:
        return ""

    escapedLabel = html.escape(label)
    escapedPosition = html.escape(positionLabel)
    if iconName:
        iconHtml = (
            f'<img class="radical-position-icon" src="{html.escape(iconName)}" '
            f'alt="{escapedPosition}">'
        )
        valueHtml = f'<span class="radical-position-value">{iconHtml}<span>{escapedPosition}</span></span>'
    else:
        valueHtml = f'<span>{escapedPosition}</span>'

    return (
        '<div class="kanji-detail-row">'
        f'<span class="kanji-detail-label">{escapedLabel}</span>'
        f'<span class="kanji-detail-value">{valueHtml}</span>'
        '</div>'
    )


def RenderField(fieldName: str, card: sqlite3.Row, fieldLabels: dict[str, str] | None = None) -> str:
    value = (card[fieldName] or "").strip()
    if not value:
        return ""

    label = (fieldLabels or {}).get(fieldName, "")
    if fieldName == "radical_position":
        return RenderRadicalPosition(value, label or "Radical Position")

    escapedValue = html.escape(value)
    if not label:
        return escapedValue

    return (
        '<div class="kanji-detail-row">'
        f'<span class="kanji-detail-label">{html.escape(label)}</span>'
        f'<span class="kanji-detail-value">{escapedValue}</span>'
        '</div>'
    )


def RenderMedia(card: sqlite3.Row) -> str:
    mediaType = card["media_type"]
    mediaFiles = json.loads(card["media_files_json"])
    if not mediaFiles:
        return ""

    tags = []
    for filePath in mediaFiles:
        name = Path(filePath).name
        extension = Path(name).suffix.lower()
        if mediaType == "image" or extension in SupportedImageExtensions:
            tags.append(f'<div><img src="{html.escape(name)}" style="max-width: 95%;"></div>')
        elif mediaType == "audio" or extension in SupportedAudioExtensions:
            tags.append(f"[sound:{name}]")
        elif mediaType == "video" or extension in SupportedVideoExtensions:
            tags.append(
                f'<video controls style="max-width: 95%;"><source src="{html.escape(name)}"></video>'
            )
    return "<br>".join(tags)


def RenderDictionaryReference(card: sqlite3.Row) -> str:
    entryId = (card["dictionary_entry_id"] or "").strip()
    if not entryId:
        return ""

    headword = html.escape((card["dictionary_headword"] or "").strip())
    reading = html.escape((card["dictionary_reading"] or "").strip())
    gloss = html.escape((card["dictionary_gloss"] or "").strip())
    wordForm = html.escape((card["word_form"] or "").strip())

    summary = f"{headword} [{reading}]".strip() if reading else headword
    detailParts = [item for item in [summary, gloss] if item]
    detail = " - ".join(detailParts)
    formText = f" | form: {wordForm}" if wordForm else ""
    return f"<small>JMDict #{html.escape(entryId)}: {detail}{formText}</small>"


def BuildNoteFields(card: sqlite3.Row) -> Tuple[str, str, str]:
    schema = CardSchemas[card["schema_key"]]
    fieldLabels = schema.get("FieldLabels", {})

    frontParts = [
        rendered
        for field in schema["FrontFields"]
        if (rendered := RenderField(field, card, fieldLabels))
    ]
    backParts = [
        rendered
        for field in schema["BackFields"]
        if (rendered := RenderField(field, card, fieldLabels))
    ]

    mediaHtml = RenderMedia(card)
    dictionaryReferenceHtml = RenderDictionaryReference(card)
    notes = RenderField("notes", card)

    frontHtml = "<br>".join(frontParts)
    backHtml = "<br>".join(backParts)

    if notes:
        backHtml += f"<hr>{notes}" if backHtml else notes
    if dictionaryReferenceHtml:
        backHtml += f"<hr>{dictionaryReferenceHtml}" if backHtml else dictionaryReferenceHtml
    if mediaHtml:
        backHtml += f"<hr>{mediaHtml}" if backHtml else mediaHtml

    sortField = RenderField("kanji", card) or RenderField("kana", card) or RenderField("english", card)
    return frontHtml, backHtml, sortField


def GetRadicalPositionIconPath(card: sqlite3.Row) -> str:
    _, iconName = ResolveRadicalPosition(card["radical_position"] or "")
    if not iconName:
        return ""
    iconPath = PublicIconDir / iconName
    return str(iconPath) if iconPath.exists() else ""


def CreateAnkiModel() -> genanki.Model:
    return genanki.Model(
        NoteModelId,
        "Japanese Builder Model",
        fields=[
            {"name": "Front"},
            {"name": "Back"},
            {"name": "Sort"},
        ],
        templates=[
            {
                "name": "Card 1",
                "qfmt": "{{Front}}",
                "afmt": "{{FrontSide}}<hr id='answer'>{{Back}}",
            }
        ],
        css="""
        .card {
          font-family: Arial, sans-serif;
          font-size: 28px;
          text-align: center;
          color: black;
          background-color: white;
        }
        img { max-width: 95%; height: auto; }
        video { max-width: 95%; }
        .kanji-detail-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          margin: 0.35rem 0;
          font-size: 22px;
        }
        .kanji-detail-label {
          min-width: 8rem;
          text-align: right;
          color: #555;
          font-weight: 700;
        }
        .kanji-detail-value {
          text-align: left;
        }
        .radical-position-value {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
        }
        .radical-position-icon {
          width: 2rem;
          height: 2rem;
          object-fit: contain;
          vertical-align: middle;
        }
        """,
    )


def CreateStableDeckId(collectionName: str, deckName: str) -> int:
    seed = hashlib.sha1(f"{collectionName}::{deckName}".encode("utf-8")).hexdigest()[:10]
    return int(seed, 16)


def ExportDeckPackage(connection: sqlite3.Connection, deckId: str) -> Path:
    deckRow = GetDeckRow(connection, deckId)
    cards = GetDeckCards(connection, deckId)
    model = CreateAnkiModel()
    deck = genanki.Deck(
        CreateStableDeckId(deckRow["collection_name"], deckRow["deck_name"]),
        f'{deckRow["collection_name"]}::{deckRow["deck_name"]}',
    )

    mediaFiles = []
    for card in cards:
        frontHtml, backHtml, sortField = BuildNoteFields(card)
        note = genanki.Note(model=model, fields=[frontHtml, backHtml, sortField])
        deck.add_note(note)
        mediaFiles.extend(json.loads(card["media_files_json"]))
        radicalIconPath = GetRadicalPositionIconPath(card)
        if radicalIconPath:
            mediaFiles.append(radicalIconPath)

    exportPath = ExportDir / f"{deckRow['collection_name']}__{deckRow['deck_name']}.apkg"
    package = genanki.Package(deck)
    package.media_files = sorted(set(mediaFiles))
    package.write_to_file(str(exportPath))
    return exportPath
