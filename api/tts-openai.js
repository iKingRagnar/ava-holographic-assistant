// OpenAI TTS — tts-1, solo voces femeninas / neutras suaves (sin onyx, echo, sage, ash masculinos)
// Requires OPENAI_API_KEY in Vercel environment variables
//
// OpenAI: nova, shimmer, coral, fable suelen sonar femeninas; alloy es neutra — todas en español por el texto.

const AVATAR_VOICES = [
  { voice: 'nova',    speed: 1.0  }, // AVA   — cálida
  { voice: 'shimmer', speed: 1.08 }, // KIRA  — brillante
  { voice: 'coral',   speed: 0.94 }, // ZANE  — grave femenina
  { voice: 'fable',   speed: 1.02 }, // FAKER — clara
  { voice: 'nova',    speed: 0.92 }, // SAO   — pausada
  { voice: 'shimmer', speed: 1.12 }, // NEON  — rápida
  { voice: 'coral',   speed: 1.06 }, // YUKI  — suave
  { voice: 'fable',   speed: 0.98 }, // REI   — directa
  { voice: 'alloy',   speed: 0.9  }, // MIRA  — serena
  { voice: 'nova',    speed: 1.05 }, // KAI   — cálida social
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
  const clean = text.substring(0, 2500);

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
