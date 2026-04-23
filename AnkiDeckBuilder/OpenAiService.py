import base64
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from openai import OpenAI

from AnkiDeckBuilder.AppConfig import AppDir, ImageOcrPrompt

ProgressCallback = Optional[Callable[[int, int, str], None]]
OpenAiDebugLogDefaultPath = AppDir / "openai_api_debug.log"
OpenAiDebugLogMaxCharsDefault = 16000
OpenAiRateLimitRetriesDefault = 3
OpenAiRateLimitRetrySecondsDefault = 1.5


def GetOpenAiClient() -> OpenAI:
    apiKey = os.environ.get("OPENAI_API_KEY", "").strip()
    if not apiKey:
        raise RuntimeError("OPENAI_API_KEY is not set.")
    return OpenAI(api_key=apiKey)


def ParseBooleanEnvironmentVariable(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    normalizedValue = value.strip().lower()
    return normalizedValue in {"1", "true", "yes", "on"}


def ParseIntegerEnvironmentVariable(name: str, default: int, minimum: int = 0) -> int:
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return max(minimum, int(value.strip()))
    except (TypeError, ValueError):
        return default


def ParseFloatEnvironmentVariable(name: str, default: float, minimum: float = 0.0) -> float:
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return max(minimum, float(value.strip()))
    except (TypeError, ValueError):
        return default


def IsOpenAiDebugLoggingEnabled() -> bool:
    return ParseBooleanEnvironmentVariable("OPENAI_DEBUG_LOG", default=False)


def GetOpenAiDebugLogPath() -> Path:
    configuredPath = (os.environ.get("OPENAI_DEBUG_LOG_PATH") or "").strip()
    if not configuredPath:
        return OpenAiDebugLogDefaultPath
    return Path(configuredPath)


def GetOpenAiRateLimitRetryCount() -> int:
    return ParseIntegerEnvironmentVariable(
        "OPENAI_RATE_LIMIT_RETRIES",
        OpenAiRateLimitRetriesDefault,
        minimum=0,
    )


def GetOpenAiRateLimitRetryBaseSeconds() -> float:
    return ParseFloatEnvironmentVariable(
        "OPENAI_RATE_LIMIT_RETRY_SECONDS",
        OpenAiRateLimitRetrySecondsDefault,
        minimum=0.1,
    )


def RedactDebugPayload(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: RedactDebugPayload(item) for key, item in value.items()}
    if isinstance(value, list):
        return [RedactDebugPayload(item) for item in value]
    if isinstance(value, tuple):
        return [RedactDebugPayload(item) for item in value]
    if isinstance(value, str) and value.startswith("data:"):
        return f"<data-url redacted; length={len(value)}>"
    return value


def ConvertToSerializableDebugValue(value: Any) -> Any:
    if isinstance(value, (dict, list, str, int, float, bool)) or value is None:
        return value
    if hasattr(value, "model_dump"):
        try:
            return value.model_dump()
        except Exception:
            pass
    return repr(value)


def TruncateDebugValue(value: Any, maxCharacters: int) -> Any:
    if isinstance(value, str):
        if len(value) <= maxCharacters:
            return value
        hiddenCharacterCount = len(value) - maxCharacters
        return f"{value[:maxCharacters]}... [truncated {hiddenCharacterCount} chars]"
    if isinstance(value, list):
        return [TruncateDebugValue(item, maxCharacters) for item in value]
    if isinstance(value, dict):
        return {key: TruncateDebugValue(item, maxCharacters) for key, item in value.items()}
    return value


def LooksLikeOpenAiRateLimitError(exc: Exception) -> bool:
    statusCode = getattr(exc, "status_code", None)
    if statusCode == 429:
        return True

    errorText = str(exc).lower()
    return "rate_limit_exceeded" in errorText or "tokens per min" in errorText


def WriteOpenAiDebugLog(eventType: str, payload: Dict[str, Any]) -> None:
    if not IsOpenAiDebugLoggingEnabled():
        return

    logPath = GetOpenAiDebugLogPath()
    maxCharacters = ParseIntegerEnvironmentVariable(
        "OPENAI_DEBUG_LOG_MAX_CHARS",
        OpenAiDebugLogMaxCharsDefault,
        minimum=256,
    )
    logEntry = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "event": eventType,
        **payload,
    }
    serializableEntry = ConvertToSerializableDebugValue(RedactDebugPayload(logEntry))
    truncatedEntry = TruncateDebugValue(serializableEntry, maxCharacters)

    try:
        logPath.parent.mkdir(parents=True, exist_ok=True)
        with open(logPath, "a", encoding="utf-8") as logFile:
            logFile.write(json.dumps(truncatedEntry, ensure_ascii=False, default=str))
            logFile.write("\n")
    except Exception:
        return


