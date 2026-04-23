export type StatusLevel = 'info' | 'success' | 'warning' | 'error';

export interface StatusMessage {
  type: StatusLevel;
  message: string;
}

export interface CardSchemaOption {
  key: string;
  label: string;
}

export interface VerbFormOption {
  key: string;
  label: string;
}

export interface VerbTypeOption {
  key: string;
  label: string;
}

export interface CollectionRow {
  id: string;
  name: string;
}

export interface DeckRow {
  id: string;
  collection_id: string;
  collection_name: string;
  name: string;
  label: string;
  card_count: number;
}

export interface DashboardRow {
  collection_name: string;
  deck_name: string;
  card_count: number;
}

export interface DashboardSummary {
  collection_count: number;
  deck_count: number;
  card_count: number;
  global_card_count: number;
  rows: DashboardRow[];
}

export interface PracticeModeOption {
  key: 'verb_sort' | 'adjective_sort' | 'te_form';
  label: string;
}

export interface BootstrapPayload {
  app_title: string;
  card_schemas: CardSchemaOption[];
  verb_forms: VerbFormOption[];
  verb_types: VerbTypeOption[];
  collections: CollectionRow[];
  decks: DeckRow[];
  dashboard: DashboardSummary;
  defaults: {
    schema_key: string;
    word_form: string;
    practice_modes: PracticeModeOption[];
  };
}

export interface DictionaryEntry {
  entry_id: string;
  headword: string;
  reading: string;
  english: string;
  glosses: string[];
  pos_labels: string[];
  pos_tags?: string[];
  senses?: {
    sense_index: number;
    glosses: string[];
    pos_labels: string[];
    notes: string[];
  }[];
  examples?: {
    japanese: string;
    reading: string;
    english: string;
  }[];
  kanji_forms?: string[];
  kana_forms?: string[];
  option_label: string;
  verb_type: string;
  verb_type_label?: string;
  is_verb: boolean;
  word_fields?: {
    key: string;
    label: string;
    word: string;
    reading: string;
    role: 'parent' | 'child';
  }[];
  stem_entry?: {
    word: string;
    reading: string;
    field_key: string;
    field_label: string;
  };
  search_match?: {
    relation: 'parent' | 'child' | 'variant' | 'gloss' | 'entry';
    relation_label: string;
    field_key: string;
    field_label: string;
    matched_text: string;
    score: number;
  };
  forms?: Record<string, { kanji?: string; kana?: string }>;
}

export interface GlobalCardRow {
  id: string;
  kanji: string;
  kana: string;
  english: string;
  notes: string;
  kanji_masu: string;
  kana_masu: string;
  kanji_te: string;
  kana_te: string;
  kanji_past: string;
  kana_past: string;
  kanji_negative: string;
  kana_negative: string;
  dictionary_entry_id: string;
  dictionary_headword: string;
  dictionary_reading: string;
  dictionary_gloss: string;
  dictionary_pos: string;
  dictionary_pos_tags: string[];
  verb_type: string;
  image_files: string[];
  video_files: string[];
  tags: string[];
  media_type: string;
}

export interface DeckCardRow {
  id: string;
  index: number;
  kanji: string;
  kana: string;
  english: string;
  notes: string;
  schema_key: string;
  schema_label: string;
  word_form: string;
  dictionary_entry_id: string;
  dictionary_headword: string;
  dictionary_reading: string;
  dictionary_gloss: string;
  dictionary_pos: string;
  dictionary_pos_tags: string[];
  verb_type: string;
  media_type: string;
  media_files: string[];
  tags: string[];
}

export interface RevisionCardRow {
  id: string;
  front: string;
  back: string;
  notes: string;
  schema_label: string;
  word_form: string;
}

export interface PracticeRoundCard {
  id: string;
  prompt: string;
  hint: string;
  expected: string;
  expected_display?: string;
  accepted_answers?: string[];
}

export interface PracticeScoring {
  base_correct_points: number;
  incorrect_penalty_points: number;
  bucket_labels: Record<string, string>;
}

export interface PracticeRoundResponse {
  deck_id: string;
  mode: 'verb_sort' | 'adjective_sort' | 'te_form';
  rows: PracticeRoundCard[];
  scoring: PracticeScoring;
}

export interface PracticeAnswerRow {
  mode: string;
  prompt: string;
  hint: string;
  expected: string;
  selected: string;
  correct: boolean;
  elapsed_seconds: number;
  delta_points: number;
}

export interface ScanPreviewRow {
  visible_text: string;
  source_text: string;
  dictionary_entry_id: string;
  kanji: string;
  kana: string;
  english: string;
}

export interface ManualFormValue {
  word: string;
  reading: string;
}
