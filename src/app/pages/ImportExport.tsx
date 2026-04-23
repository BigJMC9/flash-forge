import { useState } from 'react';
import { Download, FileText, Image, Upload } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  callActionWithFiles,
  downloadBlob,
  errorMessage,
  exportDeckPackage,
} from '../lib/backend';
import { parseCommaSeparated } from '../lib/text';
import { ScanPreviewRow } from '../types';

export function ImportExport() {
  const {
    cardSchemas,
    currentUser,
    decks,
    defaultSchemaKey,
    defaultWordForm,
    refreshBootstrap,
    setStatus,
    verbForms,
  } = useApp();

  const [scanDeckId, setScanDeckId] = useState('');
  const [scanSchemaKey, setScanSchemaKey] = useState(defaultSchemaKey);
  const [scanWordForm, setScanWordForm] = useState(defaultWordForm);
  const [scanTags, setScanTags] = useState('image_ocr');
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [scanSummary, setScanSummary] = useState('');
  const [scanPreviewRows, setScanPreviewRows] = useState<ScanPreviewRow[]>([]);
  const [scanErrors, setScanErrors] = useState<string[]>([]);

  const [csvDeckId, setCsvDeckId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState('');

  const [exportDeckId, setExportDeckId] = useState('');
  const [lastExportFilename, setLastExportFilename] = useState('');
  const canUseOcr = Boolean(currentUser?.can_use_ocr);

  const handleRunScan = async () => {
    if (!scanDeckId) {
      setStatus({
        type: 'warning',
        message: 'Select a destination deck before running OCR.',
      });
      return;
    }

    if (scanFiles.length === 0) {
      setStatus({
        type: 'warning',
        message: 'Select one or more image files first.',
      });
      return;
    }

    try {
      const response = await callActionWithFiles<{
        added: number;
        duplicates: number;
        summary: string;
        preview_rows: ScanPreviewRow[];
        errors: string[];
      }>(
        'scan_images',
        {
          deck_id: scanDeckId,
          schema_key: scanSchemaKey,
          word_form: scanWordForm,
          tags: parseCommaSeparated(scanTags),
        },
        'image_paths',
        scanFiles,
      );

      await refreshBootstrap();
      setScanSummary(response.summary);
      setScanPreviewRows(response.preview_rows ?? []);
      setScanErrors(response.errors ?? []);
      setStatus({
        type: response.added > 0 ? 'success' : 'warning',
        message: `Scan finished. Added ${response.added} card(s) and skipped ${response.duplicates} duplicates.`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const handleCsvImport = async () => {
    if (!csvDeckId) {
      setStatus({
        type: 'warning',
        message: 'Select a destination deck before importing CSV.',
      });
      return;
    }

    if (!csvFile) {
      setStatus({
        type: 'warning',
        message: 'Select a CSV file first.',
      });
      return;
    }

    try {
      const response = await callActionWithFiles<{
        added: number;
        skipped: number;
      }>('import_csv', { deck_id: csvDeckId }, 'csv_path', [csvFile], 'single');

      await refreshBootstrap();
      setCsvResult(
        `Imported ${response.added} card(s) and skipped ${response.skipped}.`,
      );
      setStatus({
        type: response.added > 0 ? 'success' : 'warning',
        message: `CSV import complete. Added ${response.added} card(s).`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const handleExportDeck = async () => {
    if (!exportDeckId) {
      setStatus({
        type: 'warning',
        message: 'Select a deck to export.',
      });
      return;
    }

    try {
      const result = await exportDeckPackage(exportDeckId);
      downloadBlob(result.blob, result.filename);
      setLastExportFilename(result.filename);
      setStatus({
        type: 'success',
        message: `Exported ${result.filename}.`,
      });
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
          <h2 className="app-page-title">Import & Export</h2>
          <p className="app-page-description">
            Bring content in through OCR or CSV, then export polished decks without
            switching tools.
          </p>
        </div>
      </div>

      <div className="app-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <Image className="w-5 h-5 text-blue-700" />
          <h3 className="text-lg font-semibold">OCR / Scan Intake</h3>
        </div>

        {!canUseOcr && (
          <div className="app-banner-warning mb-4">
            OCR is disabled for your account by default. Ask an administrator to
            enable OCR access if you need image scanning.
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Destination Deck
            </label>
            <select
              value={scanDeckId}
              onChange={(event) => setScanDeckId(event.target.value)}
              disabled={!canUseOcr}
              className="app-input"
            >
              <option value="">Select deck…</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Schema</label>
            <select
              value={scanSchemaKey}
              onChange={(event) => setScanSchemaKey(event.target.value)}
              disabled={!canUseOcr}
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
              value={scanWordForm}
              onChange={(event) => setScanWordForm(event.target.value)}
              disabled={!canUseOcr}
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

        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">Tags</label>
          <input
            type="text"
            value={scanTags}
            onChange={(event) => setScanTags(event.target.value)}
            disabled={!canUseOcr}
            placeholder="image_ocr,chapter-1"
            className="app-input"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label
            className={`app-btn-primary ${canUseOcr ? 'cursor-pointer' : 'pointer-events-none'}`}
          >
            <Upload className="w-5 h-5" />
            <span>Select Images</span>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={!canUseOcr}
              onChange={(event) =>
                setScanFiles(Array.from(event.target.files ?? []))
              }
              className="hidden"
            />
          </label>

          <button
            onClick={() => void handleRunScan()}
            disabled={!canUseOcr}
            className="app-btn-secondary"
          >
            Run Scan
          </button>

          <span className="text-sm text-gray-600">
            {scanFiles.length} image(s) selected
          </span>
        </div>

        {scanSummary && (
          <div className="app-banner mb-4 whitespace-pre-wrap">
            {scanSummary}
          </div>
        )}

        {scanPreviewRows.length > 0 && (
          <div className="app-table-wrap mb-4">
            <table className="w-full">
              <thead className="app-table-head">
                <tr>
                  <th className="app-table-th">Visible Text</th>
                  <th className="app-table-th">Source</th>
                  <th className="app-table-th">Word</th>
                  <th className="app-table-th">English</th>
                </tr>
              </thead>
              <tbody>
                {scanPreviewRows.map((row) => (
                  <tr
                    key={`${row.visible_text}-${row.dictionary_entry_id}`}
                    className="app-table-row"
                  >
                    <td className="app-table-td">{row.visible_text}</td>
                    <td className="app-table-td text-gray-600">{row.source_text}</td>
                    <td className="app-table-td">
                      {row.kanji} [{row.kana}]
                    </td>
                    <td className="app-table-td">{row.english}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {scanErrors.length > 0 && (
          <div className="app-banner-danger">
            {scanErrors.join('\n')}
          </div>
        )}
      </div>

      <div className="app-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-5 h-5 text-blue-700" />
          <h3 className="text-lg font-semibold">CSV Import</h3>
        </div>

        <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Destination Deck
            </label>
            <select
              value={csvDeckId}
              onChange={(event) => setCsvDeckId(event.target.value)}
              className="app-input"
            >
              <option value="">Select deck…</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.label}
                </option>
              ))}
            </select>
          </div>

          <label className="app-btn-primary cursor-pointer">
            <Upload className="w-5 h-5" />
            <span>Select CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void handleCsvImport()}
            className="app-btn-secondary"
          >
            Import CSV
          </button>
          <span className="text-sm text-gray-600">
            {csvFile ? csvFile.name : 'No CSV selected'}
          </span>
        </div>

        {csvResult && <p className="text-sm text-gray-600 mt-4">{csvResult}</p>}
      </div>

      <div className="app-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-5 h-5 text-blue-700" />
          <h3 className="text-lg font-semibold">Anki Export (.apkg)</h3>
        </div>

        <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Deck to Export
            </label>
            <select
              value={exportDeckId}
              onChange={(event) => setExportDeckId(event.target.value)}
              className="app-input"
            >
              <option value="">Select deck…</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.label} ({deck.card_count} cards)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => void handleExportDeck()}
            className="app-btn-primary"
          >
            <Download className="w-5 h-5" />
            Export Deck
          </button>
        </div>

        <p className="text-sm text-gray-600 mt-4">
          {lastExportFilename
            ? `Last export: ${lastExportFilename}`
            : 'No export generated in this session.'}
        </p>
      </div>
    </div>
  );
}
