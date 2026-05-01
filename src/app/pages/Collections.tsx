import { useState } from 'react';
import { Link } from 'react-router';
import { Edit2, Folder, Plus, Trash2 } from 'lucide-react';
import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import { useApp } from '../contexts/AppContext';

export function Collections() {
  const {
    collections,
    decks,
    createCollection,
    createDeck,
    deleteCollection,
    deleteDeck,
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
  const [collectionToDelete, setCollectionToDelete] = useState<{
    id: string;
    name: string;
    deckCount: number;
  } | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<{ id: string; name: string } | null>(
    null,
  );

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

  const handleDeleteCollection = async () => {
    if (!collectionToDelete) {
      return;
    }

    const success = await deleteCollection(collectionToDelete.id);
    if (success) {
      setCollectionToDelete(null);
    }
  };

  const handleDeleteDeck = async () => {
    if (!deckToDelete) {
      return;
    }

    const success = await deleteDeck(deckToDelete.id);
    if (success) {
      setDeckToDelete(null);
    }
  };

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">Collections & Decks</h2>
          <p className="app-page-description">
            Organize your workspace into collections, create decks, and jump into study
            flows from the same structure.
          </p>
        </div>
      </div>

      <div className="app-panel p-6">
        <h3 className="app-section-title mb-4">Create Collection</h3>
        <form
          onSubmit={handleCreateCollection}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={newCollectionName}
            onChange={(event) => setNewCollectionName(event.target.value)}
            placeholder="Enter a collection name"
            className="app-input flex-1"
          />
          <button
            type="submit"
            className="app-btn-primary"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {collections.length === 0 ? (
          <div className="app-empty">
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
                className="app-table-wrap"
              >
                <div className="app-table-head flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
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
                        className="app-input max-w-xs px-2 py-1"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => setCurrentCollection(collection.id)}
                          className="min-w-0 text-left font-semibold"
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
                  <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                    <div className="text-sm text-gray-600">
                      {collectionDecks.length} deck(s)
                    </div>
                    <button
                      onClick={() =>
                        setCollectionToDelete({
                          id: collection.id,
                          name: collection.name,
                          deckCount: collectionDecks.length,
                        })
                      }
                      className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <form
                    onSubmit={(event) => void handleCreateDeck(event, collection.id)}
                    className="mb-4 flex flex-col gap-3 sm:flex-row"
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
                      className="app-input flex-1"
                    />
                    <button
                      type="submit"
                      className="app-btn-primary"
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
                    <div className="app-table-wrap shadow-none">
                      <table className="w-full">
                        <thead className="app-table-head">
                          <tr>
                            <th className="app-table-th">Deck</th>
                            <th className="app-table-th">Cards</th>
                            <th className="app-table-th">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {collectionDecks.map((deck) => (
                            <tr key={deck.id} className="app-table-row">
                              <td className="app-table-td">
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
                                    className="app-input max-w-xs px-2 py-1"
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
                              <td className="app-table-td text-gray-600">{deck.card_count}</td>
                              <td className="app-table-td">
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
                                  <button
                                    onClick={() =>
                                      setDeckToDelete({
                                        id: deck.id,
                                        name: deck.name,
                                      })
                                    }
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    Delete
                                  </button>
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

      <ConfirmActionDialog
        open={Boolean(collectionToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setCollectionToDelete(null);
          }
        }}
        title="Delete collection?"
        description={
          collectionToDelete
            ? `Delete "${collectionToDelete.name}" and its ${collectionToDelete.deckCount} deck(s). This removes the deck cards, invites, reading caches, and conversation sessions under that collection.`
            : ''
        }
        confirmLabel="Delete Collection"
        destructive
        onConfirm={handleDeleteCollection}
      />

      <ConfirmActionDialog
        open={Boolean(deckToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setDeckToDelete(null);
          }
        }}
        title="Delete deck?"
        description={
          deckToDelete
            ? `Delete "${deckToDelete.name}" and all of its cards, collaborators, invites, reading caches, and conversation sessions.`
            : ''
        }
        confirmLabel="Delete Deck"
        destructive
        onConfirm={handleDeleteDeck}
      />
    </div>
  );
}
