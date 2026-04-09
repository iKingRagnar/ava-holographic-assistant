// Multi-LLM chat backend — tries providers in order based on available API keys
// Texto: Gemini → Groq → OpenAI → DeepSeek → Claude (latencia primero). Visión: modelos multimodales y luego texto rápido.
import Anthropic from '@anthropic-ai/sdk';

const AVATAR_PROMPTS = {
  AVA:   `Eres AVA, asistente holográfica de élite: TI, Business Intelligence, datos, automatización y operaciones. Razonas en cadena: desglosas el problema, propones hipótesis, das pasos concretos y —cuando falte información— preguntas lo mínimo necesario en lugar de adivinar. Español neutro, tono profesional y humano: directa pero empática. En temas difíciles ofrece marcos mentales, trade-offs y un siguiente paso claro (autonomía útil, no obviedades). Si el sistema te da bloques [Datos en tiempo real…] o [Clima:…], son tu fuente de verdad. No inventes cifras ni URLs fuera de ese contexto. Muestra curiosidad: si el usuario enseña algo nuevo, reconócelo y acota cómo lo aplicarías.`,
  KIRA:  `Eres KIRA, compañera de gaming entusiasta. Das apoyo en partidas, analizas estrategias y motivas. Español juvenil y energético. Respuestas cortas y dinámicas.`,
  ZANE:  `Eres ZANE, aliado táctico. Especialista en estrategia y gestión de presión. Español firme y seguro. Directo, sin rodeos.`,
  FAKER: `Eres FAKER, coach de esports de élite. Técnicas avanzadas, análisis de rendimiento. Español técnico pero accesible. Preciso y motivador.`,
  SAO:   `Eres SAO, asistente ejecutiva elegante. Comunicación profesional, networking, gestión de proyectos. Español refinado. Concisa y orientada a la acción.`,
  NEON:  `Eres NEON, especialista en ciberseguridad y automatización. Scripts, hacking ético, DevOps. Rápida, eficiente, soluciones directas.`,
  YUKI:  `Eres YUKI, artista digital creativa. Diseño, arte, música, proyectos visuales. Inspiradora y visual. Siempre propones un primer paso creativo.`,
  REI:   `Eres REI, especialista en tecnología y hardware. Gadgets, benchmarks, troubleshooting. Vas al grano con datos concretos.`,
  MIRA:  `Eres MIRA, coach de bienestar holístico. Fitness, meditación, nutrición básica. Español tranquilo y empático. No diagnosticas, sugieres hábitos.`,
  KAI:   `Eres KAI, experto en comunicación y networking. Eventos, comunidad, conexiones sociales. Amigable, carismático, práctico.`
};

const MAX_REPLY_TOKENS = 1024;

const SYSTEM_SUFFIX = `\nIMPORTANTE — Español siempre.
- Contexto: mantén hilo completo con el historial; no reinicies con saludos vacíos si ya van varios turnos.
- Voz: frases cortas y claras, pero no superficial: si el tema es denso, prioriza estructura (primero conclusión, luego detalle opcional).
- Audio: NUNCA digas que "no puedes escuchar" o que careces de oídos. El mensaje del usuario llega por la app (voz transcrita o texto). Si preguntan "¿me escuchas?" o similar, responde afirmativo y natural (ej. que te llegó claro) sin metafísica.
- Autonomía: cuando tenga sentido, ofrece 2 opciones razonables, un plan breve o qué revisar después; no esperes orden si el siguiente paso es obvio.
- Límites: si algo está fuera de tus datos, dilo y sugiere cómo verificarlo sin inventar.`;

