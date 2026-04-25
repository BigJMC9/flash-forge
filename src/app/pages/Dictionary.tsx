import { useCallback, useEffect, useRef, useState } from 'react';
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
  if (relation === 'child' || relation === 'variant' || relation === 'gloss') {
    return 'app-badge-accent';
  }
  if (relation === 'parent') {
    return 'app-badge-muted';
  }
  return 'app-badge';
}

function buildEntryTags(entry: DictionaryEntry): string[] {
  const tags = [
    ...(entry.pos_tags ?? []),
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
  const searchRequestIdRef = useRef(0);

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

  const runSearch = useCallback(async (rawQuery: string) => {
    const trimmedQuery = rawQuery.trim();
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    if (!trimmedQuery) {
      setResults([]);
      setSelectedIds(new Set());
      setSelectedEntryId('');
      setIsSearching(false);
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

      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      setResults(response.results ?? []);
      setSelectedIds(new Set());
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, [setStatus]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      searchRequestIdRef.current += 1;
      setResults([]);
      setSelectedIds(new Set());
      setSelectedEntryId('');
      setIsSearching(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void runSearch(trimmedQuery);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  const handleSearch = async () => {
    await runSearch(query);
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
    <div className="app-page max-w-7xl">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">Dictionary Search</h2>
          <p className="app-page-description">
            Search JMdict, inspect structured entry details, and add selected results to
            the current deck or global library.
          </p>
        </div>
      </div>

      <div className="app-panel p-6">
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
            className="app-input flex-1"
          />
          <button
            onClick={() => void handleSearch()}
            disabled={isSearching}
            className="app-btn-primary"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </div>

      <div className="app-panel p-6">
        <h3 className="app-section-title mb-4">Add Settings</h3>

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
              className="app-input"
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

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              English Override
            </label>
            <input
              type="text"
              value={englishOverride}
              onChange={(event) => setEnglishOverride(event.target.value)}
              placeholder="Optional replacement English gloss"
              className="app-input"
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
              className="app-input"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Shared note for added cards"
              className="app-input"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => void handleAddEntries(Array.from(selectedIds))}
            disabled={selectedIds.size === 0}
            className="app-btn-primary"
          >
            Add Selected ({selectedIds.size})
          </button>
          <button
            onClick={() => setSelectedIds(new Set(results.map((entry) => entry.entry_id)))}
            disabled={results.length === 0}
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

      {results.length === 0 ? (
        <div className="app-empty">
          Search the dictionary to load results.
        </div>
      ) : (
        <div className="grid xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)] gap-6 items-start">
          <div className="app-table-wrap">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] table-fixed">
                <colgroup>
                  <col className="w-[52px]" />
                  <col className="w-[150px]" />
                  <col className="w-[130px]" />
                  <col className="w-[280px]" />
                  <col className="w-[150px]" />
                  <col className="w-[278px]" />
                </colgroup>
                <thead className="app-table-head">
                  <tr>
                    <th className="app-table-th">Sel</th>
                    <th className="app-table-th">Headword</th>
                    <th className="app-table-th">Reading</th>
                    <th className="app-table-th">English</th>
                    <th className="app-table-th">Type / Match</th>
                    <th className="app-table-th">Actions</th>
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
                        className={`app-table-row align-top cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="app-table-td">
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
                        <td className="app-table-td font-semibold">
                          <div className="flex flex-wrap items-start gap-2">
                            <span className="whitespace-nowrap break-keep leading-6">
                              {entry.headword}
                            </span>
                            {isSelected && (
                              <span className="app-badge-accent whitespace-nowrap">
                                Selected
                              </span>
                            )}
                          </div>
                          {entry.search_match?.relation === 'child' &&
                            entry.stem_entry && (
                              <div className="text-xs text-gray-500 mt-1 font-normal break-keep">
                                Stem:{' '}
                                {formatSurface(
                                  entry.stem_entry.word,
                                  entry.stem_entry.reading,
                                )}{' '}
                                · {entry.stem_entry.field_label}
                              </div>
                            )}
                        </td>
                        <td className="app-table-td text-gray-600 whitespace-nowrap break-keep">
                          {entry.reading}
                        </td>
                        <td className="app-table-td">
                          <div>{entry.english}</div>
                          {entry.glosses.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              {entry.glosses.join(' | ')}
                            </div>
                          )}
                        </td>
                        <td className="app-table-td text-sm">
                          <div className="flex flex-col items-start gap-2">
                            <div className="app-badge-accent rounded-md">
                              {entry.is_verb
                                ? entry.verb_type.replace(/_/g, ' ')
                                : entry.pos_labels[0] ?? 'entry'}
                            </div>
                            {entry.search_match && (
                              <>
                                <div
                                  className={relationClassName(entry.search_match.relation)}
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
                        <td className="app-table-td">
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

          <aside className="app-panel p-6 xl:sticky xl:top-6">
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
                        className={`${relationClassName(selectedEntry.search_match.relation)} text-sm`}
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
                          className="app-badge"
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
                          className="app-panel-muted p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-sm text-gray-800">
                              {field.label}
                            </div>
                            <span
                              className={`${relationClassName(field.role)} text-xs`}
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
                          className="app-panel-muted p-3"
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
                          className="app-panel-muted p-3"
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
              <div className="app-empty p-6">
                Select a dictionary result to inspect its JMdict fields.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