def RequestResponseText(client: OpenAI, model: str, inputPayload: Any) -> str:
    WriteOpenAiDebugLog(
        "openai_request",
        {
            "model": model,
            "input": RedactDebugPayload(ConvertToSerializableDebugValue(inputPayload)),
        },
    )

    maxRetries = GetOpenAiRateLimitRetryCount()
    baseRetrySeconds = GetOpenAiRateLimitRetryBaseSeconds()
    attempt = 0
    while True:
        try:
            response = client.responses.create(model=model, input=inputPayload)
            break
        except Exception as exc:
            isRetryable = LooksLikeOpenAiRateLimitError(exc) and attempt < maxRetries
            if isRetryable:
                sleepSeconds = baseRetrySeconds * (2**attempt)
                WriteOpenAiDebugLog(
                    "openai_retry",
                    {
                        "model": model,
                        "attempt": attempt + 1,
                        "max_retries": maxRetries,
                        "sleep_seconds": sleepSeconds,
                        "error": str(exc),
                    },
                )
                time.sleep(sleepSeconds)
                attempt += 1
                continue

            WriteOpenAiDebugLog(
                "openai_error",
                {
                    "model": model,
                    "error": str(exc),
                },
            )
            raise

    WriteOpenAiDebugLog(
        "openai_response",
        {
            "model": model,
            "response": RedactDebugPayload(ConvertToSerializableDebugValue(response)),
        },
    )

    extractedText = ExtractTextFromResponse(response)
    WriteOpenAiDebugLog(
        "openai_output_text",
        {
            "model": model,
            "output_text": extractedText,
        },
    )
    return extractedText


def ExtractTextFromResponse(response: Any) -> str:
    directText = (getattr(response, "output_text", "") or "").strip()
    if directText:
        return directText

    fragments: List[str] = []
    outputItems = getattr(response, "output", None)
    if outputItems is None and isinstance(response, dict):
        outputItems = response.get("output")

    if not outputItems:
        return ""

    for outputItem in outputItems:
        contentItems = _GetContentItems(outputItem)
        for contentItem in contentItems:
            textValue = _GetTextValue(contentItem)
            if textValue:
                fragments.append(textValue)

    return "\n".join(fragment.strip() for fragment in fragments if fragment).strip()


def _GetContentItems(outputItem: Any) -> List[Any]:
    if isinstance(outputItem, dict):
        return outputItem.get("content") or []
    return getattr(outputItem, "content", []) or []


def _GetTextValue(contentItem: Any) -> str:
    if isinstance(contentItem, dict):
        textCandidate = contentItem.get("text")
        if isinstance(textCandidate, str):
            return textCandidate
        if isinstance(textCandidate, dict):
            nestedValue = textCandidate.get("value")
            if isinstance(nestedValue, str):
                return nestedValue
        return ""

    textCandidate = getattr(contentItem, "text", None)
    if isinstance(textCandidate, str):
        return textCandidate

    nestedValue = getattr(textCandidate, "value", None)
    if isinstance(nestedValue, str):
        return nestedValue

    return ""


