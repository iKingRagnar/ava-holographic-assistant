// @ts-check
// RAG persistent storage — solo activo si DATABASE_URL está configurado.
// POST /api/rag-store    { sessionId, chunks }   → guarda chunks
// GET  /api/rag-store?sessionId=xxx              → devuelve chunks
// DELETE /api/rag-store  { sessionId }           → borra KB de esa sesión
//
// Si Postgres no está configurado, responde 501 y el cliente cae al modo
// localStorage (comportamiento actual).

import { isDbReady, storeChunks, fetchChunks, clearChunks } from './_db.js';
import { checkRate, clientIp } from './_ratelimit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // Rate limit ~20 ops/min por IP (los ingests pueden ser pesados)
  const ip = clientIp(req);
  const rate = await checkRate(`rag:${ip}`, 20, 60_000);
  if (!rate.ok) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited' });
  }

  if (!(await isDbReady())) {
    return res.status(501).json({
      error: 'db_not_configured',
      message: 'DATABASE_URL no está presente. Usa el modo localStorage client-side.',
    });
  }

  try {
    if (req.method === 'GET') {
      const sid = String(req.query?.sessionId || '').slice(0, 128);
      if (!sid) return res.status(400).json({ error: 'sessionId requerido' });
      const rows = await fetchChunks(sid);
      return res.status(200).json({ chunks: rows, total: rows.length });
    }

    if (req.method === 'POST') {
      const { sessionId, chunks } = req.body || {};
      if (!sessionId || !Array.isArray(chunks)) {
        return res.status(400).json({ error: 'sessionId y chunks[] requeridos' });
      }
      if (chunks.length > 1000) {
        return res.status(400).json({ error: 'too_many_chunks', max: 1000 });
      }
      const r = await storeChunks(String(sessionId).slice(0, 128), chunks);
      return res.status(200).json(r);
    }

    if (req.method === 'DELETE') {
      const { sessionId } = req.body || {};
      if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });
      const r = await clearChunks(String(sessionId).slice(0, 128));
      return res.status(200).json(r);
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('[rag-store] error:', e.message);
    return res.status(500).json({ error: 'internal', message: e.message });
  }
}
