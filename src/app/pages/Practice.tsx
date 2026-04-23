import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, DragEvent, FormEvent } from 'react';
import { useParams } from 'react-router';
import { Clock, Play, SlidersHorizontal, Square, Target, Trophy } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { callAction, errorMessage } from '../lib/backend';
import type {
  PracticeAnswerRow,
  PracticeGameType,
  PracticeModeKey,
  PracticeRoundCard,
  PracticeRoundResponse,
  PracticeScoring,
} from '../types';

const DEFAULT_SORT_QUEUE_SIZE = 3;
const ROUND_SIZE_OPTIONS = [12, 18, 24, 32];
const VERB_FORM_OPTIONS = [
  { key: 'masu', label: 'Masu' },
  { key: 'te', label: 'Te' },
  { key: 'past', label: 'Past (た)' },
  { key: 'negative', label: 'Negative' },
  { key: 'potential', label: 'Potential' },
  { key: 'passive', label: 'Passive' },
  { key: 'causative', label: 'Causative' },
];
const ADJECTIVE_FORM_OPTIONS = [
  { key: 'past', label: 'Past' },
  { key: 'negative', label: 'Negative' },
];
const MODE_COPY: Record<
  PracticeModeKey,
  {
    description: string;
    instructions: string;
    emptyMessage: string;
  }
> = {
  word_class_sort: {
    description:
      'Drag incoming words into Verb, い-adjective, な-adjective, Noun, Adverb, Particle, Expression, or Conjunction buckets.',
    instructions:
      'Drag a card into the right bucket, or tap a card and then tap the target bucket.',
    emptyMessage:
      'No cards with supported word-class tags were found in this deck.',
  },
  adjective_conjugation: {
    description:
      'Build adjective forms from the dictionary stem. Past and negative prompts can be mixed into the same round.',
    instructions:
      'Type the requested adjective form. Kana and kanji answers are both accepted.',
    emptyMessage:
      'No adjective cards with usable conjugation data were found in this deck.',
  },
  verb_conjugation: {
    description:
      'Run a configurable conjugation drill across the verb forms you choose, like a custom game playlist.',
    instructions:
      'Type the requested verb form. Kana and kanji answers are both accepted.',
    emptyMessage:
      'No verb cards with usable conjugation data were found in this deck.',
  },
};

function speedBonusForSeconds(elapsedSeconds: number): number {
  if (elapsedSeconds <= 2) return 6;
  if (elapsedSeconds <= 4) return 4;
  if (elapsedSeconds <= 6) return 2;
  if (elapsedSeconds <= 8) return 1;
  return 0;
}

function toggleOption(values: string[], nextValue: string): string[] {
  if (values.includes(nextValue)) {
    const filtered = values.filter((value) => value !== nextValue);
    return filtered.length > 0 ? filtered : values;
  }
  return [...values, nextValue];
}

function bucketTone(bucket: string): string {
  switch (bucket) {
    case 'verb':
      return 'border-sky-200 bg-sky-50 text-sky-900';
    case 'i_adj':
      return 'border-indigo-200 bg-indigo-50 text-indigo-900';
    case 'na_adj':
      return 'border-violet-200 bg-violet-50 text-violet-900';
    case 'noun':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'adverb':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'particle':
      return 'border-rose-200 bg-rose-50 text-rose-900';
    case 'expression':
      return 'border-cyan-200 bg-cyan-50 text-cyan-900';
    case 'conjunction':
      return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-900';
  }
}

function stackCardStyle(index: number): CSSProperties {
  const topOffset = index * 34;
  const scale = 1 - index * 0.04;
  const rotation = index % 2 === 0 ? -1.2 : 1.2;
  const opacity = Math.max(0.45, 1 - index * 0.18);
  return {
    transform: `translateY(${topOffset}px) scale(${scale}) rotate(${rotation}deg)`,
    opacity,
    zIndex: DEFAULT_SORT_QUEUE_SIZE - index,
  };
}

