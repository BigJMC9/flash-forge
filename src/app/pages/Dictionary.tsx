import { useState } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Square,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { callAction, errorMessage } from '../lib/backend';
import { parseCommaSeparated } from '../lib/text';
import { DictionaryEntry } from '../types';

export function Dictionary() {
  const {
    cardSchemas,
    currentDeck,
    currentDeckId,
    defaultSchemaKey,
    defaultWordForm,
    refreshBootstrap,
    setStatus,
    verbForms,
  } = useApp();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [destination, setDestination] = useState<'deck' | 'global'>('deck');
  const [schemaKey, setSchemaKey] = useState(defaultSchemaKey);
  const [wordForm, setWordForm] = useState(defaultWordForm);
  const [tags, setTags] = useState('japanese,jamdict');
  const [notes, setNotes] = useState('');
  const [englishOverride, setEnglishOverride] = useState('');

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setSelectedIds(new Set());
      return;
    }

    try {
      setIsSearching(true);
      const response = await callAction<{ results: DictionaryEntry[] }>(
        'search_dictionary',
        {
          query: trimmedQuery,
          limit: 50,
        },
      );
      setResults(response.results ?? []);
      setSelectedIds(new Set());
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelection = (entryId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const handleAddEntries = async (entryIds: string[]) => {
    if (entryIds.length === 0) {
      setStatus({
        type: 'warning',
        message: 'Select one or more dictionary entries first.',
      });
      return;
    }

    if (destination === 'deck' && !currentDeckId) {
      setStatus({
        type: 'warning',
        message: 'Select a context deck first.',
      });
      return;
    }

    try {
      const response = await callAction<{
        added: number;
        skipped: number;
        missing_entry_ids: string[];
      }>('add_dictionary_entries', {
        entry_ids: entryIds,
        destination,
        deck_id: currentDeckId ?? '',
        schema_key: schemaKey,
        word_form: wordForm,
        tags: parseCommaSeparated(tags),
        notes,
        english_override: englishOverride,
      });

      await refreshBootstrap();
      setSelectedIds(new Set());
      setStatus({
        type: response.added > 0 ? 'success' : 'warning',
        message: `Added ${response.added} card(s) and skipped ${response.skipped}.`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-semibold mb-6">Dictionary Search</h2>

      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleSearch();
              }
            }}
            placeholder="Search by Japanese text or English gloss"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => void handleSearch()}
            disabled={isSearching}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-300"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
        <h3 className="font-semibold mb-4">Add Settings</h3>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Destination
            </label>
            <select
              value={destination}
              onChange={(event) =>
                setDestination(event.target.value as 'deck' | 'global')
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="deck">Current Deck</option>
              <option value="global">Global Library</option>
            </select>
            {destination === 'deck' && (
              <p className="text-xs text-gray-500 mt-2">
                {currentDeck
                  ? `Current deck: ${currentDeck.label}`
                  : 'No context deck selected.'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Schema</label>
            <select
              value={schemaKey}
              onChange={(event) => setSchemaKey(event.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {verbForms.map((form) => (
                <option key={form.key} value={form.key}>
                  {form.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              English Override
            </label>
            <input
              type="text"
              value={englishOverride}
              onChange={(event) => setEnglishOverride(event.target.value)}
              placeholder="Optional replacement English gloss"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="tag1, tag2"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Shared note for added cards"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => void handleAddEntries(Array.from(selectedIds))}
            disabled={selectedIds.size === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            Add Selected ({selectedIds.size})
          </button>
          <button
            onClick={() => setSelectedIds(new Set(results.map((entry) => entry.entry_id)))}
            disabled={results.length === 0}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100"
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100"
          >
            Clear
          </button>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="bg-white rounded-lg p-8 border border-gray-200 text-center text-gray-500">
          Search the dictionary to load results.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">Sel</th>
                <th className="text-left px-4 py-3 text-sm text-gray-600">
                  Headword
                </th>
                <th className="text-left px-4 py-3 text-sm text-gray-600">
                  Reading
                </th>
                <th className="text-left px-4 py-3 text-sm text-gray-600">
                  English
                </th>
                <th className="text-left px-4 py-3 text-sm text-gray-600">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-sm text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((entry) => (
                <tr key={entry.entry_id} className="border-b border-gray-100 align-top">
                  <td className="px-4 py-3">
                    <button onClick={() => toggleSelection(entry.entry_id)}>
                      {selectedIds.has(entry.entry_id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-semibold">{entry.headword}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.reading}</td>
                  <td className="px-4 py-3">
                    <div>{entry.english}</div>
                    {entry.glosses.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {entry.glosses.join(' | ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="inline-flex px-2 py-1 bg-blue-50 text-blue-700 rounded">
                      {entry.is_verb
                        ? entry.verb_type.replace(/_/g, ' ')
                        : entry.pos_labels[0] ?? 'entry'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-2">
                      <button
                        onClick={() => void handleAddEntries([entry.entry_id])}
                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Quick Add
                      </button>
                      <div className="text-xs text-gray-500 max-w-xs">
                        {entry.option_label}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
