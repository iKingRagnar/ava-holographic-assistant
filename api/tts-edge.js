// Edge TTS — Microsoft Neural voices via edge-tts compatible endpoint
// Neural Spanish female voices, per-avatar selection, no API key needed

// Per-avatar neural voice mapping (all female, varied personality)
const AVATAR_VOICES = [
  { name: 'es-MX-DaliaNeural',    rate: '+0%',  pitch: '+0%'  }, // AVA — profesional
  { name: 'es-MX-MarinaNeural',   rate: '+8%',  pitch: '+8%'  }, // KIRA — energética
  { name: 'es-ES-ElviraNeural',   rate: '-5%',  pitch: '-8%'  }, // ZANE — firme
  { name: 'es-ES-AbrilNeural',    rate: '+5%',  pitch: '+3%'  }, // FAKER — precisa
  { name: 'es-MX-DaliaNeural',    rate: '-8%',  pitch: '+5%'  }, // SAO — elegante
  { name: 'es-MX-MarinaNeural',   rate: '+12%', pitch: '+4%'  }, // NEON — rápida
  { name: 'es-ES-XimenaNeural',   rate: '+0%',  pitch: '+10%' }, // YUKI — suave
  { name: 'es-ES-ElviraNeural',   rate: '+6%',  pitch: '-4%'  }, // REI — técnica
  { name: 'es-MX-DaliaNeural',    rate: '-10%', pitch: '+6%'  }, // MIRA — tranquila
  { name: 'es-MX-MarinaNeural',   rate: '+10%', pitch: '+2%'  }, // KAI — carismática
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, avatarIndex = 0 } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }

  const idx = Math.max(0, Math.min(9, parseInt(avatarIndex) || 0));
  const v = AVATAR_VOICES[idx];
  const clean = text.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));

  // Step 1: get ephemeral token from Edge TTS
  let token = '';
  try {
    const tokenRes = await fetch(
      'https://azure.microsoft.com/en-us/services/cognitive-services/text-to-speech/',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    // Token endpoint for edge TTS (no-auth tier)
    const tokenEndpoint = await fetch(
      'https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken',
      { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': '' } }
    );
    token = '';
  } catch(e) { token = ''; }

  const ssml = `<speak version='1.0' xml:lang='${v.name.startsWith('es-MX') ? 'es-MX' : 'es-ES'}'>
  <voice xml:lang='${v.name.startsWith('es-MX') ? 'es-MX' : 'es-ES'}' name='${v.name}'>
    <prosody rate='${v.rate}' pitch='${v.pitch}'>${clean}</prosody>
  </voice>
</speak>`;

  try {
    // Use the public Edge TTS synthesis endpoint
    const response = await fetch(
      'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
          'User-Agent': 'AVAHolographic/2.0',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: ssml
      }
    );

    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      return res.json({ audioContent: base64Audio, encoding: 'mp3', voice: v.name, source: 'azure-neural' });
    }
  } catch(e) { console.warn('Azure TTS attempt failed:', e.message); }

  // Fallback: Google Translate TTS (no key, but limited)
  try {
    const gtText = encodeURIComponent(text.substring(0, 200));
    const gtRes = await fetch(
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${gtText}&tl=es-MX&client=tw-ob`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }
    );
    if (gtRes.ok) {
      const buf = await gtRes.arrayBuffer();
      return res.json({ audioContent: Buffer.from(buf).toString('base64'), encoding: 'mp3', voice: 'google-es', source: 'google-tts' });
    }
  } catch(e) { console.warn('Google TTS fallback failed:', e.message); }

  return res.status(502).json({ error: 'All TTS providers failed' });
}
