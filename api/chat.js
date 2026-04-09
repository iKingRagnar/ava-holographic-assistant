// Multi-LLM chat backend — tries providers in order based on available API keys
// Priority: Claude → OpenAI → Gemini → Groq (free/fast)
import Anthropic from '@anthropic-ai/sdk';

const AVATAR_PROMPTS = {
  AVA:   `Eres AVA, asistente holográfica de alta gama. Experta en TI, Business Intelligence, datos y operaciones. Español neutro, tono profesional, claro y cercano. Sofisticada pero accesible. Respuestas breves para voz (2-4 oraciones). No inventes datos.`,
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

const SYSTEM_SUFFIX = '\nIMPORTANTE: Responde siempre en español. Máximo 3 oraciones cortas, optimizado para voz.';

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
      const r = await client.messages.create({ model, max_tokens: 300, system: systemPrompt, messages: msgList });
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
    max_tokens: 300,
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
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
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
          max_tokens: 300,
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
        max_tokens: 300,
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
          max_tokens: 300,
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
  const visionHint =
    vision?.base64
      ? '\nPuedes ver una foto reciente de la cámara del usuario junto con su último mensaje; describe solo lo relevante si te preguntan por lo visual.'
      : '';
  const systemPrompt =
    (system || AVATAR_PROMPTS[name] || AVATAR_PROMPTS.AVA) + SYSTEM_SUFFIX + visionHint;
  const msgList = messages.slice(-12).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).substring(0, 2000),
  }));

  const hasVision = !!(vision && vision.base64 && String(vision.base64).length > 100);

  // Con imagen: primero modelos multimodales, luego el resto sin imagen
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