def ParseJsonResponse(rawText: str) -> Dict[str, Any]:
    cleanedText = (rawText or "").strip()
    if not cleanedText:
        raise ValueError("The AI response was empty. Please retry.")

    cleanedText = StripCodeFence(cleanedText)

    try:
        return json.loads(cleanedText)
    except json.JSONDecodeError:
        embeddedJson = ExtractEmbeddedJson(cleanedText)
        if not embeddedJson:
            snippet = cleanedText.replace("\n", " ")[:220]
            raise ValueError(f"Could not parse AI JSON response. Preview: {snippet}") from None
        try:
            return json.loads(embeddedJson)
        except json.JSONDecodeError:
            snippet = embeddedJson.replace("\n", " ")[:220]
            raise ValueError(f"Could not parse AI JSON response. Preview: {snippet}") from None


def CoerceJsonObject(parsed: Any) -> Dict[str, Any]:
    if isinstance(parsed, dict):
        return parsed
    if isinstance(parsed, list):
        for item in parsed:
            if isinstance(item, dict):
                return item
    return {}


def CoerceJsonObjectList(parsed: Any, fieldName: str) -> List[Dict[str, Any]]:
    if isinstance(parsed, list):
        return [dict(item) for item in parsed if isinstance(item, dict)]

    if not isinstance(parsed, dict):
        return []

    value = parsed.get(fieldName)
    if not isinstance(value, list):
        return []

    return [dict(item) for item in value if isinstance(item, dict)]


def StripCodeFence(text: str) -> str:
    codeFencePattern = re.compile(r"^```(?:json)?\s*([\s\S]*?)\s*```$", re.IGNORECASE)
    match = codeFencePattern.match(text)
    if match:
        return match.group(1).strip()
    return text


def ExtractEmbeddedJson(text: str) -> str:
    objectMatch = re.search(r"\{[\s\S]*\}", text)
    if objectMatch:
        return objectMatch.group(0)

    arrayMatch = re.search(r"\[[\s\S]*\]", text)
    if arrayMatch:
        return arrayMatch.group(0)

    return ""


def FileToDataUrl(uploadedFile: Any) -> str:
    mimeType = uploadedFile.type or "application/octet-stream"
    payload = base64.b64encode(uploadedFile.getbuffer()).decode("ascii")
    return f"data:{mimeType};base64,{payload}"


def ExtractCardsFromImages(
    client: OpenAI,
    model: str,
    uploads: List[Any],
    progressCallback: ProgressCallback = None,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    candidates: List[Dict[str, Any]] = []
    errors: List[str] = []
    totalUploads = len(uploads)

    for uploadIndex, upload in enumerate(uploads, start=1):
        if progressCallback:
            progressCallback(uploadIndex - 1, totalUploads, f"Scanning {upload.name} ({uploadIndex}/{totalUploads})")

        try:
            raw = RequestResponseText(
                client,
                model,
                [
                    {"role": "system", "content": ImageOcrPrompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_text",
                                "text": (
                                    "Extract visible Japanese vocabulary candidates for dictionary lookup. "
                                    "Prioritize canonical kanji+okurigana spellings when visible. "
                                    "If only kana is visible, keep kana."
                                ),
                            },
                            {
                                "type": "input_text",
                                "text": (
                                    "Return each item with visible_text plus best-effort kanji and kana. "
                                    "Do not invent words that are not clearly visible."
                                ),
                            },
                            {"type": "input_image", "image_url": FileToDataUrl(upload)},
                        ],
                    },
                ],
            )
            parsed = ParseJsonResponse(raw)
            for item in parsed.get("items", []):
                visibleText = (item.get("visible_text") or "").strip()
                kanji = (item.get("kanji") or visibleText).strip()
                kana = (item.get("kana") or "").strip()
                confidence = float(item.get("confidence") or 0)
                if not (kanji or kana or visibleText):
                    continue
                candidates.append(
                    {
                        "visible_text": visibleText,
                        "kanji": kanji,
                        "kana": kana,
                        "confidence": confidence,
                        "image_name": upload.name,
                    }
                )
        except Exception as exc:
            errors.append(f"{upload.name}: {exc}")
        finally:
            if progressCallback:
                progressCallback(uploadIndex, totalUploads, f"Scanned {upload.name} ({uploadIndex}/{totalUploads})")

    return candidates, errors


