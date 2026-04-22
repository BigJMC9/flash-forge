import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { callAction, errorMessage } from '../lib/backend';
import {
  BootstrapPayload,
  CardSchemaOption,
  CollectionRow,
  DashboardSummary,
  DeckRow,
  PracticeModeOption,
  StatusMessage,
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

interface AppContextType {
  appTitle: string;
  collections: CollectionRow[];
  decks: DeckRow[];
  dashboard: DashboardSummary;
  cardSchemas: CardSchemaOption[];
  verbForms: VerbFormOption[];
  verbTypes: VerbTypeOption[];
  practiceModes: PracticeModeOption[];
  defaultSchemaKey: string;
  defaultWordForm: string;
  currentCollectionId: string | null;
  currentDeckId: string | null;
  currentCollection: CollectionRow | null;
  currentDeck: DeckRow | null;
  isLoading: boolean;
  status: StatusMessage | null;
  setStatus: (status: StatusMessage | null) => void;
  setCurrentCollection: (id: string | null) => void;
  setCurrentDeck: (id: string | null) => void;
  refreshBootstrap: () => Promise<void>;
  createCollection: (name: string) => Promise<boolean>;
  renameCollection: (collectionId: string, name: string) => Promise<boolean>;
  createDeck: (collectionId: string, name: string) => Promise<boolean>;
  renameDeck: (deckId: string, name: string) => Promise<boolean>;
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

  const applyBootstrap = (payload: BootstrapPayload) => {
    setBootstrap(payload);

    const collectionIds = payload.collections.map((collection) => collection.id);
    const deckIds = payload.decks.map((deck) => deck.id);
    const nextCollectionId = normalizeSelectedId(
      currentCollectionId ?? readStoredValue(CURRENT_COLLECTION_STORAGE_KEY),
      collectionIds,
    );
    const nextDeckId = normalizeSelectedId(
      currentDeckId ?? readStoredValue(CURRENT_DECK_STORAGE_KEY),
      deckIds,
    );

    setCurrentCollectionId(nextCollectionId);
    setCurrentDeckId(nextDeckId);
  };

  const refreshBootstrap = async () => {
    try {
      setIsLoading(true);
      const payload = await callAction<BootstrapPayload>('bootstrap');
      applyBootstrap(payload);
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshBootstrap();
  }, []);

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
  const verbForms = bootstrap?.verb_forms ?? [];
  const verbTypes = bootstrap?.verb_types ?? [];
  const practiceModes = bootstrap?.defaults.practice_modes ?? [];
  const defaultSchemaKey =
    bootstrap?.defaults.schema_key ?? 'kana_kanji_front_english_back';
  const defaultWordForm = bootstrap?.defaults.word_form ?? 'dictionary';

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

  const value = useMemo<AppContextType>(
    () => ({
      appTitle: bootstrap?.app_title ?? 'Anki Deck Creator',
      collections,
      decks,
      dashboard,
      cardSchemas,
      verbForms,
      verbTypes,
      practiceModes,
      defaultSchemaKey,
      defaultWordForm,
      currentCollectionId,
      currentDeckId,
      currentCollection,
      currentDeck,
      isLoading,
      status,
      setStatus,
      setCurrentCollection: setCurrentCollectionId,
      setCurrentDeck: setCurrentDeckId,
      refreshBootstrap,
      createCollection,
      renameCollection,
      createDeck,
      renameDeck,
    }),
    [
      bootstrap?.app_title,
      cardSchemas,
      collections,
      createCollection,
      createDeck,
      currentCollection,
      currentCollectionId,
      currentDeck,
      currentDeckId,
      dashboard,
      decks,
      defaultSchemaKey,
      defaultWordForm,
      isLoading,
      practiceModes,
      renameCollection,
      renameDeck,
      status,
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
