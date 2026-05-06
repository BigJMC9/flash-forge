import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { callAction, errorMessage } from '../lib/backend';
import type {
  AiDeckProposalApplyResponse,
  AiDeckProposalItem,
  AiDeckProposalResponse,
} from '../types';

type ProposalMode = 'mixed' | 'add' | 'update';

const MODE_OPTIONS: Array<{ key: ProposalMode; label: string; description: string }> = [
  {
    key: 'mixed',
    label: 'Add and improve',
    description: 'Let the AI propose new cards and edits to existing cards.',
  },
  {
    key: 'add',
    label: 'New cards only',
    description: 'Only propose additions.',
  },
  {
    key: 'update',
    label: 'Improve existing',
    description: 'Only propose edits to current deck cards.',
  },
];

const COUNT_OPTIONS = [6, 12, 18, 24, 32];

function shuffleItems<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function optionButtonClass(active: boolean): string {
  return active ? 'app-option app-option-active' : 'app-option';
}

function operationLabel(operation: string): string {
  return operation === 'update' ? 'Update' : 'Add';
}

export function AiDeckAssistant() {
  const { deckId = '' } = useParams<{ deckId: string }>();
  const {
    cardSchemas,
    decks,
    defaultSchemaKey,
    refreshBootstrap,
    setCurrentDeck,
    setStatus,
  } = useApp();

  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<ProposalMode>('mixed');
  const [schemaKey, setSchemaKey] = useState(defaultSchemaKey);
  const [targetCount, setTargetCount] = useState(12);
  const [proposalSummary, setProposalSummary] = useState('');
  const [proposalItems, setProposalItems] = useState<AiDeckProposalItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const deck = decks.find((item) => item.id === deckId) ?? null;
  const selectedItems = proposalItems.filter((item) => selectedIds.includes(item.id));
  const schemaLabelByKey = useMemo(
    () => Object.fromEntries(cardSchemas.map((schema) => [schema.key, schema.label])),
    [cardSchemas],
  );

  useEffect(() => {
    if (deckId) {
      setCurrentDeck(deckId);
    }
  }, [deckId, setCurrentDeck]);

  useEffect(() => {
    if (!cardSchemas.length) {
      return;
    }
    if (!cardSchemas.some((schema) => schema.key === schemaKey)) {
      setSchemaKey(defaultSchemaKey);
    }
  }, [cardSchemas, defaultSchemaKey, schemaKey]);

  const toggleSelected = (itemId: string) => {
    setSelectedIds((previous) =>
      previous.includes(itemId)
        ? previous.filter((id) => id !== itemId)
        : [...previous, itemId],
    );
  };

  const generateProposal = async () => {
    if (!deckId || !prompt.trim()) {
      setStatus({
        type: 'warning',
        message: 'Enter a prompt for the AI deck assistant.',
      });
      return;
    }

    try {
      setIsGenerating(true);
      const response = await callAction<AiDeckProposalResponse>(
        'generate_ai_deck_proposal',
        {
          deck_id: deckId,
          prompt: prompt.trim(),
          mode,
          schema_key: schemaKey,
          target_count: targetCount,
        },
      );
      setProposalSummary(response.summary ?? '');
      setProposalItems(shuffleItems(response.items ?? []));
      setSelectedIds([]);
      setFeedback('');
      setStatus({
        type: response.items.length ? 'success' : 'warning',
        message: response.items.length
          ? `Generated ${response.items.length} proposed change(s).`
          : 'The AI did not return any usable proposed changes.',
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const refineSelected = async () => {
    if (!selectedItems.length || !feedback.trim()) {
      setStatus({
        type: 'warning',
        message: 'Select proposed cards and explain what the AI should fix.',
      });
      return;
    }

    try {
      setIsRefining(true);
      const response = await callAction<AiDeckProposalResponse>(
        'refine_ai_deck_proposal',
        {
          deck_id: deckId,
          original_prompt: prompt.trim(),
          mode,
          schema_key: schemaKey,
          feedback: feedback.trim(),
          selected_items: selectedItems,
        },
      );
      setProposalSummary(response.summary || proposalSummary);
      setProposalItems((previous) =>
        shuffleItems([
          ...previous.filter((item) => !selectedIds.includes(item.id)),
          ...(response.items ?? []),
        ]),
      );
      setSelectedIds([]);
      setFeedback('');
      setStatus({
        type: response.items.length ? 'success' : 'warning',
        message: response.items.length
          ? `Revised ${response.items.length} selected proposal(s).`
          : 'The AI did not return usable revisions.',
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsRefining(false);
    }
  };

  const removeSelected = () => {
    setProposalItems((previous) =>
      previous.filter((item) => !selectedIds.includes(item.id)),
    );
    setSelectedIds([]);
  };

  const applyProposal = async () => {
    if (!proposalItems.length) {
      return;
    }

    try {
      setIsApplying(true);
      const response = await callAction<AiDeckProposalApplyResponse>(
        'apply_ai_deck_proposal',
        {
          deck_id: deckId,
          schema_key: schemaKey,
          items: proposalItems,
        },
      );
      await refreshBootstrap();
      setProposalItems([]);
      setSelectedIds([]);
      setProposalSummary('');
      setFeedback('');
      setStatus({
        type: response.skipped > 0 ? 'warning' : 'success',
        message: `Applied ${response.added} addition(s), ${response.updated} update(s), ${response.skipped} skipped.`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsApplying(false);
    }
  };

  if (!deck) {
    return (
      <div className="app-page max-w-4xl">
        <div className="app-empty">Deck not found.</div>
      </div>
    );
  }

  return (
    <div className="app-page max-w-7xl">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">AI Deck Assistant: {deck.name}</h2>
          <p className="app-page-description">
            Ask for additions or improvements, review the randomized proposal, then apply only what meets your standards.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(22rem,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <div className="app-panel p-6">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Request
            </h3>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm text-gray-600">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={7}
                  placeholder="Create 12 cards about train station vocabulary, or improve cards with weak English definitions..."
                  className="app-input"
                />
              </div>

              <div>
                <div className="mb-2 text-sm text-gray-600">Mode</div>
                <div className="grid gap-2">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setMode(option.key)}
                      className={optionButtonClass(mode === option.key)}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="block text-xs opacity-75">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-600">
                  Default Schema
                </label>
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
                <div className="mb-2 text-sm text-gray-600">Target Count</div>
                <div className="flex flex-wrap gap-2">
                  {COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setTargetCount(count)}
                      className={optionButtonClass(targetCount === count)}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void generateProposal()}
                disabled={isGenerating}
                className="app-btn-primary w-full"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate Review Set
              </button>
            </div>
          </div>

          {proposalItems.length > 0 && (
            <div className="app-panel p-6">
              <h3 className="mb-4 text-base font-semibold text-gray-900">
                Revise Selected
              </h3>
              <div className="mb-3 text-sm text-gray-600">
                {selectedItems.length} selected
              </div>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                rows={5}
                placeholder="Explain what is wrong, or provide the exact correction you want for the selected cards."
                className="app-input"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void refineSelected()}
                  disabled={isRefining || selectedItems.length === 0}
                  className="app-btn-primary"
                >
                  {isRefining ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Ask AI to Fix
                </button>
                <button
                  type="button"
                  onClick={removeSelected}
                  disabled={selectedItems.length === 0}
                  className="app-btn-secondary"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {proposalItems.length === 0 ? (
            <div className="app-empty">
              Generate a review set to inspect proposed additions and updates before applying them.
            </div>
          ) : (
            <>
              <div className="app-panel p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Review Proposed Changes
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Order is randomized. Select anything incorrect and ask the AI to revise it.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setProposalItems((previous) => shuffleItems(previous))}
                      className="app-btn-secondary"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Shuffle
                    </button>
                    <button
                      type="button"
                      onClick={() => void applyProposal()}
                      disabled={isApplying}
                      className="app-btn-primary"
                    >
                      {isApplying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Apply Reviewed
                    </button>
                  </div>
                </div>
                {proposalSummary && (
                  <div className="app-banner mt-4">{proposalSummary}</div>
                )}
              </div>

              <div className="space-y-4">
                {proposalItems.map((item, index) => {
                  const selected = selectedIds.includes(item.id);
                  const proposedSchema =
                    schemaLabelByKey[item.card.schema_key] ?? item.card.schema_key;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border bg-white p-5 ${
                        selected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'
                      }`}
                    >
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <label className="flex min-w-0 items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelected(item.id)}
                            className="mt-1 h-4 w-4"
                          />
                          <span>
                            <span className="mb-1 block text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
                              {index + 1}. {operationLabel(item.operation)}
                            </span>
                            <span className="block text-lg font-semibold text-gray-900">
                              {item.card.kanji}
                              {item.card.kana ? ` [${item.card.kana}]` : ''}
                            </span>
                          </span>
                        </label>
                        <span className="app-badge-muted">{proposedSchema}</span>
                      </div>

                      {item.operation === 'update' && item.existing_card && (
                        <div className="mb-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                              Current
                            </div>
                            <div className="font-semibold">
                              {item.existing_card.kanji}
                              {item.existing_card.kana
                                ? ` [${item.existing_card.kana}]`
                                : ''}
                            </div>
                            <div className="mt-1 text-sm text-gray-700">
                              {item.existing_card.english}
                            </div>
                            {item.existing_card.notes && (
                              <div className="mt-2 text-xs text-gray-500">
                                {item.existing_card.notes}
                              </div>
                            )}
                          </div>
                          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                              Proposed
                            </div>
                            <div className="font-semibold">
                              {item.card.kanji}
                              {item.card.kana ? ` [${item.card.kana}]` : ''}
                            </div>
                            <div className="mt-1 text-sm text-gray-700">
                              {item.card.english}
                            </div>
                            {item.card.notes && (
                              <div className="mt-2 text-xs text-gray-600">
                                {item.card.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {item.operation !== 'update' && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                              English
                            </div>
                            <div className="mt-1 text-sm text-gray-800">
                              {item.card.english}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                              Word Form
                            </div>
                            <div className="mt-1 text-sm text-gray-800">
                              {item.card.word_form}
                            </div>
                          </div>
                        </div>
                      )}

                      {(item.card.kanji_on_readings ||
                        item.card.kanji_kun_readings ||
                        item.card.kanji_nanori_readings ||
                        item.card.radical_position) && (
                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          {item.card.kanji_on_readings && (
                            <div className="text-sm">
                              <span className="font-semibold">ON:</span>{' '}
                              {item.card.kanji_on_readings}
                            </div>
                          )}
                          {item.card.kanji_kun_readings && (
                            <div className="text-sm">
                              <span className="font-semibold">Kun:</span>{' '}
                              {item.card.kanji_kun_readings}
                            </div>
                          )}
                          {item.card.kanji_nanori_readings && (
                            <div className="text-sm">
                              <span className="font-semibold">Nanori:</span>{' '}
                              {item.card.kanji_nanori_readings}
                            </div>
                          )}
                          {item.card.radical_position && (
                            <div className="text-sm">
                              <span className="font-semibold">Radical:</span>{' '}
                              {item.card.radical_position}
                            </div>
                          )}
                        </div>
                      )}

                      {item.reason && (
                        <div className="app-banner mt-4">{item.reason}</div>
                      )}
                      {item.card.tags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.card.tags.map((tag) => (
                            <span key={tag} className="app-badge-muted">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
