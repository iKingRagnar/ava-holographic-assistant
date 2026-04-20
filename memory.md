# MEMORY.MD — Memoria Persistente del Agente

> **INSTRUCCIÓN CRÍTICA:** Al iniciar cualquier sesión nueva, lo primero que debes hacer es leer este archivo completo antes de ejecutar cualquier tarea.
> Cuando el usuario te corrija en algo o pida que recuerdes algo, actualiza este archivo inmediatamente.
> **NUNCA olvidar revisar herramientas, MCPs y Skills disponibles antes de decir "no puedo" — siempre buscar primero con `ToolSearch` o `search_mcp_registry`.**

---

## Herramientas siempre disponibles

### Herramientas de archivo y código
| Herramienta | Uso |
|-------------|-----|
| `Read` | Leer cualquier archivo antes de editarlo (OBLIGATORIO antes de Edit) |
| `Write` | Crear archivos nuevos o reescribir completo |
| `Edit` | Editar partes específicas de un archivo existente |
| `Glob` | Buscar archivos por patrón (`**/*.js`, `src/**/*.ts`) |
| `Grep` | Buscar texto/regex en archivos — SIEMPRE usar esto, nunca `grep` en bash |
| `mcp__workspace__bash` | Shell Linux aislado. Paths: `C:\Users\ragna\Downloads\Holograma_AI` → `/sessions/.../mnt/Holograma_AI/` |
| `mcp__workspace__web_fetch` | Fetch de URLs (respetar restricciones de dominio) |

### Agentes especializados (Agent tool)
| Tipo | Cuándo usar |
|------|-------------|
| `general-purpose` | Investigación, búsqueda en codebase, tareas multi-step |
| `Explore` | Explorar codebase rápido — quick/medium/very thorough |
| `Plan` | Diseñar arquitectura antes de implementar |
| `claude-code-guide` | Preguntas sobre Claude Code, API, Agent SDK |

### TaskCreate / TaskUpdate / TaskList
- Usar para CUALQUIER tarea con 3+ pasos
- Marcar `in_progress` ANTES de empezar, `completed` cuando termina
- Incluir paso de verificación final siempre

---

## Skills disponibles (invocar con Skill tool)

| Skill | Cuándo invocar |
|-------|---------------|
| `bi-analyst` | Business Intelligence, Power BI, DAX, SQL, Python analytics, n8n |
| `docx` | Crear/editar documentos Word (.docx) |
| `pdf` | Crear/leer/manipular PDFs |
| `pptx` | Crear/editar presentaciones PowerPoint |
| `xlsx` | Crear/editar hojas de cálculo Excel |
| `schedule` | Crear tareas programadas |
| `skill-creator` | Crear o mejorar skills existentes |
| `consolidate-memory` | Limpiar y consolidar archivos de memoria |
| `setup-cowork` | Setup guiado de Cowork |

**REGLA:** Antes de crear un .docx, .pdf, .pptx o .xlsx — SIEMPRE leer primero el SKILL.md correspondiente en `C:\Users\ragna\AppData\Roaming\Claude\local-agent-mode-sessions\...\skills\{tipo}\SKILL.md`

---

## MCPs disponibles

### Vercel (mcp__a74243b5...)
- `deploy_to_vercel` — deploy directo desde aquí
- `list_deployments`, `get_deployment` — ver estado
- `get_runtime_logs`, `get_deployment_build_logs` — debugging
- `list_projects`, `get_project` — gestión de proyectos
- `search_vercel_documentation` — docs de Vercel

### HuggingFace (mcp__19f6b341...)
- `hf_hub_query`, `hub_repo_search` — buscar modelos
- `hf_doc_search`, `hf_doc_fetch` — documentación
- `paper_search` — papers académicos
- `space_search`, `dynamic_space` — Spaces de HF

### Claude in Chrome (mcp__Claude_in_Chrome__)
- `navigate`, `read_page`, `get_page_text` — navegar y leer páginas
- `find`, `form_input` — interactuar con formularios
- `javascript_tool` — ejecutar JS en el browser
- `computer` — ver pantalla
- `gif_creator` — crear GIFs de flujos
- `read_network_requests`, `read_console_messages` — debugging web

### MCP Registry
- `mcp__mcp-registry__search_mcp_registry` — buscar MCPs disponibles para instalar
- `mcp__mcp-registry__suggest_connectors` — sugerir conectores relevantes

### Ticket/Events (mcp__74645ce4...)
- Gestión completa de eventos, tickets, membresías, órdenes, descuentos

### Workspace/Session
- `mcp__cowork__request_cowork_directory` — solicitar acceso a carpeta del usuario
- `mcp__cowork__present_files` — mostrar archivos al usuario
- `mcp__session_info__list_sessions`, `read_transcript` — leer historial de sesiones

