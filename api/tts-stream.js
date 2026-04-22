// @ts-check
// tts-stream.js — Streaming TTS usando ElevenLabs WebSocket API
// El cliente hace POST con { text, voiceId } y recibe chunks MP3 via
// Server-Sent Events con base64. Permite empezar a reproducir audio antes
// de que el texto completo llegue del LLM → ahorra 1-2s de latencia percibida.
//
// Uso desde el cliente:
//   const res = await fetch('/api/tts-stream', { method:'POST', body: JSON.stringify({text,voiceId}) });
//   const reader = res.body.getReader();
//   ... concatena chunks y los alimenta al MediaSource / audio tag
//
// Si ELEVENLABS_API_KEY no está presente, responde 501 y el cliente debe
// caer al TTS no-streaming (/api/tts-elevenlabs) o browser speech synthesis.

import { checkRate, clientIp } from './_ratelimit.js';

const VOICE_DEFAULT = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Bella
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5';

/**
 * @param {any} req @param {any} res
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: 'elevenlabs_not_configured' });
  }

  const ip = clientIp(req);
  const rate = await checkRate(`tts:${ip}`, 60, 60_000);
  if (!rate.ok) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited' });
  }

  const { text, voiceId = VOICE_DEFAULT } = req.body || {};
  if (!text || typeof text !== 'string' || text.length === 0) {
    return res.status(400).json({ error: 'text required' });
  }
  if (text.length > 4000) {
    return res.status(400).json({ error: 'text_too_long', max: 4000 });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  let ws = null;
  try {
    const { WebSocket } = await import('ws').catch(() => ({ WebSocket: globalThis.WebSocket }));
    if (!WebSocket) {
      res.write(`data: ${JSON.stringify({ error: 'no_ws_support' })}\n\n`);
      res.end();
      return;
    }

    const url = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${MODEL}&output_format=mp3_44100_128`;
    ws = new WebSocket(url, { headers: { 'xi-api-key': apiKey } });

    const client = res;
    let closed = false;
    client.on('close', () => { closed = true; try { ws?.close(); } catch(_) {} });

    ws.on('open', () => {
      // BOS — configuración inicial
      ws.send(JSON.stringify({
        text: ' ',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
        xi_api_key: apiKey,
      }));
      // Texto real (flush: true para empezar a generar sin esperar más)
      ws.send(JSON.stringify({ text: text + ' ', try_trigger_generation: true }));
      // EOS
      ws.send(JSON.stringify({ text: '' }));
    });

    ws.on('message', (raw) => {
      if (closed) return;
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.audio) {
          client.write(`data: ${JSON.stringify({ audio: msg.audio })}\n\n`);
        }
        if (msg.isFinal) {
          client.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          client.end();
          try { ws.close(); } catch(_) {}
        }
        if (msg.error) {
          client.write(`data: ${JSON.stringify({ error: msg.error })}\n\n`);
          client.end();
          try { ws.close(); } catch(_) {}
        }
      } catch (e) {
        console.warn('[tts-stream] parse error:', e.message);
      }
    });

    ws.on('error', (e) => {
      console.warn('[tts-stream] ws error:', e.message);
      if (!closed) {
        client.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        client.end();
      }
    });

    ws.on('close', () => {
      if (!closed) {
        client.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        client.end();
      }
    });
  } catch (e) {
    console.error('[tts-stream] fatal:', e.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
      res.end();
    }
    try { ws?.close(); } catch(_) {}
  }
}
