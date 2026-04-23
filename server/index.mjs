import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBridgeDefaults, routeApiRequest } from './apiBridge.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..');
const distDir = path.resolve(repoRoot, 'dist');
const bridgeOptions = getBridgeDefaults();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function setSecurityHeaders(res) {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "connect-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
}

async function resolveStaticPath(urlPath) {
  const cleanPath = urlPath.split('?')[0];
  const normalizedPath =
    cleanPath === '/' ? '/index.html' : cleanPath.replace(/^\/+/, '/');
  const candidatePath = path.resolve(distDir, `.${normalizedPath}`);

  if (!candidatePath.startsWith(distDir)) {
    throw new Error('Invalid path.');
  }

  try {
    const fileStat = await stat(candidatePath);
    if (fileStat.isFile()) {
      return candidatePath;
    }
  } catch {
    // Fall back to the SPA entry point.
  }

  return path.join(distDir, 'index.html');
}

async function serveStatic(req, res) {
  const filePath = await resolveStaticPath(req.url || '/');
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await readFile(filePath);

  res.statusCode = 200;
  res.setHeader(
    'Content-Type',
    MIME_TYPES[ext] || 'application/octet-stream',
  );
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  res.end(buffer);
}

const server = createServer((req, res) => {
  setSecurityHeaders(res);

  void routeApiRequest(req, res, async () => {
    try {
      if ((req.method || 'GET') !== 'GET' && (req.method || 'GET') !== 'HEAD') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            ok: false,
            error: { message: `Unsupported method: ${req.method}` },
          }),
        );
        return;
      }

      await serveStatic(req, res);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: false,
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    }
  }, bridgeOptions);
});

server.listen(port, host, () => {
  process.stdout.write(`Flash Forge listening on http://${host}:${port}\n`);
});