---

## Reglas de uso de herramientas

1. **Antes de decir "no puedo hacer X"** → usar `ToolSearch` o `search_mcp_registry`
2. **Para deploy** → usar MCP de Vercel directamente, no solo instrucciones
3. **Para archivos .docx/.pdf/.pptx/.xlsx** → leer SKILL.md primero, siempre
4. **Para búsquedas en codebase** → `Grep` o `Explore` agent, nunca bash grep manual
5. **Para tareas complejas** → `TaskCreate` desde el inicio
6. **Para navegación web** → Claude in Chrome MCP antes de pedir al usuario que abra algo
7. **ToolSearch** → usar cuando una herramienta no está cargada (deferred tools)

---

## Proyecto

- **Nombre:** AVA Holographic Assistant
- **Repo:** https://github.com/iKingRagnar/ava-holographic-assistant
- **Stack:** HTML único (`ava.html`) + Vercel Functions (`api/`) + Three.js VRM avatar
- **Deploy:** Vercel (producción) + `node server.js` (local con `npm run dev:local`)
- **Usuario:** Guillermo — guillermorc44@gmail.com

---

## Arquitectura actual (abril 2026)

### Frontend — `ava.html` (~4950 líneas)
- Three.js r134 + three-vrm 0.6.11 — avatar VRM holográfico
- 10 avatares VRM en `public/` (AVA, KIRA, ZANE, FAKER, SAO, NEON, YUKI, REI, MIRA, KAI)
- AMOVE FSM — 16+ estados autónomos: HAND_HIP, CATWALK, WALK, FLIP_HAIR, SASSY_LEAN, DANCE, GREET, WAVE, POINT, BOW, SHRUG, STRETCH, THINK, STOP
- Spring physics — `sprStep(cur, vel, target, stiff, damp)` con k=55/d=14
- Finger articulation — 30 huesos de dedos animados, poses por estado (HAND_HIP, FLIP_HAIR, GREET, POINT, DANCE, TALKING, THINKING, LISTENING)
- Particle system v2 — DUST/STREAM/ORBIT, sparks en state change
- Floor grid 3D holográfico — 3 GridHelpers animados + glow disc
- Holo dual filter — `holo-thinking` (amber) / `holo-listening` (blue) CSS filter en canvas
- Scanlines overlay reactivo al estado
- TTS cache — `_ttsCache` Map, 10 frases pre-calentadas a los 3s del startup
- Edge TTS primero (gratis, es-MX-DaliaNeural) + AbortController 4s → OpenAI fallback
- STT: Web Speech API (Chrome) + Deepgram Nova-2 (Firefox/fallback servidor)
- Streaming SSE — sentence pipeline, speakNext() queue, `speakText = speak` alias
- RAG client-side — `_ragChunks` en localStorage, TF-IDF cosine similarity
- Panel KB — botón `KB` esquina superior derecha, panel lateral para ingestar documentos
- Auto-voice — `voiceConversationActive` flag, STT se reinicia automáticamente tras TTS
- Vision camera — OFF por defecto (`localStorage.getItem('ava_vision') === '1'`)
- Base-ring animation — REMOVIDA (display:none) por feedback del usuario
- Holo glow, Aurora atmosphere, HUD corners, waveform display

### Backend — `api/`
| Archivo | Función |
|---------|---------|
| `chat.js` | Multi-LLM: Gemini→Groq→OpenAI→DeepSeek→Claude. Enriquecimiento: clima, citas, noticias. RAG context + memoria |
| `chat-stream.js` | SSE streaming: Anthropic stream() + OpenAI stream. Incluye ragContext y metodología OBSERVA-PIENSA-ACTÚA |
| `rag-ingest.js` | Chunking inteligente (512 tokens, 64 overlap) + TF-IDF vectorización |
| `rag-search.js` | Cosine similarity + keyword boost, top-k configurable |
| `tts-edge.js` | Microsoft Neural TTS — es-MX-DaliaNeural (gratis) |
| `tts-openai.js` | OpenAI TTS fallback |
| `stt-deepgram.js` | Deepgram Nova-2 servidor STT |

### Variables de entorno (.env.local)
- `ANTHROPIC_API_KEY` ✓
- `DEEPGRAM_API_KEY` ✓
- `VERCEL_OIDC_TOKEN` ✓
- OpenAI, Gemini, Groq — opcionales (fallback chain)

---

## Metodología del agente

**OBSERVA → PIENSA → ACTÚA** (ver `agents.md` para detalle completo)
- Leer `agents.md` Y `memory.md` antes de cualquier tarea
- KB tiene prioridad sobre conocimiento general
- Citar fuente cuando la respuesta viene de RAG: "[KB: nombre_doc]"
- Nunca inventar KPIs, fórmulas DAX, datos de ventas ni métricas