def GenerateReadingComprehensionPackage(
    client: OpenAI,
    model: str,
    preferredVocabulary: List[Dict[str, str]],
    supportVocabulary: List[Dict[str, str]],
    readingLevel: str = "intermediate",
    sourceStyle: str = "story",
    topicHint: str = "",
    questionCount: int = 4,
) -> Dict[str, Any]:
    normalizedLevel = (readingLevel or "intermediate").strip().lower() or "intermediate"
    normalizedSourceStyle = (sourceStyle or "story").strip().lower() or "story"
    normalizedTopicHint = (topicHint or "").strip()
    normalizedQuestionCount = max(3, min(6, int(questionCount or 4)))

    promptPayload = {
        "task": "Generate a Japanese reading-comprehension package for learners.",
        "reading_level": normalizedLevel,
        "source_style": normalizedSourceStyle,
        "topic_hint": normalizedTopicHint,
        "question_count": normalizedQuestionCount,
        "preferred_vocabulary": preferredVocabulary[:48],
        "support_vocabulary": supportVocabulary[:96],
        "rules": [
            "Write the passage entirely in Japanese.",
            "Use the preferred_vocabulary heavily; those deck words should drive the situation and topic.",
            "Support vocabulary may appear, but only as secondary reinforcement.",
            "Introduce new words slowly and sparingly. At most 6 new words total.",
            "If source_style is 'news_style', write in an original short news-report style. Do not quote or imitate a real article.",
            "All quiz questions, answer choices, and explanations must be in Japanese.",
            "Questions must be multiple choice with exactly 4 answer choices each.",
            "Return JSON only.",
        ],
        "json_schema": {
            "title": "string",
            "source_note": "string",
            "passage": "string",
            "questions": [
                {
                    "id": "string",
                    "question": "string",
                    "choices": ["string", "string", "string", "string"],
                    "correct_index": 0,
                    "explanation": "string",
                }
            ],
            "new_words": [
                {
                    "word": "string",
                    "reading": "string",
                    "meaning": "string",
                    "part_of_speech": "string",
                    "note": "string",
                }
            ],
        },
    }

    raw = RequestResponseText(
        client,
        model,
        [
            {
                "role": "system",
                "content": (
                    "You create Japanese reading-comprehension material for learners. "
                    "Be precise, natural, and curriculum-aware. "
                    "Output valid JSON only."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": json.dumps(promptPayload, ensure_ascii=False),
                    }
                ],
            },
        ],
    )
    parsed = CoerceJsonObject(ParseJsonResponse(raw))

    title = str(parsed.get("title") or "").strip() or "読解"
    sourceNote = str(parsed.get("source_note") or "").strip()
    passage = str(parsed.get("passage") or "").strip()

    if not passage:
        raise ValueError("The reading passage was empty.")

    questions: List[Dict[str, Any]] = []
    for index, rawQuestion in enumerate(CoerceJsonObjectList(parsed, "questions"), start=1):
        question = str(rawQuestion.get("question") or "").strip()
        choices = [str(choice or "").strip() for choice in rawQuestion.get("choices") or []]
        explanation = str(rawQuestion.get("explanation") or "").strip()
        try:
            correctIndex = int(rawQuestion.get("correct_index", 0))
        except (TypeError, ValueError):
            correctIndex = 0

        if not question or len(choices) != 4 or not explanation:
            continue
        if correctIndex < 0 or correctIndex >= len(choices):
            continue

        questions.append(
            {
                "id": str(rawQuestion.get("id") or f"q{index}").strip() or f"q{index}",
                "question": question,
                "choices": choices,
                "correct_index": correctIndex,
                "explanation": explanation,
            }
        )

    if len(questions) < 3:
        raise ValueError("The AI did not return enough quiz questions.")

    newWords: List[Dict[str, str]] = []
    for rawWord in CoerceJsonObjectList(parsed, "new_words"):
        word = str(rawWord.get("word") or "").strip()
        reading = str(rawWord.get("reading") or "").strip()
        meaning = str(rawWord.get("meaning") or "").strip()
        partOfSpeech = str(rawWord.get("part_of_speech") or "").strip()
        note = str(rawWord.get("note") or "").strip()
        if not word:
            continue
        newWords.append(
            {
                "word": word,
                "reading": reading or word,
                "meaning": meaning,
                "part_of_speech": partOfSpeech,
                "note": note,
            }
        )

    return {
        "title": title,
        "source_note": sourceNote,
        "passage": passage,
        "questions": questions[:normalizedQuestionCount],
        "new_words": newWords[:6],
        "reading_level": normalizedLevel,
        "source_style": normalizedSourceStyle,
        "topic_hint": normalizedTopicHint,
    }


