import { useMemo, useState } from 'react';
import { Save, Sparkles, Upload } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { callAction, callActionWithFiles, errorMessage } from '../lib/backend';
import { parseCommaSeparated } from '../lib/text';
import { ManualFormValue } from '../types';

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
  const [forms, setForms] =
    useState<Record<string, ManualFormValue>>(createDefaultForms);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

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
    if (!kanji.trim() || !kana.trim() || !english.trim()) {
      setStatus({
        type: 'warning',
        message: 'Kanji, kana, and English are required.',
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
              placeholder="たべる"
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

        <div className="flex gap-3">
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
