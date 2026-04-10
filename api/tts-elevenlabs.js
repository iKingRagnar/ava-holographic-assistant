// ElevenLabs TTS — solo voces femeninas premade (10 perfiles distintos)
// Requires ELEVENLABS_API_KEY in Vercel environment variables

const AVATAR_VOICES = [
  { voiceId: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel',    stability: 0.55, similarity: 0.78, style: 0.3  }, // AVA
  { voiceId: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',      stability: 0.32, similarity: 0.76, style: 0.52 }, // KIRA
  { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',     stability: 0.48, similarity: 0.76, style: 0.42 }, // ZANE
  { voiceId: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', stability: 0.62, similarity: 0.8,  style: 0.22 }, // FAKER
  { voiceId: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli',      stability: 0.52, similarity: 0.77, style: 0.28 }, // SAO
  { voiceId: 'piTKgcLEGmPE4e6mEKli', name: 'Nicole',    stability: 0.38, similarity: 0.74, style: 0.48 }, // NEON
  { voiceId: 'pMsXgVXv3BLzUgSXRplE', name: 'Serena',    stability: 0.72, similarity: 0.82, style: 0.12 }, // YUKI
  { voiceId: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy',   stability: 0.5,  similarity: 0.79, style: 0.32 }, // REI
  { voiceId: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi',      stability: 0.44, similarity: 0.75, style: 0.4  }, // MIRA
  { voiceId: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',      stability: 0.46, similarity: 0.77, style: 0.38 }, // KAI
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(503).json({ error: 'ELEVENLABS_API_KEY not configured' });

  const { text, avatarIndex = 0 } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const idx = Math.max(0, Math.min(9, parseInt(avatarIndex) || 0));
  const v = AVATAR_VOICES[idx];
  const clean = text.substring(0, 500);

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: clean,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: v.stability,
          similarity_boost: v.similarity,
          style: v.style,
          use_speaker_boost: true,
        },
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('ElevenLabs error:', r.status, err);
      return res.status(r.status).json({ error: 'ElevenLabs failed: ' + err });
    }

    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    res.json({ audioContent: b64, encoding: 'mp3', voice: v.name, source: 'elevenlabs' });

  } catch (e) {
    console.error('ElevenLabs exception:', e);
    res.status(500).json({ error: e.message });
  }
}
