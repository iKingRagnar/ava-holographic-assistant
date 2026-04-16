/**
 * AVA Local Dev Server
 * Sirve archivos estáticos + ejecuta los API endpoints de Vercel localmente.
 * Uso: node server.js  (puerto 3333 por defecto)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3333;

// ── Cargar .env.local ──────────────────────────────────────────────────────
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Quitar comillas envolventes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && !process.env[key]) process.env[key] = val;
  }
  console.log('✓ .env.local cargado');
} else {
  console.warn('⚠ .env.local no encontrado');
}

// ── MIME types ─────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.vrm':  'model/gltf-binary',
  '.glb':  'model/gltf-binary',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
};

// ── Helper: leer body JSON ─────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ── Fake Vercel request/response wrappers ──────────────────────────────────
function makeVercelReq(req, body) {
  return {
    method: req.method,
    headers: req.headers,
    body,
    query: Object.fromEntries(new URL('http://x' + req.url).searchParams),
  };
}

function makeVercelRes(res) {
  let statusCode = 200;
  const headers = {};
  return {
    status(code) { statusCode = code; return this; },
    setHeader(k, v) { headers[k] = v; return this; },
    json(obj) {
      const body = JSON.stringify(obj);
      res.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers });
      res.end(body);
    },
    send(text) {
      res.writeHead(statusCode, { 'Content-Type': 'text/plain', ...headers });
      res.end(String(text));
    },
    end(data) {
      res.writeHead(statusCode, headers);
      res.end(data);
    },
  };
}

// ── Cargar handlers de API dinámicamente ───────────────────────────────────
const apiCache = {};
async function getApiHandler(name) {
  if (apiCache[name]) return apiCache[name];
  const filePath = path.join(__dirname, 'api', name + '.js');
  if (!fs.existsSync(filePath)) return null;
  try {
    const mod = await import(filePath + '?t=' + Date.now());
    const handler = mod.default || mod;
    apiCache[name] = handler;
    return handler;
  } catch (e) {
    console.error(`Error loading api/${name}.js:`, e.message);
    return null;
  }
}

// ── Servidor HTTP principal ────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── API routes ────────────────────────────────────────────────────────
  const apiMatch = pathname.match(/^\/api\/(.+)$/);
  if (apiMatch) {
    const name = apiMatch[1].replace(/\.js$/, '');
    const handler = await getApiHandler(name);
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `API route not found: ${name}` }));
      return;
    }
    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      await handler(makeVercelReq(req, body), makeVercelRes(res));
    } catch (e) {
      console.error(`API ${name} error:`, e.message);
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    }
    return;
  }

  // ── Static files ──────────────────────────────────────────────────────
  let filePath = path.join(__dirname, pathname === '/' ? 'ava.html' : pathname);

  // VRM files live in /public/
  if (pathname.match(/^\/\d+\.vrm$/)) {
    filePath = path.join(__dirname, 'public', pathname.slice(1));
  }

  // Directory → try ava.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'ava.html');
  }

  if (!fs.existsSync(filePath)) {
    // Fallback to ava.html for SPA routing
    filePath = path.join(__dirname, 'ava.html');
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end('Error: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 AVA Dev Server corriendo en → http://localhost:${PORT}`);
  console.log(`   Chat API : http://localhost:${PORT}/api/chat`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ cargada (' + process.env.ANTHROPIC_API_KEY.slice(0,20) + '...)' : '✗ NO encontrada'}`);
  console.log(`   DEEPGRAM_API_KEY : ${process.env.DEEPGRAM_API_KEY ? '✓ cargada' : '✗ NO encontrada'}\n`);
});
