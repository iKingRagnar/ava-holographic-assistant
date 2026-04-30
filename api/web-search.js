// @ts-check
// Web search tool — usa Tavily si TAVILY_API_KEY existe, sino DuckDuckGo
// Instant Answer + Wikipedia summary como fallback gratuito.
//
// POST /api/web-search { query: "..." }
// → { results: [{title, url, snippet}], source }

import { checkRate, clientIp } from './_ratelimit.js';

const TAVILY_KEY = process.env.TAVILY_API_KEY;

async function searchTavily(query) {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_KEY, query, max_results: 5,
      include_answer: true, search_depth: 'basic',
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) return null;
  const d = await r.json();
  return {
    answer: d.answer || '',
    results: (d.results || []).map(x => ({
      title: x.title, url: x.url, snippet: x.content || '',
    })),
    source: 'tavily',
  };
}

async function searchDuckDuckGo(query) {
  // Instant Answer API — no requiere key
  try {
    const r = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const results = [];
    if (d.AbstractText) {
      results.push({ title: d.Heading || query, url: d.AbstractURL || '', snippet: d.AbstractText });
    }
    for (const t of (d.RelatedTopics || []).slice(0, 4)) {
      if (t.Text) results.push({ title: t.Text.slice(0, 80), url: t.FirstURL || '', snippet: t.Text });
    }
    if (!results.length) return null;
    return { answer: d.AbstractText || '', results, source: 'duckduckgo' };
  } catch { return null; }
}

async function searchWikipedia(query) {
  try {
    const r = await fetch(
      `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/\s/g, '_'))}`,
      { signal: AbortSignal.timeout(6_000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.extract) return null;
    return {
      answer: d.extract,
      results: [{ title: d.title, url: d.content_urls?.desktop?.page || '', snippet: d.extract }],
      source: 'wikipedia',
    };
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const ip = clientIp(req);
  const rate = await checkRate(`websearch:${ip}`, 30, 60_000);
  if (!rate.ok) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited' });
  }

  const { query } = req.body || {};
  if (!query || typeof query !== 'string' || query.length < 2 || query.length > 500) {
    return res.status(400).json({ error: 'query string requerido (2-500 chars)' });
  }

  // 1) Tavily si está configurado
  if (TAVILY_KEY) {
    const result = await searchTavily(query).catch(() => null);
    if (result?.results?.length) return res.json(result);
  }

  // 2) DuckDuckGo Instant Answer
  const ddg = await searchDuckDuckGo(query);
  if (ddg) return res.json(ddg);

  // 3) Wikipedia summary fallback
  const wiki = await searchWikipedia(query);
  if (wiki) return res.json(wiki);

  return res.json({ answer: '', results: [], source: 'none' });
}
