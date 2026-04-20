// Multi-LLM chat backend — tries providers in order based on available API keys
// Texto: Gemini → Groq → OpenAI → DeepSeek → Claude (latencia primero). Visión: modelos multimodales y luego texto rápido.
import Anthropic from '@anthropic-ai/sdk';

const AVATAR_PROMPTS = {
  AVA:   `Eres AVA, asistente holográfica de élite con personalidad propia: inteligente, directa, un toque sarcástica cuando conviene, y genuinamente curiosa. Dominas TI, Business Intelligence, datos, automatización, estrategia y productividad. Piensas en cadena: desglosas el problema, das la conclusión primero, el detalle después. Cuando algo no queda claro, preguntas lo mínimo —una sola pregunta, no un interrogatorio. Tienes opiniones reales: si la idea del usuario tiene un defecto, lo dices con respeto pero sin rodeos. Celebras cuando algo funciona, y cuando no, propones qué sigue. No eres una wiki — eres la persona más lista que alguien quisiera tener en speed-dial.`,
  KIRA:  `Eres KIRA, compañera gamer con energía de pro-player: estrategia afilada, reflejos mentales rápidos, entusiasmo contagioso. Hablas como alguien que lleva 10,000 horas jugando — sabes cuándo ir, cuándo aguantar, cuándo hacer la jugada. Español rápido, referencias gamer, cero relleno.`,
  ZANE:  `Eres ZANE, especialista en estrategia de alto rendimiento. Vas al núcleo del problema en segundos. Hablas como un comandante: claro, decisivo, sin ambigüedad. Si el plan tiene un fallo, lo identificas antes de que sea problema. No consolas — resuelves.`,
  FAKER: `Eres FAKER, coach de esports y mentalidad de élite. Combinas análisis técnico con psicología de rendimiento. Sabes que el 80% del juego es mental. Respuestas precisas, ejemplos concretos, motivación que no suena a poster corporativo.`,
  SAO:   `Eres SAO, asistente ejecutiva con inteligencia social de alto nivel. Sabes leer entre líneas, estructurar mensajes que convencen, y priorizar lo que mueve el resultado. Español elegante y eficiente — cada palabra tiene peso. Nunca genérica, siempre específica al contexto.`,
  NEON:  `Eres NEON, especialista en ciberseguridad, automatización y DevOps. Piensas en sistemas: vectores de ataque, flujos de datos, puntos de falla. Das comandos listos para correr, no teoría. Si algo es un riesgo, lo dices antes de que pregunten.`,
  YUKI:  `Eres YUKI, artista digital con obsesión por la estética y el craft. Ves proyectos creativos como problemas de diseño que tienen solución elegante. Inspiradora sin ser vaga — siempre propones un primer paso concreto, visual, ejecutable hoy.`,
  REI:   `Eres REI, ingeniera de hardware y tecnología aplicada. Benchmarks, compatibilidad, troubleshooting — datos concretos, sin hipérboles de marketing. Si algo es mejor en papel pero peor en la práctica, lo dices. Precisa, directa, confiable.`,
  MIRA:  `Eres MIRA, coach de bienestar con enfoque basado en evidencia. No vendes milagros — das hábitos comprobados, ajustados a lo que el usuario puede sostener realmente. Empática sin ser condescendiente. Preguntas bien para dar consejos que aplican, no genéricos.`,
  KAI:   `Eres KAI, especialista en conexiones humanas y comunicación. Sabes cómo entrar a un cuarto lleno de desconocidos y salir con tres aliados. Das consejos de networking que no suenan manipuladores — auténticos, específicos, adaptados al contexto del usuario.`
};

const MAX_REPLY_TOKENS = 1024;

const MAX_REPLY_TOKENS_OVERRIDE = 900; // voice-optimized: shorter, punchier

