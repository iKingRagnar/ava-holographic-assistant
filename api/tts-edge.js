// Edge TTS — Microsoft neural voices, no API key needed
// Uses the same WebSocket protocol as the edge-tts Python package
import { createHash } from 'crypto';

// 10 avatares femeninos — voces jóvenes ~19 años, español latinoamericano
// pitch +8%..+14% = voz femenina joven; rate +5%..+12% = ritmo natural de chica joven
const AVATAR_VOICES = [
  { name: 'es-MX-DaliaNeural',    rate: '+8%',  pitch: '+10%', style: 'cheerful'  }, // AVA   — joven MX cálida
  { name: 'es-CO-SalomeNeural',   rate: '+12%', pitch: '+12%', style: null        }, // KIRA  — enérgica CO joven
  { name: 'es-MX-BeatrizNeural',  rate: '+4%',  pitch: '+8%',  style: null        }, // ZANE  — firme pero joven
  { name: 'es-AR-ElenaNeural',    rate: '+8%',  pitch: '+10%', style: null        }, // FAKER — precisa AR joven
  { name: 'es-PE-CamilaNeural',   rate: '+2%',  pitch: '+12%', style: null        }, // SAO   — elegante PE joven
  { name: 'es-CL-CatalinaNeural', rate: '+14%', pitch: '+10%', style: null        }, // NEON  — rápida CL joven
  { name: 'es-MX-MarinaNeural',   rate: '+6%',  pitch: '+14%', style: null        }, // YUKI  — suave MX joven
  { name: 'es-MX-DaliaNeural',    rate: '+10%', pitch: '+8%',  style: null        }, // REI   — directa MX joven
  { name: 'es-CO-SalomeNeural',   rate: '+0%',  pitch: '+12%', style: null        }, // MIRA  — tranquila CO joven
  { name: 'es-AR-ElenaNeural',    rate: '+10%', pitch: '+11%', style: null        }, // KAI   — carismática AR joven
  { name: 'es-UY-ValentinaNeural', rate: '+6%', pitch: '+3%',  style: null        }, // KAI   — carismática UY
];

function uuid() {
  return createHash('md5').update(Math.random().toString()).digest('hex');
}

function buildSSML(text, voice) {
  const lang = voice.name.substring(0, 5);
  const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>
<voice name='${voice.name}'><prosody rate='${voice.rate}' pitch='${voice.pitch}'>${esc}</prosody></voice></speak>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, avatarIndex = 0 } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const idx = Math.max(0, Math.min(9, parseInt(avatarIndex) || 0));
  const voice = AVATAR_VOICES[idx];
  const clean = text.substring(0, 1000);

  // Attempt 1: edge-tts public synthesis endpoint (same as Python package)
  try {
    const connId = uuid().replace(/-/g,'');
    const ssml = buildSSML(clean, voice);
    const synth = await fetch(
      `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        },
        body: ssml,
      }
    );

    if (synth.ok) {
      const buf = await synth.arrayBuffer();
      if (buf.byteLength > 1000) {
        const b64 = Buffer.from(buf).toString('base64');
        return res.json({ audioContent: b64, encoding: 'mp3', voice: voice.name, source: 'edge-tts' });
      }
    }
    console.warn('Edge TTS response:', synth.status, synth.statusText);
  } catch(e) { console.warn('Edge TTS failed:', e.message); }

  // Attempt 2: Google TTS (free, es-MX accent)
  try {
    const encoded = encodeURIComponent(clean.substring(0, 200));
    const gRes = await fetch(
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=es-MX&client=tw-ob&ttsspeed=0.9`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    );
    if (gRes.ok) {
      const buf = await gRes.arrayBuffer();
      return res.json({ audioContent: Buffer.from(buf).toString('base64'), encoding: 'mp3', voice: 'google-es-MX', source: 'google-tts' });
    }
  } catch(e) { console.warn('Google TTS failed:', e.message); }

  return res.status(502).json({ error: 'Edge TTS and Google TTS both failed' });
}
