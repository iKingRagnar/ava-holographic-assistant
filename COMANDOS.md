# 🎙️ Comandos de voz AVA — Cheatsheet

**Regla #1**: cada comando empieza con el nombre del avatar activo (`AVA`, `KIRA`, `ZANE`, etc.). Si no, lo ignora.

> Ej: dices "AVA hola" → responde. Dices solo "hola" → silencio.

---

## 🎭 Cambio de avatar
| Di | Resultado |
|---|---|
| `"AVA cuáles avatares hay"` | Lee la lista hablada |
| `"AVA avatar 2"` | Cambia al #2 (KIRA) |
| `"AVA avatar número 3"` | Cambia al #3 (ZANE) |
| `"AVA cambia al avatar cuatro"` | Cambia al #4 (FAKER) |
| `"AVA cambia a KIRA"` | Cambia por nombre |
| `"AVA pon a NEON"` | Idem |
| `"AVA siguiente avatar"` | Avanza uno |
| `"AVA avatar anterior"` | Retrocede uno |

**Lista**: 1.AVA · 2.KIRA · 3.ZANE · 4.FAKER · 5.SAO · 6.NEON · 7.YUKI · 8.REI · 9.MIRA · 10.KAI

---

## 🔊 Control de audio
| Di | Resultado |
|---|---|
| `"AVA cállate"` / `"silencio"` / `"para"` | Corta TTS al instante |
| `"AVA más fuerte"` / `"sube volumen"` | +20% volumen (máx 150%) |
| `"AVA más bajo"` / `"baja volumen"` | –20% volumen (mín 30%) |
| `"AVA más despacio"` / `"más lento"` | –15% velocidad |
| `"AVA más rápido"` / `"acelera"` | +15% velocidad |
| `"AVA repite"` / `"dilo otra vez"` | Repite última respuesta sin gastar tokens |
| `"AVA volumen normal"` | Reset a defaults |

---

## 🪞 Smart Mirror (requiere FaceMesh ON)
| Di | Resultado |
|---|---|
| `"AVA qué edad tengo"` / `"cómo me ves"` | Edad fisiológica estimada + simetría |
| `"AVA estoy enfocado"` / `"foco"` | Score de foco % + parpadeo/min + duración sesión |
| `"AVA estoy cansado"` / `"fatiga"` | Nivel de fatiga + recomendación |
| `"AVA cómo está mi postura"` | Detecta inclinación lateral |

Activa FaceMesh: ⚙️ → checkbox "Micro-expresiones (FaceMesh)" → permitir cámara.

---

## 📝 Sesión y memoria
| Di | Resultado |
|---|---|
| `"AVA resumen de sesión"` / `"qué hicimos hoy"` / `"recap"` | Duración + turnos + temas + foco promedio |
| `"AVA recuerdas cuando hablamos de X"` | Busca en memoria episódica (requiere Postgres) |

---

## 🌐 Búsqueda en internet
| Di | Resultado |
|---|---|
| `"AVA busca en internet sobre arquitectura RAG"` | Web search (Tavily → DuckDuckGo → Wikipedia) |
| `"AVA googlea CES 2026 highlights"` | Idem |
| `"AVA investiga sobre el último iPhone"` | Idem |
| `"AVA noticias sobre crypto"` | News API si tienes `NEWSDATA_API_KEY` |

---

## 🌤️ Datos contextuales (auto-detectados)

Estos no son comandos como tales — basta con preguntar y AVA los enriquece:

| Pregunta | Fuente |
|---|---|
| `"AVA qué clima hace en Monterrey"` | Open-Meteo (gratis, sin key) |
| `"AVA dame una frase motivacional"` | ZenQuotes |
| `"AVA dato curioso"` | UselessFacts |
| `"AVA cuéntame un chiste"` | Joke API |
| `"AVA hoy en la historia"` | byabbe.se |

---

## ⌨️ Atajos de teclado
| Tecla | Acción |
|---|---|
| `ESPACIO` | Toggle micrófono |
| `Ctrl + R` | Reset configuración |

---

## 🛠️ Variables de entorno requeridas en Railway

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | Claude (recomendado) |
| `GROQ_API_KEY` | Llama 3.3 70B (gratis, ultra rápido) |
| `GEMINI_API_KEY` | Google Gemini Flash (gratis) |
| `OPENAI_API_KEY` | GPT-4o |
| `DEEPGRAM_API_KEY` | STT premium (opcional) |
| `ELEVENLABS_API_KEY` | TTS premium con WS streaming (opcional) |
| `NEWSDATA_API_KEY` | Noticias (opcional) |
| `TAVILY_API_KEY` | Web search premium (opcional, sino DDG+Wiki) |
| `GITHUB_TOKEN` | GitHub search 5000 req/h (opcional, sino 60) |
| `DATABASE_URL` | Memoria Postgres (Railway plugin Postgres) |
| `REDIS_URL` | Rate-limit persistente (Railway plugin Redis) |
| `VRM_CDN_BASE` | URL CDN para VRMs (opcional, sino sirve desde /public) |
| `ALLOWED_ORIGINS` | CORS allowlist en producción |
| `AVA_TIMEZONE` | `America/Mexico_City` por default |

---

## 🐛 Debug en consola del navegador

```js
// Cambiar avatar programáticamente
window.switchAvatar(3);   // FAKER

// Ver session log
console.log(_sessionLog.items);
console.log(_sessionLog.topTopics());

// Ver métricas faceMesh
console.log(_face);

// Ver config actual
console.log(cfg);
```
