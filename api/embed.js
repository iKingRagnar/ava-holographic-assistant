// @ts-check
// Embedding endpoint usando HuggingFace Inference API (gratis con rate limit).
// Si HUGGINGFACE_TOKEN existe → usa modelo bge-small-en o multilingual-e5-small.
// Sin token → 501 (cliente cae a TF-IDF de rag-ingest/rag-search).
//
// POST /api/embed { texts: string[] }   → { vectors: number[][] }

import { checkRate, clientIp } from './_ratelimit.js';

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;
// Multilingual model (es+en) — funciona bien para RAG en español.
const HF_MODEL = process.env.HF_EMBED_MODEL || 'intfloat/multilingual-e5-small';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const ip = clientIp(req);
  const rate = await checkRate(`embed:${ip}`, 60, 60_000);
  if (!rate.ok) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited' });
  }

  if (!HF_TOKEN) {
    return res.status(501).json({
      error: 'hf_token_missing',
      message: 'Define HUGGINGFACE_TOKEN en Railway Variables. El cliente debe usar TF-IDF como fallback.',
    });
  }

  const { texts } = req.body || {};
  if (!Array.isArray(texts) || texts.length === 0) {
    return res.status(400).json({ error: 'texts array requerido' });
  }
  if (texts.length > 64) return res.status(400).json({ error: 'too_many_texts', max: 64 });
  for (const t of texts) {
    if (typeof t !== 'string' || t.length > 8000) {
      return res.status(400).json({ error: 'cada text debe ser string ≤ 8000 chars' });
    }
  }

  try {
    // E5 family: prefijar "query: " o "passage: " mejora resultados.
    const inputs = texts.map(t => `passage: ${t}`);
    const r = await fetch(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs, options: { wait_for_model: true } }),
        signal: AbortSignal.timeout(30_000),
      }
    );
    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      return res.status(502).json({
        error: 'hf_failed',
        status: r.status,
        body: errBody.slice(0, 300),
      });
    }
    const vectors = await r.json();
    if (!Array.isArray(vectors)) {
      return res.status(502).json({ error: 'unexpected_response_shape' });
    }
    return res.json({
      vectors,
      model: HF_MODEL,
      dim: Array.isArray(vectors[0]) ? vectors[0].length : 0,
    });
  } catch (e) {
    return res.status(500).json({ error: 'internal', message: e.message });
  }
}
