import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { callAction, errorMessage } from '../lib/backend';
import {
  BootstrapPayload,
  CardSchemaFieldOption,
  CardSchemaOption,
  CollectionRow,
  DashboardSummary,
  DeckRow,
  PendingInviteRow,
  PracticeModeOption,
  StatusMessage,
  UserAccountRow,
  VerbFormOption,
  VerbTypeOption,
} from '../types';

const CURRENT_COLLECTION_STORAGE_KEY = 'anki-deck-creator-current-collection';
const CURRENT_DECK_STORAGE_KEY = 'anki-deck-creator-current-deck';

const EMPTY_DASHBOARD: DashboardSummary = {
  collection_count: 0,
  deck_count: 0,
  card_count: 0,
  global_card_count: 0,
  rows: [],
};

function readStoredValue(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(key);
}

function writeStoredValue(key: string, value: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (value) {
    localStorage.setItem(key, value);
    return;
  }

  localStorage.removeItem(key);
}

function normalizeSelectedId(
  preferredId: string | null | undefined,
  availableIds: string[],
): string | null {
  if (preferredId && availableIds.includes(preferredId)) {
    return preferredId;
  }
  return availableIds[0] ?? null;
}

interface RegisterOptions {
  username: string;
  email: string;
  password: string;
  seedFromTemplate: boolean;
}

