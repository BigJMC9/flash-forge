export const KANJI_DETAIL_SCHEMA_KEY = 'kanji_detail_front_back';

export const RADICAL_POSITION_OPTIONS = [
  { key: '', label: 'Not a radical', icon: '' },
  { key: 'hen', label: 'へん', icon: '/icons/hen.png' },
  { key: 'tsukuri', label: 'つくり', icon: '/icons/tsukuri.png' },
  { key: 'kanmuri', label: 'かんむり', icon: '/icons/kanmuri.png' },
  { key: 'ashi', label: 'あし', icon: '/icons/ashi.png' },
  { key: 'tare', label: 'たれ', icon: '/icons/tare.png' },
  { key: 'nyou', label: 'にょう', icon: '/icons/nyou.png' },
  { key: 'kunigamae', label: 'くにがまえ', icon: '/icons/kunigamae.png' },
  { key: 'mongamae', label: 'もんがまえ', icon: '/icons/mongamae.png' },
  { key: 'gyougamae', label: 'ぎょうがまえ', icon: '/icons/gyougamae.png' },
  { key: 'hakogamae', label: 'はこがまえ', icon: '/icons/hakogamae.png' },
  { key: 'keigamae', label: 'けいがまえ', icon: '/icons/keigamae.png' },
  { key: 'kigamae', label: 'きがまえ', icon: '/icons/kigamae.png' },
  { key: 'tsutsumigamae', label: 'つつみがまえ', icon: '/icons/tsutsumigamae.png' },
];

export function getRadicalPositionOption(key: string) {
  return RADICAL_POSITION_OPTIONS.find((option) => option.key === key);
}
