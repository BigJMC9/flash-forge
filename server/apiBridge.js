import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDefault = path.resolve(currentDir, '..');
const sidecarScriptDefault = path.resolve(
  repoRootDefault,
  'python_sidecar',
  'main.py',
);
const workspaceDirDefault = path.resolve(repoRootDefault, 'anki_workspace');
const pythonCommandDefault = process.env.PYTHON ?? 'python';

export const SESSION_COOKIE_NAME = 'flash_forge_session';
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MAX_ACTION_BODY_BYTES = 256 * 1024;
const MAX_EXPORT_BODY_BYTES = 32 * 1024;
const MAX_ACTION_WITH_FILES_BODY_BYTES = 70 * 1024 * 1024;
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 10;
const AUTH_RATE_LIMIT_ACTIONS = new Set(['login_user', 'register_user']);
const authRateLimitBuckets = new Map();

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function extractSidecarError(stdout, stderr) {
  try {
    const parsed = JSON.parse(stdout);
    const message = parsed?.error?.message;
    if (message) {
      return message;
    }
  } catch {
    // Fall through to raw output handling.
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

async function parseJsonBody(req, maxBytes = MAX_ACTION_BODY_BYTES) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw createHttpError(413, 'Request body is too large.');
    }
    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString('utf-8').trim();
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw createHttpError(400, 'Request body must be valid JSON.');
  }
}

function writeJson(res, statusCode, payload, extraHeaders = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value !== undefined) {
      res.setHeader(key, value);
    }
  }
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie ?? '';
  const cookies = {};
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function getSessionToken(req) {
  return parseCookies(req)[SESSION_COOKIE_NAME] ?? '';
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '')
    .split(',')[0]
    .trim();
  if (forwarded) {
    return forwarded;
  }
  return String(req.socket?.remoteAddress ?? 'unknown');
}

function pruneAuthRateLimitBucket(now, bucket) {
  return bucket.filter((timestamp) => now - timestamp < AUTH_RATE_LIMIT_WINDOW_MS);
}

function enforceAuthRateLimit(req, action) {
  if (!AUTH_RATE_LIMIT_ACTIONS.has(action)) {
    return;
  }

  const now = Date.now();
  const key = `${action}:${getClientIp(req)}`;
  const existing = pruneAuthRateLimitBucket(now, authRateLimitBuckets.get(key) ?? []);
  if (existing.length >= AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
    authRateLimitBuckets.set(key, existing);
    throw createHttpError(
      429,
      'Too many authentication attempts. Try again in 15 minutes.',
    );
  }
  existing.push(now);
  authRateLimitBuckets.set(key, existing);
}

function clearAuthRateLimit(req, action) {
  if (!AUTH_RATE_LIMIT_ACTIONS.has(action)) {
    return;
  }
  authRateLimitBuckets.delete(`${action}:${getClientIp(req)}`);
}

function shouldUseSecureCookies(req) {
  if (String(process.env.COOKIE_SECURE ?? '').trim() === '1') {
    return true;
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (forwardedProto === 'https') {
    return true;
  }

  if (req.socket?.encrypted) {
    return true;
  }

  return false;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function buildSessionCookie(rawToken, req) {
  return serializeCookie(SESSION_COOKIE_NAME, rawToken, {
    path: '/',
    sameSite: 'Lax',
    httpOnly: true,
    secure: shouldUseSecureCookies(req),
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    expires: new Date(Date.now() + SESSION_COOKIE_MAX_AGE_SECONDS * 1000),
  });
}

function buildExpiredSessionCookie(req) {
  return serializeCookie(SESSION_COOKIE_NAME, '', {
    path: '/',
    sameSite: 'Lax',
    httpOnly: true,
    secure: shouldUseSecureCookies(req),
    maxAge: 0,
    expires: new Date(0),
  });
}

function withSessionPayload(req, payload = {}) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return payload;
  }
  return {
    ...payload,
    _session_token: sessionToken,
  };
}

