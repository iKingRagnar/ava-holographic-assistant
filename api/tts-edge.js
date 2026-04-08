// Edge TTS - Microsoft Azure Cognitive Services (gratis, sin API key necesaria para uso básico)
// Voz: es-ES-ElviraNeural (femenina española) o es-MX-DaliaNeural

const EDGE_TTS_VOICES = {
  'es-ES': 'es-ES-ElviraNeural',
  'es-MX': 'es-MX-DaliaNeural',
  'en-US': 'en-US-JennyNeural'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voice = 'es-MX' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }

  try {
    const voiceName = EDGE_TTS_VOICES[voice] || EDGE_TTS_VOICES['es-MX'];
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice === 'es-ES' ? 'es-ES' : 'es-MX'}">
        <voice name="${voiceName}">
          <prosody rate="+10%" pitch="+5%">
            ${text.replace(/[<>]/g, '')}
          </prosody>
        </voice>
      </speak>
    `;

    // Microsoft Edge TTS endpoint (público, sin auth)
    const response = await fetch('https://speech.platform.bing.com/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: ssml
    });

    if (!response.ok) {
      // Fallback a Inworld TTS si Edge falla
      console.log('Edge TTS failed, trying Inworld fallback');
      return res.status(502).json({ error: 'Edge TTS unavailable, use /api/tts' });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    res.json({
      audioContent: base64Audio,
      encoding: 'mp3',
      voice: voiceName,
      source: 'edge-tts'
    });

  } catch (error) {
    console.error('Edge TTS error:', error);
    res.status(500).json({ error: 'TTS error: ' + error.message });
  }
}
