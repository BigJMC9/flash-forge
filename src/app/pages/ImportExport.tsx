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
    <div className="max-w-5xl">
      <h2 className="text-2xl font-semibold mb-6">Import & Export</h2>

      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Image className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold">OCR / Scan Intake</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Destination Deck
            </label>
            <select
              value={scanDeckId}
              onChange={(event) => setScanDeckId(event.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            placeholder="image_ocr,chapter-1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
            <Upload className="w-5 h-5" />
            <span>Select Images</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                setScanFiles(Array.from(event.target.files ?? []))
              }
              className="hidden"
            />
          </label>

          <button
            onClick={() => void handleRunScan()}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Run Scan
          </button>

          <span className="text-sm text-gray-600">
            {scanFiles.length} image(s) selected
          </span>
        </div>

        {scanSummary && (
          <div className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm whitespace-pre-wrap">
            {scanSummary}
          </div>
        )}

        {scanPreviewRows.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Visible Text
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Source
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    Word
                  </th>
                  <th className="text-left px-4 py-3 text-sm text-gray-600">
                    English
                  </th>
                </tr>
              </thead>
              <tbody>
                {scanPreviewRows.map((row) => (
                  <tr
                    key={`${row.visible_text}-${row.dictionary_entry_id}`}
                    className="border-t border-gray-100"
                  >
                    <td className="px-4 py-3">{row.visible_text}</td>
                    <td className="px-4 py-3 text-gray-600">{row.source_text}</td>
                    <td className="px-4 py-3">
                      {row.kanji} [{row.kana}]
                    </td>
                    <td className="px-4 py-3">{row.english}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {scanErrors.length > 0 && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {scanErrors.join('\n')}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-6 h-6 text-green-600" />
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select deck…</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.label}
                </option>
              ))}
            </select>
          </div>

          <label className="inline-flex items-center gap-3 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
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
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Import CSV
          </button>
          <span className="text-sm text-gray-600">
            {csvFile ? csvFile.name : 'No CSV selected'}
          </span>
        </div>

        {csvResult && <p className="text-sm text-gray-600 mt-4">{csvResult}</p>}
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-6 h-6 text-purple-600" />
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
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