def NormalizeStringArray(values: Any) -> List[str]:
    normalizedItems: List[str] = []
    for rawValue in values or []:
        value = str(rawValue or "").strip()
        if not value or value in normalizedItems:
            continue
        normalizedItems.append(value)
    return normalizedItems


def NormalizeReadingQuestions(rawQuestions: Any, minimumCount: int = 1) -> List[Dict[str, Any]]:
    questions: List[Dict[str, Any]] = []
    for index, rawQuestion in enumerate(rawQuestions or [], start=1):
        if not isinstance(rawQuestion, dict):
            continue
        question = str(rawQuestion.get("question") or "").strip()
        choices = [str(choice or "").strip() for choice in rawQuestion.get("choices") or []]
        explanation = str(rawQuestion.get("explanation") or "").strip()
        try:
            correctIndex = int(rawQuestion.get("correct_index", 0))
        except (TypeError, ValueError):
            correctIndex = 0

        if not question or len(choices) != 4:
            continue
        if correctIndex < 0 or correctIndex >= len(choices):
            continue

        questions.append(
            {
                "id": str(rawQuestion.get("id") or f"q{index}").strip() or f"q{index}",
                "question": question,
                "choices": choices,
                "correct_index": correctIndex,
                "explanation": explanation,
            }
        )

    if len(questions) < minimumCount:
        raise ValueError("The AI did not return enough quiz questions.")
    return questions


def NormalizeNewWordEntries(rawWords: Any) -> List[Dict[str, str]]:
    newWords: List[Dict[str, str]] = []
    for rawWord in rawWords or []:
        if not isinstance(rawWord, dict):
            continue
        word = str(rawWord.get("word") or "").strip()
        reading = str(rawWord.get("reading") or "").strip()
        meaning = str(rawWord.get("meaning") or "").strip()
        partOfSpeech = str(rawWord.get("part_of_speech") or "").strip()
        note = str(rawWord.get("note") or "").strip()
        if not word:
            continue
        newWords.append(
            {
                "word": word,
                "reading": reading or word,
                "meaning": meaning,
                "part_of_speech": partOfSpeech,
                "note": note,
            }
        )
    return newWords


