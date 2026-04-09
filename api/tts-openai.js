// OpenAI TTS — tts-1-hd, voz latina "paloma" (es-MX) para todos los avatares
// El idioma sale del texto; paloma mantiene acento mexicano natural.
// Requires OPENAI_API_KEY in Vercel environment variables

// Velocidad ligeramente distinta por avatar (misma voz paloma)
const AVATAR_VOICES = [
  { voice: 'paloma', speed: 1.0  }, // AVA
  { voice: 'paloma', speed: 1.06 }, // KIRA
  { voice: 'paloma', speed: 0.94 }, // ZANE
  { voice: 'paloma', speed: 1.04 }, // FAKER
  { voice: 'paloma', speed: 0.92 }, // SAO
  { voice: 'paloma', speed: 1.1  }, // NEON
  { voice: 'paloma', speed: 1.02 }, // YUKI
  { voice: 'paloma', speed: 0.98 }, // REI
  { voice: 'paloma', speed: 0.9  }, // MIRA
  { voice: 'paloma', speed: 1.08 }, // KAI
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
        model: 'tts-1',
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
