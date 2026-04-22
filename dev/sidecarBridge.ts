import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

type JsonObject = Record<string, unknown>;

type SidecarEnvelope = {
  ok?: boolean;
  data?: unknown;
  error?: {
    message?: string;
  };
};

type ActionRequest = {
  action?: string;
  payload?: JsonObject;
};

type UploadedFile = {
  name?: string;
  type?: string;
  base64?: string;
};

type ActionWithFilesRequest = ActionRequest & {
  fileField?: string;
  fileMode?: 'single' | 'array';
  files?: UploadedFile[];
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..');
const sidecarScript = path.resolve(
  repoRoot,
  'desktop_app',
  'python_sidecar',
  'main.py',
);
const workspaceDir = path.resolve(repoRoot, 'anki_workspace');
const pythonCommand = process.env.PYTHON ?? 'python';

function extractSidecarError(stdout: string, stderr: string): string {
  try {
    const parsed = JSON.parse(stdout) as SidecarEnvelope;
    const message = parsed.error?.message;
    if (message) {
      return message;
    }
  } catch {
    // Fall through to raw stdout/stderr handling.
  }

  const stderrText = stderr.trim();
  if (stderrText) {
    return stderrText;
  }

  const stdoutText = stdout.trim();
  if (stdoutText) {
    return stdoutText;
  }

  return 'Sidecar process failed without output.';
}

async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString('utf-8').trim();
  if (!body) {
    return {} as T;
  }

  return JSON.parse(body) as T;
}

function writeJson(
  res: ServerResponse,
  statusCode: number,
  payload: JsonObject,
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function runSidecarAction<T>(
  action: string,
  payload: JsonObject = {},
): Promise<T> {
  const payloadPath = path.join(
    os.tmpdir(),
    `anki-deck-creator-${randomUUID()}.json`,
  );

  await writeFile(payloadPath, JSON.stringify(payload), 'utf-8');

  try {
    const result = await new Promise<T>((resolve, reject) => {
      const child = spawn(
        pythonCommand,
        [
          sidecarScript,
          '--action',
          action,
          '--payload-file',
          payloadPath,
        ],
        {
          cwd: repoRoot,
          env: {
            ...process.env,
            ANKI_APP_DIR: workspaceDir,
          },
          windowsHide: true,
        },
      );

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(extractSidecarError(stdout, stderr)));
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as SidecarEnvelope;
          if (!parsed.ok) {
            reject(
              new Error(
                parsed.error?.message ?? 'Sidecar returned an unknown error.',
              ),
            );
            return;
          }

          resolve((parsed.data ?? null) as T);
        } catch (error) {
          reject(
            new Error(
              `Unable to parse sidecar JSON output. ${String(error)}\n${stdout}`,
            ),
          );
        }
      });
    });

    return result;
  } finally {
    await rm(payloadPath, { force: true }).catch(() => undefined);
  }
}

async function materializeFiles(files: UploadedFile[]): Promise<{
  paths: string[];
  tempDir: string;
}> {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), 'anki-deck-creator-files-'),
  );
  const filePaths: string[] = [];

  for (const [index, file] of files.entries()) {
    const rawName = file.name?.trim() || `upload-${index + 1}`;
    const safeName = `${index + 1}-${path.basename(rawName)}`;
    const filePath = path.join(tempDir, safeName);
    const buffer = Buffer.from(file.base64 ?? '', 'base64');

    await writeFile(filePath, buffer);
    filePaths.push(filePath);
  }

  return { paths: filePaths, tempDir };
}

async function handleActionRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await parseJsonBody<ActionRequest>(req);
  const action = String(body.action ?? '').trim();

  if (!action) {
    writeJson(res, 400, {
      ok: false,
      error: { message: 'Action is required.' },
    });
    return;
  }

  const data = await runSidecarAction(action, body.payload ?? {});
  writeJson(res, 200, { ok: true, data });
}

async function handleActionWithFilesRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await parseJsonBody<ActionWithFilesRequest>(req);
  const action = String(body.action ?? '').trim();
  const fileField = String(body.fileField ?? '').trim();
  const fileMode = body.fileMode === 'single' ? 'single' : 'array';
  const files = Array.isArray(body.files) ? body.files : [];

  if (!action) {
    writeJson(res, 400, {
      ok: false,
      error: { message: 'Action is required.' },
    });
    return;
  }

  if (!fileField) {
    writeJson(res, 400, {
      ok: false,
      error: { message: 'fileField is required.' },
    });
    return;
  }

  const { paths, tempDir } = await materializeFiles(files);

  try {
    const payload = { ...(body.payload ?? {}) } as JsonObject;
    payload[fileField] = fileMode === 'single' ? paths[0] ?? '' : paths;

    const data = await runSidecarAction(action, payload);
    writeJson(res, 200, { ok: true, data });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function handleExportDeckRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await parseJsonBody<{ deck_id?: string }>(req);
  const deckId = String(body.deck_id ?? '').trim();

  if (!deckId) {
    writeJson(res, 400, {
      ok: false,
      error: { message: 'deck_id is required.' },
    });
    return;
  }

  const data = await runSidecarAction<{
    export_path: string;
    filename?: string;
  }>('export_deck', {
    deck_id: deckId,
  });

  const exportPath = String(data.export_path ?? '').trim();
  if (!exportPath) {
    throw new Error('export_deck did not return an export path.');
  }

  await stat(exportPath);
  const buffer = await readFile(exportPath);
  const filename = String(data.filename ?? path.basename(exportPath));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename.replace(/"/g, '')}"`,
  );
  res.setHeader('Cache-Control', 'no-store');
  res.end(buffer);
}

async function routeApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void,
): Promise<void> {
  if (!req.url?.startsWith('/api/')) {
    next();
    return;
  }

  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'POST' && url.pathname === '/api/action') {
      await handleActionRequest(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/action-with-files') {
      await handleActionWithFilesRequest(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/export-deck') {
      await handleExportDeckRequest(req, res);
      return;
    }

    writeJson(res, 404, {
      ok: false,
      error: { message: `Unknown API route: ${url.pathname}` },
    });
  } catch (error) {
    writeJson(res, 500, {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

function attachMiddleware(
  server: ViteDevServer | PreviewServer,
): void {
  server.middlewares.use((req, res, next) => {
    void routeApiRequest(req, res, next);
  });
}

export function pythonSidecarBridge(): Plugin {
  return {
    name: 'python-sidecar-bridge',
    configureServer(server) {
      attachMiddleware(server);
    },
    configurePreviewServer(server) {
      attachMiddleware(server);
    },
  };
}
