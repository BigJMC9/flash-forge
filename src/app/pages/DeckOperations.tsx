import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import {
  CheckSquare,
  Edit2,
  Search,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { callAction, callActionWithFiles, errorMessage } from '../lib/backend';
import { DeckCardRow } from '../types';

type EditForm = {
  kanji: string;
  kana: string;
  english: string;
  notes: string;
  schema_key: string;
};

export function DeckOperations() {
  const { deckId = '' } = useParams<{ deckId: string }>();
  const {
    cardSchemas,
    decks,
    defaultSchemaKey,
    refreshBootstrap,
    setCurrentDeck,
    setStatus,
  } = useApp();

  const [searchText, setSearchText] = useState('');
  const [rows, setRows] = useState<DeckCardRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSchemaKey, setBulkSchemaKey] = useState(defaultSchemaKey);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    kanji: '',
    kana: '',
    english: '',
    notes: '',
    schema_key: defaultSchemaKey,
  });
  const [replaceTarget, setReplaceTarget] = useState('english');
  const [replaceMediaType, setReplaceMediaType] = useState('image');
  const [replaceFiles, setReplaceFiles] = useState<File[]>([]);

  const deck = decks.find((item) => item.id === deckId) ?? null;

  const selectedCardIdForMedia = useMemo(() => {
    if (editingCardId) {
      return editingCardId;
    }
    const ids = Array.from(selectedIds);
    return ids.length === 1 ? ids[0] : '';
  }, [editingCardId, selectedIds]);

  const loadRows = async () => {
    if (!deckId) {
      setRows([]);
      setSelectedIds(new Set());
      return;
    }

    try {
      const response = await callAction<{ rows: DeckCardRow[] }>(
        'list_deck_cards',
        {
          deck_id: deckId,
          search: searchText,
        },
      );

      setRows(response.rows ?? []);
      setSelectedIds((previous) => {
        const next = new Set<string>();
        for (const id of previous) {
          if (response.rows?.some((row) => row.id === id)) {
            next.add(id);
          }
        }
        return next;
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
      void loadRows();
    }
  }, [deckId]);

  const toggleSelection = (cardId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const startEditing = (card: DeckCardRow) => {
    setEditingCardId(card.id);
    setEditForm({
      kanji: card.kanji,
      kana: card.kana,
      english: card.english,
      notes: card.notes,
      schema_key: card.schema_key,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCardId) {
      return;
    }

    try {
      const response = await callAction<{ updated: boolean }>('update_card', {
        deck_id: deckId,
        card_id: editingCardId,
        ...editForm,
      });

      await Promise.all([refreshBootstrap(), loadRows()]);
      setStatus({
        type: response.updated ? 'success' : 'warning',
        message: response.updated
          ? 'Card updated.'
          : 'Card update skipped because it would duplicate an existing card.',
      });

      if (response.updated) {
        setEditingCardId(null);
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const handleBulkSchemaUpdate = async () => {
    if (selectedIds.size === 0) {
      setStatus({
        type: 'warning',
        message: 'Select one or more cards first.',
      });
      return;
    }

    try {
      const response = await callAction<{ updated: number; skipped: number }>(
        'bulk_update_card_schema',
        {
          deck_id: deckId,
          card_ids: Array.from(selectedIds),
          schema_key: bulkSchemaKey,
        },
      );

      await Promise.all([refreshBootstrap(), loadRows()]);
      setSelectedIds(new Set());
      setStatus({
        type: response.updated > 0 ? 'success' : 'warning',
        message: `Updated ${response.updated} card(s) and skipped ${response.skipped}.`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      return;
    }

    if (!confirmDelete) {
      setStatus({
        type: 'warning',
        message: 'Tick confirm delete before removing cards.',
      });
      return;
    }

    try {
      const response = await callAction<{ deleted: number }>('delete_deck_cards', {
        deck_id: deckId,
        card_ids: Array.from(selectedIds),
      });

      await Promise.all([refreshBootstrap(), loadRows()]);
      setSelectedIds(new Set());
      setEditingCardId(null);
      setStatus({
        type: 'success',
        message: `Deleted ${response.deleted} card(s).`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const handleReplaceMedia = async () => {
    if (!selectedCardIdForMedia) {
      setStatus({
        type: 'warning',
        message: 'Pick a single card to replace media on.',
      });
      return;
    }

    if (replaceFiles.length === 0) {
      setStatus({
        type: 'warning',
        message: 'Select one or more media files first.',
      });
      return;
    }

    try {
      await callActionWithFiles(
        'replace_card_media',
        {
          deck_id: deckId,
          card_id: selectedCardIdForMedia,
          replace_target: replaceTarget,
          media_type: replaceMediaType,
        },
        'media_paths',
        replaceFiles,
      );

      await loadRows();
      setReplaceFiles([]);
      setStatus({
        type: 'success',
        message: 'Card media replaced.',
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  if (!deck) {
    return (
      <div className="max-w-6xl">
        <div className="bg-white rounded-lg p-8 border border-gray-200 text-center text-gray-500">
          Deck not found.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-semibold mb-2">{deck.name}</h2>
      <p className="text-gray-600 mb-6">
        {deck.collection_name} · {deck.card_count} cards
      </p>

      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void loadRows();
              }
            }}
            placeholder="Search by dictionary form, notes, or inflection"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => void loadRows()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
        <h3 className="font-semibold mb-4">
          Bulk Actions ({selectedIds.size} selected)
        </h3>

        <div className="grid md:grid-cols-[1fr_auto_auto_auto] gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Schema
            </label>
            <select
              value={bulkSchemaKey}
              onChange={(event) => setBulkSchemaKey(event.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {cardSchemas.map((schema) => (
                <option key={schema.key} value={schema.key}>
                  {schema.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => void handleBulkSchemaUpdate()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Apply Schema
          </button>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={confirmDelete}
              onChange={(event) => setConfirmDelete(event.target.checked)}
            />
            Confirm delete
          </label>

          <button
            onClick={() => void handleDeleteSelected()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {editingCardId && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
          <h3 className="font-semibold mb-4">Edit Card</h3>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              value={editForm.kanji}
              onChange={(event) =>
                setEditForm((previous) => ({
                  ...previous,
                  kanji: event.target.value,
                }))
              }
              placeholder="Kanji"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={editForm.kana}
              onChange={(event) =>
                setEditForm((previous) => ({
                  ...previous,
                  kana: event.target.value,
                }))
              }
              placeholder="Kana"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <input
              type="text"
              value={editForm.english}
              onChange={(event) =>
                setEditForm((previous) => ({
                  ...previous,
                  english: event.target.value,
                }))
              }
              placeholder="English"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <textarea
              value={editForm.notes}
              onChange={(event) =>
                setEditForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
              rows={3}
              placeholder="Notes"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <select
              value={editForm.schema_key}
              onChange={(event) =>
                setEditForm((previous) => ({
                  ...previous,
                  schema_key: event.target.value,
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {cardSchemas.map((schema) => (
                <option key={schema.key} value={schema.key}>
                  {schema.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => void handleSaveEdit()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Changes
            </button>
            <button
              onClick={() => setEditingCardId(null)}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
        <h3 className="font-semibold mb-4">Replace Card Media</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select exactly one card or open one in edit mode before attaching new
          media.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <select
            value={replaceTarget}
            onChange={(event) => setReplaceTarget(event.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="english">Replace English text with media tag</option>
            <option value="kana">Replace Kana text with media tag</option>
            <option value="kanji">Replace Kanji text with media tag</option>
            <option value="none">Keep existing text</option>
          </select>

          <select
            value={replaceMediaType}
            onChange={(event) => setReplaceMediaType(event.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="image">Image</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>

          <label className="inline-flex items-center gap-3 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Select media</span>
            <input
              type="file"
              multiple
              accept="image/*,audio/*,video/*"
              onChange={(event) =>
                setReplaceFiles(Array.from(event.target.files ?? []))
              }
              className="hidden"
            />
          </label>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={() => void handleReplaceMedia()}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black"
          >
            Apply Media
          </button>
          <div className="text-sm text-gray-600">
            Target card:{' '}
            {selectedCardIdForMedia || 'select one card or open the editor'}
          </div>
          <div className="text-sm text-gray-600">
            {replaceFiles.length} file(s) selected
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-lg p-8 border border-gray-200 text-center text-gray-500">
          No cards match the current filter.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">Sel</th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    #
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Word
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Reading
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    English
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Schema
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Form
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelection(row.id)}>
                        {selectedIds.has(row.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">{row.index}</td>
                    <td className="px-4 py-3 font-semibold">{row.kanji}</td>
                    <td className="px-4 py-3 text-gray-600">{row.kana}</td>
                    <td className="px-4 py-3">{row.english}</td>
                    <td className="px-4 py-3 text-sm">{row.schema_label}</td>
                    <td className="px-4 py-3 text-sm">{row.word_form}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => startEditing(row)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
