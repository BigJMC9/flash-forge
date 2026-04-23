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
    return 'border-sky-500 bg-sky-50 shadow-sm';
  }
  return 'border-gray-200 bg-white hover:border-gray-300';
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
      ? 'bg-emerald-50 text-emerald-700'
      : readingResults.percent >= 60
        ? 'bg-amber-50 text-amber-700'
        : 'bg-rose-50 text-rose-700'
    : 'bg-slate-50 text-slate-700';

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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg p-8 border border-gray-200 text-center text-gray-500">
          Deck not found.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Reading: {deck.name}</h2>
      <p className="text-gray-600 mb-6">
        Cached reading topics, cached passages, and fresh quiz questions built
        around this deck and the global pool.
      </p>

      <div className="grid xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
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
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
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
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {shouldGenerateMore ? 'Suggestion:' : 'Cache status:'} {recommendedReason}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
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
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        readingLevel === option.key
                          ? 'bg-sky-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
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
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        readingSource === option.key
                          ? 'bg-sky-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
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
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        readingQuestionCount === count
                          ? 'bg-sky-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {count} questions
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => void createScenario()}
                disabled={isCreatingScenario}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-70"
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

          <div className="bg-white rounded-lg p-4 border border-gray-200">
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
                    className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${scenarioCardTone(
                      scenario.id === selectedScenarioId,
                    )}`}
                  >
                    <div className="font-semibold text-gray-900 mb-1">
                      {scenario.title}
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      {scenario.summary}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {scenario.difficulty}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {scenario.style || 'story'}
                      </span>
                      {scenario.has_cached_material && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          Cached passage
                        </span>
                      )}
                      {scenario.is_custom && (
                        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
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
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
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
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Passage
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {selectedScenario.difficulty}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {selectedScenario.style || 'story'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {selectedScenario.question_count} questions
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  Used {selectedScenario.times_used}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
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
              <div className="bg-white rounded-lg p-6 border border-gray-200">
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
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {session.cached_material
                        ? 'Cached passage'
                        : 'Freshly generated passage'}
                    </span>
                    {session.source_note && (
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                        {session.source_note}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-8">
                  <div className="whitespace-pre-wrap text-lg leading-9 text-slate-900">
                    {session.passage}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200">
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
                      className="rounded-2xl border border-gray-200 p-5"
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
                              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                                selected
                                  ? 'border-sky-500 bg-sky-50 text-sky-900'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              } ${readingSubmitted ? 'cursor-default' : ''}`}
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
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-3 font-medium text-white hover:bg-sky-700"
                    >
                      <BookOpenText className="w-4 h-4" />
                      Grade Quiz
                    </button>
                  ) : (
                    <button
                      onClick={() => void startReading(false)}
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-3 font-medium text-white hover:bg-sky-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      New Question Set
                    </button>
                  )}
                </div>
              </div>

              {readingResults && (
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-semibold">Results</h3>
                      <p className="text-sm text-gray-600">
                        Review the misses, then add any new useful words.
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${readingScoreBadgeClass}`}
                    >
                      {readingResults.correctAnswers}/{readingResults.total} correct (
                      {readingResults.percent}%)
                    </span>
                  </div>

                  {readingResults.incorrectRows.length > 0 && (
                    <div className="space-y-4 mb-6">
                      <h4 className="font-medium">Where You Missed</h4>
                      {readingResults.incorrectRows.map((row) => (
                        <div
                          key={row.id}
                          className="rounded-2xl border border-rose-200 bg-rose-50 p-4"
                        >
                          <div className="font-medium text-rose-900 mb-2">
                            {row.question}
                          </div>
                          <div className="text-sm text-rose-900 mb-1">
                            Your answer: {row.selected_text}
                          </div>
                          <div className="text-sm text-rose-900 mb-2">
                            Correct answer: {row.correct_text}
                          </div>
                          <div className="text-sm text-rose-800">
                            {row.explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium mb-4">New Words Introduced</h4>
                    {session.new_words.length === 0 ? (
                      <div className="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        No new words were introduced in this passage.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {session.new_words.map((word, index) => {
                          const wordKey = `${word.word}:${word.reading}:${index}`;
                          return (
                            <div
                              key={wordKey}
                              className="rounded-2xl border border-gray-200 p-4"
                            >
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
                                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  Add to Global
                                </button>
                                <button
                                  onClick={() =>
                                    void addReadingWord(wordKey, 'deck', word)
                                  }
                                  className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100"
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
            <div className="bg-white rounded-lg p-8 border border-gray-200 text-center text-gray-500">
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
