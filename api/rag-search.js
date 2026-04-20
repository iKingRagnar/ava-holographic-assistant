// RAG Search — cosine similarity over client-side KB chunks
// POST /api/rag-search
// Body: { query: string, chunks: [{id, text, source, vector:{[term]:weight}}], topK?: number }
// Returns: { results: [{id, text, source, score}] }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { query, chunks, topK = 3, minScore = 0.05 } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query requerido' });
  }
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return res.status(200).json({ results: [], message: 'KB vacía' });
  }

  try {
    // Build a single-doc IDF from the query alone (query expansion)
    // For server-side search we use the pre-computed vectors from ingest
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return res.status(200).json({ results: [] });
    }

    // Build query TF vector (uniform weights — we don't have IDF from query alone)
    const queryVec = {};
    for (const t of queryTokens) {
      queryVec[t] = (queryVec[t] || 0) + 1;
    }
    // Normalize query vector
    const qMag = Math.sqrt(Object.values(queryVec).reduce((s, v) => s + v * v, 0));
    for (const t in queryVec) queryVec[t] /= qMag;

    // Score each chunk
    const scored = chunks.map(chunk => {
      const vec = chunk.vector || {};
      let dot = 0;
      let vecMag = 0;

      for (const [term, weight] of Object.entries(vec)) {
        vecMag += weight * weight;
        if (queryVec[term]) {
          dot += queryVec[term] * weight;
        }
      }

      // Also boost chunks that contain exact substrings of the query (keyword match)
      const chunkLower = (chunk.text || '').toLowerCase();
      const queryLower = query.toLowerCase();
      let keywordBoost = 0;
      for (const token of queryTokens) {
        if (chunkLower.includes(token)) keywordBoost += 0.08;
      }
      // Exact phrase bonus
      if (chunkLower.includes(queryLower)) keywordBoost += 0.25;

      const cosine = vecMag > 0 ? dot / Math.sqrt(vecMag) : 0;
      const score = Math.min(1, cosine + keywordBoost);

      return {
        id:     chunk.id,
        text:   chunk.text,
        source: chunk.source || 'KB',
        index:  chunk.index ?? 0,
        score:  Math.round(score * 1000) / 1000,
      };
    });

    // Sort by score descending, filter below threshold
    const results = scored
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(r => ({
        id:     r.id,
        text:   r.text,
        source: r.source,
        score:  r.score,
      }));

    return res.status(200).json({ results, query, totalChunks: chunks.length });

  } catch (err) {
    console.error('[rag-search]', err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── TOKENIZER (must match rag-ingest.js exactly for vector compatibility) ──────
function tokenize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  'de','la','el','en','y','a','los','del','se','las','por','un','con','no','una',
  'su','para','es','al','lo','como','mas','pero','sus','le','ya','o','fue','este',
  'ha','si','sobre','ser','tiene','entre','cuando','muy','sin','sobre','también',
  'me','hasta','hay','donde','quien','desde','nos','durante','estados','todos',
  'uno','les','ni','contra','otros','ese','eso','ante','ellos','e','esto','mí',
  'antes','algunos','qué','unos','yo','otro','otras','otra','él','tanto','esa',
  'estos','mucho','quienes','nada','muchos','cual','poco','ella','estar','estas',
  'algunas','algo','nosotros','mi','mis','tú','te','ti','tu','tus','vosotros',
  'vuestro','vuesta','vuestros','vuestras','os','mío','mía','míos','mías','tuyo',
  'tuya','tuyos','tuyas','suyo','suya','suyos','suyas','nuestro','nuestra',
  'nuestros','nuestras','vuestro','está','estás','estoy','estamos','estáis',
  'están','soy','eres','somos','sois','son','era','eras','éramos','eran',
  'sea','seas','seamos','sean','sido','siendo','haber','tengo','tienes','tenemos',
  'tenéis','tienen','he','has','hemos','habéis','han','para','por','con','sin',
  'bajo','sobre','entre','hacia','hasta','desde','durante','mediante','según',
  'tan','más','menos','muy','bien','aquí','allí','también','tampoco','así','ahora',
  'the','and','for','are','but','not','you','all','can','her','was','one','our',
  'out','day','get','has','him','his','how','its','may','new','now','old','see',
  'two','who','boy','did','own','too','use','way','who','oil','sit','she','set',
  'put','too','got','let','why','few','ask','own','big','old','any','say','via',
  'had','that','this','with','from','they','been','have','will','said','each',
  'which','their','time','would','there','could','other','into','then','than',
  'some','what','when','about','more','also','just','like','only','over','such',
  'even','most','after','where','before','through','should','these','those',
]);
