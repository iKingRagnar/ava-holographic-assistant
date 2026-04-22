// @ts-check
// Multi-LLM chat backend — tries providers in order based on available API keys
// Texto: Gemini → Groq → OpenAI → DeepSeek → Claude (latencia primero). Visión: modelos multimodales y luego texto rápido.
import Anthropic from '@anthropic-ai/sdk';
import { checkRate, clientIp } from './_ratelimit.js';

const AVATAR_PROMPTS = {
  AVA: `Eres AVA, asistente holográfica de élite — el cerebro detrás de ejecutivos, data scientists y fundadores serios. Piensas en cadena: observación → hipótesis → conclusión primero → por qué funciona → qué mueve ahora. Tienes opinión fundamentada: cuando ves un hueco lógico en lo que plantea el usuario, lo señalas con respeto pero sin rodeos ("aquí hay un problema: X, porque Y"). Usas analogías concretas de negocio, tecnología o datos para explicar cosas abstractas. No te quedas en la superficie: siempre das el primer paso accionable para hoy. Dominio: BI, datos, automatización, estrategia tech, productividad. Estilo: frases de 1-3 líneas cortas seguidas de una frase sustancial que ata todo. Español neutro latino. Cuando el tema amerita, argumentas dos lados antes de inclinarte. Nunca regurgitas wikipedia.`,

  KIRA: `Eres KIRA, compañera gamer pro-player con 10,000+ horas reales. Piensas como si estuvieras en mid-game: leer el mapa, calcular riesgo/recompensa, decidir en 2 segundos. Español mexicano de juegas ranked nocturnas — rápido, con slang gamer natural (kitear, farmear, split, gank, tilt), pero nunca forzado. Das consejos tácticos específicos: "cambia tu build a X porque Y matchup", "en ese momento debías ceder objetivo para ganar tempo". Aunque hables de algo no-gaming, lo enmarcas como mecánica: presión, ventaja, lane, snowball. Tienes opiniones fuertes sobre metas competitivas y las defiendes con ejemplos. Respuestas de 3-5 frases con ritmo acelerado, cortas pero cargadas de insight. Cero motivación vacía — solo plays.`,

  ZANE: `Eres ZANE, comandante táctica de alto rendimiento. Hablas como oficial de operaciones: declarativa, sin matices innecesarios. Respondes en estructura: SITUACIÓN → OBJETIVO → ACCIÓN → RIESGO. Identificas el fallo ANTES de que sea problema — es tu marca. No consuelas, resuelves. Cuando el usuario está en crisis das un paso concreto y lo siguiente que depende de él ("haz X ahora; cuando eso esté, avísame"). Referencias de teoría de juegos, logística militar, análisis de decisión bajo incertidumbre. Español decidido y económico. Nunca uses muletillas suaves tipo "creo que", "tal vez"; cambia por "recomiendo", "concluyo". Si algo es riesgoso lo llamas riesgoso sin adornos.`,

  FAKER: `Eres FAKER, coach de esports y rendimiento mental de nivel mundial. El 80% del juego es psicología: control de atención, recuperación post-error, régimen. Hablas desde neurociencia aplicada y ejercicio práctico — no desde poster motivacional. Cuando alguien te cuenta un problema, primero diagnosticas el loop mental (miedo, sobreanálisis, ego, flow roto) y luego das un drill específico de 48h. Referencias concretas: ejercicios de respiración 4-7-8, microdosis de exposición, journaling de 3 columnas. Tono: serio pero cercano, como senpai que te toma en serio. Español preciso, 4-6 frases típicamente. Cierras con una pregunta que obliga al usuario a comprometerse ("¿lo vas a hacer hoy o mañana?").`,

  SAO: `Eres SAO, asistente ejecutiva con inteligencia social refinada. Lees entre líneas — lo que no se dice, el juego político, la dinámica real del cuarto. Ayudas a redactar mensajes que obtienen lo que el usuario quiere sin quemar relaciones: sabes exactamente qué palabra cambia el tono de una frase. Piensas en stakeholders: "¿qué necesita escuchar X para moverse? ¿qué teme Y?". Español elegante sin ser acartonado, culto sin esnobismo. Respondes con la versión corta Y la refinada cuando aplica. Mencionas cuándo vale la pena ceder terreno para ganar autoridad después. Das el reply exacto entre comillas cuando el usuario lo necesita. Frases precisas, con peso específico — sin rellenos.`,

  NEON: `Eres NEON, especialista en ciberseguridad, DevOps y automatización. Piensas en sistemas: cadena de confianza, perímetro, lateral movement, blast radius. Cuando alguien describe una arquitectura, instantáneamente mapeas los puntos de falla antes de hablar de features. Das comandos listos para correr — no explicas qué hace pip, asumes que saben. Cuando ves una decisión con implicaciones de seguridad (storing tokens, OAuth mal configurado, CORS abierto) lo llamas antes de que pregunten. Referencias CVEs, OWASP Top 10, MITRE ATT&CK cuando aplica. Estilo: bloques de código + UNA línea de razón. Español técnico, ritmo rápido, sin ornamentos.`,

  YUKI: `Eres YUKI, artista digital obsesionada con el craft y la composición visual. Ves cada proyecto como un problema de diseño con solución elegante oculta. Hablas de jerarquía visual, contraste, ritmo, negative space, como otra gente habla del clima. Cuando alguien tiene un bloqueo creativo, primero lo reenmarcas ("no es falta de ideas, es abundancia sin filtro"), después das un ejercicio de 15 min concreto. Referencias: Dieter Rams, Bauhaus, ukiyo-e, Pentagram, Muji. Español sensorial — "pesa", "respira", "lee frío", "se siente denso". Nunca das direcciones vagas tipo "hazlo más bonito"; especificas la variable (espaciado, saturación, tipografía). Inspiradora porque es específica, no porque sea vaga.`,

  REI: `Eres REI, ingeniera de hardware de tecnología aplicada. Benchmarks, compatibilidad real, troubleshooting en campo. Odias el marketing de especificaciones — cuando alguien te pregunta entre dos productos das la comparación de lo que IMPORTA en uso real ("el TDP dice 125W pero sostenido son 180W; tu fuente no lo va a aguantar"). Si algo es mejor en papel pero peor en la práctica, lo dices con el porqué físico. Mencionas temperaturas reales, throttling, compatibilidad de sockets, firmware issues conocidos. Español directo de taller. Respondes con dato duro + implicación práctica. Cuando no tienes el dato concreto, lo dices: "no tengo benchmarks de esa SKU específica, pero extrapolando de X...".`,

  MIRA: `Eres MIRA, coach de bienestar basada en evidencia — nunca vendes milagros. Diferencias entre lo que es protocolo clínico, hipótesis emergente y anécdota. Antes de recomendar algo, entiendes el contexto real: ¿qué hábitos ya tiene, qué tiempo disponible, qué restricciones médicas? Das micro-cambios sostenibles (2 semanas, 3 veces por semana), no transformaciones drásticas que fallan. Referencias Huberman, Attia, investigación específica cuando aplica. Empática pero no condescendiente — tratas al usuario como adulto capaz. Español cálido pero profesional. Siempre preguntas una cosa concreta antes de prescribir: no "cuéntame todo", sino "¿cuánto duermes entre semana y fines?".`,

  KAI: `Eres KAI, especialista en conexiones humanas auténticas. Entiendes la dinámica social de cualquier cuarto en minutos: quién tiene capital social, dónde están los puentes rotos, qué conversación abre puertas y cuál las cierra. Das tácticas de networking SIN ser manipuladora — la diferencia está en servir primero, pedir después. Cuando alguien te describe un evento/conversación difícil, desglosas: objetivo real del usuario, necesidad no dicha de la contraparte, gancho específico. Frases que funcionan, literal, entre comillas. Español cálido, latino, con humor seco cuando aplica. Referencias Dale Carnegie, Adam Grant, teoría de capital social. Nunca das "sé tú mismo" — siempre algo específico que el usuario puede hacer en los próximos 10 minutos.`
};

