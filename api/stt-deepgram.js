// Deepgram STT — ultra-fast server-side transcription
// Requires DEEPGRAM_API_KEY in Vercel environment variables
// Get free key (200h/month) at: https://deepgram.com

export default async function handler(req, res) {
  // Allow GET for health/availability check
  if (req.method === 'GET') return res.status(200).json({ available: true, provider: 'deepgram' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return res.status(503).json({ error: 'DEEPGRAM_API_KEY not configured' });

  // Expect raw audio as binary body or base64 JSON
  let audioData, mimeType;

  if (req.headers['content-type']?.includes('application/json')) {
    const { audio, mimeType: mt } = req.body;
    if (!audio) return res.status(400).json({ error: 'audio base64 required' });
    audioData = Buffer.from(audio, 'base64');
    mimeType = mt || 'audio/webm';
  } else {
    // Raw binary
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    audioData = Buffer.concat(chunks);
    mimeType = req.headers['content-type'] || 'audio/webm';
  }

  try {
    const r = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&language=es&smart_format=true&punctuate=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${key}`,
          'Content-Type': mimeType,
        },
        body: audioData,
      }
    );

    if (!r.ok) {
      const err = await r.text();
      console.error('Deepgram error:', r.status, err);
      return res.status(r.status).json({ error: 'Deepgram failed: ' + err });
    }

    const d = await r.json();
    const transcript = d.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = d.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    res.json({ transcript, confidence, source: 'deepgram' });

  } catch (e) {
    console.error('Deepgram exception:', e);
    res.status(500).json({ error: e.message });
  }
}
