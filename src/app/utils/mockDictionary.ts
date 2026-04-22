import { DictionaryEntry } from '../types';

// Mock Japanese dictionary data
export const mockDictionary: DictionaryEntry[] = [
  {
    id: '1',
    kanji: '食べる',
    kana: 'たべる',
    english: 'to eat',
    wordKind: 'ichidan',
    jlptLevel: 'N5',
    frequency: 1000,
  },
  {
    id: '2',
    kanji: '行く',
    kana: 'いく',
    english: 'to go',
    wordKind: 'godan',
    jlptLevel: 'N5',
    frequency: 500,
  },
  {
    id: '3',
    kanji: '勉強する',
    kana: 'べんきょうする',
    english: 'to study',
    wordKind: 'suru',
    jlptLevel: 'N5',
    frequency: 800,
  },
  {
    id: '4',
    kanji: '来る',
    kana: 'くる',
    english: 'to come',
    wordKind: 'kuru',
    jlptLevel: 'N5',
    frequency: 600,
  },
  {
    id: '5',
    kanji: '美しい',
    kana: 'うつくしい',
    english: 'beautiful',
    wordKind: 'i-adj',
    jlptLevel: 'N4',
    frequency: 2000,
  },
  {
    id: '6',
    kanji: '静か',
    kana: 'しずか',
    english: 'quiet',
    wordKind: 'na-adj',
    jlptLevel: 'N4',
    frequency: 1500,
  },
  {
    id: '7',
    kanji: '本',
    kana: 'ほん',
    english: 'book',
    wordKind: 'noun',
    jlptLevel: 'N5',
    frequency: 400,
  },
  {
    id: '8',
    kanji: '見る',
    kana: 'みる',
    english: 'to see, to watch',
    wordKind: 'ichidan',
    jlptLevel: 'N5',
    frequency: 300,
  },
  {
    id: '9',
    kanji: '書く',
    kana: 'かく',
    english: 'to write',
    wordKind: 'godan',
    jlptLevel: 'N5',
    frequency: 700,
  },
  {
    id: '10',
    kanji: '読む',
    kana: 'よむ',
    english: 'to read',
    wordKind: 'godan',
    jlptLevel: 'N5',
    frequency: 900,
  },
  {
    id: '11',
    kanji: '大きい',
    kana: 'おおきい',
    english: 'big, large',
    wordKind: 'i-adj',
    jlptLevel: 'N5',
    frequency: 350,
  },
  {
    id: '12',
    kanji: '元気',
    kana: 'げんき',
    english: 'healthy, energetic',
    wordKind: 'na-adj',
    jlptLevel: 'N5',
    frequency: 1200,
  },
];

export function searchDictionary(query: string): DictionaryEntry[] {
  const normalized = query.toLowerCase().trim();
  
  if (!normalized) {
    return mockDictionary;
  }

  return mockDictionary.filter(
    (entry) =>
      entry.kanji.includes(normalized) ||
      entry.kana.includes(normalized) ||
      entry.english.toLowerCase().includes(normalized)
  );
}