async function runSidecarAction(action, payload = {}, options = {}) {
  const repoRoot = options.repoRoot ?? repoRootDefault;
  const sidecarScript = options.sidecarScript ?? sidecarScriptDefault;
  const workspaceDir = options.workspaceDir ?? workspaceDirDefault;
  const pythonCommand = options.pythonCommand ?? pythonCommandDefault;

  const payloadPath = path.join(
    os.tmpdir(),
    `flash-forge-${randomUUID()}.json`,
  );

  await writeFile(payloadPath, JSON.stringify(payload), 'utf-8');

  try {
    const result = await new Promise((resolve, reject) => {
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
          const parsed = JSON.parse(stdout);
          if (!parsed?.ok) {
            reject(
              new Error(
                parsed?.error?.message ?? 'Sidecar returned an unknown error.',
              ),
            );
            return;
          }

          resolve(parsed?.data ?? null);
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

async function materializeFiles(files) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'flash-forge-files-'));
  const filePaths = [];

  for (const [index, file] of files.entries()) {
    const rawName = String(file?.name ?? '').trim() || `upload-${index + 1}`;
    const safeName = `${index + 1}-${path.basename(rawName)}`;
    const filePath = path.join(tempDir, safeName);
    const buffer = Buffer.from(String(file?.base64 ?? ''), 'base64');

    await writeFile(filePath, buffer);
    filePaths.push(filePath);
  }

  return { paths: filePaths, tempDir };
}

function normalizeActionResponse(action, data, req, res) {
  if (action === 'logout_user') {
    res.setHeader('Set-Cookie', buildExpiredSessionCookie(req));
    return data;
  }

  if (action === 'login_user' || action === 'register_user') {
    const sessionToken = String(data?.session_token ?? '').trim();
    if (sessionToken) {
      res.setHeader('Set-Cookie', buildSessionCookie(sessionToken, req));
    }

    const sanitized = { ...(data ?? {}) };
    delete sanitized.session_token;
    if (sessionToken) {
      clearAuthRateLimit(req, action);
      sanitized.session_established = true;
    }
    return sanitized;
  }

  return data;
}

async function handleActionRequest(req, res, options = {}) {
  const body = await parseJsonBody(req, MAX_ACTION_BODY_BYTES);
  const action = String(body?.action ?? '').trim();

  if (!action) {
    writeJson(res, 400, {
      ok: false,
      error: { message: 'Action is required.' },
    });
    return;
  }

  enforceAuthRateLimit(req, action);
  const payload = withSessionPayload(req, body?.payload ?? {});
  const data = await runSidecarAction(action, payload, options);
  const normalizedData = normalizeActionResponse(action, data, req, res);
  writeJson(res, 200, { ok: true, data: normalizedData });
}

async function handleActionWithFilesRequest(req, res, options = {}) {
  const body = await parseJsonBody(req, MAX_ACTION_WITH_FILES_BODY_BYTES);
  const action = String(body?.action ?? '').trim();
  const fileField = String(body?.fileField ?? '').trim();
  const fileMode = body?.fileMode === 'single' ? 'single' : 'array';
  const files = Array.isArray(body?.files) ? body.files : [];

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
    const payload = withSessionPayload(req, body?.payload ?? {});
    payload[fileField] = fileMode === 'single' ? paths[0] ?? '' : paths;
    const data = await runSidecarAction(action, payload, options);
    writeJson(res, 200, { ok: true, data });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function handleExportDeckRequest(req, res, options = {}) {
  const body = await parseJsonBody(req, MAX_EXPORT_BODY_BYTES);
  const deckId = String(body?.deck_id ?? '').trim();

  if (!deckId) {
    writeJson(res, 400, {
      ok: false,
      error: { message: 'deck_id is required.' },
    });
    return;
  }

  const data = await runSidecarAction(
    'export_deck',
    withSessionPayload(req, { deck_id: deckId }),
    options,
  );

  const exportPath = String(data?.export_path ?? '').trim();
  if (!exportPath) {
    throw new Error('export_deck did not return an export path.');
  }

  await stat(exportPath);
  const buffer = await readFile(exportPath);
  const filename = String(data?.filename ?? path.basename(exportPath));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename.replace(/"/g, '')}"`,
  );
  res.setHeader('Cache-Control', 'no-store');
  res.end(buffer);
}

export async function routeApiRequest(
  req,
  res,
  next = () => {},
  options = {},
) {
  if (!req.url?.startsWith('/api/')) {
    next();
    return;
  }

  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'POST' && url.pathname === '/api/action') {
      await handleActionRequest(req, res, options);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/action-with-files') {
      await handleActionWithFilesRequest(req, res, options);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/export-deck') {
      await handleExportDeckRequest(req, res, options);
      return;
    }

    writeJson(res, 404, {
      ok: false,
      error: { message: `Unknown API route: ${url.pathname}` },
    });
  } catch (error) {
    const statusCode =
      typeof error?.statusCode === 'number' ? error.statusCode : 500;
    writeJson(res, statusCode, {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

export function getBridgeDefaults() {
  return {
    repoRoot: repoRootDefault,
    sidecarScript: sidecarScriptDefault,
    workspaceDir: workspaceDirDefault,
    pythonCommand: pythonCommandDefault,
  };
}
