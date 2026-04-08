const INWORLD_KEY = process.env.INWORLD_API_KEY || 'dGtzMFA0aEU5bWp5ZTlObWJKT25YT1g0NU9WYVdWcXQ6MnpxakR3aGtackI2MWtsZ3NmQkNIQVpzOEVSOTlnMkdsR2xYa2k4YzhsRTlyNlB6eVZ3c3dId1RxcmZnaE0xTA==';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
