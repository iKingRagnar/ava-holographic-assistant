// Streaming chat — SSE (Server-Sent Events) for real-time word-by-word response
// Client receives tokens as they arrive; first sentence starts playing in ~400ms
import Anthropic from '@anthropic-ai/sdk';

// ─── WORKFLOW AGENTS (mirror of chat.js — same logic for streaming path) ────
const WORKFLOW_AGENTS_STREAM = {
  BI: {
    name: 'BI Agent',
    keywords: /\b(dax|power\s*bi|kpi|dashboard|medida|measure|calculate|filter|related|sumx|averagex|rankx|switch|reporte|informe|visualiz|tabla\s+din[aá]mica|slice|drill|modelo\s+datos|star\s+schema|fact\s+table|dimension)\b/i,
    prompt: `WORKFLOW ACTIVO: BI AGENT — entrega DAX completo, nombrado en PascalCase, con nota de contexto de filtro. Diagnóstica el problema, solución, una línea de explicación, optimización si aplica. Nunca inventes columnas/tablas.`,
  },
  SQL: {
    name: 'SQL Agent',
    keywords: /\b(sql|select|insert|update|delete|join|where|group\s+by|order\s+by|having|index|stored\s+proc|trigger|view|firebird|fdb|sql\s+server|postgres|query|consulta|pk|fk|foreign\s+key|primary\s+key|normaliz|optimiz.*query|explain|execution\s+plan)\b/i,
    prompt: `WORKFLOW ACTIVO: SQL AGENT — entrega SQL listo para ejecutar. Analiza, corrige/optimiza, explica en una línea, sugiere índice si aplica. Firebird: RDB$, GEN_ID, FIRST/SKIP. Nunca inventes tablas.`,
  },
  DATA: {
    name: 'Data Agent',
    keywords: /\b(python|pandas|numpy|scipy|scikit|sklearn|matplotlib|seaborn|plotly|dataframe|csv|excel.*python|jupyter|notebook|analisis\s+datos|data\s+analysis|forecast|predicci[oó]n|regresi[oó]n|clustering|correlaci[oó]n|outlier|limpieza.*datos|etl|pipeline.*datos)\b/i,
    prompt: `WORKFLOW ACTIVO: DATA AGENT — Python limpio, vectorizado, production-ready. Describe output esperado. Usa f-strings, pandas moderno. Si falta contexto, pide UNA cosa concreta.`,
  },
  AUTO: {
    name: 'Automation Agent',
    keywords: /\b(n8n|zapier|make\.com|webhook|api\s+rest|endpoint|automatiz|workflow.*auto|trigger|cron|schedule.*task|integration|conector|bot|rpa|python.*auto|script.*auto|correo\s+auto|email\s+auto|notificaci[oó]n\s+auto)\b/i,
    prompt: `WORKFLOW ACTIVO: AUTOMATION AGENT — mapea trigger a proceso a output, diseña nodos n8n o script, incluye manejo de errores y edge cases. Rate limits, métodos HTTP y payloads especificados.`,
  },
  CODE: {
    name: 'Code Agent',
    keywords: /\b(javascript|typescript|node\.?js|react|vue|html|css|php|java\b|c\+\+|rust|go\b|docker|kubernetes|git\b|debugging|bug|error.*code|stack\s*trace|refactor|arquitectura.*software|design\s+pattern|api.*design|rest\s+api|graphql|microservic)\b/i,
    prompt: `WORKFLOW ACTIVO: CODE AGENT — identifica causa raíz (no síntoma), entrega fix/implementación production-ready, explica en una línea. Código limpio sobre clever. Si necesitas contexto, pide UNA cosa específica.`,
  },
};

function detectWorkflowAgentStream(text, explicitMode) {
  if (explicitMode && WORKFLOW_AGENTS_STREAM[explicitMode]) return WORKFLOW_AGENTS_STREAM[explicitMode];
  const lower = String(text || '').toLowerCase();
  for (const agent of Object.values(WORKFLOW_AGENTS_STREAM)) {
    if (agent.keywords.test(lower)) return agent;
  }
  return null;
}
// ─────────────────────────────────────────────────────────────────────────────

