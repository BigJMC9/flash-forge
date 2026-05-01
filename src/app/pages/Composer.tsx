import { useMemo, useState } from 'react';
import { Save, Sparkles, Upload } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { callAction, callActionWithFiles, errorMessage } from '../lib/backend';
import { parseCommaSeparated } from '../lib/text';
import { ManualFormValue } from '../types';
import {
  KANJI_DETAIL_SCHEMA_KEY,
  RADICAL_POSITION_OPTIONS,
  getRadicalPositionOption,
} from '../utils/kanji';

function createDefaultForms(): Record<string, ManualFormValue> {
  return {
    dictionary: { word: '', reading: '' },
    masu: { word: '', reading: '' },
    te: { word: '', reading: '' },
    past: { word: '', reading: '' },
    negative: { word: '', reading: '' },
    potential: { word: '', reading: '' },
    passive: { word: '', reading: '' },
    causative: { word: '', reading: '' },
  };
}

export function Composer() {
  const {
    cardSchemas,
    currentDeck,
    currentDeckId,
    defaultSchemaKey,
    defaultWordForm,
    refreshBootstrap,
    setStatus,
    verbForms,
    verbTypes,
  } = useApp();

  const [destination, setDestination] = useState<'deck' | 'global'>('deck');
  const [schemaKey, setSchemaKey] = useState(defaultSchemaKey);
  const [wordKind, setWordKind] = useState('noun');
  const [wordForm, setWordForm] = useState(defaultWordForm);
  const [kanji, setKanji] = useState('');
  const [kana, setKana] = useState('');
  const [english, setEnglish] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('manual');
  const [kanjiOnReadings, setKanjiOnReadings] = useState('');
  const [kanjiKunReadings, setKanjiKunReadings] = useState('');
  const [kanjiNanoriReadings, setKanjiNanoriReadings] = useState('');
  const [radicalPosition, setRadicalPosition] = useState('');
  const [forms, setForms] =
    useState<Record<string, ManualFormValue>>(createDefaultForms);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const isKanjiDetailSchema = schemaKey === KANJI_DETAIL_SCHEMA_KEY;
  const selectedRadicalPosition = getRadicalPositionOption(radicalPosition);

  const hasGeneratedForms = useMemo(
    () =>
      Object.values(forms).some(
        (value) => value.word.trim() || value.reading.trim(),
      ),
    [forms],
  );

  const resetComposer = () => {
    setKanji('');
    setKana('');
    setEnglish('');
    setNotes('');
    setTags('manual');
    setKanjiOnReadings('');
    setKanjiKunReadings('');
    setKanjiNanoriReadings('');
    setRadicalPosition('');
    setForms(createDefaultForms());
    setMediaFiles([]);
  };

  const handleGenerateForms = async () => {
    if (!kanji.trim() || !kana.trim()) {
      setStatus({
        type: 'warning',
        message: 'Kanji and kana are required before generating forms.',
      });
      return;
    }

    try {
      const response = await callAction<{
        forms: Record<string, ManualFormValue>;
      }>('build_word_forms', {
        word: kanji,
        reading: kana,
        word_kind: wordKind,
      });

      setForms((previous) => ({
        ...previous,
        ...response.forms,
      }));
      setStatus({
        type: 'success',
        message: 'Word forms generated.',
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const handleSave = async () => {
    if (!kanji.trim() || !english.trim() || (!isKanjiDetailSchema && !kana.trim())) {
      setStatus({
        type: 'warning',
        message: isKanjiDetailSchema
          ? 'Kanji and English are required.'
          : 'Kanji, kana, and English are required.',
      });
      return;
    }

    if (destination === 'deck' && !currentDeckId) {
      setStatus({
        type: 'warning',
        message: 'Select a context deck first.',
      });
      return;
    }

    const payload = {
      destination,
      deck_id: currentDeckId ?? '',
      schema_key: schemaKey,
      word_form: wordForm,
      word_kind: wordKind,
      kanji,
      kana,
      english,
      notes,
      tags: parseCommaSeparated(tags),
      kanji_on_readings: kanjiOnReadings,
      kanji_kun_readings: kanjiKunReadings,
      kanji_nanori_readings: kanjiNanoriReadings,
      radical_position: radicalPosition,
      forms,
    };

    try {
      const response = mediaFiles.length
        ? await callActionWithFiles<{
            added: boolean;
            word_form?: string;
            saved_media_paths?: string[];
          }>('add_manual_card', payload, 'media_paths', mediaFiles)
        : await callAction<{
            added: boolean;
            word_form?: string;
            saved_media_paths?: string[];
          }>('add_manual_card', payload);

      await refreshBootstrap();
      setStatus({
        type: response.added ? 'success' : 'warning',
        message: response.added
          ? 'Card saved.'
          : 'Card already exists and was skipped.',
      });

      if (response.added) {
        resetComposer();
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  return (
    <div className="app-page max-w-5xl">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">Manual Card Composer</h2>
          <p className="app-page-description">
            Build cards manually, generate forms when useful, and save them directly
            to the active deck or the global library.
          </p>
        </div>
      </div>

      <div className="app-panel p-6">
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Destination
            </label>
            <select
              value={destination}
              onChange={(event) =>
                setDestination(event.target.value as 'deck' | 'global')
              }
              className="app-input"
            >
              <option value="deck">Current Deck</option>
              <option value="global">Global Library</option>
            </select>
            {destination === 'deck' && (
              <p className="text-xs text-gray-500 mt-2">
                {currentDeck
                  ? `Current deck: ${currentDeck.label}`
                  : 'No context deck selected.'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Schema</label>
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
            <label className="block text-sm text-gray-600 mb-2">
              Word Form
            </label>
            <select
              value={wordForm}
              onChange={(event) => setWordForm(event.target.value)}
              className="app-input"
            >
              {verbForms.map((form) => (
                <option key={form.key} value={form.key}>
                  {form.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-600 mb-2">Word Kind</label>
          <select
            value={wordKind}
            onChange={(event) => setWordKind(event.target.value)}
            className="app-input"
          >
            {verbTypes.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Kanji
            </label>
            <input
              type="text"
              value={kanji}
              onChange={(event) => setKanji(event.target.value)}
              placeholder="食べる"
              className="app-input"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Kana</label>
            <input
              type="text"
              value={kana}
              onChange={(event) => setKana(event.target.value)}
              placeholder={isKanjiDetailSchema ? 'Optional reading hint' : 'たべる'}
              className="app-input"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-600 mb-2">English</label>
          <input
            type="text"
            value={english}
            onChange={(event) => setEnglish(event.target.value)}
            placeholder="to eat"
            className="app-input"
          />
        </div>

        {isKanjiDetailSchema && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="font-semibold mb-4">Kanji Details</h3>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  ON Reading
                </label>
                <input
                  type="text"
                  value={kanjiOnReadings}
                  onChange={(event) => setKanjiOnReadings(event.target.value)}
                  placeholder="オン, いん"
                  className="app-input"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  Kun Reading
                </label>
                <input
                  type="text"
                  value={kanjiKunReadings}
                  onChange={(event) => setKanjiKunReadings(event.target.value)}
                  placeholder="おと, ね"
                  className="app-input"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  Nanori
                </label>
                <input
                  type="text"
                  value={kanjiNanoriReadings}
                  onChange={(event) => setKanjiNanoriReadings(event.target.value)}
                  placeholder="Optional name reading"
                  className="app-input"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  Radical Position
                </label>
                <select
                  value={radicalPosition}
                  onChange={(event) => setRadicalPosition(event.target.value)}
                  className="app-input"
                >
                  {RADICAL_POSITION_OPTIONS.map((option) => (
                    <option key={option.key || 'none'} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRadicalPosition?.icon && (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <img
                    src={selectedRadicalPosition.icon}
                    alt={selectedRadicalPosition.label}
                    className="h-8 w-8 object-contain"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedRadicalPosition.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm text-gray-600 mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Optional notes or mnemonic"
            className="app-input"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="manual,chapter-2"
              className="app-input"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Media Files
            </label>
            <label className="app-btn-secondary cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Select media</span>
              <input
                type="file"
                multiple
                accept="image/*,audio/*,video/*"
                onChange={(event) =>
                  setMediaFiles(Array.from(event.target.files ?? []))
                }
                className="hidden"
              />
            </label>
            <div className="text-xs text-gray-500 mt-2">
              {mediaFiles.length} file(s) selected
            </div>
          </div>
        </div>

        <div className="mb-4">
          <button
            onClick={() => void handleGenerateForms()}
            className="app-btn-secondary"
          >
            <Sparkles className="w-4 h-4" />
            Generate Forms
          </button>
        </div>

        {hasGeneratedForms && (
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Generated Forms</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(forms).map(([key, value]) => (
                <div key={key} className="app-panel-muted p-4">
                  <div className="font-medium capitalize mb-3">
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={value.word}
                      onChange={(event) =>
                        setForms((previous) => ({
                          ...previous,
                          [key]: {
                            ...previous[key],
                            word: event.target.value,
                          },
                        }))
                      }
                      placeholder="Word"
                      className="app-input"
                    />
                    <input
                      type="text"
                      value={value.reading}
                      onChange={(event) =>
                        setForms((previous) => ({
                          ...previous,
                          [key]: {
                            ...previous[key],
                            reading: event.target.value,
                          },
                        }))
                      }
                      placeholder="Reading"
                      className="app-input"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => void handleSave()}
            className="app-btn-primary"
          >
            <Save className="w-4 h-4" />
            Save Card
          </button>
          <button
            onClick={resetComposer}
            className="app-btn-secondary"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