export function Practice() {
  const { deckId = '' } = useParams<{ deckId: string }>();
  const { decks, practiceModes, setCurrentDeck, setStatus } = useApp();

  const [mode, setMode] = useState<PracticeModeKey>('word_class_sort');
  const [gameType, setGameType] = useState<PracticeGameType>('bucket_sort');
  const [isActive, setIsActive] = useState(false);
  const [cards, setCards] = useState<PracticeRoundCard[]>([]);
  const [remainingCards, setRemainingCards] = useState<PracticeRoundCard[]>([]);
  const [bucketOrder, setBucketOrder] = useState<string[]>([]);
  const [roundStartedAt, setRoundStartedAt] = useState(0);
  const [cardShownAt, setCardShownAt] = useState<Record<string, number>>({});
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lastSpeedBonus, setLastSpeedBonus] = useState(0);
  const [lastResultMessage, setLastResultMessage] = useState('');
  const [answers, setAnswers] = useState<PracticeAnswerRow[]>([]);
  const [answerInput, setAnswerInput] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [draggedCardId, setDraggedCardId] = useState('');
  const [roundSize, setRoundSize] = useState(18);
  const [verbForms, setVerbForms] = useState<string[]>([
    'te',
    'past',
    'negative',
  ]);
  const [adjectiveForms, setAdjectiveForms] = useState<string[]>([
    'past',
    'negative',
  ]);
  const [scoring, setScoring] = useState<PracticeScoring>({
    base_correct_points: 10,
    incorrect_penalty_points: 2,
    bucket_labels: {
      verb: 'Verb',
      i_adj: 'I-adjective (い)',
      na_adj: 'Na-adjective (な)',
      noun: 'Noun',
      adverb: 'Adverb',
      particle: 'Particle',
      expression: 'Expression',
      conjunction: 'Conjunction',
    },
  });

  const deck = decks.find((item) => item.id === deckId) ?? null;
  const currentCard = remainingCards[0] ?? null;
  const visibleSortCards = remainingCards.slice(0, DEFAULT_SORT_QUEUE_SIZE);
  const selectedSortCard =
    visibleSortCards.find((card) => card.id === selectedCardId) ??
    visibleSortCards[0] ??
    null;
  const modeCopy = MODE_COPY[mode];

  const accuracy =
    correctCount + incorrectCount === 0
      ? 0
      : Math.round((correctCount / (correctCount + incorrectCount)) * 100);

  const averageTime =
    answers.length === 0
      ? 0
      : Number(
          (
            answers.reduce((total, row) => total + row.elapsed_seconds, 0) /
            answers.length
          ).toFixed(2),
        );

  const answerSummary = useMemo(() => answers, [answers]);

  const resetSession = () => {
    setIsActive(false);
    setCards([]);
    setRemainingCards([]);
    setBucketOrder([]);
    setRoundStartedAt(0);
    setCardShownAt({});
    setScore(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setStreak(0);
    setBestStreak(0);
    setLastSpeedBonus(0);
    setLastResultMessage('');
    setAnswers([]);
    setAnswerInput('');
    setSelectedCardId('');
    setDraggedCardId('');
  };

  const completeRound = (
    finalScore = score,
    finalCorrectCount = correctCount,
    finalIncorrectCount = incorrectCount,
    finalBestStreak = bestStreak,
  ) => {
    setIsActive(false);
    setAnswerInput('');
    setSelectedCardId('');
    setDraggedCardId('');
    setLastResultMessage('Round complete.');
    setStatus({
      type: 'success',
      message: `Game complete. Score ${finalScore}. Correct ${finalCorrectCount}, Incorrect ${finalIncorrectCount}, Best streak ${finalBestStreak}.`,
    });
  };

  const startRound = async () => {
    if (!deckId) {
      return;
    }

    try {
      const response = await callAction<PracticeRoundResponse>('get_practice_round', {
        deck_id: deckId,
        mode,
        options: {
          round_size: roundSize,
          verb_forms: verbForms,
          adjective_forms: adjectiveForms,
        },
      });

      if (!response.rows?.length) {
        setStatus({
          type: 'warning',
          message: modeCopy.emptyMessage,
        });
        return;
      }

      const nowSeconds = Date.now() / 1000;
      setCards(response.rows);
      setRemainingCards(response.rows);
      setBucketOrder(response.bucket_order ?? []);
      setGameType(response.game_type);
      setScoring(response.scoring);
      setRoundStartedAt(nowSeconds);
      setCardShownAt({});
      setScore(0);
      setCorrectCount(0);
      setIncorrectCount(0);
      setStreak(0);
      setBestStreak(0);
      setLastSpeedBonus(0);
      setLastResultMessage('');
      setAnswers([]);
      setAnswerInput('');
      setSelectedCardId(response.rows[0]?.id ?? '');
      setDraggedCardId('');
      setIsActive(true);
      setStatus({
        type: 'success',
        message: `Started ${practiceModes.find((option) => option.key === mode)?.label ?? mode} with ${response.rows.length} prompt(s).`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  useEffect(() => {
    if (deckId) {
      setCurrentDeck(deckId);
    }
  }, [deckId, setCurrentDeck]);

  useEffect(() => {
    const availableModes = practiceModes.map((option) => option.key);
    if (availableModes.includes(mode)) {
      return;
    }
    setMode((availableModes[0] ?? 'word_class_sort') as PracticeModeKey);
  }, [mode, practiceModes]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const visibleIds =
      gameType === 'bucket_sort'
        ? remainingCards.slice(0, DEFAULT_SORT_QUEUE_SIZE).map((card) => card.id)
        : remainingCards[0]
          ? [remainingCards[0].id]
          : [];
    if (visibleIds.length === 0) {
      return;
    }

    const nowSeconds = Date.now() / 1000;
    setCardShownAt((previous) => {
      let changed = false;
      const next = { ...previous };
      for (const cardId of visibleIds) {
        if (next[cardId]) {
          continue;
        }
        next[cardId] = nowSeconds;
        changed = true;
      }
      return changed ? next : previous;
    });
  }, [gameType, isActive, remainingCards]);

  const resolveAnswer = ({
    card,
    selectedValue,
    selectedLabel,
    expectedLabel,
    correct,
  }: {
    card: PracticeRoundCard;
    selectedValue: string;
    selectedLabel: string;
    expectedLabel: string;
    correct: boolean;
  }) => {
    const shownAt = cardShownAt[card.id] ?? Date.now() / 1000;
    const elapsedSeconds = Math.max(0, Date.now() / 1000 - shownAt);
    const speedBonus = speedBonusForSeconds(elapsedSeconds);
    const nextCorrectCount = correct ? correctCount + 1 : correctCount;
    const nextIncorrectCount = correct ? incorrectCount : incorrectCount + 1;
    let deltaPoints = 0;
    let nextScore = score;
    let nextStreak = 0;
    let nextBestStreak = bestStreak;

    if (correct) {
      nextStreak = streak + 1;
      const streakBonus = Math.min((nextStreak - 1) * 2, 12);
      deltaPoints = scoring.base_correct_points + speedBonus + streakBonus;
      nextScore = score + deltaPoints;
      nextBestStreak = Math.max(bestStreak, nextStreak);
      setScore(nextScore);
      setCorrectCount(nextCorrectCount);
      setStreak(nextStreak);
      setBestStreak(nextBestStreak);
      setLastSpeedBonus(speedBonus);
      setLastResultMessage(
        `Correct. +${deltaPoints} (speed +${speedBonus}, streak ${nextStreak}).`,
      );
    } else {
      deltaPoints = -scoring.incorrect_penalty_points;
      nextScore = Math.max(0, score + deltaPoints);
      setScore(nextScore);
      setIncorrectCount(nextIncorrectCount);
      setStreak(0);
      setLastSpeedBonus(0);
      setLastResultMessage(
        `Incorrect. Expected ${expectedLabel}. ${deltaPoints} points.`,
      );
    }

    setAnswers((previous) => [
      ...previous,
      {
        mode,
        game_type: gameType,
        prompt: card.prompt,
        hint: card.hint,
        expected: card.expected,
        expected_label: expectedLabel,
        selected: selectedValue,
        selected_label: selectedLabel,
        correct,
        elapsed_seconds: Number(elapsedSeconds.toFixed(2)),
        delta_points: deltaPoints,
      },
    ]);

    const nextRemainingCards = remainingCards.filter((row) => row.id !== card.id);
    setRemainingCards(nextRemainingCards);
    setCardShownAt((previous) => {
      const next = { ...previous };
      delete next[card.id];
      return next;
    });

    if (nextRemainingCards.length === 0) {
      completeRound(
        nextScore,
        nextCorrectCount,
        nextIncorrectCount,
        nextBestStreak,
      );
      return;
    }

    setSelectedCardId(nextRemainingCards[0]?.id ?? '');
  };

  const answerBucketRound = (bucket: string, forcedCardId?: string) => {
    if (!isActive) {
      return;
    }

    const targetCardId =
      forcedCardId || draggedCardId || selectedCardId || visibleSortCards[0]?.id;
    if (!targetCardId) {
      return;
    }

    const targetCard = remainingCards.find((card) => card.id === targetCardId);
    if (!targetCard) {
      return;
    }

    setDraggedCardId('');
    setSelectedCardId(targetCard.id);

    const expectedLabel =
      scoring.bucket_labels[targetCard.expected] ?? targetCard.expected;
    const selectedLabel = scoring.bucket_labels[bucket] ?? bucket;
    resolveAnswer({
      card: targetCard,
      selectedValue: bucket,
      selectedLabel,
      expectedLabel,
      correct: bucket === targetCard.expected,
    });
  };

  const submitTextEntryAnswer = () => {
    if (!isActive || !currentCard) {
      return;
    }

    const submittedDisplay = answerInput.trim();
    const submittedNormalized = submittedDisplay.replace(/\s+/g, '');
    if (!submittedNormalized) {
      setStatus({
        type: 'warning',
        message: 'Type an answer first.',
      });
      return;
    }

    const acceptedAnswers = (currentCard.accepted_answers ?? []).map((value) =>
      String(value ?? ''),
    );
    const expectedDisplay = String(
      currentCard.expected_display ?? currentCard.expected,
    );
    const expectedLabel = currentCard.form_label
      ? `${currentCard.form_label}: ${expectedDisplay}`
      : expectedDisplay;

    resolveAnswer({
      card: currentCard,
      selectedValue: submittedDisplay,
      selectedLabel: submittedDisplay,
      expectedLabel,
      correct: acceptedAnswers.includes(submittedNormalized),
    });
    setAnswerInput('');
  };

  const handleTextEntrySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitTextEntryAnswer();
  };

  const handleCardDragStart = (
    event: DragEvent<HTMLDivElement>,
    cardId: string,
  ) => {
    setDraggedCardId(cardId);
    setSelectedCardId(cardId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', cardId);
  };

  const handleBucketDrop = (
    event: DragEvent<HTMLButtonElement>,
    bucket: string,
  ) => {
    event.preventDefault();
    const droppedCardId =
      event.dataTransfer.getData('text/plain') || draggedCardId || selectedCardId;
    answerBucketRound(bucket, droppedCardId);
  };

  const selectedVerbFormLabels = VERB_FORM_OPTIONS.filter((option) =>
    verbForms.includes(option.key),
  ).map((option) => option.label);
  const selectedAdjectiveFormLabels = ADJECTIVE_FORM_OPTIONS.filter((option) =>
    adjectiveForms.includes(option.key),
  ).map((option) => option.label);

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
      <h2 className="text-2xl font-semibold mb-2">Practice: {deck.name}</h2>
      <p className="text-gray-600 mb-6">
        Custom drills for sorting, conjugation, and rapid recall
      </p>

      {!isActive && answers.length === 0 && (
        <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6 mb-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h3 className="font-semibold mb-4">Select Practice Mode</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {practiceModes.map((option) => {
                const active = mode === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => setMode(option.key)}
                    className={`rounded-2xl border-2 p-5 text-left transition-all ${
                      active
                        ? 'border-sky-500 bg-sky-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold mb-2">{option.label}</div>
                    <div className="text-sm text-gray-600">
                      {MODE_COPY[option.key].description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal className="w-5 h-5 text-sky-600" />
              <h3 className="font-semibold">Custom Game Options</h3>
            </div>

            <div className="mb-5">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Round Size
              </div>
              <div className="flex flex-wrap gap-2">
                {ROUND_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    onClick={() => setRoundSize(size)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      roundSize === size
                        ? 'bg-sky-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {size} prompts
                  </button>
                ))}
              </div>
            </div>

            {mode === 'verb_conjugation' && (
              <div className="mb-5">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Verb Forms
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {VERB_FORM_OPTIONS.map((option) => {
                    const checked = verbForms.includes(option.key);
                    return (
                      <button
                        key={option.key}
                        onClick={() =>
                          setVerbForms((previous) =>
                            toggleOption(previous, option.key),
                          )
                        }
                        className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                          checked
                            ? 'border-sky-500 bg-sky-50 text-sky-900'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === 'adjective_conjugation' && (
              <div className="mb-5">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Adjective Forms
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {ADJECTIVE_FORM_OPTIONS.map((option) => {
                    const checked = adjectiveForms.includes(option.key);
                    return (
                      <button
                        key={option.key}
                        onClick={() =>
                          setAdjectiveForms((previous) =>
                            toggleOption(previous, option.key),
                          )
                        }
                        className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                          checked
                            ? 'border-sky-500 bg-sky-50 text-sky-900'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === 'word_class_sort' && (
              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-700 mb-2">
                  Bucket Set
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Verb',
                    'I-adjective',
                    'Na-adjective',
                    'Noun',
                    'Adverb',
                    'Particle',
                    'Expression',
                    'Conjunction',
                  ].map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-4 mb-5">
              <div className="text-sm font-medium text-gray-700 mb-1">
                Current Mode
              </div>
              <div className="font-semibold text-gray-900 mb-2">
                {practiceModes.find((option) => option.key === mode)?.label ?? mode}
              </div>
              <div className="text-sm text-gray-600">{modeCopy.instructions}</div>
            </div>

            <button
              onClick={() => void startRound()}
              className="w-full px-8 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Start Round
            </button>
          </div>
        </div>
      )}

      {isActive && (
        <>
          <div className="grid md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
              <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
              <div className="text-2xl font-semibold">{score}</div>
              <div className="text-sm text-gray-600">Score</div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
              <Target className="w-5 h-5 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-semibold">{streak}</div>
              <div className="text-sm text-gray-600">Streak</div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
              <Target className="w-5 h-5 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-semibold">{bestStreak}</div>
              <div className="text-sm text-gray-600">Best</div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
              <div className="text-2xl font-semibold">{accuracy}%</div>
              <div className="text-sm text-gray-600">Accuracy</div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
              <Clock className="w-5 h-5 text-gray-500 mx-auto mb-2" />
              <div className="text-2xl font-semibold">{averageTime}s</div>
              <div className="text-sm text-gray-600">Avg Time</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                {practiceModes.find((option) => option.key === mode)?.label ?? mode}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Prompt {answers.length + 1} / {cards.length}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Round size {cards.length}
              </span>
              {mode === 'verb_conjugation' &&
                selectedVerbFormLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700"
                  >
                    {label}
                  </span>
                ))}
              {mode === 'adjective_conjugation' &&
                selectedAdjectiveFormLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
                  >
                    {label}
                  </span>
                ))}
            </div>

            {gameType === 'bucket_sort' ? (
              <div className="grid xl:grid-cols-[1.05fr_0.95fr] gap-6">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white">
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-300 mb-3">
                    Incoming Queue
                  </div>
                  <div className="relative h-[320px]">
                    {visibleSortCards.map((card, index) => {
                      const isSelected = selectedSortCard?.id === card.id;
                      return (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={(event) => handleCardDragStart(event, card.id)}
                          onDragEnd={() => setDraggedCardId('')}
                          onClick={() => setSelectedCardId(card.id)}
                          className={`absolute inset-x-0 mx-auto max-w-xl rounded-3xl border px-6 py-5 shadow-xl transition-all duration-300 cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? 'border-sky-300 bg-white text-slate-900 ring-4 ring-sky-400/40'
                              : 'border-white/10 bg-white/90 text-slate-900'
                          }`}
                          style={stackCardStyle(index)}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                              {index === 0 ? 'Live' : 'On deck'}
                            </span>
                            <span className="text-xs font-medium text-slate-500">
                              #{answers.length + index + 1}
                            </span>
                          </div>
                          <div className="text-4xl font-semibold mb-3 leading-tight">
                            {card.prompt}
                          </div>
                          <div className="text-base text-slate-600">
                            {card.hint || 'No gloss'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-sm text-slate-200">
                    {modeCopy.instructions}
                  </div>
                </div>

                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-3">
                    Drop Buckets
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {bucketOrder.map((bucket) => (
                      <button
                        key={bucket}
                        onClick={() => answerBucketRound(bucket)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleBucketDrop(event, bucket)}
                        className={`rounded-2xl border px-4 py-4 text-left transition-transform hover:-translate-y-0.5 ${bucketTone(
                          bucket,
                        )}`}
                      >
                        <div className="font-semibold mb-1">
                          {scoring.bucket_labels[bucket] ?? bucket}
                        </div>
                        <div className="text-sm opacity-80">
                          {selectedSortCard
                            ? `Place ${selectedSortCard.prompt} here`
                            : 'Waiting for the next card'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-8">
                {currentCard && (
                  <>
                    <div className="text-center mb-8">
                      {currentCard.form_label && (
                        <div className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white mb-4">
                          {currentCard.form_label}
                        </div>
                      )}
                      <div className="text-5xl font-semibold text-slate-900 mb-4">
                        {currentCard.prompt}
                      </div>
                      <div className="text-xl text-slate-600">
                        {currentCard.hint || 'No gloss'}
                      </div>
                    </div>

                    <form
                      onSubmit={handleTextEntrySubmit}
                      className="max-w-xl mx-auto"
                    >
                      <input
                        type="text"
                        value={answerInput}
                        onChange={(event) => setAnswerInput(event.target.value)}
                        placeholder={
                          currentCard.form_label
                            ? `Type the ${currentCard.form_label.toLowerCase()}`
                            : 'Type the answer'
                        }
                        className="w-full rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-center text-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      <button
                        type="submit"
                        className="mt-4 w-full rounded-2xl bg-sky-600 px-6 py-4 text-lg font-semibold text-white hover:bg-sky-700"
                      >
                        Submit Answer
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}

            <div className="text-center text-sm text-gray-600 mt-6">
              {lastResultMessage}
            </div>
            <div className="text-center text-sm text-gray-500 mt-2">
              Last speed bonus: +{lastSpeedBonus}
            </div>
          </div>

          <button
            onClick={() => {
              setIsActive(false);
              setAnswerInput('');
              setDraggedCardId('');
              setSelectedCardId('');
              setLastResultMessage('Round stopped.');
            }}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Square className="w-5 h-5" />
            Stop Round
          </button>
        </>
      )}

      {!isActive && answers.length > 0 && (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-xl font-semibold mb-4">Round Summary</h3>

          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-semibold text-blue-600">{score}</div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-semibold text-green-600">
                {accuracy}%
              </div>
              <div className="text-sm text-gray-600">Accuracy</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-semibold text-purple-600">
                {bestStreak}
              </div>
              <div className="text-sm text-gray-600">Best Streak</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-3xl font-semibold text-orange-600">
                {averageTime}s
              </div>
              <div className="text-sm text-gray-600">Avg Time</div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Prompt
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Expected
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Your Answer
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Result
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Time
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {answerSummary.map((row, index) => (
                  <tr
                    key={`${row.prompt}-${index}`}
                    className="border-t border-gray-100"
                  >
                    <td className="px-4 py-3">{row.prompt}</td>
                    <td className="px-4 py-3">{row.expected_label}</td>
                    <td className="px-4 py-3">{row.selected_label}</td>
                    <td className="px-4 py-3">
                      {row.correct ? (
                        <span className="text-green-600">Correct</span>
                      ) : (
                        <span className="text-red-600">Incorrect</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.elapsed_seconds.toFixed(2)}s
                    </td>
                    <td className="px-4 py-3">
                      {row.delta_points >= 0
                        ? `+${row.delta_points}`
                        : row.delta_points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={resetSession}
            className="mt-6 px-8 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
          >
            New Round
          </button>
          {roundStartedAt > 0 && (
            <div className="mt-3 text-sm text-gray-500">
              Round duration: {(Date.now() / 1000 - roundStartedAt).toFixed(1)}s
            </div>
          )}
        </div>
      )}
    </div>
  );
}
