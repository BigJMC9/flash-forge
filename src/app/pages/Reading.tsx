import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import {
  BookOpenText,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { callAction, errorMessage } from '../lib/backend';
import type {
  AiScenarioRow,
  PracticeRoundOptions,
  ReadingSessionResponse,
  ScenarioListResponse,
} from '../types';

const READING_LEVEL_OPTIONS = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
];

const READING_SOURCE_OPTIONS = [
  { key: 'story', label: 'Deck-Focused Story' },
  { key: 'news_style', label: 'News Style' },
];

function scenarioCardTone(active: boolean): string {
  if (active) {
    return 'app-select-card app-select-card-active';
  }
  return 'app-select-card';
}

function optionButtonClass(active: boolean): string {
  return active ? 'app-option app-option-active' : 'app-option';
}

export function Reading() {
  const { deckId = '' } = useParams<{ deckId: string }>();
  const { decks, refreshBootstrap, setCurrentDeck, setStatus } = useApp();

  const [scenarios, setScenarios] = useState<AiScenarioRow[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [isGeneratingScenarios, setIsGeneratingScenarios] = useState(false);
  const [isCreatingScenario, setIsCreatingScenario] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isReportingCompletion, setIsReportingCompletion] = useState(false);
  const [shouldGenerateMore, setShouldGenerateMore] = useState(false);
  const [recommendedReason, setRecommendedReason] = useState('');

  const [customTitle, setCustomTitle] = useState('');
  const [customSummary, setCustomSummary] = useState('');
  const [readingLevel, setReadingLevel] =
    useState<PracticeRoundOptions['reading_level']>('intermediate');
  const [readingSource, setReadingSource] =
    useState<PracticeRoundOptions['reading_source']>('story');
  const [readingTopic, setReadingTopic] = useState('');
  const [readingQuestionCount, setReadingQuestionCount] = useState(4);

  const [session, setSession] = useState<ReadingSessionResponse | null>(null);
  const [readingSelections, setReadingSelections] = useState<
    Record<string, number>
  >({});
  const [readingSubmitted, setReadingSubmitted] = useState(false);
  const [readingCompletionReported, setReadingCompletionReported] =
    useState(false);
  const [readingWordStatus, setReadingWordStatus] = useState<
    Record<string, string>
  >({});

  const deck = decks.find((item) => item.id === deckId) ?? null;
  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null;

  const readingResults = useMemo(() => {
    if (!session || !readingSubmitted) {
      return null;
    }

    const rows = session.questions.map((question) => {
      const selectedIndex = readingSelections[question.id];
      const isCorrect = selectedIndex === question.correct_index;
      return {
        ...question,
        selected_index: selectedIndex,
        selected_text:
          selectedIndex === undefined ? '未回答' : question.choices[selectedIndex],
        correct_text: question.choices[question.correct_index],
        is_correct: isCorrect,
      };
    });
    const correctAnswers = rows.filter((row) => row.is_correct).length;
    const total = rows.length;
    const percent = total === 0 ? 0 : Math.round((correctAnswers / total) * 100);

    return {
      rows,
      correctAnswers,
      total,
      percent,
      incorrectRows: rows.filter((row) => !row.is_correct),
    };
  }, [readingSelections, readingSubmitted, session]);

  const readingScoreBadgeClass = readingResults
    ? readingResults.percent >= 85
      ? 'app-badge-accent'
      : readingResults.percent >= 60
        ? 'app-badge-muted'
        : 'app-badge'
    : 'app-badge-muted';

  const loadScenarios = async () => {
    if (!deckId) {
      setScenarios([]);
      setSelectedScenarioId('');
      return;
    }

    try {
      setIsLoadingScenarios(true);
      const response = await callAction<ScenarioListResponse>(
        'list_reading_scenarios',
        { deck_id: deckId },
      );
      setScenarios(response.scenarios ?? []);
      setShouldGenerateMore(Boolean(response.should_generate_more));
      setRecommendedReason(response.recommended_reason ?? '');
      setSelectedScenarioId((previous) => {
        if (previous && response.scenarios.some((item) => item.id === previous)) {
          return previous;
        }
        return response.scenarios[0]?.id ?? '';
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsLoadingScenarios(false);
    }
  };

  useEffect(() => {
    if (!deckId) {
      return;
    }
    setCurrentDeck(deckId);
    void loadScenarios();
  }, [deckId, setCurrentDeck]);

  const buildReadingOptions = (): PracticeRoundOptions => ({
    round_size: 18,
    verb_forms: ['te', 'past', 'negative'],
    adjective_forms: ['past', 'negative'],
    verb_sort_only_ru_endings: false,
    verb_sort_include_suru_verbs: true,
    verb_sort_include_suru_nouns: true,
    adjective_sort_only_i_endings: false,
    reading_level: readingLevel,
    reading_source: readingSource,
    reading_topic: readingTopic.trim(),
    reading_question_count: readingQuestionCount,
  });

  const generateSuggestedScenarios = async () => {
    if (!deckId) {
      return;
    }

    try {
      setIsGeneratingScenarios(true);
      const response = await callAction<ScenarioListResponse>(
        'generate_reading_scenarios',
        {
          deck_id: deckId,
          count: 6,
        },
      );
      setScenarios(response.scenarios ?? []);
      setShouldGenerateMore(Boolean(response.should_generate_more));
      setRecommendedReason(response.recommended_reason ?? '');
      setSelectedScenarioId((response.scenarios ?? [])[0]?.id ?? '');
      setStatus({
        type: 'success',
        message: `Generated ${response.generated_count ?? 0} reading scenario suggestion(s).`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsGeneratingScenarios(false);
    }
  };

  const createScenario = async () => {
    if (!deckId) {
      return;
    }

    try {
      setIsCreatingScenario(true);
      const response = await callAction<{ scenario: AiScenarioRow }>(
        'create_reading_scenario',
        {
          deck_id: deckId,
          title: customTitle.trim(),
          summary: customSummary.trim(),
          options: buildReadingOptions(),
        },
      );
      setCustomTitle('');
      setCustomSummary('');
      setReadingTopic('');
      await loadScenarios();
      setSelectedScenarioId(response.scenario.id);
      setStatus({
        type: 'success',
        message: `Added reading scenario "${response.scenario.title}".`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsCreatingScenario(false);
    }
  };

  const startReading = async (refreshMaterial = false) => {
    const scenarioId = selectedScenario?.id;
    if (!deckId || !scenarioId) {
      return;
    }

    try {
      setIsStartingSession(true);
      const response = await callAction<ReadingSessionResponse>(
        'start_reading_session',
        {
          deck_id: deckId,
          scenario_id: scenarioId,
          refresh_material: refreshMaterial,
        },
      );
      setSession(response);
      setReadingSelections({});
      setReadingSubmitted(false);
      setReadingCompletionReported(false);
      setReadingWordStatus({});
      setSelectedScenarioId(response.scenario.id);
      setStatus({
        type: 'success',
        message: refreshMaterial
          ? 'Generated a fresh reading passage.'
          : response.cached_material
            ? 'Loaded cached reading passage with fresh questions.'
            : 'Generated a new reading passage and quiz.',
      });
      await loadScenarios();
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsStartingSession(false);
    }
  };

  const submitReadingQuiz = async () => {
    if (!session) {
      return;
    }

    setReadingSubmitted(true);
    const total = session.questions.length;
    const answered = Object.keys(readingSelections).length;

    if (!readingCompletionReported) {
      try {
        setIsReportingCompletion(true);
        await callAction('complete_reading_session', {
          scenario_id: session.scenario.id,
        });
        setReadingCompletionReported(true);
        await loadScenarios();
      } catch (error) {
        setStatus({
          type: 'error',
          message: errorMessage(error),
        });
      } finally {
        setIsReportingCompletion(false);
      }
    }

    setStatus({
      type: answered === total ? 'success' : 'warning',
      message:
        answered === total
          ? 'Reading quiz graded.'
          : `Reading quiz graded with ${total - answered} unanswered question(s).`,
    });
  };

  const addReadingWord = async (
    wordKey: string,
    destination: 'deck' | 'global',
    word: {
      word: string;
      reading: string;
      meaning: string;
      part_of_speech: string;
      note: string;
    },
  ) => {
    try {
      setReadingWordStatus((previous) => ({
        ...previous,
        [`${wordKey}:${destination}`]: 'Adding...',
      }));
      const response = await callAction<{
        added: boolean;
        method: 'dictionary' | 'manual';
      }>('add_reading_new_word', {
        deck_id: deckId,
        destination,
        word: word.word,
        reading: word.reading,
        meaning: word.meaning,
        part_of_speech: word.part_of_speech,
        note: word.note,
      });
      await refreshBootstrap();
      setReadingWordStatus((previous) => ({
        ...previous,
        [`${wordKey}:${destination}`]: response.added
          ? `Added via ${response.method}`
          : 'Skipped duplicate',
      }));
      setStatus({
        type: response.added ? 'success' : 'warning',
        message: response.added
          ? `Added ${word.word} to the ${destination === 'deck' ? 'deck' : 'global library'}.`
          : `${word.word} was skipped because it already exists.`,
      });
    } catch (error) {
      setReadingWordStatus((previous) => ({
        ...previous,
        [`${wordKey}:${destination}`]: 'Add failed',
      }));
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  if (!deck) {
    return (
      <div className="app-page max-w-4xl">
        <div className="app-empty">
          Deck not found.
        </div>
      </div>
    );
  }

  return (
    <div className="app-page max-w-7xl">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">Reading: {deck.name}</h2>
          <p className="app-page-description">
            Cached reading topics, cached passages, and fresh quiz questions built
            around this deck and the global pool.
          </p>
        </div>
      </div>

      <div className="grid xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <div className="app-panel p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold">Scenario Pool</h3>
                <p className="text-sm text-gray-600">
                  Cached topics stay here until you ask for more.
                </p>
              </div>
              <button
                onClick={() => void generateSuggestedScenarios()}
                disabled={isGeneratingScenarios}
                className="app-btn-primary"
              >
                {isGeneratingScenarios ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate Suggestions
              </button>
            </div>
            {recommendedReason && (
              <div className="app-banner">
                {shouldGenerateMore ? 'Suggestion:' : 'Cache status:'} {recommendedReason}
              </div>
            )}
          </div>

          <div className="app-panel p-6">
            <h3 className="font-semibold mb-4">Add Custom Situation / Topic</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(event) => setCustomTitle(event.target.value)}
                  placeholder="After-school shopping, morning commute, weather report..."
                  className="app-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Summary
                </label>
                <textarea
                  value={customSummary}
                  onChange={(event) => setCustomSummary(event.target.value)}
                  rows={3}
                  placeholder="Optional note for the reading situation."
                  className="app-input"
                />
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Reading Level
                </div>
                <div className="flex flex-wrap gap-2">
                  {READING_LEVEL_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setReadingLevel(option.key)}
                      className={optionButtonClass(readingLevel === option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Passage Style
                </div>
                <div className="flex flex-wrap gap-2">
                  {READING_SOURCE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setReadingSource(option.key)}
                      className={optionButtonClass(readingSource === option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic Hint
                </label>
                <input
                  type="text"
                  value={readingTopic}
                  onChange={(event) => setReadingTopic(event.target.value)}
                  placeholder="commute, shopping, school, weather..."
                  className="app-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Count
                </label>
                <div className="flex flex-wrap gap-2">
                  {[3, 4, 5, 6].map((count) => (
                    <button
                      key={count}
                      onClick={() => setReadingQuestionCount(count)}
                      className={optionButtonClass(readingQuestionCount === count)}
                    >
                      {count} questions
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => void createScenario()}
                disabled={isCreatingScenario}
                className="app-btn-secondary w-full"
              >
                {isCreatingScenario ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Custom Reading
              </button>
            </div>
          </div>

          <div className="app-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Cached Scenarios</h3>
              {isLoadingScenarios && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {scenarios.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                  No reading scenarios are cached yet. Generate suggestions or add a custom topic.
                </div>
              ) : (
                scenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => setSelectedScenarioId(scenario.id)}
                    className={`w-full ${scenarioCardTone(scenario.id === selectedScenarioId)}`}
                  >
                    <div className="font-semibold text-gray-900 mb-1">
                      {scenario.title}
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      {scenario.summary}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="app-badge-muted">
                        {scenario.difficulty}
                      </span>
                      <span className="app-badge-muted">
                        {scenario.style || 'story'}
                      </span>
                      {scenario.has_cached_material && (
                        <span className="app-badge-accent">
                          Cached passage
                        </span>
                      )}
                      {scenario.is_custom && (
                        <span className="app-badge-accent">
                          Custom
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {selectedScenario && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-2">
                    Selected Scenario
                  </div>
                  <h3 className="text-2xl font-semibold text-slate-900 mb-2">
                    {selectedScenario.title}
                  </h3>
                  <p className="text-gray-600">{selectedScenario.summary}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void startReading(false)}
                    disabled={isStartingSession}
                    className="app-btn-primary"
                  >
                    {isStartingSession ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <BookOpenText className="w-4 h-4" />
                    )}
                    Open Reading
                  </button>
                  <button
                    onClick={() => void startReading(true)}
                    disabled={isStartingSession}
                    className="app-btn-secondary"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Passage
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <span className="app-badge-muted">
                  {selectedScenario.difficulty}
                </span>
                <span className="app-badge-muted">
                  {selectedScenario.style || 'story'}
                </span>
                <span className="app-badge-muted">
                  {selectedScenario.question_count} questions
                </span>
                <span className="app-badge-muted">
                  Used {selectedScenario.times_used}
                </span>
                <span className="app-badge-muted">
                  Completed {selectedScenario.times_completed}
                </span>
              </div>

              {selectedScenario.topic_hint && (
                <div className="mt-4 text-sm text-gray-600">
                  Topic focus: {selectedScenario.topic_hint}
                </div>
              )}
            </div>
          )}

          {session ? (
            <>
              <div className="app-panel p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-1">
                      Reading Session
                    </div>
                    <h3 className="text-2xl font-semibold text-slate-900">
                      {session.title}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="app-badge-muted">
                      {session.cached_material
                        ? 'Cached passage'
                        : 'Freshly generated passage'}
                    </span>
                    {session.source_note && (
                      <span className="app-badge-accent">
                        {session.source_note}
                      </span>
                    )}
                  </div>
                </div>

                <div className="app-panel-muted p-8">
                  <div className="whitespace-pre-wrap text-lg leading-9 text-slate-900">
                    {session.passage}
                  </div>
                </div>
              </div>

              <div className="app-panel p-6">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="font-semibold">Reading Quiz</h3>
                    <p className="text-sm text-gray-600">
                      Fresh questions are generated each time from the cached passage.
                    </p>
                  </div>
                  {isReportingCompletion && (
                    <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving completion
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {session.questions.map((question, index) => (
                    <div
                      key={question.id}
                      className="app-panel-muted p-5"
                    >
                      <div className="font-medium text-slate-900 mb-4">
                        {index + 1}. {question.question}
                      </div>
                      <div className="grid gap-3">
                        {question.choices.map((choice, choiceIndex) => {
                          const selected =
                            readingSelections[question.id] === choiceIndex;
                          return (
                            <button
                              key={`${question.id}-${choiceIndex}`}
                              onClick={() =>
                                setReadingSelections((previous) => ({
                                  ...previous,
                                  [question.id]: choiceIndex,
                                }))
                              }
                              disabled={readingSubmitted}
                              className={`${selected ? 'app-select-card app-select-card-active' : 'app-select-card'} ${readingSubmitted ? 'cursor-default' : ''}`}
                            >
                              {choice}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 mt-6">
                  {!readingSubmitted ? (
                    <button
                      onClick={() => void submitReadingQuiz()}
                      className="app-btn-primary"
                    >
                      <BookOpenText className="w-4 h-4" />
                      Grade Quiz
                    </button>
                  ) : (
                    <button
                      onClick={() => void startReading(false)}
                      className="app-btn-primary"
                    >
                      <RefreshCw className="w-4 h-4" />
                      New Question Set
                    </button>
                  )}
                </div>
              </div>

              {readingResults && (
                <div className="app-panel p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-semibold">Results</h3>
                      <p className="text-sm text-gray-600">
                        Review the misses, then add any new useful words.
                      </p>
                    </div>
                    <span className={`${readingScoreBadgeClass} px-4 py-2 text-sm font-semibold`}>
                      {readingResults.correctAnswers}/{readingResults.total} correct (
                      {readingResults.percent}%)
                    </span>
                  </div>

                  {readingResults.incorrectRows.length > 0 && (
                    <div className="space-y-4 mb-6">
                      <h4 className="font-medium">Where You Missed</h4>
                      {readingResults.incorrectRows.map((row) => (
                        <div key={row.id} className="app-panel-muted p-4">
                          <div className="font-medium text-gray-900 mb-2">
                            {row.question}
                          </div>
                          <div className="text-sm text-gray-700 mb-1">
                            Your answer: {row.selected_text}
                          </div>
                          <div className="text-sm text-gray-700 mb-2">
                            Correct answer: {row.correct_text}
                          </div>
                          <div className="text-sm text-gray-600">
                            {row.explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium mb-4">New Words Introduced</h4>
                    {session.new_words.length === 0 ? (
                      <div className="app-banner">
                        No new words were introduced in this passage.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {session.new_words.map((word, index) => {
                          const wordKey = `${word.word}:${word.reading}:${index}`;
                          return (
                            <div key={wordKey} className="app-panel-muted p-4">
                              <div className="font-semibold text-slate-900 mb-1">
                                {word.word} [{word.reading}]
                              </div>
                              <div className="text-sm text-slate-600 mb-1">
                                {word.meaning || 'Meaning not provided'}
                              </div>
                              <div className="text-xs text-slate-500 mb-3">
                                {word.part_of_speech || 'Part of speech not provided'}
                                {word.note ? ` | ${word.note}` : ''}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() =>
                                    void addReadingWord(wordKey, 'global', word)
                                  }
                                  className="app-btn-secondary"
                                >
                                  Add to Global
                                </button>
                                <button
                                  onClick={() =>
                                    void addReadingWord(wordKey, 'deck', word)
                                  }
                                  className="app-btn-primary"
                                >
                                  Add to Deck
                                </button>
                              </div>
                              {(readingWordStatus[`${wordKey}:global`] ||
                                readingWordStatus[`${wordKey}:deck`]) && (
                                <div className="mt-3 text-xs text-slate-500">
                                  {readingWordStatus[`${wordKey}:global`]
                                    ? `Global: ${readingWordStatus[`${wordKey}:global`]}`
                                    : ''}
                                  {readingWordStatus[`${wordKey}:global`] &&
                                  readingWordStatus[`${wordKey}:deck`]
                                    ? ' | '
                                    : ''}
                                  {readingWordStatus[`${wordKey}:deck`]
                                    ? `Deck: ${readingWordStatus[`${wordKey}:deck`]}`
                                    : ''}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="app-empty">
              {selectedScenario
                ? 'Select "Open Reading" to load the cached passage or generate one for this scenario.'
                : 'Generate or add a reading scenario to get started.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
