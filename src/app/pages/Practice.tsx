import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Clock, Play, Square, Target, Trophy } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { callAction, errorMessage } from '../lib/backend';
import {
  PracticeAnswerRow,
  PracticeRoundCard,
  PracticeScoring,
} from '../types';

function speedBonusForSeconds(elapsedSeconds: number): number {
  if (elapsedSeconds <= 2) return 6;
  if (elapsedSeconds <= 4) return 4;
  if (elapsedSeconds <= 6) return 2;
  if (elapsedSeconds <= 8) return 1;
  return 0;
}

export function Practice() {
  const { deckId = '' } = useParams<{ deckId: string }>();
  const { decks, practiceModes, setCurrentDeck, setStatus } = useApp();

  const [mode, setMode] = useState<'verb_sort' | 'adjective_sort' | 'te_form'>(
    'verb_sort',
  );
  const [isActive, setIsActive] = useState(false);
  const [cards, setCards] = useState<PracticeRoundCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundStartedAt, setRoundStartedAt] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lastSpeedBonus, setLastSpeedBonus] = useState(0);
  const [lastResultMessage, setLastResultMessage] = useState('');
  const [answers, setAnswers] = useState<PracticeAnswerRow[]>([]);
  const [teInput, setTeInput] = useState('');
  const [scoring, setScoring] = useState<PracticeScoring>({
    base_correct_points: 10,
    incorrect_penalty_points: 2,
    bucket_labels: {
      ichidan: 'Ichidan',
      godan: 'Godan',
      i_adj: 'I-adjective (い)',
      na_adj: 'Na-adjective (な)',
    },
  });

  const deck = decks.find((item) => item.id === deckId) ?? null;
  const currentCard = cards[currentIndex] ?? null;

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

  const summaryRows = useMemo(
    () =>
      answers.map((answer) => ({
        ...answer,
        expectedLabel:
          answer.mode === 'te_form'
            ? answer.expected
            : scoring.bucket_labels[answer.expected] ?? answer.expected,
        selectedLabel:
          answer.mode === 'te_form'
            ? answer.selected
            : scoring.bucket_labels[answer.selected] ?? answer.selected,
      })),
    [answers, scoring.bucket_labels],
  );

  const completeRound = (
    finalScore = score,
    finalCorrectCount = correctCount,
    finalIncorrectCount = incorrectCount,
    finalBestStreak = bestStreak,
  ) => {
    setIsActive(false);
    setTeInput('');
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
      const response = await callAction<{
        rows: PracticeRoundCard[];
        scoring: PracticeScoring;
      }>('get_practice_round', {
        deck_id: deckId,
        mode,
      });

      if (!response.rows?.length) {
        setStatus({
          type: 'warning',
          message:
            mode === 'verb_sort'
              ? 'No Ichidan or Godan verb cards were found in this deck.'
              : mode === 'adjective_sort'
                ? 'No adjective cards were found in this deck.'
                : 'No verb cards with usable て-form data were found in this deck.',
        });
        return;
      }

      const nowSeconds = Date.now() / 1000;
      setCards(response.rows);
      setScoring(response.scoring);
      setCurrentIndex(0);
      setRoundStartedAt(nowSeconds);
      setQuestionStartedAt(nowSeconds);
      setScore(0);
      setCorrectCount(0);
      setIncorrectCount(0);
      setStreak(0);
      setBestStreak(0);
      setLastSpeedBonus(0);
      setLastResultMessage('');
      setAnswers([]);
      setTeInput('');
      setIsActive(true);
      setStatus({
        type: 'success',
        message: `Started ${mode} with ${response.rows.length} card(s).`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const answerBucketRound = (selectedBucket: string) => {
    if (!isActive || !currentCard) {
      return;
    }

    const elapsedSeconds = Math.max(0, Date.now() / 1000 - questionStartedAt);
    const speedBonus = speedBonusForSeconds(elapsedSeconds);
    const correct = selectedBucket === currentCard.expected;
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
        `Incorrect. Expected ${scoring.bucket_labels[currentCard.expected] ?? currentCard.expected}. ${deltaPoints} points.`,
      );
    }

    setAnswers((previous) => [
      ...previous,
      {
        mode,
        prompt: currentCard.prompt,
        hint: currentCard.hint,
        expected: currentCard.expected,
        selected: selectedBucket,
        correct,
        elapsed_seconds: Number(elapsedSeconds.toFixed(2)),
        delta_points: deltaPoints,
      },
    ]);

    if (currentIndex + 1 >= cards.length) {
      completeRound(
        nextScore,
        nextCorrectCount,
        nextIncorrectCount,
        nextBestStreak,
      );
      return;
    }

    setCurrentIndex((previous) => previous + 1);
    setQuestionStartedAt(Date.now() / 1000);
  };

  const submitTeFormAnswer = () => {
    if (!isActive || !currentCard) {
      return;
    }

    const submittedDisplay = teInput.trim();
    const submittedNormalized = submittedDisplay.replace(/\s+/g, '');
    if (!submittedNormalized) {
      setStatus({
        type: 'warning',
        message: 'Type a て-form answer first.',
      });
      return;
    }

    const acceptedAnswers = (currentCard.accepted_answers ?? []).map((value) =>
      String(value ?? ''),
    );
    const expectedDisplay = String(
      currentCard.expected_display ?? currentCard.expected,
    );
    const elapsedSeconds = Math.max(0, Date.now() / 1000 - questionStartedAt);
    const speedBonus = speedBonusForSeconds(elapsedSeconds);
    const correct = acceptedAnswers.includes(submittedNormalized);
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
        `Incorrect. Expected ${expectedDisplay}. ${deltaPoints} points.`,
      );
    }

    setAnswers((previous) => [
      ...previous,
      {
        mode: 'te_form',
        prompt: currentCard.prompt,
        hint: currentCard.hint,
        expected: expectedDisplay,
        selected: submittedDisplay,
        correct,
        elapsed_seconds: Number(elapsedSeconds.toFixed(2)),
        delta_points: deltaPoints,
      },
    ]);

    if (currentIndex + 1 >= cards.length) {
      completeRound(
        nextScore,
        nextCorrectCount,
        nextIncorrectCount,
        nextBestStreak,
      );
      return;
    }

    setCurrentIndex((previous) => previous + 1);
    setQuestionStartedAt(Date.now() / 1000);
    setTeInput('');
  };

  useEffect(() => {
    if (deckId) {
      setCurrentDeck(deckId);
    }
  }, [deckId]);

  useEffect(() => {
    const availableModes = practiceModes.map((option) => option.key);
    if (availableModes.includes(mode)) {
      return;
    }
    setMode((availableModes[0] ?? 'verb_sort') as typeof mode);
  }, [mode, practiceModes]);

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
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Practice: {deck.name}</h2>
      <p className="text-gray-600 mb-6">Gamified review and speed drills</p>

      {!isActive && answers.length === 0 && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
          <h3 className="font-semibold mb-4">Select Practice Mode</h3>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {practiceModes.map((option) => (
              <button
                key={option.key}
                onClick={() => setMode(option.key)}
                className={`p-6 rounded-lg border-2 transition-all text-left ${
                  mode === option.key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold mb-2">{option.label}</div>
                <div className="text-sm text-gray-600">
                  {option.key === 'verb_sort'
                    ? 'Classify verbs as Ichidan or Godan.'
                    : option.key === 'adjective_sort'
                      ? 'Classify adjectives as い or な.'
                      : 'Type the correct て-form.'}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => void startRound()}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start Round
          </button>
        </div>
      )}

      {isActive && currentCard && (
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

          <div className="bg-white rounded-lg p-8 border-2 border-gray-300 mb-6">
            <div className="text-center mb-8">
              <div className="text-sm text-gray-600 mb-4">
                Question {currentIndex + 1} of {cards.length}
              </div>
              <div className="text-5xl mb-4">{currentCard.prompt}</div>
              <div className="text-xl text-gray-600">{currentCard.hint}</div>
            </div>

            {mode === 'te_form' ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitTeFormAnswer();
                }}
                className="max-w-md mx-auto"
              >
                <input
                  type="text"
                  value={teInput}
                  onChange={(event) => setTeInput(event.target.value)}
                  placeholder="Type the correct て-form"
                  className="w-full px-6 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-xl mb-4"
                />
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Submit
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <button
                  onClick={() =>
                    answerBucketRound(mode === 'verb_sort' ? 'ichidan' : 'i_adj')
                  }
                  className="px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg"
                >
                  {mode === 'verb_sort' ? 'Ichidan' : 'I-adjective'}
                </button>
                <button
                  onClick={() =>
                    answerBucketRound(mode === 'verb_sort' ? 'godan' : 'na_adj')
                  }
                  className="px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg"
                >
                  {mode === 'verb_sort' ? 'Godan' : 'Na-adjective'}
                </button>
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
              setLastResultMessage('Round stopped.');
              setTeInput('');
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
                {summaryRows.map((row, index) => (
                  <tr key={`${row.prompt}-${index}`} className="border-t border-gray-100">
                    <td className="px-4 py-3">{row.prompt}</td>
                    <td className="px-4 py-3">{row.expectedLabel}</td>
                    <td className="px-4 py-3">{row.selectedLabel}</td>
                    <td className="px-4 py-3">
                      {row.correct ? (
                        <span className="text-green-600">Correct</span>
                      ) : (
                        <span className="text-red-600">Incorrect</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{row.elapsed_seconds.toFixed(2)}s</td>
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
            onClick={() => {
              setAnswers([]);
              setCards([]);
              setCurrentIndex(0);
              setScore(0);
              setCorrectCount(0);
              setIncorrectCount(0);
              setStreak(0);
              setBestStreak(0);
              setLastSpeedBonus(0);
              setLastResultMessage('');
              setRoundStartedAt(0);
            }}
            className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
