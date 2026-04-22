// @ts-check
// Postgres helper — solo activa si DATABASE_URL está presente (Railway plugin).
// Sin DATABASE_URL los endpoints RAG siguen funcionando client-side (localStorage).

let _pool = null;
let _ready = false;
let _initTried = false;

async function _ensurePool() {
  if (_initTried) return _pool;
  _initTried = true;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  try {
    const { default: pg } = await import('pg');
    _pool = new pg.Pool({
      connectionString: url,
      ssl: url.includes('railway') || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 5,
    });
    _pool.on('error', (e) => console.warn('[db] pool error:', e.message));
    // Inicializar schema idempotente
    await _pool.query(`
      CREATE TABLE IF NOT EXISTS rag_chunks (
        id           TEXT PRIMARY KEY,
        session_id   TEXT NOT NULL,
        source       TEXT NOT NULL,
        text         TEXT NOT NULL,
        tokens       INTEGER,
        vector       JSONB NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rag_session ON rag_chunks (session_id);
      CREATE INDEX IF NOT EXISTS idx_rag_source  ON rag_chunks (source);
    `);
    _ready = true;
    console.log('[db] Postgres ready');
  } catch (e) {
    console.warn('[db] Postgres init failed, disabling server-side RAG:', e.message);
    _pool = null;
  }
  return _pool;
}

export async function isDbReady() {
  await _ensurePool();
  return _ready;
}

export async function storeChunks(sessionId, chunks) {
  const pool = await _ensurePool();
  if (!pool) return { stored: 0, reason: 'no_db' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of chunks) {
      await client.query(
        `INSERT INTO rag_chunks (id, session_id, source, text, tokens, vector)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET text=EXCLUDED.text, vector=EXCLUDED.vector`,
        [c.id, sessionId, c.source || 'kb', c.text, c.tokens || null, c.vector || {}]
      );
    }
    await client.query('COMMIT');
    return { stored: chunks.length };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    return { stored: 0, error: e.message };
  } finally {
    client.release();
  }
}

export async function fetchChunks(sessionId, limit = 500) {
  const pool = await _ensurePool();
  if (!pool) return [];
  const r = await pool.query(
    `SELECT id, source, text, tokens, vector FROM rag_chunks
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sessionId, limit]
  );
  return r.rows;
}

export async function clearChunks(sessionId) {
  const pool = await _ensurePool();
  if (!pool) return { deleted: 0, reason: 'no_db' };
  const r = await pool.query(`DELETE FROM rag_chunks WHERE session_id = $1`, [sessionId]);
  return { deleted: r.rowCount || 0 };
}
