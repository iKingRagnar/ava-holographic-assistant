/**
 * Sirve @pixiv/three-vrm desde el mismo origen (evita bloqueos a CDNs / trackers).
 * El HTML carga <script src="/api/three-vrm.js"> → siempre application/javascript.
 */
const SOURCES = [
  'https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@0.6.11/lib/three-vrm.js',
  'https://unpkg.com/@pixiv/three-vrm@0.6.11/lib/three-vrm.js',
];

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).setHeader('Allow', 'GET, HEAD').end();
  }

  let lastErr = '';
  for (const url of SOURCES) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (!r.ok) {
        lastErr = `${url} → ${r.status}`;
        continue;
      }
      const body = req.method === 'HEAD' ? '' : await r.text();
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      return res.status(200).send(body);
    } catch (e) {
      lastErr = `${url}: ${e && e.message ? e.message : e}`;
    }
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  return res
    .status(200)
    .send(
      '/* three-vrm proxy: upstream falló */ console.error("[api/three-vrm]", ' +
        JSON.stringify(lastErr) +
        ');'
    );
}
