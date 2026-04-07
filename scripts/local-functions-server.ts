/**
 * local-functions-server.ts
 *
 * Lightweight local dev server that runs Netlify function handlers on
 * http://localhost:9999/.netlify/functions/*
 *
 * Vite proxies those requests here (see vite.config.ts).
 * Run via:  npm run dev:local   (runs both Vite + this server together)
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Load .env file into process.env ───────────────────────────────────────────
try {
  const envContent = readFileSync(join(process.cwd(), '.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key   = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      // Don't override values already set in the real environment
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
  console.log('  Loaded .env');
} catch {
  console.warn('  No .env file found — server-side env vars may be missing.');
}

const PORT = 9999;

// Cache handlers so each function module is only imported once per run
const handlerCache = new Map<string, (event: unknown) => Promise<unknown>>();

async function getHandler(name: string): Promise<((event: unknown) => Promise<unknown>) | null> {
  if (!handlerCache.has(name)) {
    try {
      // tsx registers a TypeScript loader so dynamic import of .ts files works
      const mod = await import(`./netlify/functions/${name}.ts`);
      if (typeof mod.handler !== 'function') {
        console.error(`  [${name}] No 'handler' export found.`);
        return null;
      }
      handlerCache.set(name, mod.handler);
      console.log(`  Loaded function: ${name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [${name}] Failed to load: ${msg}`);
      return null;
    }
  }
  return handlerCache.get(name) ?? null;
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += String(chunk); });
    req.on('end', () => resolve(body));
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Allow Vite dev server origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Match /.netlify/functions/<fnName>
  const match = req.url?.match(/^\/\.netlify\/functions\/([^/?]+)/);
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not a function path' }));
    return;
  }

  const fnName = match[1];
  const handler = await getHandler(fnName);

  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Function '${fnName}' not found` }));
    return;
  }

  const body    = await readBody(req);
  const urlObj  = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const queryStringParameters: Record<string, string> = {};
  urlObj.searchParams.forEach((v, k) => { queryStringParameters[k] = v; });

  // Build a Netlify-compatible HandlerEvent object
  const event = {
    httpMethod:            req.method ?? 'GET',
    headers:               req.headers as Record<string, string>,
    body:                  body || null,
    queryStringParameters,
    path:                  urlObj.pathname,
    isBase64Encoded:       false,
    rawUrl:                req.url ?? '/',
    rawQuery:              urlObj.search.slice(1),
  };

  try {
    const result = await handler(event, {});
    res.writeHead(result.statusCode ?? 200, result.headers ?? {});
    res.end(result.body ?? '');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${fnName}] Runtime error:`, msg);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: msg }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  Functions server → http://localhost:${PORT}/.netlify/functions/*\n`);
});