def GenerateScenarioSuggestions(
    client: OpenAI,
    model: str,
    preferredVocabulary: List[Dict[str, str]],
    supportVocabulary: List[Dict[str, str]],
    mode: str,
    existingTitles: Optional[List[str]] = None,
    count: int = 6,
) -> List[Dict[str, Any]]:
    normalizedMode = (mode or "reading").strip().lower() or "reading"
    normalizedCount = max(3, min(8, int(count or 6)))
    suggestionType = "reading topics and situations" if normalizedMode == "reading" else "conversation topics and situations"

    promptPayload = {
        "task": f"Generate {suggestionType} for a Japanese learner.",
        "mode": normalizedMode,
        "count": normalizedCount,
        "existing_titles_to_avoid": NormalizeStringArray(existingTitles or []),
        "preferred_vocabulary": preferredVocabulary[:48],
        "support_vocabulary": supportVocabulary[:96],
        "rules": [
            "Use the preferred_vocabulary heavily when deciding the best situations.",
            "Support vocabulary may broaden the scenario, but deck words should stay central.",
            "Keep titles concrete and useful, not generic.",
            "Return JSON only.",
        ],
        "mode_specific_rules": (
            [
                "Reading scenarios should suggest short article or story situations a learner can read.",
                "Use style values like story or news_style.",
                "Question count should be between 3 and 6.",
            ]
            if normalizedMode == "reading"
            else [
                "Conversation scenarios should suggest believable back-and-forth situations.",
                "Use style values like casual, polite, practical, or interview.",
                "Question count can stay 0 for conversation scenarios.",
            ]
        ),
        "json_schema": {
            "items": [
                {
                    "title": "string",
                    "summary": "string",
                    "topic_hint": "string",
                    "difficulty": "beginner|intermediate|advanced",
                    "style": "string",
                    "question_count": 4,
                    "tags": ["string"],
                }
            ]
        },
    }

    raw = RequestResponseText(
        client,
        model,
        [
            {
                "role": "system",
                "content": (
                    "You design Japanese learning scenarios. "
                    "Prioritize relevance to the learner's known vocabulary. "
                    "Output valid JSON only."
                ),
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": json.dumps(promptPayload, ensure_ascii=False)}],
            },
        ],
    )
    parsed = ParseJsonResponse(raw)

    suggestions: List[Dict[str, Any]] = []
    for rawItem in CoerceJsonObjectList(parsed, "items"):
        title = str(rawItem.get("title") or "").strip()
        summary = str(rawItem.get("summary") or "").strip()
        topicHint = str(rawItem.get("topic_hint") or "").strip()
        difficulty = str(rawItem.get("difficulty") or "intermediate").strip().lower() or "intermediate"
        style = str(rawItem.get("style") or "").strip()
        try:
            questionCount = int(rawItem.get("question_count", 4))
        except (TypeError, ValueError):
            questionCount = 4
        tags = NormalizeStringArray(rawItem.get("tags") or [])
        if not title or not summary:
            continue
        suggestions.append(
            {
                "title": title,
                "summary": summary,
                "topic_hint": topicHint or title,
                "difficulty": difficulty,
                "style": style,
                "question_count": max(0, min(6, questionCount)),
                "tags": tags[:8],
            }
        )

    if not suggestions:
        raise ValueError("The AI did not return any scenario suggestions.")
    return suggestions[:normalizedCount]


