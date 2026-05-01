import { useEffect, useState } from 'react';
import {
  CheckSquare,
  Download,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import { useApp } from '../contexts/AppContext';
import { callAction, errorMessage } from '../lib/backend';
import { parseCommaSeparated } from '../lib/text';
import { GlobalCardRow } from '../types';

export function GlobalLibrary() {
  const {
    cardSchemas,
    currentDeck,
    currentDeckId,
    defaultSchemaKey,
    defaultWordForm,
    decks,
    refreshBootstrap,
    setStatus,
    verbForms,
  } = useApp();

  const [searchText, setSearchText] = useState('');
  const [rows, setRows] = useState<GlobalCardRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sourceDeckId, setSourceDeckId] = useState('');
  const [schemaKey, setSchemaKey] = useState(defaultSchemaKey);
  const [wordForm, setWordForm] = useState(defaultWordForm);
  const [extraTags, setExtraTags] = useState('global_pool');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const loadRows = async () => {
    try {
      const response = await callAction<{ rows: GlobalCardRow[] }>(
        'list_global_cards',
        {
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
    void loadRows();
  }, []);

  const toggleSelection = (rowId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleImportDeckToGlobal = async () => {
    if (!sourceDeckId) {
      setStatus({
        type: 'warning',
        message: 'Select a source deck first.',
      });
      return;
    }

    try {
      const response = await callAction<{ added: number; skipped: number }>(
        'import_deck_to_global',
        {
          deck_id: sourceDeckId,
        },
      );
      await Promise.all([refreshBootstrap(), loadRows()]);
      setStatus({
        type: response.added > 0 ? 'success' : 'warning',
        message: `Imported ${response.added} card(s) into the global library and skipped ${response.skipped}.`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const handleImportToDeck = async () => {
    if (!currentDeckId) {
      setStatus({
        type: 'warning',
        message: 'Select a context deck first.',
      });
      return;
    }

    if (selectedIds.size === 0) {
      setStatus({
        type: 'warning',
        message: 'Select one or more global cards first.',
      });
      return;
    }

    try {
      const response = await callAction<{ added: number; skipped: number }>(
        'import_global_to_deck',
        {
          deck_id: currentDeckId,
          global_card_ids: Array.from(selectedIds),
          schema_key: schemaKey,
          word_form: wordForm,
          tags: parseCommaSeparated(extraTags),
        },
      );
      await refreshBootstrap();
      setSelectedIds(new Set());
      setStatus({
        type: response.added > 0 ? 'success' : 'warning',
        message: `Imported ${response.added} card(s) to the current deck and skipped ${response.skipped}.`,
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

    try {
      const response = await callAction<{ deleted: number }>(
        'delete_global_cards',
        {
          ids: Array.from(selectedIds),
        },
      );
      await Promise.all([refreshBootstrap(), loadRows()]);
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      setStatus({
        type: 'success',
        message: `Deleted ${response.deleted} global card(s).`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">Global Library</h2>
          <p className="app-page-description">
            Reuse vocabulary across decks, import shared cards into the current context,
            and keep the library curated.
          </p>
        </div>
      </div>

      <div className="app-panel p-6">
        <h3 className="app-section-title mb-4">Import Deck Cards to Global Library</h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={sourceDeckId}
            onChange={(event) => setSourceDeckId(event.target.value)}
            className="app-input flex-1"
          >
            <option value="">Select a source deck…</option>
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => void handleImportDeckToGlobal()}
            className="app-btn-primary"
          >
            <Download className="w-4 h-4" />
            Import All Cards
          </button>
        </div>
      </div>

      <div className="app-panel p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void loadRows();
              }
            }}
            placeholder="Search by dictionary or inflected form"
            className="app-input flex-1"
          />
          <button
            onClick={() => void loadRows()}
            className="app-btn-primary"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Current Deck
            </label>
            <div className="app-banner">
              {currentDeck ? currentDeck.label : 'No context deck selected'}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Schema</label>
            <select
              value={schemaKey}
              onChange={(event) => setSchemaKey(event.target.value)}
              className="app-input"
            >
              {cardSchemas.map((schema) => (
                <option key={schema.key} value={schema.key}>
                  {schema.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Word Form
            </label>
            <select
              value={wordForm}
              onChange={(event) => setWordForm(event.target.value)}
              className="app-input"
            >
              {verbForms.map((form) => (
                <option key={form.key} value={form.key}>
                  {form.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">Extra Tags</label>
          <input
            type="text"
            value={extraTags}
            onChange={(event) => setExtraTags(event.target.value)}
            placeholder="global_pool,review"
            className="app-input"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            onClick={() => void handleImportToDeck()}
            disabled={selectedIds.size === 0}
            className="app-btn-primary"
          >
            Import Selected to Current Deck
          </button>
          <button
            onClick={() => setDeleteDialogOpen(true)}
            disabled={selectedIds.size === 0}
            className="app-btn-danger"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set(rows.map((row) => row.id)))}
            disabled={rows.length === 0}
            className="app-btn-secondary"
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0}
            className="app-btn-secondary"
          >
            Clear
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="app-empty">
          No global cards match the current search.
        </div>
      ) : (
        <div className="app-table-wrap">
          <div>
            <table className="w-full">
              <thead className="app-table-head">
                <tr>
                  <th className="app-table-th">Sel</th>
                  <th className="app-table-th">
                    Word
                  </th>
                  <th className="app-table-th">
                    Reading
                  </th>
                  <th className="app-table-th">
                    English
                  </th>
                  <th className="app-table-th">
                    Forms
                  </th>
                  <th className="app-table-th">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="app-table-row align-top">
                    <td className="app-table-td">
                      <button onClick={() => toggleSelection(row.id)}>
                        {selectedIds.has(row.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="app-table-td font-semibold">{row.kanji}</td>
                    <td className="app-table-td text-gray-600">{row.kana}</td>
                    <td className="app-table-td">
                      <div>{row.english}</div>
                      {row.dictionary_gloss && (
                        <div className="text-xs text-gray-500 mt-1">
                          {row.dictionary_gloss}
                        </div>
                      )}
                    </td>
                    <td className="app-table-td text-sm text-gray-600">
                      <div className="space-y-1">
                        {row.kanji_masu && <div>Masu: {row.kanji_masu}</div>}
                        {row.kanji_te && <div>Te: {row.kanji_te}</div>}
                        {row.kanji_past && <div>Past: {row.kanji_past}</div>}
                        {row.kanji_negative && (
                          <div>Negative: {row.kanji_negative}</div>
                        )}
                      </div>
                    </td>
                    <td className="app-table-td text-sm">
                      <div className="flex flex-wrap gap-2">
                        {row.tags.map((tag) => (
                          <span
                            key={`${row.id}-${tag}`}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete selected global cards?"
        description={`Delete ${selectedIds.size} selected card(s) from the global library. This only removes them from the global pool.`}
        confirmLabel="Delete Cards"
        destructive
        onConfirm={handleDeleteSelected}
      />
    </div>
  );
}