---

## Problemas conocidos y soluciones

| Problema | Solución |
|----------|----------|
| `git index.lock` / `HEAD.lock` bloqueados | Usuario debe correr `PUSH_GITHUB.bat` o `del .git\*.lock` desde Windows CMD |
| Archivo `ava.html` se trunca con Edit tool en archivos grandes | Usar `bash >> append` para el tail, verificar con `tail -5` y `wc -l` |
| Null bytes en ava.html | `python3 -c "data=open(...,'rb').read(); open(...,'wb').write(data.replace(b'\x00',b''))"` |
| `speak` no definida | Estaba en el tail truncado — recuperar con `git show HEAD:ava.html \| sed -n 'N,$p'` |
| F-string con backslash en Python | Extraer variable antes del f-string |

---

## Preferencias del usuario (Guillermo)

- Respuestas directas, sin relleno
- Código production-ready, no ejemplos
- Siempre verificar con checks al final de cada implementación
- El bat `PUSH_GITHUB.bat` resuelve el problema de git locks
- Voz femenina joven (~19 años), español latinoamericano (es-MX-DaliaNeural)
- Movimientos de avatar: naturales, "con voluntad e inteligencia propia", no robóticos
- UI: estética neon-green holográfica, sin animaciones feas (base-ring removido)

---

## Historial de cambios importantes

### Sesión abril 2026 (esta sesión)
- ✅ Finger articulation — 30 huesos, poses por estado y AMOVE
- ✅ TTS cache — pre-warm 10 frases comunes, auto-cache respuestas ≤140 chars
- ✅ Edge TTS first + AbortController 4s
- ✅ `speakText = speak` alias para streaming pipeline
- ✅ Holo dual filter — CSS filter en canvas por estado
- ✅ Scanlines overlay reactivo
- ✅ RAG completo — rag-ingest.js, rag-search.js, panel KB en UI, integración en processMessage
- ✅ ragContext inyectado en chat.js y chat-stream.js
- ✅ `agents.md` — metodología OBSERVA-PIENSA-ACTÚA
- ✅ `memory.md` — este archivo
- ✅ `PUSH_GITHUB.bat` — solución permanente para git locks
- ✅ Recuperación de archivos truncados (tail de git)
- ✅ **Workflow Agents** — BI / SQL / DATA / AUTO / CODE empaquetados como agentes especializados

## Workflow Agents (chat.js + chat-stream.js + ava.html)

### Cómo funciona
- `WORKFLOW_AGENTS` en `chat.js` — 5 agentes con regex de intent + system prompt especializado
- `detectWorkflowAgent(text, explicitMode)` — auto-detect por keywords O modo explícito del frontend
- Inyección: `workflowBlock` se añade al `systemPrompt` ANTES de enrichment y RAG
- `chat-stream.js` tiene `WORKFLOW_AGENTS_STREAM` espejo + `detectWorkflowAgentStream()`
- Frontend: barra de 5 botones (BI / SQL / DATA / AUTO / CODE) centrada en el top
  - Click activa modo explícito → se pasa `workflowMode` en el payload
  - Click de nuevo desactiva (toggle)
  - Sin click = auto-detect por keywords del mensaje

### Agentes disponibles
| Agente | Keywords clave | Output |
|--------|---------------|--------|
| BI | dax, power bi, kpi, dashboard, measure, reporte | DAX PascalCase + contexto de filtro |
| SQL | select, join, firebird, query, stored proc | SQL listo para correr + índice sugerido |
| DATA | python, pandas, sklearn, forecast, etl | Python vectorizado, production-ready |
| AUTO | n8n, webhook, zapier, trigger, automatiz | Nodos n8n step-by-step + error handling |
| CODE | javascript, react, docker, git, bug, refactor | Fix causa raíz + una línea explicación |

### Problema conocido
- Archivo `chat.js` se trunca con Edit tool en archivos grandes
- Solución: `cat >> archivo << 'EOF'` para appends, verificar con `wc -l` + `tail`

### Sesiones anteriores
- Spring physics poses, catwalk, flip hair, hand-hip gestures
- Young latina voice (es-MX-DaliaNeural)
- Floor grid 3D holográfico
- Particle system v2 + aurora atmosphere + HUD corners
- Streaming SSE (chat-stream.js)
- Auto-voice (voiceConversationActive)
- STT robustness (no-speech / network error recovery)

---

*Última actualización: abril 2026*
*Actualizar este archivo cuando el usuario corrija algo o pida recordar algo nuevo.*
