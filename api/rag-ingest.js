// RAG Ingest — chunking + TF-IDF vectorization
// POST /api/rag-ingest
// Body: { text: string, source?: string, chunkSize?: number, chunkOverlap?: number }
// Returns: { chunks: [{id, text, source, tokens, vector: {[term]: weight}}] }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { text, source = 'documento', chunkSize = 512, chunkOverlap = 64 } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: 'text requerido (mínimo 10 chars)' });
  }

  try {
    const chunks = chunkText(text.trim(), chunkSize, chunkOverlap, source);
    const corpus = chunks.map(c => c.text);
    const idf    = computeIDF(corpus);
    const result = chunks.map(c => ({
      ...c,
      vector: computeTFIDF(c.text, idf),
    }));

    return res.status(200).json({
      chunks: result,
      stats: {
        totalChunks: result.length,
        source,
        avgChunkLen: Math.round(result.reduce((s, c) => s + c.text.length, 0) / result.length),
      },
    });
  } catch (err) {
    console.error('[rag-ingest]', err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── TEXT CHUNKING ──────────────────────────────────────────────────────────────
function chunkText(text, chunkSize, overlap, source) {
  // Normalize whitespace
  const clean = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Split on paragraph boundaries first (better semantic coherence)
  const paras = clean.split(/\n\n+/).filter(p => p.trim().length > 0);

  const chunks = [];
  let buffer = '';
  let bufTokens = 0;

  const flush = () => {
    const t = buffer.trim();
    if (t.length > 20) {
      chunks.push({
        id:     `${source}_${chunks.length}`,
        text:   t,
        source,
        tokens: estimateTokens(t),
        index:  chunks.length,
      });
    }
    buffer = '';
    bufTokens = 0;
  };

  for (const para of paras) {
    const paraTokens = estimateTokens(para);

    // If a single paragraph exceeds chunk size, split it by sentences
    if (paraTokens > chunkSize) {
      if (buffer) flush();
      const sentences = splitSentences(para);
      let sentBuf = '';
      let sentTokens = 0;
      for (const sent of sentences) {
        const st = estimateTokens(sent);
        if (sentTokens + st > chunkSize && sentBuf) {
          buffer = sentBuf;
          bufTokens = sentTokens;
          flush();
          // Start new buffer with overlap (last sentence)
          const overlapText = sentBuf.split(/[.!?]\s+/).slice(-2).join('. ');
          buffer = overlapText + ' ';
          bufTokens = estimateTokens(buffer);
        }
        sentBuf += (sentBuf ? ' ' : '') + sent;
        sentTokens += st;
      }
      if (sentBuf.trim()) {
        buffer = sentBuf;
        flush();
      }
      continue;
    }

    // If adding this paragraph would exceed chunk size, flush first
    if (bufTokens + paraTokens > chunkSize && buffer) {
      flush();
      // Overlap: carry last N tokens from previous chunk
      const words = buffer ? buffer.split(' ').slice(-overlap) : [];
      buffer = words.join(' ') + (words.length ? '\n\n' : '');
      bufTokens = estimateTokens(buffer);
    }

    buffer += (buffer ? '\n\n' : '') + para;
    bufTokens += paraTokens;
  }

  if (buffer.trim()) flush();

  return chunks;
}

function splitSentences(text) {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function estimateTokens(text) {
  // ~4 chars per token (rough estimate, works well for Spanish/English mix)
  return Math.ceil(text.length / 4);
}

// ─── TF-IDF ─────────────────────────────────────────────────────────────────────
function tokenize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents for matching
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

function computeIDF(corpus) {
  const N = corpus.length;
  const df = {};  // document frequency per term

  for (const doc of corpus) {
    const terms = new Set(tokenize(doc));
    for (const t of terms) {
      df[t] = (df[t] || 0) + 1;
    }
  }

  const idf = {};
  for (const [term, freq] of Object.entries(df)) {
    idf[term] = Math.log((N + 1) / (freq + 1)) + 1;  // smoothed IDF
  }
  return idf;
}

function computeTFIDF(text, idf) {
  const tokens = tokenize(text);
  if (!tokens.length) return {};

  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }

  const vector = {};
  const maxTF = Math.max(...Object.values(tf));

  for (const [term, count] of Object.entries(tf)) {
    const normTF = count / maxTF;  // normalized TF
    const termIDF = idf[term] || Math.log(2); // fallback for OOV terms
    const weight = normTF * termIDF;
    if (weight > 0.01) {  // prune low-weight terms to save space
      vector[term] = Math.round(weight * 1000) / 1000;
    }
  }
  return vector;
}

// ─── SPANISH + ENGLISH STOPWORDS ────────────────────────────────────────────────
const STOPWORDS = new Set([
  // Spanish
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
  // English
  'the','and','for','are','but','not','you','all','can','her','was','one','our',
  'out','day','get','has','him','his','how','its','may','new','now','old','see',
  'two','who','boy','did','own','too','use','way','who','oil','sit','she','set',
  'put','too','got','let','why','few','ask','own','big','old','any','say','via',
  'had','that','this','with','from','they','been','have','will','said','each',
  'which','their','time','would','there','could','other','into','then','than',
  'some','what','when','about','more','also','just','like','only','over','such',
  'even','most','after','where','before','through','should','these','those',
]);
