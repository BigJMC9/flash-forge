import { useEffect, useState } from 'react';
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

function formatSurface(word: string, reading: string): string {
  const trimmedWord = word.trim();
  const trimmedReading = reading.trim();
  if (trimmedWord && trimmedReading && trimmedWord !== trimmedReading) {
    return `${trimmedWord} [${trimmedReading}]`;
  }
  return trimmedWord || trimmedReading;
}

function relationClassName(
  relation: 'parent' | 'child' | 'variant' | 'gloss' | 'entry' | undefined,
): string {
  if (relation === 'child') {
    return 'bg-amber-50 text-amber-700';
  }
  if (relation === 'variant') {
    return 'bg-violet-50 text-violet-700';
  }
  if (relation === 'gloss') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (relation === 'parent') {
    return 'bg-slate-100 text-slate-700';
  }
  return 'bg-gray-100 text-gray-700';
}

function buildEntryTags(entry: DictionaryEntry): string[] {
  const tags = [
    ...(entry.pos_labels ?? []),
    ...(entry.is_verb && entry.verb_type_label ? [entry.verb_type_label] : []),
    ...((entry.senses ?? []).flatMap((sense) => sense.notes ?? [])),
  ];

  return Array.from(
    new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
  );
}

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
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [destination, setDestination] = useState<'deck' | 'global'>('deck');
  const [schemaKey, setSchemaKey] = useState(defaultSchemaKey);
  const [wordForm, setWordForm] = useState(defaultWordForm);
  const [tags, setTags] = useState('japanese,jamdict');
  const [notes, setNotes] = useState('');
  const [englishOverride, setEnglishOverride] = useState('');

  const selectedEntry =
    results.find((entry) => entry.entry_id === selectedEntryId) ?? null;
  const selectedEntryTags = selectedEntry ? buildEntryTags(selectedEntry) : [];

  useEffect(() => {
    if (results.length === 0) {
      setSelectedEntryId('');
      return;
    }

    setSelectedEntryId((previous) =>
      results.some((entry) => entry.entry_id === previous)
        ? previous
        : results[0].entry_id,
    );
  }, [results]);

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setSelectedIds(new Set());
      setSelectedEntryId('');
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
    <div className="max-w-7xl">
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
        <div className="grid xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)] gap-6 items-start">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
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
                      Type / Match
                    </th>
                    <th className="text-left px-4 py-3 text-sm text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((entry) => {
                    const isSelected = entry.entry_id === selectedEntryId;
                    return (
                      <tr
                        key={entry.entry_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedEntryId(entry.entry_id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedEntryId(entry.entry_id);
                          }
                        }}
                        className={`border-b border-gray-100 align-top cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSelection(entry.entry_id);
                            }}
                          >
                            {selectedIds.has(entry.entry_id) ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          <div className="flex items-start gap-2">
                            <span>{entry.headword}</span>
                            {isSelected && (
                              <span className="inline-flex px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                                Selected
                              </span>
                            )}
                          </div>
                          {entry.search_match?.relation === 'child' &&
                            entry.stem_entry && (
                              <div className="text-xs text-gray-500 mt-1 font-normal">
                                Stem:{' '}
                                {formatSurface(
                                  entry.stem_entry.word,
                                  entry.stem_entry.reading,
                                )}{' '}
                                · {entry.stem_entry.field_label}
                              </div>
                            )}
                        </td>
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
                          <div className="flex flex-col items-start gap-2">
                            <div className="inline-flex px-2 py-1 bg-blue-50 text-blue-700 rounded">
                              {entry.is_verb
                                ? entry.verb_type.replace(/_/g, ' ')
                                : entry.pos_labels[0] ?? 'entry'}
                            </div>
                            {entry.search_match && (
                              <>
                                <div
                                  className={`inline-flex px-2 py-1 rounded ${relationClassName(entry.search_match.relation)}`}
                                >
                                  {entry.search_match.relation_label}
                                </div>
                                <div className="text-xs text-gray-500 max-w-xs">
                                  {entry.search_match.field_label}
                                  {entry.search_match.matched_text
                                    ? `: ${entry.search_match.matched_text}`
                                    : ''}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-2">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleAddEntries([entry.entry_id]);
                              }}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="bg-white rounded-lg border border-gray-200 p-6 xl:sticky xl:top-6">
            {selectedEntry ? (
              <div className="space-y-6">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">
                        {selectedEntry.headword}
                      </h3>
                      <div className="text-gray-600 mt-1">
                        {selectedEntry.reading}
                      </div>
                    </div>
                    {selectedEntry.search_match && (
                      <span
                        className={`inline-flex px-2 py-1 rounded text-sm ${relationClassName(selectedEntry.search_match.relation)}`}
                      >
                        {selectedEntry.search_match.relation_label}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    JMdict #{selectedEntry.entry_id}
                  </div>
                  <div className="mt-3 text-sm text-gray-700">
                    {selectedEntry.english}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium text-gray-700">Search Match</div>
                  <div className="text-sm text-gray-600">
                    {selectedEntry.search_match?.field_label ?? 'Dictionary entry'}
                  </div>
                  {selectedEntry.search_match?.matched_text && (
                    <div className="text-sm text-gray-800">
                      {selectedEntry.search_match.matched_text}
                    </div>
                  )}
                </div>

                {selectedEntry.stem_entry && (
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">Stem Entry</div>
                    <div className="text-sm text-gray-800">
                      {formatSurface(
                        selectedEntry.stem_entry.word,
                        selectedEntry.stem_entry.reading,
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedEntry.stem_entry.field_label}
                    </div>
                  </div>
                )}

                {selectedEntryTags.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">Tags</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntryTags.map((tag) => (
                        <span
                          key={`${selectedEntry.entry_id}-tag-${tag}`}
                          className="inline-flex px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEntry.kanji_forms && selectedEntry.kanji_forms.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">
                      JMdict Kanji Forms
                    </div>
                    <div className="text-sm text-gray-800">
                      {selectedEntry.kanji_forms.join(' / ')}
                    </div>
                  </div>
                )}

                {selectedEntry.kana_forms && selectedEntry.kana_forms.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">
                      JMdict Kana Forms
                    </div>
                    <div className="text-sm text-gray-800">
                      {selectedEntry.kana_forms.join(' / ')}
                    </div>
                  </div>
                )}

                {selectedEntry.word_fields && selectedEntry.word_fields.length > 0 && (
                  <div className="space-y-3">
                    <div className="font-medium text-gray-700">Word Fields</div>
                    <div className="space-y-2">
                      {selectedEntry.word_fields.map((field) => (
                        <div
                          key={`${selectedEntry.entry_id}-field-${field.key}`}
                          className="border border-gray-200 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-sm text-gray-800">
                              {field.label}
                            </div>
                            <span
                              className={`inline-flex px-2 py-1 rounded text-xs ${relationClassName(field.role)}`}
                            >
                              {field.role === 'parent' ? 'Parent' : 'Child'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700 mt-2">
                            {formatSurface(field.word, field.reading)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEntry.senses && selectedEntry.senses.length > 0 && (
                  <div className="space-y-3">
                    <div className="font-medium text-gray-700">Sense Rows</div>
                    <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
                      {selectedEntry.senses.map((sense) => (
                        <div
                          key={`${selectedEntry.entry_id}-sense-${sense.sense_index}`}
                          className="border border-gray-200 rounded-lg p-3"
                        >
                          <div className="font-medium text-sm text-gray-800">
                            Sense {sense.sense_index}
                          </div>
                          {sense.glosses.length > 0 && (
                            <div className="text-sm text-gray-700 mt-2">
                              Glosses: {sense.glosses.join(' | ')}
                            </div>
                          )}
                          {sense.pos_labels.length > 0 && (
                            <div className="text-sm text-gray-500 mt-2">
                              POS: {sense.pos_labels.join(' | ')}
                            </div>
                          )}
                          {sense.notes.length > 0 && (
                            <div className="text-sm text-gray-500 mt-2">
                              Notes: {sense.notes.join(' | ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEntry.examples && selectedEntry.examples.length > 0 && (
                  <div className="space-y-3">
                    <div className="font-medium text-gray-700">Examples</div>
                    <div className="space-y-3">
                      {selectedEntry.examples.slice(0, 4).map((example, index) => (
                        <div
                          key={`${selectedEntry.entry_id}-example-${index}`}
                          className="border border-gray-200 rounded-lg p-3"
                        >
                          <div className="text-sm text-gray-800">
                            {example.japanese}
                          </div>
                          {example.reading && (
                            <div className="text-sm text-gray-500 mt-1">
                              {example.reading}
                            </div>
                          )}
                          {example.english && (
                            <div className="text-sm text-gray-700 mt-2">
                              {example.english}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Select a dictionary result to inspect its JMdict fields.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
