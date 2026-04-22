import { Link } from 'react-router';
import { BookOpen, Folder, Library, Plus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export function Dashboard() {
  const { dashboard, decks, setCurrentDeck } = useApp();
  const featuredDecks = decks.slice(0, 6);

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Folder className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-sm text-gray-600">Collections</div>
          </div>
          <div className="text-3xl font-semibold">
            {dashboard.collection_count}
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <BookOpen className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-sm text-gray-600">Decks</div>
          </div>
          <div className="text-3xl font-semibold">{dashboard.deck_count}</div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 rounded-lg">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-sm text-gray-600">Deck Cards</div>
          </div>
          <div className="text-3xl font-semibold">{dashboard.card_count}</div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Library className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-sm text-gray-600">Global Cards</div>
          </div>
          <div className="text-3xl font-semibold">
            {dashboard.global_card_count}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            to="/collections"
            className="bg-white rounded-lg p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <Plus className="w-5 h-5 text-blue-600" />
              <div className="font-semibold">Collections</div>
            </div>
            <p className="text-sm text-gray-600">
              Create collections and organize decks.
            </p>
          </Link>

          <Link
            to="/dictionary"
            className="bg-white rounded-lg p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-5 h-5 text-green-600" />
              <div className="font-semibold">Dictionary</div>
            </div>
            <p className="text-sm text-gray-600">
              Search JMDict and add entries to decks or the global library.
            </p>
          </Link>

          <Link
            to="/import-export"
            className="bg-white rounded-lg p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <Library className="w-5 h-5 text-purple-600" />
              <div className="font-semibold">Automation</div>
            </div>
            <p className="text-sm text-gray-600">
              OCR, CSV import, and deck export.
            </p>
          </Link>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Deck Overview</h3>
        {dashboard.rows.length === 0 ? (
          <div className="bg-white rounded-lg p-8 border border-gray-200 text-center text-gray-500">
            No decks yet. Create a collection and a deck to get started.
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm text-gray-600">
                    Collection
                  </th>
                  <th className="text-left px-6 py-3 text-sm text-gray-600">
                    Deck
                  </th>
                  <th className="text-left px-6 py-3 text-sm text-gray-600">
                    Cards
                  </th>
                  <th className="text-left px-6 py-3 text-sm text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {featuredDecks.map((deck) => (
                  <tr key={deck.id} className="border-b border-gray-100">
                    <td className="px-6 py-4">{deck.collection_name}</td>
                    <td className="px-6 py-4">{deck.name}</td>
                    <td className="px-6 py-4">{deck.card_count}</td>
                    <td className="px-6 py-4">
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
      </div>
    </div>
  );
}
