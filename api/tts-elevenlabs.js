// ElevenLabs TTS — most human-sounding voices available
// Requires ELEVENLABS_API_KEY in Vercel environment variables
// Get free key at: https://elevenlabs.io (10k chars/month free)

// Per-avatar voice IDs — ElevenLabs multilingual v2 female voices
// These are public voice IDs that work with any account
const AVATAR_VOICES = [
  { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',    stability: 0.5, similarity: 0.75, style: 0.3  }, // AVA   — warm, professional
  { voiceId: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',     stability: 0.3, similarity: 0.75, style: 0.5  }, // KIRA  — energetic
  { voiceId: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli',     stability: 0.6, similarity: 0.8,  style: 0.2  }, // ZANE  — firm
  { voiceId: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh',     stability: 0.5, similarity: 0.75, style: 0.35 }, // FAKER — precise
  { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',    stability: 0.7, similarity: 0.8,  style: 0.15 }, // SAO   — elegant
  { voiceId: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',     stability: 0.25,similarity: 0.75, style: 0.6  }, // NEON  — fast
  { voiceId: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli',     stability: 0.45,similarity: 0.75, style: 0.45 }, // YUKI  — creative
  { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',    stability: 0.6, similarity: 0.8,  style: 0.2  }, // REI   — technical
  { voiceId: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli',     stability: 0.75,similarity: 0.8,  style: 0.1  }, // MIRA  — calm
  { voiceId: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',     stability: 0.35,similarity: 0.75, style: 0.55 }, // KAI   — charismatic
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