interface AppContextType {
  appTitle: string;
  collections: CollectionRow[];
  decks: DeckRow[];
  dashboard: DashboardSummary;
  cardSchemas: CardSchemaOption[];
  cardSchemaFields: CardSchemaFieldOption[];
  verbForms: VerbFormOption[];
  verbTypes: VerbTypeOption[];
  practiceModes: PracticeModeOption[];
  defaultSchemaKey: string;
  defaultWordForm: string;
  currentCollectionId: string | null;
  currentDeckId: string | null;
  currentCollection: CollectionRow | null;
  currentDeck: DeckRow | null;
  currentUser: UserAccountRow | null;
  pendingInvites: PendingInviteRow[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  status: StatusMessage | null;
  setStatus: (status: StatusMessage | null) => void;
  setCurrentCollection: (id: string | null) => void;
  setCurrentDeck: (id: string | null) => void;
  refreshBootstrap: (options?: { showLoading?: boolean }) => Promise<void>;
  login: (identifier: string, password: string) => Promise<boolean>;
  register: (options: RegisterOptions) => Promise<boolean>;
  logout: () => Promise<boolean>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<boolean>;
  acceptInvite: (options: {
    inviteId?: string;
    inviteToken?: string;
  }) => Promise<string | null>;
  createCollection: (name: string) => Promise<boolean>;
  renameCollection: (collectionId: string, name: string) => Promise<boolean>;
  deleteCollection: (collectionId: string) => Promise<boolean>;
  createDeck: (collectionId: string, name: string) => Promise<boolean>;
  renameDeck: (deckId: string, name: string) => Promise<boolean>;
  deleteDeck: (deckId: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(
    () => readStoredValue(CURRENT_COLLECTION_STORAGE_KEY),
  );
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(() =>
    readStoredValue(CURRENT_DECK_STORAGE_KEY),
  );

  const applyBootstrap = useCallback((payload: BootstrapPayload) => {
    setBootstrap(payload);

    if (!payload.auth.is_authenticated) {
      setCurrentCollectionId(null);
      setCurrentDeckId(null);
      return;
    }

    const collectionIds = payload.collections.map((collection) => collection.id);
    const deckIds = payload.decks.map((deck) => deck.id);
    setCurrentCollectionId((previous) =>
      normalizeSelectedId(
        previous ?? readStoredValue(CURRENT_COLLECTION_STORAGE_KEY),
        collectionIds,
      ),
    );
    setCurrentDeckId((previous) =>
      normalizeSelectedId(
        previous ?? readStoredValue(CURRENT_DECK_STORAGE_KEY),
        deckIds,
      ),
    );
  }, []);

  const refreshBootstrap = useCallback(async (
    options: { showLoading?: boolean } = {},
  ) => {
    const showLoading = options.showLoading ?? false;
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      const payload = await callAction<BootstrapPayload>('bootstrap');
      applyBootstrap(payload);
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [applyBootstrap]);

  useEffect(() => {
    void refreshBootstrap({ showLoading: true });
  }, [refreshBootstrap]);

  useEffect(() => {
    writeStoredValue(CURRENT_COLLECTION_STORAGE_KEY, currentCollectionId);
  }, [currentCollectionId]);

  useEffect(() => {
    writeStoredValue(CURRENT_DECK_STORAGE_KEY, currentDeckId);
  }, [currentDeckId]);

  useEffect(() => {
    if (!bootstrap || !currentDeckId) {
      return;
    }

    const currentDeck = bootstrap.decks.find((deck) => deck.id === currentDeckId);
    if (!currentDeck) {
      return;
    }

    if (currentCollectionId !== currentDeck.collection_id) {
      setCurrentCollectionId(currentDeck.collection_id);
    }
  }, [bootstrap, currentCollectionId, currentDeckId]);

  const collections = bootstrap?.collections ?? [];
  const decks = bootstrap?.decks ?? [];
  const dashboard = bootstrap?.dashboard ?? EMPTY_DASHBOARD;
  const cardSchemas = bootstrap?.card_schemas ?? [];
  const cardSchemaFields = bootstrap?.card_schema_fields ?? [];
  const verbForms = bootstrap?.verb_forms ?? [];
  const verbTypes = bootstrap?.verb_types ?? [];
  const practiceModes = bootstrap?.defaults.practice_modes ?? [];
  const defaultSchemaKey =
    bootstrap?.defaults.schema_key ?? 'kana_kanji_front_english_back';
  const defaultWordForm = bootstrap?.defaults.word_form ?? 'dictionary';
  const currentUser = bootstrap?.auth.user ?? null;
  const pendingInvites = bootstrap?.auth.pending_invites ?? [];
  const isAuthenticated = Boolean(bootstrap?.auth.is_authenticated);
  const isAdmin = Boolean(currentUser?.is_admin);

  const currentCollection =
    collections.find((collection) => collection.id === currentCollectionId) ??
    null;
  const currentDeck = decks.find((deck) => deck.id === currentDeckId) ?? null;

  const runMutation = async (
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<boolean> => {
    try {
      await action();
      await refreshBootstrap();
      setStatus({
        type: 'success',
        message: successMessage,
      });
      return true;
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
      return false;
    }
  };

  const runAuthMutation = async (
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      await action();
      await refreshBootstrap({ showLoading: true });
      setStatus({
        type: 'success',
        message: successMessage,
      });
      return true;
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
      setIsLoading(false);
      return false;
    }
  };

  const login = async (
    identifier: string,
    password: string,
  ): Promise<boolean> =>
    runAuthMutation(async () => {
      await callAction('login_user', {
        identifier,
        password,
      });
    }, 'Signed in.');

  const register = async ({
    username,
    email,
    password,
    seedFromTemplate,
  }: RegisterOptions): Promise<boolean> =>
    runAuthMutation(async () => {
      await callAction('register_user', {
        username,
        email,
        password,
        seed_from_template: seedFromTemplate,
      });
    }, 'Account created.');

  const logout = async (): Promise<boolean> =>
    runAuthMutation(async () => {
      await callAction('logout_user');
    }, 'Signed out.');

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> =>
    runMutation(async () => {
      await callAction('change_password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
    }, 'Password updated.');

  const acceptInvite = async ({
    inviteId,
    inviteToken,
  }: {
    inviteId?: string;
    inviteToken?: string;
  }): Promise<string | null> => {
    try {
      const response = await callAction<{ accepted: boolean; deck_id: string }>(
        'accept_deck_invite',
        {
          invite_id: inviteId,
          invite_token: inviteToken,
        },
      );
      await refreshBootstrap();
      setStatus({
        type: 'success',
        message: 'Deck invite accepted.',
      });
      return response.deck_id ?? null;
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
      return null;
    }
  };

  const createCollection = async (name: string): Promise<boolean> =>
    runMutation(async () => {
      await callAction('create_collection', { name });
    }, `Collection "${name}" created.`);

  const renameCollection = async (
    collectionId: string,
    name: string,
  ): Promise<boolean> =>
    runMutation(async () => {
      await callAction('rename_collection', {
        collection_id: collectionId,
        name,
      });
    }, `Collection renamed to "${name}".`);

  const deleteCollection = async (collectionId: string): Promise<boolean> =>
    runMutation(async () => {
      await callAction('delete_collection', {
        collection_id: collectionId,
      });
    }, 'Collection deleted.');

  const createDeck = async (
    collectionId: string,
    name: string,
  ): Promise<boolean> =>
    runMutation(async () => {
      await callAction('create_deck', {
        collection_id: collectionId,
        name,
      });
    }, `Deck "${name}" created.`);

  const renameDeck = async (deckId: string, name: string): Promise<boolean> =>
    runMutation(async () => {
      await callAction('rename_deck', {
        deck_id: deckId,
        name,
      });
    }, `Deck renamed to "${name}".`);

  const deleteDeck = async (deckId: string): Promise<boolean> =>
    runMutation(async () => {
      await callAction('delete_deck', {
        deck_id: deckId,
      });
    }, 'Deck deleted.');

  const value = useMemo<AppContextType>(
    () => ({
      appTitle: bootstrap?.app_title ?? 'Flash Forge',
      collections,
      decks,
      dashboard,
      cardSchemas,
      cardSchemaFields,
      verbForms,
      verbTypes,
      practiceModes,
      defaultSchemaKey,
      defaultWordForm,
      currentCollectionId,
      currentDeckId,
      currentCollection,
      currentDeck,
      currentUser,
      pendingInvites,
      isAuthenticated,
      isAdmin,
      isLoading,
      status,
      setStatus,
      setCurrentCollection: setCurrentCollectionId,
      setCurrentDeck: setCurrentDeckId,
      refreshBootstrap,
      login,
      register,
      logout,
      changePassword,
      acceptInvite,
      createCollection,
      renameCollection,
      deleteCollection,
      createDeck,
      renameDeck,
      deleteDeck,
    }),
    [
      bootstrap?.app_title,
      cardSchemas,
      cardSchemaFields,
      collections,
      currentCollection,
      currentCollectionId,
      currentDeck,
      currentDeckId,
      currentUser,
      dashboard,
      decks,
      defaultSchemaKey,
      defaultWordForm,
      isAdmin,
      isAuthenticated,
      isLoading,
      pendingInvites,
      practiceModes,
      status,
      refreshBootstrap,
      verbForms,
      verbTypes,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