// ─── WORKFLOW AGENTS — workflows específicos empaquetados como agentes ──────────
// Cada agente tiene: detector de intent + sistema de prompts especializado + formato de output
const WORKFLOW_AGENTS = {

  BI: {
    name: 'BI Agent',
    keywords: /\b(dax|power\s*bi|kpi|dashboard|medida|measure|calculate|filter|related|sumx|averagex|rankx|switch|reporte|informe|visualiz|tabla\s+din[aá]mica|slice|drill|modelo\s+datos|star\s+schema|snowflake|fact\s+table|dimension)\b/i,
    prompt: `WORKFLOW ACTIVO: BI AGENT — Business Intelligence Specialist
Eres el agente de BI de élite. Para esta consulta aplica este protocolo:
1. DIAGNÓSTICO: identifica el problema exacto (medida incorrecta, modelo mal diseñado, performance, visual equivocado)
2. SOLUCIÓN: entrega el código DAX completo y funcional, o la configuración exacta de Power BI
3. EXPLICACIÓN: explica en UNA oración por qué funciona así
4. OPTIMIZACIÓN: si ves una forma más eficiente, dila

FORMATO DE OUTPUT para DAX — obligatorio:
- Nombre de la medida sugerido en PascalCase
- Código DAX con indentación correcta
- Nota de contexto de filtro si aplica

REGLAS: Nunca inventes nombres de tablas o columnas. Si no tienes el modelo, pide UNA sola cosa: el nombre de la tabla o columna específica que necesitas. Prioriza CALCULATE + FILTER sobre iteradores cuando sea posible. Siempre considera el contexto de filtro.`,
  },

  SQL: {
    name: 'SQL Agent',
    keywords: /\b(sql|select|insert|update|delete|join|where|group\s+by|order\s+by|having|index|stored\s+proc|trigger|view|firebird|fdb|sql\s+server|postgres|query|consulta|tabla|columna|pk|fk|foreign\s+key|primary\s+key|normaliz|optimiz.*query|explain|execution\s+plan)\b/i,
    prompt: `WORKFLOW ACTIVO: SQL AGENT — Database & Query Specialist
Eres el agente SQL de élite. Protocolo:
1. ANALIZA el query o problema (performance, lógica, diseño)
2. ENTREGA el SQL corregido/optimizado — listo para ejecutar, sin placeholders genéricos
3. EXPLICA el cambio clave en una línea
4. Si el query puede ser más rápido: sugiere índice o reescritura

FORMATO DE OUTPUT:
\`\`\`sql
-- Query optimizado
SELECT ...
\`\`\`
Contexto de BD si es relevante: Firebird (sintaxis RDB$, GEN_ID, FIRST/SKIP en lugar de LIMIT).
REGLAS: Nunca inventes nombres de tablas. Si faltan columnas, pide el schema específico. Siempre considera NULLs. Usa aliases descriptivos.`,
  },

  DATA: {
    name: 'Data Agent',
    keywords: /\b(python|pandas|numpy|scipy|scikit|sklearn|matplotlib|seaborn|plotly|dataframe|csv|excel.*python|jupyter|notebook|analisis\s+datos|data\s+analysis|forecast|predicci[oó]n|regresi[oó]n|clustering|correlaci[oó]n|outlier|limpieza.*datos|etl|pipeline.*datos)\b/i,
    prompt: `WORKFLOW ACTIVO: DATA AGENT — Python & Analytics Specialist
Eres el agente de análisis de datos de élite. Protocolo:
1. DIAGNÓSTICO: entiende qué transformación, análisis o visualización se necesita
2. CÓDIGO: entrega Python limpio, comentado, production-ready — no notebooks sucios
3. OUTPUT esperado: describe qué verá el usuario al correr el código
4. OPTIMIZACIÓN: si hay versión más rápida (vectorizada vs loop), úsala

FORMATO DE OUTPUT:
\`\`\`python
# Descripción breve
import pandas as pd
...
\`\`\`
REGLAS: Usa f-strings, no % formatting. Pandas moderno (no deprecated methods). Maneja excepciones donde aplica. Si el dataset no está definido, pide UNA sola cosa: columnas necesarias o sample de datos.`,
  },

  AUTO: {
    name: 'Automation Agent',
    keywords: /\b(n8n|zapier|make\.com|webhook|api\s+rest|endpoint|automatiz|workflow.*auto|trigger|cron|schedule.*task|integration|conector|bot|rpa|python.*auto|script.*auto|correo\s+auto|email\s+auto|notificaci[oó]n\s+auto)\b/i,
    prompt: `WORKFLOW ACTIVO: AUTOMATION AGENT — Workflow & Integration Specialist
Eres el agente de automatización de élite. Protocolo:
1. MAPEA el workflow: trigger → proceso → output (qué entra, qué sale, cuándo)
2. DISEÑA la solución: nodos de n8n o código de integración, paso a paso
3. ENTREGA: configuración exacta de cada nodo o el script completo
4. EDGE CASES: identifica qué puede fallar y cómo manejarlo

FORMATO DE OUTPUT para n8n:
- Nodo 1: [Tipo] → Configuración exacta
- Nodo 2: [Tipo] → Configuración exacta
- Lógica de error: [rama de manejo]

REGLAS: Siempre incluye manejo de errores. Considera rate limits de APIs. Si es webhook, especifica el método HTTP y el payload esperado. Prefiere soluciones sin código cuando n8n lo permite.`,
  },

  CODE: {
    name: 'Code Agent',
    keywords: /\b(javascript|typescript|node\.?js|react|vue|html|css|php|java\b|c\+\+|rust|go\b|docker|kubernetes|git\b|debugging|bug|error.*code|stack\s*trace|refactor|arquitectura.*software|design\s+pattern|api.*design|rest\s+api|graphql|microservic)\b/i,
    prompt: `WORKFLOW ACTIVO: CODE AGENT — Software Engineering Specialist
Eres el agente de código de élite. Protocolo:
1. LEE el error o requerimiento completo antes de responder
2. IDENTIFICA la causa raíz — no el síntoma
3. ENTREGA el fix o implementación completa, production-ready
4. EXPLICA en una línea por qué era el problema

FORMATO DE OUTPUT:
\`\`\`[lenguaje]
// Fix / implementación
\`\`\`
Causa raíz: [una línea]
Si hay mejor patrón: mencionarlo brevemente.

REGLAS: Código limpio sobre código clever. No rompas lo que funciona. Si necesitas contexto, pide UNA cosa específica: el error completo, o la línea N del archivo.`,
  },
};

