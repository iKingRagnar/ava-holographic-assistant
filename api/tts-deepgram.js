// Deepgram TTS — Aura-2, solo voces femeninas (hablan el idioma del texto)
// Reuses DEEPGRAM_API_KEY

// Modelos aura-2-* femeninos; -es para acento latino donde exista
const AVATAR_VOICES = [
  'aura-2-asteria-en',
  'aura-2-luna-en',
  'aura-2-thalia-en',
  'aura-2-athena-en',
  'aura-2-hera-en',
  'aura-2-andromeda-en',
  'aura-2-iris-en',
  'aura-2-juno-en',
  'aura-2-celeste-es',
  'aura-2-estrella-es',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return res.status(503).json({ error: 'DEEPGRAM_API_KEY not configured' });

  const { text, avatarIndex = 0 } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const idx = Math.max(0, Math.min(9, parseInt(avatarIndex) || 0));
  let model = AVATAR_VOICES[idx];
  const clean = text.substring(0, 2000);

  async function trySpeak(m) {
    const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(m)}&encoding=mp3`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: clean }),
    });
    return r;
  }

  try {
    let r = await trySpeak(model);
    // Fallback Aura-1 si aura-2 no está en la cuenta
    if (!r.ok && model.startsWith('aura-2-')) {
      const legacy = [
        'aura-asteria-en', 'aura-luna-en', 'aura-stella-en', 'aura-hera-en', 'aura-athena-en',
        'aura-luna-en', 'aura-stella-en', 'aura-asteria-en', 'aura-hera-en', 'aura-athena-en',
      ][idx];
      model = legacy;
      r = await trySpeak(model);
    }

    if (!r.ok) {
      const err = await r.text();
      console.error('Deepgram TTS error:', r.status, err);
      return res.status(r.status).json({ error: 'Deepgram TTS failed: ' + err });
    }

    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    res.json({ audioContent: b64, encoding: 'mp3', voice: model, source: 'deepgram-tts' });

  } catch (e) {
    console.error('Deepgram TTS exception:', e);
    res.status(500).json({ error: e.message });
  }
}
