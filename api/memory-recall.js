// @ts-check
// Memoria episódica persistente (Postgres si DATABASE_URL existe).
// Guarda turnos importantes y permite recall por keywords.
//
//   POST /api/memory-recall  { sessionId, action: 'save', role, content, summary? }
//   POST /api/memory-recall  { sessionId, action: 'recall', query }   → matches
//   POST /api/memory-recall  { sessionId, action: 'list', limit? }    → últimos N
//   POST /api/memory-recall  { sessionId, action: 'forget' }          → borra todo
//
// Sin DATABASE_URL → 501 (cliente cae a IndexedDB del navegador).

import { isDbReady } from './_db.js';
import { checkRate, clientIp } from './_ratelimit.js';

let _ensured = false;
async function _ensureMemoryTable() {
  if (_ensured) return;
  if (!(await isDbReady())) return;
  const { default: pg } = await import('pg');
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes('railway') || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 3,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS episodic_memory (
      id          BIGSERIAL PRIMARY KEY,
      session_id  TEXT NOT NULL,
      role        TEXT NOT NULL,
      content     TEXT NOT NULL,
      summary     TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_em_session ON episodic_memory (session_id);
    CREATE INDEX IF NOT EXISTS idx_em_content_trgm ON episodic_memory USING GIN (lower(content) gin_trgm_ops);
  `).catch(() => {/* trgm extension puede no estar; ignoramos */});
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`).catch(() => {});
  globalThis.__memPool = pool;
  _ensured = true;
}

async function _pool() {
  await _ensureMemoryTable();
  return globalThis.__memPool || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const ip = clientIp(req);
  const rate = await checkRate(`mem:${ip}`, 60, 60_000);
  if (!rate.ok) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited' });
  }

  if (!(await isDbReady())) {
    return res.status(501).json({ error: 'db_not_configured' });
  }
  const pool = await _pool();
  if (!pool) return res.status(503).json({ error: 'pool_unavailable' });

  const { sessionId, action } = req.body || {};
  if (!sessionId || !action) return res.status(400).json({ error: 'sessionId y action requeridos' });
  const sid = String(sessionId).slice(0, 128);

  try {
    if (action === 'save') {
      const { role, content, summary } = req.body;
      if (!role || !content) return res.status(400).json({ error: 'role+content requeridos' });
      await pool.query(
        `INSERT INTO episodic_memory (session_id, role, content, summary) VALUES ($1, $2, $3, $4)`,
        [sid, String(role).slice(0, 32), String(content).slice(0, 8000), summary ? String(summary).slice(0, 1000) : null]
      );
      return res.json({ ok: true });
    }

    if (action === 'recall') {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: 'query requerido' });
      const q = String(query).toLowerCase().slice(0, 200);
      // Trigram similarity si está disponible, else ILIKE
      let r;
      try {
        r = await pool.query(
          `SELECT role, content, summary, created_at,
                  similarity(lower(content), $2) AS sim
             FROM episodic_memory
            WHERE session_id = $1 AND lower(content) % $2
            ORDER BY sim DESC, created_at DESC
            LIMIT 8`,
          [sid, q]
        );
      } catch {
        r = await pool.query(
          `SELECT role, content, summary, created_at, 0 AS sim
             FROM episodic_memory
            WHERE session_id = $1 AND lower(content) ILIKE '%' || $2 || '%'
            ORDER BY created_at DESC
            LIMIT 8`,
          [sid, q]
        );
      }
      return res.json({ matches: r.rows });
    }

    if (action === 'list') {
      const limit = Math.min(50, Math.max(1, Number(req.body.limit) || 20));
      const r = await pool.query(
        `SELECT role, content, summary, created_at FROM episodic_memory
          WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [sid, limit]
      );
      return res.json({ items: r.rows });
    }

    if (action === 'forget') {
      const r = await pool.query(`DELETE FROM episodic_memory WHERE session_id = $1`, [sid]);
      return res.json({ deleted: r.rowCount || 0 });
    }

    return res.status(400).json({ error: 'action inválido', allowed: ['save', 'recall', 'list', 'forget'] });
  } catch (e) {
    console.error('[memory-recall]', e.message);
    return res.status(500).json({ error: 'internal', message: e.message });
  }
}
