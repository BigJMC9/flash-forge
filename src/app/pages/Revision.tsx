import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { callAction, errorMessage } from '../lib/backend';
import { RevisionCardRow } from '../types';

export function Revision() {
  const { deckId = '' } = useParams<{ deckId: string }>();
  const { decks, setCurrentDeck, setStatus } = useApp();

  const [rows, setRows] = useState<RevisionCardRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);

  const deck = decks.find((item) => item.id === deckId) ?? null;

  const currentCard = useMemo(() => rows[currentIndex] ?? null, [currentIndex, rows]);

  const loadRows = async () => {
    if (!deckId) {
      setRows([]);
      return;
    }

    try {
      const response = await callAction<{ rows: RevisionCardRow[] }>(
        'get_revision_cards',
        {
          deck_id: deckId,
        },
      );

      setRows(response.rows ?? []);
      setCurrentIndex(0);
      setShowBack(false);
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
      void loadRows();
    }
  }, [deckId]);

  if (!deck) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg p-8 border border-gray-200 text-center text-gray-500">
          Deck not found.
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-6">Revision: {deck.name}</h2>
        <div className="bg-white rounded-lg p-8 border border-gray-200 text-center text-gray-500">
          No cards are available for revision in this deck.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Revision: {deck.name}</h2>
      <p className="text-gray-600 mb-6">
        Card {currentIndex + 1} of {rows.length}
      </p>

      <div className="bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / rows.length) * 100}%` }}
        />
      </div>

      <div className="bg-white rounded-lg border-2 border-gray-300 mb-6 min-h-96 flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {currentCard?.schema_label} · {currentCard?.word_form}
          </span>
          <button
            onClick={() => setShowBack((previous) => !previous)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showBack ? 'Show Front' : 'Show Back'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowBack((previous) => !previous)}
          className="flex-1 flex flex-col items-center justify-center p-12 text-center"
        >
          <div className="text-5xl mb-6">
            {showBack ? currentCard?.back : currentCard?.front}
          </div>
          {!showBack ? (
            <p className="text-sm text-gray-500">Click to reveal the answer.</p>
          ) : (
            currentCard?.notes && (
              <div className="mt-4 max-w-2xl px-6 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-gray-700">
                {currentCard.notes}
              </div>
            )
          )}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            setCurrentIndex((previous) => Math.max(0, previous - 1));
            setShowBack(false);
          }}
          disabled={currentIndex === 0}
          className="px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>

        <button
          onClick={() => setShowBack((previous) => !previous)}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          Flip Card
        </button>

        <button
          onClick={() => {
            setCurrentIndex((previous) => Math.min(rows.length - 1, previous + 1));
            setShowBack(false);
          }}
          disabled={currentIndex === rows.length - 1}
          className="px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Next
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