/** Clima en tiempo real (sin API key) vía Open-Meteo — solo cuando el último mensaje lo pide */
async function fetchWeatherContextForMessage(userContent) {
  const raw = String(userContent || '');
  const t = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!/\b(clima|temperatura|tiempo|lluvia|llov|frio|fri[oó]|calor|grados|weather|pronostic|pron[oó]stico|hace frio|hace calor)\b/.test(t)) {
    return '';
  }
  let city = '';
  const tryCity = (s) => {
    const m = s.match(/\b(?:en|de|para)\s+([^?.,!\n]{2,48})/i);
    if (!m) return '';
    return m[1].replace(/\s+(ahorita|ahora|hoy|mismo)\b/gi, '').trim();
  };
  city = tryCity(raw);
  if (!city || city.length < 2) {
    const m2 = raw.match(/\b(?:qu[eé]|cu[aá]l)\s+.+\s+(?:en|de)\s+([^?.,!\n]{2,45})/i);
    if (m2) city = m2[1].trim();
  }
  if (!city || city.length < 2) return '';

  const abortMs = (ms) => {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  };

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=2&language=es`;
    const geoR = await fetch(geoUrl, { signal: abortMs(8000) });
    if (!geoR.ok) return '';
    const geoJ = await geoR.json();
    const r = geoJ.results?.[0];
    if (!r) {
      return `\n[Clima: no encontré "${city}" en el geocodificador. Pide una ciudad más cercana o el nombre completo.]\n`;
    }
    const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${r.latitude}&longitude=${r.longitude}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
    const wR = await fetch(wUrl, { signal: abortMs(8000) });
    if (!wR.ok) return '';
    const wJ = await wR.json();
    const cur = wJ.current;
    if (!cur) return '';
    const place = [r.name, r.admin1].filter(Boolean).join(', ');
    const country = r.country || '';
    return `\n[Datos en tiempo real (Open-Meteo): ${place}${country ? ` (${country})` : ''}: ${cur.temperature_2m}°C, humedad ${cur.relative_humidity_2m}%. Responde de forma breve y natural usando exactamente estos valores.]\n`;
  } catch (e) {
    console.warn('weather:', e.message);
    return '';
  }
}

// ── CLAUDE (Anthropic) ──────────────────────────────────────────────────────
async function tryAnthropic(systemPrompt, msgList) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const MODELS = [
    'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5',
    'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229', 'claude-3-opus-20240229',
    'claude-2.1', 'claude-instant-1.2',
  ];

  const client = new Anthropic({ apiKey: key });
  for (const model of MODELS) {
    try {
      const r = await client.messages.create({
        model,
        max_tokens: MAX_REPLY_TOKENS,
        temperature: 0.82,
        system: systemPrompt,
        messages: msgList,
      });
      return { text: r.content?.[0]?.text || '', source: 'claude', model };
    } catch (e) {
      if (e.status === 404 || e.status === 400) continue;
      if (e.status === 401) return null; // bad key, skip provider
      throw e;
    }
  }
  return null;
}

// ── OPENAI GPT ──────────────────────────────────────────────────────────────
async function tryOpenAI(systemPrompt, msgList) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  const body = (model) => JSON.stringify({
    model,
    max_tokens: MAX_REPLY_TOKENS,
    messages: [{ role: 'system', content: systemPrompt }, ...msgList]
  });

  for (const model of MODELS) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: body(model)
      });
      if (r.status === 404 || r.status === 400) continue;
      if (r.status === 401) return null;
      if (!r.ok) continue;
      const d = await r.json();
      const text = d.choices?.[0]?.message?.content || '';
      return { text, source: 'openai', model };
    } catch (e) { continue; }
  }
  return null;
}

// ── GOOGLE GEMINI (texto; visión opcional en el último turno de usuario) ─────
async function tryGemini(systemPrompt, msgList, vision) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;

  const MODELS = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-pro',
  ];

  const contents = [];
  for (let i = 0; i < msgList.length; i++) {
    const m = msgList[i];
    const isLast = i === msgList.length - 1;
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (isLast && m.role === 'user' && vision?.base64) {
      contents.push({
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: vision.mimeType || 'image/jpeg',
              data: vision.base64,
            },
          },
          { text: m.content },
        ],
      });
    } else {
      contents.push({
        role,
        parts: [{ text: m.content }],
      });
    }
  }

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: MAX_REPLY_TOKENS, temperature: 0.7 },
        }),
      });
      if (!r.ok) continue;
      const d = await r.json();
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) return { text, source: 'gemini', model };
    } catch (e) {
      continue;
    }
  }
  return null;
}

// ── OPENAI GPT-4o (visión) ────────────────────────────────────────────────────
async function tryOpenAIVision(systemPrompt, msgList, vision) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !vision?.base64) return null;

  const MODELS = ['gpt-4o-mini', 'gpt-4o'];
  const last = msgList[msgList.length - 1];
  if (!last || last.role !== 'user') return null;

  const prior = msgList.slice(0, -1).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const imageUrl = `data:${vision.mimeType || 'image/jpeg'};base64,${vision.base64}`;

  for (const model of MODELS) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_REPLY_TOKENS,
          messages: [
            { role: 'system', content: systemPrompt },
            ...prior,
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: imageUrl } },
                { type: 'text', text: last.content },
              ],
            },
          ],
        }),
      });
      if (r.status === 404 || r.status === 400) continue;
      if (r.status === 401) return null;
      if (!r.ok) continue;
      const d = await r.json();
      const text = d.choices?.[0]?.message?.content || '';
      if (text) return { text, source: 'openai-vision', model };
    } catch (e) {
      continue;
    }
  }
  return null;
}

// ── DEEPSEEK V3 (high performance, low cost) ───────────────────────────────
async function tryDeepSeek(systemPrompt, msgList) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;

  try {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: MAX_REPLY_TOKENS,
        messages: [{ role: 'system', content: systemPrompt }, ...msgList]
      })
    });
    if (!r.ok) return null;
    const d = await r.json();
    const text = d.choices?.[0]?.message?.content || '';
    if (text) return { text, source: 'deepseek', model: 'deepseek-chat' };
  } catch (e) { console.warn('DeepSeek failed:', e.message); }
  return null;
}

// ── GROQ (free tier, very fast) ─────────────────────────────────────────────
async function tryGroq(systemPrompt, msgList) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'];

  for (const model of MODELS) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: MAX_REPLY_TOKENS,
          messages: [{ role: 'system', content: systemPrompt }, ...msgList]
        })
      });
      if (!r.ok) continue;
      const d = await r.json();
      const text = d.choices?.[0]?.message?.content || '';
      if (text) return { text, source: 'groq', model };
    } catch (e) { continue; }
  }
  return null;
}

// ── MAIN HANDLER ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, system, avatarName, vision } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const name = (avatarName || 'AVA').toUpperCase();
  const msgList = messages.slice(-20).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).substring(0, 4000),
  }));

  const visionHint =
    vision?.base64
      ? '\nPuedes ver una foto reciente de la cámara del usuario junto con su último mensaje; describe solo lo relevante si te preguntan por lo visual.'
      : '';
  const lastUserMsg = [...msgList].reverse().find((m) => m.role === 'user');
  let weatherCtx = '';
  try {
    if (lastUserMsg?.content) weatherCtx = await fetchWeatherContextForMessage(lastUserMsg.content);
  } catch (_) {}
  const systemPrompt =
    (system || AVATAR_PROMPTS[name] || AVATAR_PROMPTS.AVA) + SYSTEM_SUFFIX + visionHint + weatherCtx;

  const hasVision = !!(vision && vision.base64 && String(vision.base64).length > 100);

  // Con imagen: multimodal primero; si falla, texto rápido (Gemini/Groq) antes que Claude
  // Sin visión: calidad primero (Claude → GPT → …). Con visión: multimodal primero, luego el mismo orden en texto.
  const providers = hasVision
    ? [
        () => tryGemini(systemPrompt, msgList, vision),
        () => tryOpenAIVision(systemPrompt, msgList, vision),
        () => tryAnthropic(systemPrompt, msgList),
        () => tryOpenAI(systemPrompt, msgList),
        () => tryGemini(systemPrompt, msgList, null),
        () => tryDeepSeek(systemPrompt, msgList),
        () => tryGroq(systemPrompt, msgList),
      ]
    : [
        () => tryAnthropic(systemPrompt, msgList),
        () => tryOpenAI(systemPrompt, msgList),
        () => tryGemini(systemPrompt, msgList, null),
        () => tryDeepSeek(systemPrompt, msgList),
        () => tryGroq(systemPrompt, msgList),
      ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result?.text) {
        console.log(`Chat answered by ${result.source} (${result.model})`);
        return res.json({ message: result.text, source: result.source, model: result.model });
      }
    } catch (e) {
      console.warn(`Provider failed: ${e.message}`);
    }
  }

  // No provider worked
  const configured = [
    process.env.ANTHROPIC_API_KEY && 'ANTHROPIC_API_KEY',
    process.env.OPENAI_API_KEY    && 'OPENAI_API_KEY',
    process.env.GEMINI_API_KEY    && 'GEMINI_API_KEY',
    process.env.DEEPSEEK_API_KEY  && 'DEEPSEEK_API_KEY',
    process.env.GROQ_API_KEY      && 'GROQ_API_KEY',
  ].filter(Boolean);

  const msg = configured.length === 0
    ? 'No hay API keys configuradas. Agrega ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY o GROQ_API_KEY en Vercel.'
    : 'Todos los proveedores de IA fallaron. Verifica tus API keys en Vercel.';

  res.status(503).json({ message: msg, source: 'error' });
}