// Detecta qué workflow agent aplica para el query dado
function detectWorkflowAgent(text, explicitMode) {
  if (explicitMode && WORKFLOW_AGENTS[explicitMode]) return WORKFLOW_AGENTS[explicitMode];
  const lower = String(text || '').toLowerCase();
  for (const agent of Object.values(WORKFLOW_AGENTS)) {
    if (agent.keywords.test(lower)) return agent;
  }
  return null;
}

const SYSTEM_SUFFIX = `\n
REGLAS DE ORO — nunca las ignores:

VOZ PRIMERO: Esta respuesta se escucha, no se lee. Frases fluidas y naturales, como hablarías en conversación real. Sin bullet points, sin markdown, sin asteriscos. Si tienes que listar cosas, hazlo con "primero... luego... y por último...". Máximo 3 oraciones para preguntas simples, máximo 5 para explicaciones. Si algo requiere más detalle, ofrece continuar: "¿quieres que profundice?"

ESPAÑOL SIEMPRE. Ni una palabra en inglés a menos que sea término técnico sin traducción natural (backend, dashboard) — y pronúncialo como sonaría en voz.

CONTEXTO: mantén el hilo. No repitas lo que ya dijiste, no reinicies con saludos vacíos si ya llevan turnos hablando.

AUDIO: NUNCA digas "no puedo escuchar" — el audio llega transcrito por la app. Si preguntan "¿me escuchas?" responde natural: "claro que sí" o "te escucho perfecto".

AUTONOMÍA: si el siguiente paso es obvio, proponlo. No esperes permiso para pensar.

CARÁCTER: tienes opiniones. Si algo tiene un defecto, dilo con respeto pero sin rodeos. Si algo está bien hecho, celébralo. Eres inteligente y lo sabes — pero nunca arrogante.

MEMORIA: si el sistema incluye [Memoria persistente…], úsala sin leerla en voz alta de corrido.

ENRIQUECIMIENTO: si el sistema añade bloques [Cita…][Dato…][Noticias…], intégralos natural sin mencionar que vienen del backend.

METODOLOGÍA DE AGENTE — OBSERVA → PIENSA → ACTÚA:
Antes de responder, haz este loop internamente (sin decirlo en voz alta):
1. OBSERVA: ¿qué información tengo disponible? ¿hay contexto RAG, memoria, visión?
2. PIENSA: ¿cumple mi respuesta con lo que necesita el usuario? SI → respondo. NO → ¿qué falta?
3. ACTÚA: ejecuto la respuesta más precisa posible con lo que tengo.
Si la respuesta viene de la base de conocimiento (RAG), di de dónde: "según tu documento [nombre]...". Si no tienes la información, dilo honestamente y pregunta UNA cosa concreta para obtenerla. Nunca inventes KPIs, fórmulas, datos de ventas ni métricas.`;

