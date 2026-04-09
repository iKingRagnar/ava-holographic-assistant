// Deepgram TTS — Aura-2 neural voices, very low latency
// Reuses the same DEEPGRAM_API_KEY used for STT
// Spanish Aura-2 voices: aura-2-andromeda-es, aura-2-luna-es, aura-2-stella-es

// Voz ÚNICA por avatar — Deepgram Aura v1, mixed gender
// Female: asteria, luna, stella, athena, hera | Male: orion, arcas, perseus, angus, orpheus, helios, zeus
// Note: Aura speaks any language, model just sets voice character
const AVATAR_VOICES = [
  'aura-asteria-en',  // AVA   — cálida profesional (F)
  'aura-luna-en',     // KIRA  — brillante enérgica (F)
  'aura-orion-en',    // ZANE  — firme, profundo (M)
  'aura-perseus-en',  // FAKER — preciso coach (M)
  'aura-hera-en',     // SAO   — elegante ejecutiva (F)
  'aura-helios-en',   // NEON  — claro rápido (M)
  'aura-stella-en',   // YUKI  — suave creativa (F)
  'aura-arcas-en',    // REI   — directo técnico (M)
  'aura-athena-en',   // MIRA  — calma empática (F)
  'aura-orpheus-en',  // KAI   — carismático social (M)
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return res.status(503).json({ error: 'DEEPGRAM_API_KEY not configured' });

  const { text, avatarIndex = 0 } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const idx = Math.max(0, Math.min(9, parseInt(avatarIndex) || 0));
  const model = AVATAR_VOICES[idx];
  const clean = text.substring(0, 2000);

  try {
    const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: clean }),
    });

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
