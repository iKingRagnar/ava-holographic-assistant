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
  '.webmanifest': 'application/manifest+json',
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
  let headersSent = false;

  function ensureHeaders() {
    if (!headersSent) {
      headersSent = true;
      res.writeHead(statusCode, headers);
    }
  }

  return {
    status(code) { statusCode = code; return this; },
    setHeader(k, v) { headers[k] = v; return this; },
    // SSE support: flush headers immediately so the browser sees the stream
    flushHeaders() { ensureHeaders(); if (res.flushHeaders) res.flushHeaders(); return this; },
    // write() is required for SSE / streaming responses
    write(data) {
      ensureHeaders();
      try { res.write(data); } catch (_) {}
      return this;
    },
    json(obj) {
      const body = JSON.stringify(obj);
      if (!headersSent) {
        headersSent = true;
        res.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers });
      }
      res.end(body);
    },
    send(text) {
      if (!headersSent) {
        headersSent = true;
        res.writeHead(statusCode, { 'Content-Type': 'text/plain', ...headers });
      }
      res.end(String(text));
    },
    end(data) {
      ensureHeaders();
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

  // ── Debug endpoint (Railway diagnostics) ─────────────────────────────
  if (pathname === '/api/debug') {
    const publicDir = path.join(__dirname, 'public');
    let vrmFiles = [];
    try { vrmFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.vrm')); } catch(_) {}
    const info = {
      node: process.version,
      port: PORT,
      env: process.env.NODE_ENV || 'none',
      cwd: __dirname,
      vrm_count: vrmFiles.length,
      vrm_files: vrmFiles.map(f => {
        try { return { name: f, size_mb: +(fs.statSync(path.join(publicDir, f)).size / 1048576).toFixed(1) }; }
        catch(_) { return { name: f, error: true }; }
      }),
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      deepgram: !!process.env.DEEPGRAM_API_KEY,
    };
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(info, null, 2));
    return;
  }

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

  // VRM/GLB files live in /public/ — handle both /filename.vrm and /public/filename.vrm
  if (pathname.match(/^\/\d+\.vrm$/)) {
    filePath = path.join(__dirname, 'public', pathname.slice(1));
  } else if (pathname.match(/^\/public\/\d+\.vrm$/)) {
    filePath = path.join(__dirname, 'public', pathname.replace('/public/', ''));
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

  // ── Large binary files (VRM/GLB) → stream with proper headers ─────────
  if (['.vrm', '.glb'].includes(ext)) {
    try {
      const stat = fs.statSync(filePath);
      const total = stat.size;
      const rangeHeader = req.headers['range'];
      if (rangeHeader) {
        const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : total - 1;
        const chunkSize = (end - start) + 1;
        res.writeHead(206, {
          'Content-Type': mime,
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Cache-Control': 'public, max-age=86400',
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': total,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (e) {
      console.error('VRM stream error:', e.message);
      res.writeHead(500);
      res.end('VRM stream error: ' + e.message);
    }
    return;
  }

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end('Error: ' + e.message);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`✗ Puerto ${PORT} ocupado. Otro proceso escuchando ahí. Cambia PORT o cierra el proceso.`);
  } else {
    console.error('✗ Server error:', err);
  }
  process.exit(1);
});

// Log de excepciones no manejadas en handlers API para evitar crashes silenciosos
process.on('unhandledRejection', (reason) => {
  console.error('⚠ Unhandled promise rejection en API handler:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠ Uncaught exception:', err);
});

server.listen(PORT, () => {
  console.log(`\n🚀 AVA Dev Server corriendo en → http://localhost:${PORT}`);
  console.log(`   Chat API : http://localhost:${PORT}/api/chat`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ cargada (' + process.env.ANTHROPIC_API_KEY.slice(0,20) + '...)' : '✗ NO encontrada'}`);
  console.log(`   DEEPGRAM_API_KEY : ${process.env.DEEPGRAM_API_KEY ? '✓ cargada' : '✗ NO encontrada'}\n`);
});
