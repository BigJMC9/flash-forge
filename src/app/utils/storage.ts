import { AppState } from '../types';

const STORAGE_KEY = 'anki_deck_creator_app_state';

function getSampleData(): AppState {
  const sampleCollectionId = crypto.randomUUID();
  const sampleDeckId = crypto.randomUUID();
  
  return {
    collections: [
      {
        id: sampleCollectionId,
        name: 'Japanese N5',
        createdAt: new Date().toISOString(),
      },
    ],
    decks: [
      {
        id: sampleDeckId,
        collectionId: sampleCollectionId,
        name: 'Basic Verbs',
        createdAt: new Date().toISOString(),
      },
    ],
    deckCards: [
      {
        id: crypto.randomUUID(),
        deckId: sampleDeckId,
        kanji: '食べる',
        kana: 'たべる',
        english: 'to eat',
        notes: 'Common ichidan verb',
        tags: ['N5', 'verb'],
        schema: 'kanji_to_english',
        wordForm: 'dictionary',
        wordKind: 'ichidan',
        forms: {
          dictionary: '食べる',
          masu: '食べます',
          te: '食べて',
          past: '食べた',
          negative: '食べない',
          potential: '食べられる',
          passive: '食べられる',
          causative: '食べさせる',
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        deckId: sampleDeckId,
        kanji: '行く',
        kana: 'いく',
        english: 'to go',
        notes: 'Common godan verb',
        tags: ['N5', 'verb'],
        schema: 'kanji_to_english',
        wordForm: 'dictionary',
        wordKind: 'godan',
        forms: {
          dictionary: '行く',
          masu: '行います',
          te: '行って',
          past: '行った',
          negative: '行わない',
        },
        createdAt: new Date().toISOString(),
      },
    ],
    globalCards: [],
    currentCollectionId: null,
    currentDeckId: null,
  };
}

export function loadAppState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load app state:', error);
  }

  // Return sample data for first-time users
  return getSampleData();
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save app state:', error);
  }
}