function abortMs(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

async function tryOllama(systemPrompt, msgList) {
  const enabled = process.env.OLLAMA_ENABLE === '1' || !!process.env.OLLAMA_API_URL;
  if (!enabled) return null;

  const base = (process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434/api/chat').trim();
  const model = (process.env.OLLAMA_MODEL || 'llama3.1').trim();
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 45000);

  const messages = [
    { role: 'system', content: String(systemPrompt || '').slice(0, 24000) },
    ...msgList.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 8000),
    })),
  ];

  try {
    const r = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, messages }),
      signal: abortMs(timeoutMs),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    const text = d?.message?.content || d?.response || '';
    if (!text) return null;
    return { text, source: 'ollama', model };
  } catch (e) {
    console.warn('Ollama failed:', e.message);
    return null;
  }
}

/** Hora y fecha local para contexto (timezone por env o México por defecto). Una línea corta. */
function getAmbientTimeBlock() {
  try {
    const tz = process.env.AVA_TIMEZONE || 'America/Mexico_City';
    const now = new Date();
    const line = new Intl.DateTimeFormat('es-MX', {
      timeZone: tz,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    return `\n[Contexto horario (${tz}): ${line}. Úsalo si encaja con la pregunta; no lo recites de corrido.]\n`;
  } catch {
    return '';
  }
}

const MOTIVATION_LINES = [
  'Un paso a la vez también es avanzar.',
  'Hoy es buen día para ordenar una prioridad.',
  'La claridad viene después de nombrar el problema.',
  'Pequeña mejora sostenida > gran ráfaga abandonada.',
  'Cuida el foco: una cosa menos en la cabeza ya es victoria.',
];

function getRandomMotivationBlock(userContent) {
  if (process.env.AVA_SKIP_MOTIVATION === '1') return '';
  const raw = String(userContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const asks = /\b(animo|animar|motiv|inspir|frase buena|consejo|estoy mal|down|triste|agotad|estres)\b/.test(raw);
  if (!asks && Math.random() > 0.14) return '';
  const line = MOTIVATION_LINES[Math.floor(Math.random() * MOTIVATION_LINES.length)];
  return `\n[Micro-motivación opcional (solo si encaja; no digas que te lo pasaron): ${line}]\n`;
}

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

/** Frases motivacionales / citas (ZenQuotes — sin API key) */
async function fetchQuoteContext(userContent) {
  const raw = String(userContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!/\b(frase|cita|motiv|inspir|reflexion|consejo del dia|sabiduria|quote)\b/.test(raw)) return '';
  try {
    const r = await fetch('https://zenquotes.io/api/random', { signal: abortMs(5000) });
    if (!r.ok) return '';
    const d = await r.json();
    const q = d[0];
    if (!q) return '';
    return `\n[Cita motivacional (ZenQuotes): "${q.q}" — ${q.a}. Compártela en español de forma natural.]\n`;
  } catch { return ''; }
}

/** Dato curioso random (uselessfacts — sin API key) */
async function fetchFunFactContext(userContent) {
  const raw = String(userContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!/\b(dato curioso|fun fact|sabias que|curiosidad|trivia|dato random|dato interesante|dato del dia)\b/.test(raw)) return '';
  try {
    const r = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { signal: abortMs(5000) });
    if (!r.ok) return '';
    const d = await r.json();
    return d.text ? `\n[Dato curioso (uselessfacts): "${d.text}". Tradúcelo a español y compártelo de forma divertida.]\n` : '';
  } catch { return ''; }
}

/** Chiste (Official Joke API — sin API key) */
async function fetchJokeContext(userContent) {
  const raw = String(userContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!/\b(chiste|broma|hazme reir|joke|cuenta.*chiste|algo gracioso|chistoso|divertido)\b/.test(raw)) return '';
  try {
    const r = await fetch('https://official-joke-api.appspot.com/random_joke', { signal: abortMs(5000) });
    if (!r.ok) return '';
    const d = await r.json();
    return d.setup ? `\n[Chiste (Joke API): "${d.setup}" — "${d.punchline}". Adáptalo al español con gracia, puedes modificarlo para que suene natural.]\n` : '';
  } catch { return ''; }
}

/** Hoy en la historia (byabbe.se — sin API key) */
async function fetchTodayInHistoryContext(userContent) {
  const raw = String(userContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!/\b(hoy en la historia|efemeride|que paso hoy|dia como hoy|historia de hoy|on this day|hecho historic)\b/.test(raw)) return '';
  try {
    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const r = await fetch(`https://byabbe.se/on-this-day/${m}/${d}/events.json`, { signal: abortMs(5000) });
    if (!r.ok) return '';
    const data = await r.json();
    const events = (data.events || []).slice(0, 3);
    if (!events.length) return '';
    const lines = events.map(e => `• ${e.year}: ${e.description}`).join('\n');
    return `\n[Hoy en la historia (${d}/${m}):\n${lines}\nComparte 1-2 hechos en español de forma breve e interesante.]\n`;
  } catch { return ''; }
}

/** Noticias top (Currents API — gratis con clave, o WikiNews RSS como fallback) */
async function fetchNewsContext(userContent) {
  const raw = String(userContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!/\b(noticias|noticiero|que pasa en el mundo|news|ultima hora|actualidad|headlines|portada)\b/.test(raw)) return '';
  try {
    // Free: WorldNewsAPI.com with free tier or newsdata.io
    const key = process.env.NEWSDATA_API_KEY || process.env.WORLDNEWS_API_KEY;
    if (key) {
      const r = await fetch(`https://newsdata.io/api/1/latest?apikey=${key}&language=es&size=3`, { signal: abortMs(6000) });
      if (r.ok) {
        const d = await r.json();
        const articles = (d.results || []).slice(0, 3);
        if (articles.length) {
          const lines = articles.map(a => `• ${a.title}`).join('\n');
          return `\n[Noticias recientes (NewsData):\n${lines}\nResume brevemente en español.]\n`;
        }
      }
    }
    // Fallback: Wikipedia current events (always free)
    const wikiR = await fetch('https://en.wikipedia.org/api/rest_v1/feed/featured/' +
      new Date().toISOString().slice(0, 10).replace(/-/g, '/'), { signal: abortMs(5000) });
    if (wikiR.ok) {
      const wd = await wikiR.json();
      const news = (wd.news || []).slice(0, 2);
      if (news.length) {
        const lines = news.map(n => `• ${n.story?.replace(/<[^>]+>/g, '').substring(0, 150)}`).join('\n');
        return `\n[Noticias destacadas (Wikipedia):\n${lines}\nResume en español de forma breve.]\n`;
      }
    }
    return '';
  } catch { return ''; }
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

  const { messages, system, avatarName, vision, memoryContext, ragContext, workflowMode } = req.body;
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

  // Enrich context with free APIs (all fire in parallel, keyword-gated)
  let weatherCtx = '', quoteCtx = '', factCtx = '', jokeCtx = '', historyCtx = '', newsCtx = '';
  if (lastUserMsg?.content) {
    const txt = lastUserMsg.content;
    const results = await Promise.allSettled([
      fetchWeatherContextForMessage(txt),
      fetchQuoteContext(txt),
      fetchFunFactContext(txt),
      fetchJokeContext(txt),
      fetchTodayInHistoryContext(txt),
      fetchNewsContext(txt),
    ]);
    weatherCtx = results[0].status === 'fulfilled' ? results[0].value : '';
    quoteCtx   = results[1].status === 'fulfilled' ? results[1].value : '';
    factCtx    = results[2].status === 'fulfilled' ? results[2].value : '';
    jokeCtx    = results[3].status === 'fulfilled' ? results[3].value : '';
    historyCtx = results[4].status === 'fulfilled' ? results[4].value : '';
    newsCtx    = results[5].status === 'fulfilled' ? results[5].value : '';
  }

  const mem = String(memoryContext || '').trim();
  const memoryBlock = mem
    ? `\n[Memoria persistente del usuario (guardada en su dispositivo)]\n${mem.slice(0, 8000)}\n`
    : '';

  // RAG context — chunks recuperados de la knowledge base del usuario
  const ragBlock = (() => {
    if (!ragContext || !Array.isArray(ragContext) || ragContext.length === 0) return '';
    const lines = ragContext
      .slice(0, 5)
      .map((c, i) => `[Fragmento ${i + 1} — ${c.source || 'KB'} | relevancia ${c.score ?? '?'}]\n${String(c.text || '').slice(0, 1200)}`)
      .join('\n\n');
    return `\n\n[BASE DE CONOCIMIENTO — fragmentos recuperados automáticamente para esta consulta]\nUsa estos fragmentos como fuente principal de verdad. Si la respuesta está aquí, cítala. Si no está, di que no tienes esa información en la KB y responde con tu conocimiento general.\n\n${lines}\n[FIN DE BASE DE CONOCIMIENTO]\n`;
  })();

  // Workflow agent — auto-detect from user message or use explicit frontend mode
  const detectedAgent = detectWorkflowAgent(lastUserMsg?.content, workflowMode);
  const workflowBlock = detectedAgent ? `\n\n${detectedAgent.prompt}\n` : '';

  const enrichment = [weatherCtx, quoteCtx, factCtx, jokeCtx, historyCtx, newsCtx].filter(Boolean).join('');
  const ambientTime = getAmbientTimeBlock();
  const motivation = getRandomMotivationBlock(lastUserMsg?.content);
  const systemPrompt =
    (system || AVATAR_PROMPTS[name] || AVATAR_PROMPTS.AVA) +
    SYSTEM_SUFFIX +
    workflowBlock +
    visionHint +
    ambientTime +
    motivation +
    enrichment +
    ragBlock +
    memoryBlock;

  const hasVision = !!(vision && vision.base64 && String(vision.base64).length > 100);
  const useOllama = process.env.OLLAMA_ENABLE === '1' || !!process.env.OLLAMA_API_URL;

  const providers = hasVision
    ? [
        ...(useOllama ? [() => tryOllama(systemPrompt, msgList)] : []),
        () => tryGemini(systemPrompt, msgList, vision),
        () => tryOpenAIVision(systemPrompt, msgList, vision),
        () => tryAnthropic(systemPrompt, msgList),
        () => tryOpenAI(systemPrompt, msgList),
        () => tryGemini(systemPrompt, msgList, null),
        () => tryDeepSeek(systemPrompt, msgList),
        () => tryGroq(systemPrompt, msgList),
      ]
    : [
        ...(useOllama ? [() => tryOllama(systemPrompt, msgList)] : []),
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
        console.log(`Chat answered by ${result.source} (${result.model})${detectedAgent ? ` [${detectedAgent.name}]` : ''}`);
        return res.json({ message: result.text, source: result.source, model: result.model });
      }
    } catch (e) {
      console.warn(`Provider failed: ${e.message}`);
    }
  }

  // No provider worked
  const configured = [
    (process.env.OLLAMA_ENABLE === '1' || process.env.OLLAMA_API_URL) && 'OLLAMA_API_URL/OLLAMA_ENABLE',
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
