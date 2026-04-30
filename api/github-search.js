// @ts-check
// GitHub search tool — usa la API pública (60 req/h sin token, 5000 con).
// Útil para "AVA, ¿hay un repo de X?" / "busca issues sobre Y en github".
//
// POST /api/github-search { query, type?: 'repo'|'issue'|'code'|'user' }

import { checkRate, clientIp } from './_ratelimit.js';

const GH_TOKEN = process.env.GITHUB_TOKEN;
const ENDPOINT = {
  repo: 'https://api.github.com/search/repositories',
  issue: 'https://api.github.com/search/issues',
  code: 'https://api.github.com/search/code',
  user: 'https://api.github.com/search/users',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const ip = clientIp(req);
  const rate = await checkRate(`gh:${ip}`, 20, 60_000);
  if (!rate.ok) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited' });
  }

  const { query, type = 'repo' } = req.body || {};
  if (!query || typeof query !== 'string' || query.length < 2) {
    return res.status(400).json({ error: 'query requerido' });
  }
  const url = ENDPOINT[type];
  if (!url) return res.status(400).json({ error: 'type inválido', allowed: Object.keys(ENDPOINT) });

  const headers = { 'Accept': 'application/vnd.github+json' };
  if (GH_TOKEN) headers['Authorization'] = `Bearer ${GH_TOKEN}`;

  try {
    const r = await fetch(`${url}?q=${encodeURIComponent(query)}&per_page=5&sort=stars&order=desc`, {
      headers, signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      return res.status(502).json({ error: 'github_failed', status: r.status });
    }
    const d = await r.json();
    const items = (d.items || []).slice(0, 5).map(it => {
      if (type === 'repo') {
        return { name: it.full_name, url: it.html_url, stars: it.stargazers_count,
                 description: it.description || '', lang: it.language || null };
      }
      if (type === 'issue') {
        return { title: it.title, url: it.html_url, state: it.state,
                 number: it.number, repo: it.repository_url?.split('/').slice(-2).join('/') };
      }
      if (type === 'user') {
        return { login: it.login, url: it.html_url, type: it.type };
      }
      return { name: it.name, url: it.html_url, snippet: it.text_matches?.[0]?.fragment || '' };
    });
    return res.json({ items, total: d.total_count || 0, type });
  } catch (e) {
    return res.status(500).json({ error: 'internal', message: e.message });
  }
}
