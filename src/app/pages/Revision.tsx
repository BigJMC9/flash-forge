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
      <div className="app-page max-w-4xl">
        <div className="app-empty">
          Deck not found.
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="app-page max-w-4xl">
        <div className="app-page-header">
          <div>
            <h2 className="app-page-title">Revision: {deck.name}</h2>
            <p className="app-page-description">
              Review the current deck one card at a time in a focused flashcard flow.
            </p>
          </div>
        </div>
        <div className="app-empty">
          No cards are available for revision in this deck.
        </div>
      </div>
    );
  }

  return (
    <div className="app-page max-w-4xl">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">Revision: {deck.name}</h2>
          <p className="app-page-description">
            Card {currentIndex + 1} of {rows.length}
          </p>
        </div>
      </div>

      <div className="bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / rows.length) * 100}%` }}
        />
      </div>

      <div className="app-panel mb-6 flex min-h-96 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <span className="text-sm text-gray-600">
            {currentCard?.schema_label} · {currentCard?.word_form}
          </span>
          <button
            onClick={() => setShowBack((previous) => !previous)}
            className="app-link"
          >
            {showBack ? 'Show Front' : 'Show Back'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowBack((previous) => !previous)}
          className="flex min-h-[24rem] w-full flex-1 flex-col items-center justify-center p-12 text-center"
        >
          <div className="text-5xl mb-6">
            {showBack ? currentCard?.back : currentCard?.front}
          </div>
          {!showBack ? (
            <p className="text-sm text-gray-500">Click to reveal the answer.</p>
          ) : (
            currentCard?.notes && (
              <div className="app-banner mt-4 max-w-2xl">
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
          className="app-btn-secondary"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>

        <button
          onClick={() => setShowBack((previous) => !previous)}
          className="app-btn-primary"
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
          className="app-btn-secondary"
        >
          Next
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
