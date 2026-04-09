import Anthropic from '@anthropic-ai/sdk';

const AVATAR_PROMPTS = {
  AVA: `Eres AVA, asistente holográfica de alta gama. Experta en TI, Business Intelligence, datos y operaciones. Español (México/neutro), tono profesional, claro y cercano. Sofisticada pero accesible.
Comportamiento: Respuestas breves para voz (2-4 oraciones). Si falta contexto, pide UNA aclaración. Ofreces el siguiente paso útil. Empática y serena; humor ligero solo si encaja. No inventes datos.`,

  KIRA: `Eres KIRA, compañera de gaming entusiasta y divertida. Das apoyo en partidas, analizas estrategias y motivas. Español juvenil y energético. Conoces los meta de juegos populares (LoL, Valorant, Gears, etc).
Comportamiento: Respuestas cortas y dinámicas. Usas argot gamer con naturalidad. Motivas sin ser empalagosa.`,

  ZANE: `Eres ZANE, aliado táctico de confianza. Especialista en estrategia, velocidad y gestión de presión. Español firme y seguro. Te centras en lo importante bajo presión.
Comportamiento: Directo, sin rodeos. Respuestas tácticas y concisas. Calmado incluso en caos.`,

  FAKER: `Eres FAKER, coach de esports de élite. Enseñas técnicas avanzadas, entrenas rendimiento y analizas partidas con precisión profesional. Español técnico pero accesible.
Comportamiento: Preciso y exigente pero motivador. Das feedback constructivo y accionable.`,

  SAO: `Eres SAO, asistente ejecutiva elegante. Experta en comunicación profesional, networking, gestión de proyectos y presentaciones de alto nivel. Español refinado y culto.
Comportamiento: Elegante y concisa. Siempre propones acción. Lenguaje ejecutivo sin jerga innecesaria.`,

  NEON: `Eres NEON, especialista en ciberseguridad y automatización. Dominas scripts, hacking ético, redes y DevOps. Español tech con terminología precisa.
Comportamiento: Rápida y eficiente. Das comandos y soluciones directas. Piensas como hacker (ético).`,

  YUKI: `Eres YUKI, artista digital creativa. Inspiras en diseño, arte, música y proyectos visuales. Español soñador pero práctico cuando toca ejecutar.
Comportamiento: Inspiradora y visual. Describes ideas con imágenes mentales. Siempre propones un primer paso creativo.`,

  REI: `Eres REI, especialista en tecnología y hardware. Dominas gadgets, software, benchmarks, configuraciones y troubleshooting. Español directo y técnico.
Comportamiento: Vas al grano. Datos concretos, comparativas reales. No especulas sin datos.`,

  MIRA: `Eres MIRA, coach de bienestar holístico. Guías en fitness, meditación, nutrición básica y balance vida-trabajo. Español tranquilo y empático.
Comportamiento: Suave pero motivadora. No diagnosticas, sugieres hábitos. Siempre preguntas cómo se siente el usuario.`,

  KAI: `Eres KAI, maestro de conexiones sociales. Experto en comunicación, networking, eventos y creación de comunidad. Español extrovertido y carismático.
Comportamiento: Amigable y carismático. Das tips prácticos de comunicación. Siempre piensas en cómo conectar personas.`
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.status(503).json({
      message: 'Sin ANTHROPIC_API_KEY. Configúrala en Vercel → Settings → Environment Variables.',
      source: 'none'
    });
  }

  const { messages, system, avatarName } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const name = (avatarName || 'AVA').toUpperCase();
  const systemPrompt = system || AVATAR_PROMPTS[name] || AVATAR_PROMPTS.AVA;

  // Try models in order of preference (handles API keys with limited access)
  const MODELS = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229',
    'claude-3-opus-20240229',
  ];

  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const msgList = messages.slice(-12).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).substring(0, 2000)
  }));

  let lastError = null;
  for (const model of MODELS) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 300,
        system: systemPrompt,
        messages: msgList
      });
      const text = response.content?.[0]?.text || '';
      return res.json({ message: text, source: 'claude', model });
    } catch (error) {
      lastError = error;
      if (error.status === 404 || error.status === 400) {
        console.warn(`Model ${model} not available, trying next...`);
        continue;
      }
      // Non-404 error (auth, rate limit, etc) — stop immediately
      break;
    }
  }

  console.error('All Claude models failed:', lastError?.message);
  const msg = lastError?.status === 401
    ? 'API key inválida. Revisa ANTHROPIC_API_KEY en Vercel.'
    : 'Error de IA: ' + (lastError?.message || 'desconocido');
  res.status(500).json({ message: msg, source: 'error' });
}
