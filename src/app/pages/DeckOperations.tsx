import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import {
  CheckSquare,
  Copy,
  Edit2,
  MailPlus,
  Shield,
  Search,
  Square,
  Trash2,
  UserMinus,
  Users,
  Upload,
} from 'lucide-react';
import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import { useApp } from '../contexts/AppContext';
import { copyTextToClipboard } from '../lib/clipboard';
import { callAction, callActionWithFiles, errorMessage } from '../lib/backend';
import { DeckCardRow, DeckCollaboratorRow, DeckInviteRow } from '../types';

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
  const [collaborators, setCollaborators] = useState<DeckCollaboratorRow[]>([]);
  const [invites, setInvites] = useState<DeckInviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [lastInviteToken, setLastInviteToken] = useState('');
  const [deleteCardsDialogOpen, setDeleteCardsDialogOpen] = useState(false);
  const [collaboratorToRemove, setCollaboratorToRemove] =
    useState<DeckCollaboratorRow | null>(null);
  const rowsRequestIdRef = useRef(0);

  const deck = decks.find((item) => item.id === deckId) ?? null;
  const inviteLink = useMemo(() => {
    if (!lastInviteToken || typeof window === 'undefined') {
      return '';
    }
    return `${window.location.origin}/account?invite_token=${encodeURIComponent(lastInviteToken)}`;
  }, [lastInviteToken]);

  const selectedCardIdForMedia = useMemo(() => {
    if (editingCardId) {
      return editingCardId;
    }
    const ids = Array.from(selectedIds);
    return ids.length === 1 ? ids[0] : '';
  }, [editingCardId, selectedIds]);

  const loadRows = useCallback(async (search = searchText) => {
    const requestId = rowsRequestIdRef.current + 1;
    rowsRequestIdRef.current = requestId;

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
          search,
        },
      );

      if (requestId !== rowsRequestIdRef.current) {
        return;
      }

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
      if (requestId !== rowsRequestIdRef.current) {
        return;
      }

      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  }, [deckId, searchText, setStatus]);

  const loadCollaboration = useCallback(async () => {
    if (!deckId) {
      setCollaborators([]);
      setInvites([]);
      return;
    }

    try {
      const response = await callAction<{
        collaborators: DeckCollaboratorRow[];
        invites: DeckInviteRow[];
        is_owner: boolean;
      }>('list_deck_collaboration', {
        deck_id: deckId,
      });
      setCollaborators(response.collaborators ?? []);
      setInvites(response.invites ?? []);
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  }, [deckId, setStatus]);

  useEffect(() => {
    if (deckId) {
      setCurrentDeck(deckId);
      void loadCollaboration();
    } else {
      setRows([]);
      setSelectedIds(new Set());
    }
  }, [deckId, loadCollaboration, setCurrentDeck]);

  useEffect(() => {
    if (!deckId) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadRows(searchText);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [deckId, loadRows, searchText]);

  const handleCreateInvite = async () => {
    if (!deck?.is_owner) {
      return;
    }

    try {
      const response = await callAction<{
        invite: DeckInviteRow & { token: string };
      }>('create_deck_invite', {
        deck_id: deckId,
        invited_email: inviteEmail,
        invited_username: inviteUsername,
      });
      setInviteEmail('');
      setInviteUsername('');
      setLastInviteToken(response.invite?.token ?? '');
      await loadCollaboration();
      setStatus({
        type: 'success',
        message: 'Deck invite created.',
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const handleRemoveCollaborator = async (collaboratorUserId: string) => {
    if (!deck?.is_owner) {
      return;
    }

    try {
      await callAction('remove_deck_collaborator', {
        deck_id: deckId,
        collaborator_user_id: collaboratorUserId,
      });
      await loadCollaboration();
      setCollaboratorToRemove(null);
      setStatus({
        type: 'success',
        message: 'Collaborator removed.',
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const handleCopyInvite = async (value: string, label: string) => {
    if (!value) {
      return;
    }

    const copied = await copyTextToClipboard(value);
    setStatus({
      type: copied ? 'success' : 'error',
      message: copied
        ? `${label} copied to clipboard.`
        : `Unable to copy the ${label.toLowerCase()}.`,
    });
  };

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

    try {
      const response = await callAction<{ deleted: number }>('delete_deck_cards', {
        deck_id: deckId,
        card_ids: Array.from(selectedIds),
      });

      await Promise.all([refreshBootstrap(), loadRows()]);
      setSelectedIds(new Set());
      setEditingCardId(null);
      setDeleteCardsDialogOpen(false);
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
      <div className="app-page">
        <div className="app-empty">
          Deck not found.
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">{deck.name}</h2>
          <p className="app-page-description">
            {deck.collection_name} · {deck.card_count} cards ·{' '}
            {deck.is_owner ? 'Owner' : 'Shared collaborator'}
          </p>
        </div>
      </div>

      <div className="app-panel p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Collaboration
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {deck.is_owner
                ? 'Invite other users to work on this deck without exposing the rest of your workspace.'
                : 'You can edit this shared deck, but only the owner can manage collaborators.'}
            </p>
          </div>
          <div className="app-badge-muted text-sm">
            {deck.is_owner ? 'Owner access' : 'Shared access'}
          </div>
        </div>

        {deck.is_owner && (
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] items-end mb-5">
            <div>
              <label className="block text-sm text-gray-600 mb-2">Invite by email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="study-partner@example.com"
                className="app-input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Invite by username
              </label>
              <input
                type="text"
                value={inviteUsername}
                onChange={(event) => setInviteUsername(event.target.value)}
                placeholder="study_partner"
                className="app-input"
              />
            </div>
            <button
              onClick={() => void handleCreateInvite()}
              className="app-btn-primary"
            >
              <MailPlus className="w-4 h-4" />
              Create Invite
            </button>
          </div>
        )}

        {lastInviteToken && deck.is_owner && (
          <div className="app-banner mb-5">
            <div className="text-sm text-blue-900 font-medium mb-2">
              Share the account link or the raw invite token with the target user.
            </div>
            <div className="flex flex-col gap-3">
              <code className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
                {lastInviteToken}
              </code>
              {inviteLink && (
                <code className="flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
                  {inviteLink}
                </code>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => void handleCopyInvite(lastInviteToken, 'Invite token')}
                  className="app-btn-secondary"
                >
                  <Copy className="w-4 h-4" />
                  Copy Token
                </button>
                {inviteLink && (
                  <button
                    onClick={() => void handleCopyInvite(inviteLink, 'Invite link')}
                    className="app-btn-secondary"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="app-panel-muted p-4">
            <div className="font-medium mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-700" />
              Collaborators
            </div>
            {collaborators.length === 0 ? (
              <div className="text-sm text-gray-500">No collaborators yet.</div>
            ) : (
              <div className="space-y-3">
                {collaborators.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium">{collaborator.username}</div>
                      <div className="text-sm text-gray-600">
                        {collaborator.email} · {collaborator.role}
                      </div>
                    </div>
                    {deck.is_owner && (
                      <button
                        onClick={() => setCollaboratorToRemove(collaborator)}
                        className="text-red-600 hover:text-red-700 flex items-center gap-1 text-sm"
                      >
                        <UserMinus className="w-4 h-4" />
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="app-panel-muted p-4">
            <div className="font-medium mb-3">Active Invites</div>
            {invites.length === 0 ? (
              <div className="text-sm text-gray-500">No outstanding invites.</div>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-3"
                  >
                    <div className="font-medium">
                      {invite.invited_username || invite.invited_email || 'Untargeted invite'}
                    </div>
                    <div className="text-sm text-gray-600">
                      Preview: {invite.token_preview}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="app-panel p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
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
      </div>

      <div className="app-panel p-6">
        <h3 className="font-semibold mb-4">
          Bulk Actions ({selectedIds.size} selected)
        </h3>

        <div className="grid gap-4 items-end md:grid-cols-[1fr_auto_auto]">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Schema
            </label>
            <select
              value={bulkSchemaKey}
              onChange={(event) => setBulkSchemaKey(event.target.value)}
              className="app-input"
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
            className="app-btn-primary"
          >
            Apply Schema
          </button>

          <button
            onClick={() => setDeleteCardsDialogOpen(true)}
            disabled={selectedIds.size === 0}
            className="app-btn-danger"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {editingCardId && (
        <div className="app-panel p-6">
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
              className="app-input"
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
              className="app-input"
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
              className="app-input"
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
              className="app-input"
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

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => void handleSaveEdit()}
              className="app-btn-primary"
            >
              Save Changes
            </button>
            <button
              onClick={() => setEditingCardId(null)}
              className="app-btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="app-panel p-6">
        <h3 className="font-semibold mb-4">Replace Card Media</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select exactly one card or open one in edit mode before attaching new
          media.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <select
            value={replaceTarget}
            onChange={(event) => setReplaceTarget(event.target.value)}
            className="app-input"
          >
            <option value="english">Replace English text with media tag</option>
            <option value="kana">Replace Kana text with media tag</option>
            <option value="kanji">Replace Kanji text with media tag</option>
            <option value="none">Keep existing text</option>
          </select>

          <select
            value={replaceMediaType}
            onChange={(event) => setReplaceMediaType(event.target.value)}
            className="app-input"
          >
            <option value="image">Image</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>

          <label className="app-btn-secondary cursor-pointer">
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={() => void handleReplaceMedia()}
            className="app-btn-primary"
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
        <div className="app-empty">
          No cards match the current filter.
        </div>
      ) : (
        <div className="app-table-wrap">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="app-table-head">
                <tr>
                  <th className="app-table-th">Sel</th>
                  <th className="app-table-th">#</th>
                  <th className="app-table-th">Word</th>
                  <th className="app-table-th">Reading</th>
                  <th className="app-table-th">English</th>
                  <th className="app-table-th">Schema</th>
                  <th className="app-table-th">Form</th>
                  <th className="app-table-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="app-table-row">
                    <td className="app-table-td">
                      <button onClick={() => toggleSelection(row.id)}>
                        {selectedIds.has(row.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="app-table-td">{row.index}</td>
                    <td className="app-table-td font-semibold">{row.kanji}</td>
                    <td className="app-table-td text-gray-600">{row.kana}</td>
                    <td className="app-table-td">{row.english}</td>
                    <td className="app-table-td text-sm">{row.schema_label}</td>
                    <td className="app-table-td text-sm">{row.word_form}</td>
                    <td className="app-table-td">
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

      <ConfirmActionDialog
        open={deleteCardsDialogOpen}
        onOpenChange={setDeleteCardsDialogOpen}
        title="Delete selected deck cards?"
        description={`Delete ${selectedIds.size} selected card(s) from this deck. This does not remove matching cards from the global library.`}
        confirmLabel="Delete Cards"
        destructive
        onConfirm={handleDeleteSelected}
      />

      <ConfirmActionDialog
        open={Boolean(collaboratorToRemove)}
        onOpenChange={(open) => {
          if (!open) {
            setCollaboratorToRemove(null);
          }
        }}
        title="Remove collaborator?"
        description={
          collaboratorToRemove
            ? `Remove ${collaboratorToRemove.username} from this deck collaboration. They will lose access immediately.`
            : ''
        }
        confirmLabel="Remove Collaborator"
        destructive
        onConfirm={() =>
          collaboratorToRemove
            ? handleRemoveCollaborator(collaboratorToRemove.id)
            : Promise.resolve()
        }
      />
    </div>
  );
}
