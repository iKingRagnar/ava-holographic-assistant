// OpenAI TTS — tts-1-hd model, neural female voices per avatar
// Requires OPENAI_API_KEY in Vercel environment variables

// Per-avatar voice mapping (OpenAI voices: alloy, echo, fable, onyx, nova, shimmer)
// Female-sounding: nova (warm), shimmer (clear/bright), fable (expressive)
const AVATAR_VOICES = [
  { voice: 'nova',    speed: 1.0  }, // AVA     — profesional, cálida
  { voice: 'shimmer', speed: 1.08 }, // KIRA    — energética, brillante
  { voice: 'nova',    speed: 0.95 }, // ZANE    — firme, pausada
  { voice: 'shimmer', speed: 1.05 }, // FAKER   — precisa
  { voice: 'fable',   speed: 0.92 }, // SAO     — elegante, expresiva
  { voice: 'shimmer', speed: 1.12 }, // NEON    — rápida
  { voice: 'nova',    speed: 1.0  }, // YUKI    — suave
  { voice: 'fable',   speed: 1.0  }, // REI     — técnica
  { voice: 'nova',    speed: 0.9  }, // MIRA    — tranquila
  { voice: 'shimmer', speed: 1.1  }, // KAI     — carismática
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const { text, avatarIndex = 0 } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }

  const idx = Math.max(0, Math.min(9, parseInt(avatarIndex) || 0));
  const v = AVATAR_VOICES[idx];
  const clean = text.substring(0, 600);

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: clean,
        voice: v.voice,
        speed: v.speed,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI TTS error:', err);
      return res.status(response.status).json({ error: 'OpenAI TTS failed: ' + err });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    res.json({
      audioContent: base64Audio,
      encoding: 'mp3',
      voice: v.voice,
      source: 'openai-tts',
    });

  } catch (error) {
    console.error('OpenAI TTS exception:', error);
    res.status(500).json({ error: 'TTS error: ' + error.message });
  }
}
