export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const INWORLD_KEY = process.env.INWORLD_API_KEY;
  if (!INWORLD_KEY) {
    return res.status(503).json({
      error: 'INWORLD_API_KEY no configurada. Añádela en Vercel → Settings → Environment Variables.'
    });
  }

  const { text, voiceId = 'Ashley' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }

  try {
    const response = await fetch('https://api.inworld.ai/tts/v1/voice', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${INWORLD_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text.substring(0, 500),
        voice_id: voiceId,
        model_id: 'inworld-tts-1.5-max',
        audio_config: {
          audio_encoding: 'MP3',
          sample_rate_hertz: 24000
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Inworld TTS error:', errText);
      return res.status(500).json({ error: 'TTS failed: ' + errText });
    }

    const data = await response.json();

    if (!data.audioContent) {
      return res.status(500).json({ error: 'No audio content returned' });
    }

    res.json({ audioContent: data.audioContent, encoding: 'mp3' });

  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: 'TTS error: ' + error.message });
  }
}