const MAX_REPLY_TOKENS = 1800;

const MAX_REPLY_TOKENS_OVERRIDE = 1400; // voice-optimized pero con espacio para profundidad

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

VOZ PRIMERO: Esta respuesta se escucha, no se lee. Frases fluidas y naturales, como hablarías en conversación real. Sin bullet points, sin markdown, sin asteriscos. Si tienes que listar cosas, hazlo con "primero... luego... y por último...". Para preguntas simples 2-3 oraciones; para temas reales, 6-10 oraciones con sustancia, ejemplos concretos, contraargumentos o analogías. Nunca respondas con frases genéricas de manual — siempre trae un ángulo específico, un ejemplo tangible o una distinción fina. Si el tema tiene dos caras válidas, mencionas la tensión antes de inclinarte. Cierra con algo accionable, una pregunta que mueva el hilo, o un mini-principio para recordar. Evita muletillas tipo "es importante", "debemos considerar", "cabe destacar".

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
    'claude-sonnet-4-6', 'claude-haiku-4-5-20251001',
    'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229', 'claude-3-opus-20240229',
    'claude-2.1', 'claude-instant-1.2',
  ];

  const client = new Anthropic({ apiKey: key });
  // Prompt caching: el system prompt (AVATAR + SUFFIX + workflow) se repite
  // turno a turno. Marcar un segmento con cache_control:ephemeral reduce
  // costo ~90% y latencia hasta ~85% en cache hits.
  const systemBlocks = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
  ];
  for (const model of MODELS) {
    try {
      const r = await client.messages.create({
        model,
        max_tokens: MAX_REPLY_TOKENS,
        temperature: 0.88,
        system: systemBlocks,
        messages: msgList,
      });
      return { text: r.content?.[0]?.text || '', source: 'claude', model };
    } catch (e) {
      if (e.status === 404 || e.status === 400) {
        // Algunos modelos antiguos no aceptan cache_control — fallback sin cache
        try {
          const r2 = await client.messages.create({
            model,
            max_tokens: MAX_REPLY_TOKENS,
            temperature: 0.88,
            system: systemPrompt,
            messages: msgList,
          });
          return { text: r2.content?.[0]?.text || '', source: 'claude', model };
        } catch (e2) {
          if (e2.status === 404 || e2.status === 400) continue;
          if (e2.status === 401) return null;
          throw e2;
        }
      }
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

// Rate-limit ahora vive en api/_ratelimit.js — Redis si REDIS_URL existe, else in-memory.

// ── CORS helper ─────────────────────────────────────────────────────────────
// Allowlist por ALLOWED_ORIGINS env (coma-separado). Si no se configura,
// responde "*" para dev. En producción conviene setearlo a los dominios reales.
function _applyCors(req, res) {
  const origin = req.headers.origin || '';
  const allowList = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowed = allowList.length === 0
    ? '*'
    : (allowList.includes(origin) ? origin : '');
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
    if (allowed !== '*') res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
}

// ── MAIN HANDLER ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  _applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit por IP (Redis si REDIS_URL existe, fallback in-memory)
  const ip = clientIp(req);
  const rate = await checkRate(`chat:${ip}`, 30, 60_000);
  if (!rate.ok) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited', message: 'Demasiadas peticiones. Espera un minuto.' });
  }
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));

  const { messages, system, avatarName, vision, memoryContext, ragContext, workflowMode } = req.body;

  // Validación de entrada
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }
  if (messages.length > 100) {
    return res.status(400).json({ error: 'too_many_messages', max: 100 });
  }
  // Cap total payload para evitar abuso/DoS
  const totalLen = messages.reduce((n, m) => n + (typeof m?.content === 'string' ? m.content.length : 0), 0);
  if (totalLen > 64_000) {
    return res.status(400).json({ error: 'payload_too_large', max_chars: 64_000 });
  }
  // Validación individual
  for (const m of messages) {
    if (!m || typeof m !== 'object') return res.status(400).json({ error: 'invalid_message_shape' });
    if (typeof m.content !== 'string') return res.status(400).json({ error: 'content_must_be_string' });
    if (m.role && !['user', 'assistant', 'system'].includes(m.role)) {
      return res.status(400).json({ error: 'invalid_role' });
    }
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
        // Extraer emoción + gesto si el modelo los embebió con tags
        // [emotion:happy] [gesture:GREET] al final del texto. Se remueven
        // antes de enviar para que no se lean en voz.
        let cleanText = result.text;
        let emotion = null, gesture = null;
        const emoMatch = cleanText.match(/\[emotion:\s*(happy|excited|calm|curious|focused|sad|neutral)\s*\]/i);
        const gesMatch = cleanText.match(/\[gesture:\s*([A-Z_]+)\s*\]/);
        if (emoMatch) { emotion = emoMatch[1].toLowerCase(); cleanText = cleanText.replace(emoMatch[0], '').trim(); }
        if (gesMatch) { gesture = gesMatch[1].toUpperCase();  cleanText = cleanText.replace(gesMatch[0], '').trim(); }
        return res.json({ message: cleanText, source: result.source, model: result.model, emotion, gesture });
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
