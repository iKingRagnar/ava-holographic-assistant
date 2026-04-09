// Deepgram TTS — Aura-2 neural voices, very low latency
// Reuses the same DEEPGRAM_API_KEY used for STT
// Spanish Aura-2 voices: aura-2-andromeda-es, aura-2-luna-es, aura-2-stella-es

// Per-avatar voice mapping (Deepgram Aura-2 multilingual)
const AVATAR_VOICES = [
  'aura-2-andromeda-es',  // AVA   — professional, warm
  'aura-2-luna-es',       // KIRA  — energetic
  'aura-2-stella-es',     // ZANE  — confident
  'aura-2-andromeda-es',  // FAKER — precise
  'aura-2-stella-es',     // SAO   — elegant
  'aura-2-luna-es',       // NEON  — fast
  'aura-2-andromeda-es',  // YUKI  — soft
  'aura-2-stella-es',     // REI   — technical
  'aura-2-andromeda-es',  // MIRA  — calm
  'aura-2-luna-es',       // KAI   — charismatic
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
    const r = await fetch('https://api.deepgram.com/v1/speak?encoding=mp3', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: clean, model }),
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
