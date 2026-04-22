import { useState } from 'react';
import { Link } from 'react-router';
import { Edit2, Folder, Plus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export function Collections() {
  const {
    collections,
    decks,
    createCollection,
    createDeck,
    renameCollection,
    renameDeck,
    setCurrentCollection,
    setCurrentDeck,
  } = useApp();

  const [newCollectionName, setNewCollectionName] = useState('');
  const [newDeckNames, setNewDeckNames] = useState<Record<string, string>>({});
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(
    null,
  );
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreateCollection = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newCollectionName.trim();
    if (!name) {
      return;
    }

    const success = await createCollection(name);
    if (success) {
      setNewCollectionName('');
    }
  };

  const handleCreateDeck = async (
    event: React.FormEvent,
    collectionId: string,
  ) => {
    event.preventDefault();
    const name = (newDeckNames[collectionId] ?? '').trim();
    if (!name) {
      return;
    }

    const success = await createDeck(collectionId, name);
    if (success) {
      setNewDeckNames((previous) => ({
        ...previous,
        [collectionId]: '',
      }));
    }
  };

  const handleRenameCollection = async (collectionId: string) => {
    const name = editName.trim();
    if (!name) {
      setEditingCollectionId(null);
      return;
    }

    const success = await renameCollection(collectionId, name);
    if (success) {
      setEditingCollectionId(null);
      setEditName('');
    }
  };

  const handleRenameDeck = async (deckId: string) => {
    const name = editName.trim();
    if (!name) {
      setEditingDeckId(null);
      return;
    }

    const success = await renameDeck(deckId, name);
    if (success) {
      setEditingDeckId(null);
      setEditName('');
    }
  };

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-semibold mb-6">Collections & Decks</h2>

      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
        <h3 className="font-semibold mb-4">Create Collection</h3>
        <form onSubmit={handleCreateCollection} className="flex gap-3">
          <input
            type="text"
            value={newCollectionName}
            onChange={(event) => setNewCollectionName(event.target.value)}
            placeholder="Enter a collection name"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {collections.length === 0 ? (
          <div className="bg-white rounded-lg p-8 border border-gray-200 text-center text-gray-500">
            No collections yet. Create the first collection above.
          </div>
        ) : (
          collections.map((collection) => {
            const collectionDecks = decks.filter(
              (deck) => deck.collection_id === collection.id,
            );

            return (
              <div
                key={collection.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Folder className="w-5 h-5 text-gray-600" />
                    {editingCollectionId === collection.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        onBlur={() => void handleRenameCollection(collection.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            void handleRenameCollection(collection.id);
                          }
                          if (event.key === 'Escape') {
                            setEditingCollectionId(null);
                          }
                        }}
                        autoFocus
                        className="px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => setCurrentCollection(collection.id)}
                          className="font-semibold text-left"
                        >
                          {collection.name}
                        </button>
                        <button
                          onClick={() => {
                            setEditingCollectionId(collection.id);
                            setEditName(collection.name);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {collectionDecks.length} deck(s)
                  </div>
                </div>

                <div className="p-6">
                  <form
                    onSubmit={(event) => void handleCreateDeck(event, collection.id)}
                    className="flex gap-3 mb-4"
                  >
                    <input
                      type="text"
                      value={newDeckNames[collection.id] ?? ''}
                      onChange={(event) =>
                        setNewDeckNames((previous) => ({
                          ...previous,
                          [collection.id]: event.target.value,
                        }))
                      }
                      placeholder="Create a deck in this collection"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Deck
                    </button>
                  </form>

                  {collectionDecks.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No decks in this collection yet.
                    </p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-4 py-3 text-sm text-gray-600">
                              Deck
                            </th>
                            <th className="text-left px-4 py-3 text-sm text-gray-600">
                              Cards
                            </th>
                            <th className="text-left px-4 py-3 text-sm text-gray-600">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {collectionDecks.map((deck) => (
                            <tr key={deck.id} className="border-t border-gray-100">
                              <td className="px-4 py-3">
                                {editingDeckId === deck.id ? (
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(event) => setEditName(event.target.value)}
                                    onBlur={() => void handleRenameDeck(deck.id)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        void handleRenameDeck(deck.id);
                                      }
                                      if (event.key === 'Escape') {
                                        setEditingDeckId(null);
                                      }
                                    }}
                                    autoFocus
                                    className="px-2 py-1 border border-gray-300 rounded"
                                  />
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span>{deck.name}</span>
                                    <button
                                      onClick={() => {
                                        setEditingDeckId(deck.id);
                                        setEditName(deck.name);
                                      }}
                                      className="text-gray-400 hover:text-gray-600"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {deck.card_count}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-3 text-sm">
                                  <button
                                    onClick={() => setCurrentDeck(deck.id)}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    Set Context
                                  </button>
                                  <Link
                                    to={`/deck/${deck.id}`}
                                    onClick={() => setCurrentDeck(deck.id)}
                                    className="text-gray-700 hover:text-gray-900"
                                  >
                                    Open
                                  </Link>
                                  <Link
                                    to={`/revision/${deck.id}`}
                                    onClick={() => setCurrentDeck(deck.id)}
                                    className="text-gray-700 hover:text-gray-900"
                                  >
                                    Revision
                                  </Link>
                                  <Link
                                    to={`/practice/${deck.id}`}
                                    onClick={() => setCurrentDeck(deck.id)}
                                    className="text-gray-700 hover:text-gray-900"
                                  >
                                    Practice
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
          })
        )}
      </div>
    </div>
  );
}
