import { WordKind } from '../types';

// Japanese verb and adjective inflection generator
// This is a simplified version - real implementation would need more complex rules

export function generateVerbForms(
  dictionary: string,
  wordKind: WordKind
): Record<string, string> {
  if (wordKind === 'noun') return {};

  const forms: Record<string, string> = {
    dictionary,
  };

  if (wordKind === 'ichidan') {
    const stem = dictionary.slice(0, -1);
    forms.masu = stem + 'ます';
    forms.te = stem + 'て';
    forms.past = stem + 'た';
    forms.negative = stem + 'ない';
    forms.potential = stem + 'られる';
    forms.passive = stem + 'られる';
    forms.causative = stem + 'させる';
  } else if (wordKind === 'godan') {
    // Simplified godan conjugation (would need proper る-verb ending detection)
    const stem = dictionary.slice(0, -1);
    const lastChar = dictionary.slice(-1);
    
    // This is simplified - real implementation needs proper u-column to i-column conversion
    forms.masu = stem + 'います'; // Placeholder
    forms.te = stem + 'って'; // Placeholder
    forms.past = stem + 'った'; // Placeholder
    forms.negative = stem + 'わない'; // Placeholder
    forms.potential = stem + 'える'; // Placeholder
    forms.passive = stem + 'われる'; // Placeholder
    forms.causative = stem + 'わせる'; // Placeholder
  } else if (wordKind === 'suru' || wordKind === 'suru_noun') {
    const base = wordKind === 'suru' ? '' : dictionary.replace(/する$/, '');
    if (wordKind === 'suru_noun') {
      forms.dictionary = base || dictionary;
    }
    forms.masu = base + 'します';
    forms.te = base + 'して';
    forms.past = base + 'した';
    forms.negative = base + 'しない';
    forms.potential = base + 'できる';
    forms.passive = base + 'される';
    forms.causative = base + 'させる';
  } else if (wordKind === 'kuru') {
    forms.masu = 'きます';
    forms.te = 'きて';
    forms.past = 'きた';
    forms.negative = 'こない';
    forms.potential = 'こられる';
    forms.passive = 'こられる';
    forms.causative = 'こさせる';
  } else if (wordKind === 'i-adj') {
    const stem = dictionary.slice(0, -1);
    forms.past = stem + 'かった';
    forms.negative = stem + 'くない';
  } else if (wordKind === 'na-adj') {
    forms.past = dictionary + 'だった';
    forms.negative = dictionary + 'じゃない';
  }

  return forms;
}

export function normalizeSearchText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function matchesSearch(
  card: { kanji: string; kana: string; english: string; forms?: Record<string, string> },
  searchTerm: string
): boolean {
  const normalized = normalizeSearchText(searchTerm);
  
  const kanji = normalizeSearchText(card.kanji);
  const kana = normalizeSearchText(card.kana);
  const english = normalizeSearchText(card.english);
  
  if (
    kanji.includes(normalized) ||
    kana.includes(normalized) ||
    english.includes(normalized)
  ) {
    return true;
  }

  // Search in inflected forms
  if (card.forms) {
    for (const form of Object.values(card.forms)) {
      if (normalizeSearchText(form).includes(normalized)) {
        return true;
      }
    }
  }

  return false;
}