def GenerateReadingMaterial(
    client: OpenAI,
    model: str,
    preferredVocabulary: List[Dict[str, str]],
    supportVocabulary: List[Dict[str, str]],
    scenario: Dict[str, Any],
) -> Dict[str, Any]:
    promptPayload = {
        "task": "Generate Japanese reading material for a learner.",
        "scenario": scenario,
        "preferred_vocabulary": preferredVocabulary[:48],
        "support_vocabulary": supportVocabulary[:96],
        "rules": [
            "Write the passage entirely in Japanese.",
            "Use the preferred_vocabulary heavily; those words should shape the topic.",
            "Support vocabulary may appear, but only as secondary reinforcement.",
            "Introduce new words slowly and sparingly. At most 6 new words total.",
            "If the scenario style is news_style, write an original short news-style passage. Do not imitate a real article.",
            "Return JSON only.",
        ],
        "json_schema": {
            "title": "string",
            "source_note": "string",
            "passage": "string",
            "new_words": [
                {
                    "word": "string",
                    "reading": "string",
                    "meaning": "string",
                    "part_of_speech": "string",
                    "note": "string",
                }
            ],
        },
    }

    raw = RequestResponseText(
        client,
        model,
        [
            {
                "role": "system",
                "content": (
                    "You create Japanese reading passages for learners. "
                    "Keep the language natural, level-aware, and useful for vocabulary reinforcement. "
                    "Output valid JSON only."
                ),
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": json.dumps(promptPayload, ensure_ascii=False)}],
            },
        ],
    )
    parsed = CoerceJsonObject(ParseJsonResponse(raw))

    title = str(parsed.get("title") or scenario.get("title") or "").strip() or "読解"
    sourceNote = str(parsed.get("source_note") or "").strip()
    passage = str(parsed.get("passage") or "").strip()
    if not passage:
        raise ValueError("The reading passage was empty.")

    return {
        "title": title,
        "source_note": sourceNote,
        "passage": passage,
        "new_words": NormalizeNewWordEntries(CoerceJsonObjectList(parsed, "new_words"))[:6],
    }


def GenerateReadingQuestionsFromPassage(
    client: OpenAI,
    model: str,
    title: str,
    passage: str,
    questionCount: int = 4,
    variationHint: str = "",
) -> List[Dict[str, Any]]:
    normalizedQuestionCount = max(3, min(6, int(questionCount or 4)))
    promptPayload = {
        "task": "Generate Japanese reading comprehension questions from a passage.",
        "title": (title or "").strip(),
        "passage": (passage or "").strip(),
        "question_count": normalizedQuestionCount,
        "variation_hint": (variationHint or "").strip(),
        "rules": [
            "All questions, answer choices, and explanations must be in Japanese.",
            "Questions must be multiple choice with exactly 4 answer choices each.",
            "Use a different angle or detail focus than a prior run when the variation_hint changes.",
            "Return JSON only.",
        ],
        "json_schema": {
            "questions": [
                {
                    "id": "string",
                    "question": "string",
                    "choices": ["string", "string", "string", "string"],
                    "correct_index": 0,
                    "explanation": "string",
                }
            ]
        },
    }

    raw = RequestResponseText(
        client,
        model,
        [
            {
                "role": "system",
                "content": (
                    "You create Japanese reading quiz questions. "
                    "The questions must stay faithful to the passage and remain fully in Japanese. "
                    "Output valid JSON only."
                ),
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": json.dumps(promptPayload, ensure_ascii=False)}],
            },
        ],
    )
    parsed = ParseJsonResponse(raw)
    return NormalizeReadingQuestions(CoerceJsonObjectList(parsed, "questions"), minimumCount=3)[
        :normalizedQuestionCount
    ]


def GenerateConversationOpening(
    client: OpenAI,
    model: str,
    preferredVocabulary: List[Dict[str, str]],
    supportVocabulary: List[Dict[str, str]],
    scenario: Dict[str, Any],
) -> Dict[str, Any]:
    promptPayload = {
        "task": "Start a Japanese conversation practice scenario.",
        "scenario": scenario,
        "preferred_vocabulary": preferredVocabulary[:40],
        "support_vocabulary": supportVocabulary[:72],
        "rules": [
            "Reply entirely in Japanese.",
            "Open the conversation naturally based on the scenario.",
            "Keep the opening to 2 or 3 short sentences.",
            "Return JSON only.",
        ],
        "json_schema": {
            "partner_name": "string",
            "opening_message": "string",
        },
    }

    raw = RequestResponseText(
        client,
        model,
        [
            {
                "role": "system",
                "content": (
                    "You are a Japanese conversation practice partner. "
                    "Stay inside the requested scenario and keep the language teachable. "
                    "Output valid JSON only."
                ),
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": json.dumps(promptPayload, ensure_ascii=False)}],
            },
        ],
    )
    parsed = CoerceJsonObject(ParseJsonResponse(raw))
    openingMessage = str(parsed.get("opening_message") or "").strip()
    if not openingMessage:
        raise ValueError("The conversation opening was empty.")
    return {
        "partner_name": str(parsed.get("partner_name") or "AI Partner").strip() or "AI Partner",
        "opening_message": openingMessage,
    }


