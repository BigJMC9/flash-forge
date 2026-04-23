import { Link } from 'react-router';
import { BookOpen, Folder, Library, Plus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export function Dashboard() {
  const { dashboard, decks, setCurrentDeck } = useApp();
  const featuredDecks = decks.slice(0, 6);

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">Dashboard</h2>
          <p className="app-page-description">
            Review workspace totals, jump into core actions, and reopen the decks
            you are actively studying.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="app-panel p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Folder className="w-4 h-4" />
            </div>
            <div className="text-sm text-gray-600">Collections</div>
          </div>
          <div className="text-3xl font-semibold">
            {dashboard.collection_count}
          </div>
        </div>

        <div className="app-panel p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="text-sm text-gray-600">Decks</div>
          </div>
          <div className="text-3xl font-semibold">{dashboard.deck_count}</div>
        </div>

        <div className="app-panel p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="text-sm text-gray-600">Deck Cards</div>
          </div>
          <div className="text-3xl font-semibold">{dashboard.card_count}</div>
        </div>

        <div className="app-panel p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Library className="w-4 h-4" />
            </div>
            <div className="text-sm text-gray-600">Global Cards</div>
          </div>
          <div className="text-3xl font-semibold">
            {dashboard.global_card_count}
          </div>
        </div>
      </div>

      <section>
        <div className="app-section-header mb-4">
          <div>
            <h3 className="app-section-title">Quick Actions</h3>
            <p className="app-section-copy">
              Open the main creation and import flows without leaving the dashboard.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to="/collections"
            className="app-panel p-6 transition-colors hover:border-blue-200"
          >
            <div className="flex items-center gap-3 mb-2">
              <Plus className="w-4 h-4 text-blue-700" />
              <div className="font-semibold">Collections</div>
            </div>
            <p className="text-sm text-gray-600">
              Create collections and organize decks.
            </p>
          </Link>

          <Link
            to="/dictionary"
            className="app-panel p-6 transition-colors hover:border-blue-200"
          >
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-4 h-4 text-blue-700" />
              <div className="font-semibold">Dictionary</div>
            </div>
            <p className="text-sm text-gray-600">
              Search JMDict and add entries to decks or the global library.
            </p>
          </Link>

          <Link
            to="/import-export"
            className="app-panel p-6 transition-colors hover:border-blue-200"
          >
            <div className="flex items-center gap-3 mb-2">
              <Library className="w-4 h-4 text-blue-700" />
              <div className="font-semibold">Automation</div>
            </div>
            <p className="text-sm text-gray-600">
              OCR, CSV import, and deck export.
            </p>
          </Link>
        </div>
      </section>

      <section>
        <div className="app-section-header mb-4">
          <div>
            <h3 className="app-section-title">Deck Overview</h3>
            <p className="app-section-copy">
              Reopen recent decks and set the active study context directly from here.
            </p>
          </div>
        </div>
        {dashboard.rows.length === 0 ? (
          <div className="app-empty">
            No decks yet. Create a collection and a deck to get started.
          </div>
        ) : (
          <div className="app-table-wrap">
            <table className="w-full">
              <thead className="app-table-head">
                <tr>
                  <th className="app-table-th">Collection</th>
                  <th className="app-table-th">Deck</th>
                  <th className="app-table-th">Cards</th>
                  <th className="app-table-th">Access</th>
                  <th className="app-table-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {featuredDecks.map((deck) => (
                  <tr key={deck.id} className="app-table-row">
                    <td className="app-table-td">{deck.collection_name}</td>
                    <td className="app-table-td">{deck.name}</td>
                    <td className="app-table-td">{deck.card_count}</td>
                    <td className="app-table-td text-sm text-gray-600">
                      {deck.is_owner ? 'Owner' : 'Shared'}
                    </td>
                    <td className="app-table-td">
                      <div className="flex gap-4 text-sm">
                        <button
                          onClick={() => setCurrentDeck(deck.id)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          Set Context
                        </button>
                        <Link
                          to={`/deck/${deck.id}`}
                          className="text-gray-700 hover:text-gray-900"
                        >
                          Open
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
