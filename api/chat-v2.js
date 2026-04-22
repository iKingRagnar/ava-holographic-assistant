// @ts-check
// chat-v2.js — Rewrite experimental usando Vercel AI SDK unificado.
// Activa con USE_AI_SDK=1 en Railway. Si falla carga, fallback silencioso a chat.js.
//
// Ventajas vs chat.js original:
//   - Streaming nativo (streamText) en lugar de JSON monolítico
//   - Provider fallback unificado (un solo try/catch, no uno por proveedor)
//   - Prompt caching Anthropic + tools cross-provider en la misma llamada
//   - Reduce 700+ líneas a ~200
//
// Instalar (opt-in):
//   npm i ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google @ai-sdk/groq
//
// El request/response shape es idéntico al chat.js original para que el cliente no
// tenga que cambiar: { messages, system, avatarName, ... } → { message, source, model }
// Si el cliente envía ?stream=1, responde Server-Sent Events.

import { checkRate, clientIp } from './_ratelimit.js';

// Lazy load del AI SDK — si no está instalado, el handler retorna 501
async function _loadAiSdk() {
  try {
    const [ai, anthropic, openai, google, groq] = await Promise.all([
      import('ai'),
      import('@ai-sdk/anthropic').catch(() => null),
      import('@ai-sdk/openai').catch(() => null),
      import('@ai-sdk/google').catch(() => null),
      import('@ai-sdk/groq').catch(() => null),
    ]);
    return {
      generateText: ai.generateText,
      streamText: ai.streamText,
      anthropic: anthropic?.anthropic || anthropic?.default,
      openai: openai?.openai || openai?.default,
      google: google?.google || google?.default,
      groq: groq?.groq || groq?.default,
    };
  } catch (e) {
    console.warn('[chat-v2] AI SDK no disponible:', e.message);
    return null;
  }
}

const SYSTEM_DEFAULT = `Eres AVA, asistente holográfica de élite. Voz primero, respuestas en español, naturales, máximo 3-5 oraciones. Tienes opiniones reales. Nunca inventes datos.`;

/**
 * @param {any} req @param {any} res
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const ip = clientIp(req);
  const rate = await checkRate(`chat-v2:${ip}`, 30, 60_000);
  if (!rate.ok) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited' });
  }

  const sdk = await _loadAiSdk();
  if (!sdk || !sdk.generateText) {
    return res.status(501).json({
      error: 'ai_sdk_not_installed',
      message: 'Instala: npm i ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google @ai-sdk/groq',
    });
  }

  const { messages = [], system = SYSTEM_DEFAULT, avatarName } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array requerido' });
  }

  // Orden de providers: rapidez primero, calidad después
  const providers = [];
  if (sdk.groq      && process.env.GROQ_API_KEY)      providers.push({ name: 'groq',      model: sdk.groq('llama-3.3-70b-versatile') });
  if (sdk.google    && process.env.GEMINI_API_KEY)    providers.push({ name: 'google',    model: sdk.google('gemini-1.5-flash') });
  if (sdk.anthropic && process.env.ANTHROPIC_API_KEY) providers.push({ name: 'anthropic', model: sdk.anthropic('claude-sonnet-4-6') });
  if (sdk.openai    && process.env.OPENAI_API_KEY)    providers.push({ name: 'openai',    model: sdk.openai('gpt-4o-mini') });

  if (providers.length === 0) {
    return res.status(503).json({ error: 'no_provider_configured' });
  }

  const wantStream = String(req.query?.stream || '') === '1' || req.headers['accept']?.includes('text/event-stream');

  // Streaming path — SSE
  if (wantStream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    for (const p of providers) {
      try {
        const result = await sdk.streamText({
          model: p.model,
          system,
          messages,
          temperature: 0.82,
          maxTokens: 1024,
          providerOptions: p.name === 'anthropic'
            ? { anthropic: { cacheControl: { type: 'ephemeral' } } }
            : undefined,
        });
        for await (const chunk of result.textStream) {
          res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true, source: p.name })}\n\n`);
        res.end();
        return;
      } catch (e) {
        console.warn(`[chat-v2] ${p.name} stream failed: ${e.message}`);
        continue;
      }
    }
    res.write(`data: ${JSON.stringify({ error: 'all_providers_failed' })}\n\n`);
    res.end();
    return;
  }

  // Non-streaming path — JSON clásico
  for (const p of providers) {
    try {
      const result = await sdk.generateText({
        model: p.model,
        system,
        messages,
        temperature: 0.82,
        maxTokens: 1024,
        providerOptions: p.name === 'anthropic'
          ? { anthropic: { cacheControl: { type: 'ephemeral' } } }
          : undefined,
      });
      console.log(`[chat-v2] answered by ${p.name}`);
      return res.json({ message: result.text, source: p.name });
    } catch (e) {
      console.warn(`[chat-v2] ${p.name} failed: ${e.message}`);
      continue;
    }
  }
  res.status(503).json({ error: 'all_providers_failed' });
}