def GenerateConversationReply(
    client: OpenAI,
    model: str,
    preferredVocabulary: List[Dict[str, str]],
    supportVocabulary: List[Dict[str, str]],
    scenario: Dict[str, Any],
    history: List[Dict[str, str]],
    userMessage: str,
) -> Dict[str, Any]:
    promptPayload = {
        "task": "Continue a Japanese conversation practice scenario.",
        "scenario": scenario,
        "preferred_vocabulary": preferredVocabulary[:40],
        "support_vocabulary": supportVocabulary[:72],
        "conversation_history": history[-12:],
        "latest_user_message": (userMessage or "").strip(),
        "rules": [
            "Reply entirely in Japanese.",
            "Stay in character for the scenario.",
            "Keep the reply to 2 or 3 short paragraphs or sentences.",
            "You may gently rephrase or naturally model better Japanese, but do not switch into an explicit teacher lecture.",
            "Return JSON only.",
        ],
        "json_schema": {
            "reply": "string",
            "should_wrap_up": False,
        },
    }

    raw = RequestResponseText(
        client,
        model,
        [
            {
                "role": "system",
                "content": (
                    "You are a Japanese conversation partner for a learner. "
                    "Respond naturally, clearly, and in Japanese only. "
                    "Output valid JSON only."
                ),
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": json.dumps(promptPayload, ensure_ascii=False)}],
            },
        ],
    )
    parsed = CoerceJsonObject(ParseJsonResponse(raw))
    reply = str(parsed.get("reply") or "").strip()
    if not reply:
        raise ValueError("The conversation reply was empty.")
    return {
        "reply": reply,
        "should_wrap_up": bool(parsed.get("should_wrap_up", False)),
    }


def GenerateConversationFeedback(
    client: OpenAI,
    model: str,
    scenario: Dict[str, Any],
    history: List[Dict[str, str]],
) -> Dict[str, Any]:
    promptPayload = {
        "task": "Evaluate a Japanese learner conversation.",
        "scenario": scenario,
        "conversation_history": history[-20:],
        "rules": [
            "Assess the learner's Japanese performance.",
            "Be concrete and concise.",
            "Use short Japanese examples where useful, but explain the overall feedback in English.",
            "Return JSON only.",
        ],
        "json_schema": {
            "score_percent": 0,
            "summary": "string",
            "correct_points": ["string"],
            "incorrect_points": ["string"],
            "strengths": ["string"],
            "weaknesses": ["string"],
            "improvements": ["string"],
        },
    }

    raw = RequestResponseText(
        client,
        model,
        [
            {
                "role": "system",
                "content": (
                    "You evaluate Japanese learner conversations. "
                    "Be specific, fair, and actionable. "
                    "Output valid JSON only."
                ),
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": json.dumps(promptPayload, ensure_ascii=False)}],
            },
        ],
    )
    parsed = CoerceJsonObject(ParseJsonResponse(raw))

    try:
        scorePercent = int(parsed.get("score_percent", 0))
    except (TypeError, ValueError):
        scorePercent = 0

    return {
        "score_percent": max(0, min(100, scorePercent)),
        "summary": str(parsed.get("summary") or "").strip(),
        "correct_points": NormalizeStringArray(parsed.get("correct_points")),
        "incorrect_points": NormalizeStringArray(parsed.get("incorrect_points")),
        "strengths": NormalizeStringArray(parsed.get("strengths")),
        "weaknesses": NormalizeStringArray(parsed.get("weaknesses")),
        "improvements": NormalizeStringArray(parsed.get("improvements")),
    }
