// OpenAI TTS — tts-1, solo voces femeninas (nova, shimmer, coral, fable). Sin alloy/onyx/echo/sage/ash/ballad.
// Requires OPENAI_API_KEY in Vercel environment variables

const AVATAR_VOICES = [
  { voice: 'nova',    speed: 1.0  }, // AVA
  { voice: 'shimmer', speed: 1.1  }, // KIRA
  { voice: 'coral',   speed: 0.93 }, // ZANE
  { voice: 'fable',   speed: 1.03 }, // FAKER
  { voice: 'nova',    speed: 0.91 }, // SAO
  { voice: 'shimmer', speed: 1.14 }, // NEON
  { voice: 'fable',   speed: 1.07 }, // YUKI
  { voice: 'coral',   speed: 1.04 }, // REI
  { voice: 'shimmer', speed: 0.87 }, // MIRA
  { voice: 'coral',   speed: 1.09 }, // KAI
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
