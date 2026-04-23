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

export interface UserAccountRow {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  can_use_ai: boolean;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface PendingInviteRow {
  id: string;
  deck_id: string;
  invited_email: string;
  invited_username: string;
  token_preview: string;
  expires_at: number;
  created_at: number;
  deck_name: string;
  collection_name: string;
  owner_username: string;
}

export interface AuthState {
  is_authenticated: boolean;
  user: UserAccountRow | null;
  pending_invites: PendingInviteRow[];
}

export interface DeckRow {
  id: string;
  collection_id: string;
  collection_name: string;
  name: string;
  label: string;
  card_count: number;
  is_owner: boolean;
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

export type PracticeModeKey =
  | 'verb_sort'
  | 'adjective_sort'
  | 'word_class_sort'
  | 'adjective_conjugation'
  | 'verb_conjugation'
  | 'reading_comprehension';

export type PracticeGameType = 'bucket_sort' | 'text_entry' | 'reading_quiz';

export interface PracticeModeOption {
  key: PracticeModeKey;
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
  auth: AuthState;
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
  form_key?: string;
  form_label?: string;
}

export interface PracticeScoring {
  base_correct_points: number;
  incorrect_penalty_points: number;
  bucket_labels: Record<string, string>;
}

export interface PracticeRoundOptions {
  round_size: number;
  verb_forms: string[];
  adjective_forms: string[];
  verb_sort_only_ru_endings: boolean;
  verb_sort_include_suru_verbs: boolean;
  verb_sort_include_suru_nouns: boolean;
  adjective_sort_only_i_endings: boolean;
  reading_level: 'beginner' | 'intermediate' | 'advanced' | string;
  reading_source: 'story' | 'news_style' | string;
  reading_topic: string;
  reading_question_count: number;
}

export interface PracticeRoundResponse {
  deck_id: string;
  mode: PracticeModeKey;
  game_type: PracticeGameType;
  rows: PracticeRoundCard[];
  scoring: PracticeScoring;
  bucket_order?: string[];
  options_used?: PracticeRoundOptions;
}

export interface PracticeAnswerRow {
  mode: PracticeModeKey;
  game_type: PracticeGameType;
  prompt: string;
  hint: string;
  expected: string;
  expected_label: string;
  selected: string;
  selected_label: string;
  correct: boolean;
  elapsed_seconds: number;
  delta_points: number;
}

export interface ReadingComprehensionQuestion {
  id: string;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
}

export interface ReadingComprehensionWord {
  word: string;
  reading: string;
  meaning: string;
  part_of_speech: string;
  note: string;
}

export interface ReadingComprehensionResponse {
  deck_id: string;
  title: string;
  source_note: string;
  passage: string;
  questions: ReadingComprehensionQuestion[];
  new_words: ReadingComprehensionWord[];
  options_used: PracticeRoundOptions;
}

export type ScenarioMode = 'reading' | 'conversation';

export interface AiScenarioRow {
  id: string;
  deck_id: string;
  mode: ScenarioMode | string;
  title: string;
  summary: string;
  topic_hint: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | string;
  style: string;
  question_count: number;
  tags: string[];
  is_custom: boolean;
  times_used: number;
  times_completed: number;
  created_at: number;
  updated_at: number;
  has_cached_material: boolean;
  reading_material_updated_at: number;
}

export interface ScenarioListResponse {
  deck_id: string;
  scenarios: AiScenarioRow[];
  generated_count?: number;
  should_generate_more: boolean;
  recommended_reason: string;
}

export interface ReadingSessionResponse {
  deck_id: string;
  scenario: AiScenarioRow;
  title: string;
  source_note: string;
  passage: string;
  questions: ReadingComprehensionQuestion[];
  new_words: ReadingComprehensionWord[];
  cached_material: boolean;
}

export interface ConversationMessage {
  role: 'assistant' | 'user' | string;
  content: string;
  timestamp?: number;
}

export interface ConversationStartResponse {
  deck_id: string;
  scenario: AiScenarioRow;
  session_id: string;
  partner_name: string;
  messages: ConversationMessage[];
}

export interface ConversationSendResponse {
  session_id: string;
  messages: ConversationMessage[];
  assistant_message: string;
  should_wrap_up: boolean;
}

export interface ConversationFeedback {
  score_percent: number;
  summary: string;
  correct_points: string[];
  incorrect_points: string[];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
}

export interface ConversationCompleteResponse {
  session_id: string;
  feedback: ConversationFeedback;
  messages: ConversationMessage[];
  status: string;
}

export interface DeckCollaboratorRow {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: number;
}

export interface DeckInviteRow {
  id: string;
  deck_id: string;
  invited_email: string;
  invited_username: string;
  token_preview: string;
  invited_by_user_id: string;
  accepted_by_user_id: string;
  expires_at: number;
  created_at: number;
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