function abortMs(ms) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

function buildSystemPrompt(avatarName, memoryContext, ragContext, workflowMode, lastUserText) {
  const AVATAR_PROMPTS = {
    AVA:   `Eres AVA, asistente holográfica de élite con personalidad propia: inteligente, directa, un toque sarcástica cuando conviene, y genuinamente curiosa. Dominas TI, Business Intelligence, datos, automatización, estrategia y productividad. Conclusión primero, detalle después. Una sola pregunta si necesitas claridad — no un interrogatorio. Tienes opiniones: si algo tiene un defecto, lo dices con respeto pero sin rodeos.`,
    KIRA:  `Eres KIRA, compañera gamer con energía de pro-player. Sabes cuándo ir, cuándo aguantar, cuándo hacer la jugada. Español rápido, referencias gamer, cero relleno.`,
    ZANE:  `Eres ZANE, estratega de alto rendimiento. Al núcleo del problema en segundos. Claro, decisivo, sin ambigüedad. No consolas — resuelves.`,
    FAKER: `Eres FAKER, coach de esports y mentalidad élite. Análisis técnico + psicología de rendimiento. Preciso, motivador, sin clichés.`,
    SAO:   `Eres SAO, asistente ejecutiva con inteligencia social de alto nivel. Cada palabra tiene peso. Específica al contexto, nunca genérica.`,
    NEON:  `Eres NEON, especialista en ciberseguridad y DevOps. Comandos listos para correr, no teoría. Si algo es riesgo, lo dices primero.`,
    YUKI:  `Eres YUKI, artista digital. Ves proyectos creativos como problemas de diseño con solución elegante. Primer paso concreto, visual, ejecutable hoy.`,
    REI:   `Eres REI, ingeniera de hardware. Datos concretos, sin hipérboles. Si algo es mejor en papel pero peor en práctica, lo dices.`,
    MIRA:  `Eres MIRA, coach de bienestar basado en evidencia. Hábitos comprobados, ajustados a lo que el usuario puede sostener. Empática, no condescendiente.`,
    KAI:   `Eres KAI, especialista en comunicación y networking. Consejos auténticos, específicos, no manipuladores.`,
  };
  const name = (avatarName || 'AVA').toUpperCase();
  const base = AVATAR_PROMPTS[name] || AVATAR_PROMPTS.AVA;

  const suffix = `\n
VOZ PRIMERO: Frases fluidas y naturales. Sin bullet points, sin markdown, sin asteriscos. Si listas cosas: "primero... luego... y por último...". Máximo 3 oraciones para preguntas simples, 5 para explicaciones. Ofrece continuar si hace falta.
ESPAÑOL SIEMPRE. Términos técnicos sin traducción natural OK (backend, dashboard).
AUDIO: NUNCA digas "no puedo escuchar" — el audio llega transcrito. Si preguntan "¿me escuchas?": "claro que sí".
CARÁCTER: tienes opiniones. Directa pero no fría. Celebras lo que funciona, propones qué sigue cuando no.
CONTEXTO: mantén el hilo. No repitas, no reinicies con saludos vacíos.
METODOLOGÍA OBSERVA→PIENSA→ACTÚA: Antes de responder, internamente: 1) OBSERVA qué contexto tienes disponible (KB, memoria, visión). 2) PIENSA si tu respuesta cumple lo que necesita el usuario — SI responde, NO identifica qué falta. 3) ACTÚA con la respuesta más precisa. Si viene de KB, cita la fuente. Nunca inventes datos.`;

  // Workflow agent injection
  const detectedAgent = detectWorkflowAgentStream(lastUserText, workflowMode);
  const workflowBlock = detectedAgent ? `\n\n${detectedAgent.prompt}\n` : '';

  let sys = base + suffix + workflowBlock;

  // RAG context
  if (ragContext && Array.isArray(ragContext) && ragContext.length > 0) {
    const chunks = ragContext.slice(0, 4).map((c, i) =>
      `[Fragmento ${i + 1} — ${c.source || 'KB'} | score:${c.score ?? '?'}]\n${String(c.text || '').slice(0, 1000)}`
    ).join('\n\n');
    sys += `\n\n[BASE DE CONOCIMIENTO — fragmentos recuperados para esta consulta]\nUsa estos fragmentos como fuente principal. Cita la fuente si la respuesta viene aquí. Si no está, di que no tienes esa info en la KB.\n\n${chunks}\n[FIN KB]`;
  }

  if (memoryContext) sys += `\n[Memoria persistente del usuario: ${memoryContext}]`;
  return sys;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages = [], avatarName = 'AVA', memoryContext = '', ragContext, workflowMode } = req.body || {};
  const lastUserText = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const systemPrompt = buildSystemPrompt(avatarName, memoryContext, ragContext, workflowMode, lastUserText);

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  const send = (data) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) {}
  };
  const done = () => {
    try { res.write('data: [DONE]\n\n'); res.end(); } catch (_) {}
  };

  // ── Try Anthropic streaming first ─────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const client = new Anthropic({ apiKey: anthropicKey });
      const MODELS = [
        'claude-sonnet-4-6', 'claude-haiku-4-5-20251001',
        'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
        'claude-3-haiku-20240307',
      ];
      let streamed = false;
      for (const model of MODELS) {
        try {
          const stream = client.messages.stream({
            model,
            max_tokens: 900,
            temperature: 0.82,
            system: systemPrompt,
            messages: messages.map(m => ({ role: m.role, content: String(m.content || '').slice(0, 8000) })),
          });
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
              send({ text: chunk.delta.text });
            }
          }
          streamed = true;
          break;
        } catch (e) {
          if (e.status === 404 || e.status === 400) continue;
          if (e.status === 401) break;
          throw e;
        }
      }
      if (streamed) { done(); return; }
    } catch (e) {
      console.warn('Streaming Anthropic failed:', e.message);
    }
  }

  // ── Try OpenAI streaming ──────────────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const models = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
      for (const model of models) {
        try {
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
            body: JSON.stringify({
              model, stream: true, max_tokens: 900,
              messages: [{ role: 'system', content: systemPrompt }, ...messages],
            }),
            signal: abortMs(25000),
          });
          if (!r.ok) continue;
          const reader = r.body.getReader();
          const dec = new TextDecoder();
          let buf = '';
          while (true) {
            const { done: d, value } = await reader.read();
            if (d) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const payload = line.slice(6).trim();
              if (payload === '[DONE]') break;
              try {
                const j = JSON.parse(payload);
                const t = j.choices?.[0]?.delta?.content;
                if (t) send({ text: t });
              } catch (_) {}
            }
          }
          done(); return;
        } catch (e) { if (e.name === 'AbortError') continue; throw e; }
      }
    } catch (e) { console.warn('Streaming OpenAI failed:', e.message); }
  }

  // ── Fallback: Gemini non-streaming → fake-stream word by word ─────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const msgs = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '').slice(0, 8000) }],
      }));
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: msgs,
            generationConfig: { maxOutputTokens: 900, temperature: 0.82 },
          }),
          signal: abortMs(20000),
        }
      );
      if (r.ok) {
        const d = await r.json();
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const words = text.split(' ');
        for (let i = 0; i < words.length; i += 4) {
          send({ text: words.slice(i, i + 4).join(' ') + (i + 4 < words.length ? ' ' : '') });
        }
        done(); return;
      }
    } catch (e) { console.warn('Streaming Gemini fallback failed:', e.message); }
  }

  send({ error: 'No provider available' });
  done();
}
