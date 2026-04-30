# AVA - Asistente Holográfico de Escritorio

> 🎙️ **Comandos de voz disponibles**: ver [`COMANDOS.md`](./COMANDOS.md) — cambio de avatar, control de audio, smart-mirror, resumen de sesión, búsqueda en internet, memoria persistente.
>
> ✨ **Features destacados**: 10 avatares VRM con personalidades únicas y voces distintas · prosodia autónoma por oración · wake-word estricto · viseme lip-sync A/I/U/E/O · barge-in TTS · adaptive quality FPS-driven · god-rays + bloom + halo + scan-line + 3-point lighting · memoria episódica Postgres · web search Tavily/DuckDuckGo/Wikipedia · GitHub search · rate-limit Redis · PWA + Service Worker · Smart Mirror (edad fisiológica + foco + fatiga + postura via FaceMesh).


**Raíz del proyecto:** todo el código y `public/*.vrm` viven en la carpeta **`Holograma_AI`** (por ejemplo `C:\Users\ragna\Downloads\Holograma_AI`). Abre esa carpeta en el editor y despliega desde ahí; no mezcles con otros repos.

![AVA](https://img.shields.io/badge/AVA-Holographic%20Assistant-00ff9d?style=for-the-badge&logo=three.js&logoColor=white)

Un asistente virtual holográfico inspirado en **Razer Project AVA**, diseñado para ejecutarse en un Google TV Box conectado a un monitor de 7" IPS en modo portrait, dentro de una vitrina acrílica transparente con efecto holográfico.

## ✨ Características

- 🤖 **Avatar 3D Holográfico** - Modelo 3D animado con Three.js
- 🎙️ **Voz Natural** - Web Speech API para entrada y salida de voz (es-MX)
- 🧠 **IA Conectada** - Integración con OpenRouter/Claude/GPT vía API configurable
- 📱 **Optimizado para TV** - Touch-friendly, botones grandes, sin hover effects
- 🎨 **Efectos Visuales** - Partículas, scan lines, anillo base pulsatil
- 💾 **Configuración Persistente** - localStorage para URL de API y system prompt

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| Frontend | HTML5 + CSS3 + Vanilla JS |
| 3D Engine | Three.js r134 + `@pixiv/three-vrm` 0.6 (VRM en `public/`) |
| Speech Recognition | Web Speech API nativa |
| Speech Synthesis | Web Speech Synthesis API |
| Backend AI | Fetch POST a endpoint configurable |

## 📋 Requisitos de Hardware

- Monitor 7" IPS (1024x600) en modo **PORTRAIT**
- Google TV Box / Android TV con Chrome
- Webcam USB
- Bocina Bluetooth con micrófono
- Vitrina acrílica 12x12x24 cm con fondo negro
- Tira LED RGB en la base (opcional)

## 🚀 Repositorio

**GitHub:** https://github.com/iKingRagnar/ava-holographic-assistant

## 📦 Instalación

### 1. Deploy en Railway (recomendado)

El proyecto incluye todo lo necesario para Railway: `railway.json`, `nixpacks.toml`, `Procfile`, `.railwayignore`. Railway auto-detecta Node 20 y corre `node server.js`.

**Opción A — Desde GitHub (recomendado):**

1. Ve a [railway.com/new](https://railway.com/new) y conecta este repo (`iKingRagnar/ava-holographic-assistant`).
2. Railway detecta `package.json` y compila con Nixpacks automáticamente.
3. En **Settings → Networking** clickea **Generate Domain** para obtener `https://<proyecto>.up.railway.app`.
4. En **Variables** añade tus secrets (ver sección más abajo).
5. El healthcheck configurado en `railway.json` apunta a `/health`; debería volver `"ok":true` a los pocos segundos.

**Opción B — Desde CLI:**

```bash
npm i -g @railway/cli
railway login
railway link   # selecciona tu proyecto (b29d2e9e-0488-444d-a1c1-a8ea318991bc)
railway up     # build + deploy
railway logs   # ver logs en vivo
```

**Opción C — deploy desde este clone:**

```bash
npm run deploy   # alias de `railway up` (requiere CLI logueada y link previo)
```

### 2. Variables de entorno en Railway

En el dashboard de Railway → **Variables** añade al menos una API key de LLM:

| Variable | Requerida | Uso |
|---|---|---|
| `ANTHROPIC_API_KEY` | ⭐ una de las LLM | Claude (preferido para calidad) |
| `OPENAI_API_KEY`    | ⭐ una de las LLM | GPT-4o / vision fallback |
| `GEMINI_API_KEY`    | ⭐ una de las LLM | Gemini Flash (más rápido, gratis) |
| `GROQ_API_KEY`      | ⭐ una de las LLM | Llama 3.3 70B (ultra rápido, gratis tier) |
| `DEEPGRAM_API_KEY`  | Opcional | STT de baja latencia (mejor que Web Speech API) |
| `ELEVENLABS_API_KEY`| Opcional | TTS premium (voz natural latina) |
| `NEWSDATA_API_KEY`  | Opcional | Contexto de noticias |
| `AVA_TIMEZONE`      | Opcional | `America/Mexico_City` por defecto |
| `ALLOWED_ORIGINS`   | Opcional | CSV de dominios permitidos (CORS). Vacío = `*` |
| `PORT`              | Auto | Railway lo inyecta, no lo toques |

Railway re-despliega automáticamente al guardar variables.

### 3. Configuración Inicial del cliente

1. Abre `https://<tu-proyecto>.up.railway.app` en Chrome (del Google TV Box o cualquier navegador).
2. En el overlay de configuración deja el campo de endpoint vacío (default `/api/chat`, va al mismo dominio).
3. Click **"ACTIVAR AVA"**.

### 4. Desarrollo local

```bash
npm install
cp .env.example .env.local
# edita .env.local con tus keys
npm run dev:local        # arranca en http://localhost:3333
```

### 5. Plugins de Railway recomendados

| Plugin | Variable auto-inyectada | Qué mejora |
|---|---|---|
| **Redis** | `REDIS_URL` | Rate-limit persistente entre redeploys y entre réplicas. Si no está configurado, el servicio cae a un token-bucket in-memory (funciona, pero se reinicia con cada deploy). |
| **PostgreSQL** | `DATABASE_URL` | Permite persistir chunks RAG server-side (`/api/rag-store`). Si falta, el cliente sigue guardando chunks en `localStorage` (flujo actual). |

Para añadirlos: en tu proyecto Railway → **+ New → Database → Add Redis** (y repetir con PostgreSQL). Railway inyecta las env vars automáticamente en todos los servicios del mismo proyecto.

### 6. Cron job opcional (pre-warming TTS)

Para mantener el servicio "tibio" y que el primer "Hola" no espere cold-start del TTS:

1. En tu proyecto Railway → **+ New → Empty Service**
2. Connect al mismo repo
3. **Settings → Cron Schedule** → `*/10 * * * *` (cada 10 min)
4. **Settings → Start Command** → `node scripts/cron-prewarm.mjs`
5. **Variables** → `PREWARM_URL = https://<tu-servicio-principal>.up.railway.app`

Cost: ~5s de ejecución cada 10 min ≈ despreciable en Hobby tier.

### 7. Custom domain

1. **Settings → Networking → Custom Domain** → escribe `ava.tudominio.com`
2. Railway te da un `CNAME` target (ej. `ghs.railway.app`).
3. En tu DNS (Cloudflare, Namecheap, etc.) crea:
   ```
   Tipo: CNAME
   Nombre: ava
   Valor: <el que te dio Railway>
   Proxy: OFF (si es Cloudflare — Railway maneja su propio TLS)
   ```
4. En ~1-2 minutos Railway emite el certificado Let's Encrypt automáticamente.
5. Actualiza `ALLOWED_ORIGINS=https://ava.tudominio.com` en Variables para reforzar CORS.

### 8. Tier sizing — qué esperar

| Tier Railway | Recomendación |
|---|---|
| **Hobby ($5 crédito/mes)** | Suficiente para 1 usuario / demo. Sin Redis/Postgres, solo `ava-holographic-assistant`. |
| **Pro ($20/mes base)** | Recomendado si vas a habilitar Postgres + Redis + cron prewarm. Mejor CPU, sin sleep automático en servicios idle. |
| **Deployment usage** | El avatar VRM (~40MB) se sirve estático; el tráfico pesado está en ese primer load. Tras eso, solo TTS/STT y chat. Estima ~50-200MB egress por sesión de 10 min. |

### 9. Docker (alternativa a Nixpacks)

Si prefieres build reproducible local: el repo incluye `Dockerfile`. Railway lo auto-detecta si borras `nixpacks.toml` y `railway.json`. Build local:
```bash
docker build -t ava-holo .
docker run -p 3333:3333 --env-file .env.local ava-holo
```

### 10. (Legacy) Deploy en Vercel

Aún soportado via `vercel.json`. Usa `npm run deploy:vercel`. No se garantiza mantenimiento — el path recomendado es Railway.

## 🎮 Controles

| Acción | Método |
|--------|--------|
| Activar micrófono | Tocar botón circular o presionar **ESPACIO** |
| Detener speech | Tocar botón mientras habla |
| Reset configuración | **Ctrl + R** |

## 🎨 Personalización

### Cambiar colores holográficos

Edita las variables CSS en `<style>`:
```css
/* Color principal holográfico */
--holo-color: #00ff9d;  /* Verde */
--holo-blue: #00aaff;   /* Azul */
```

### Prompt recomendado (Avatar — Entidad Sintética)

```text
/imagine prompt: A masterfully rendered, photorealistic portrait of an **ascended synthetic entity** (not a human). The subject is an hyper-detailed android or cyborg, blending exquisite, **ethereal human features** with flawless, engineered technology. Its "skin" is a composite of **ultra-polished white biomechanical ceramic**, seamless polished **palladium metal plates**, and translucent, **milky polycarbonate paneling** that reveals deep, pulsing internal circuitry with faint, deep-blue **quantum core glow**.

The eyes are striking: **mechanical-biological hybrid orbs** with intricate **graphene and sapphire lens iris structures**, emitting a gentle, intelligent, non-human luminous cyan light. No imperfections, no human flaws.

The aesthetic is **minimalist, ultra-refined, and haute-couture technology**. It wears an integrated, high-collar garment made of a **structured, adaptive carbon-fiber weave** mixed with matte-finish **smart fabric**, accented with subtle, glowing fiber optic lines.

The entity is set against a **soft, volumetric bokeh background** of a futuristic, sunlit clean-room laboratory, rendering a shallow depth of field.

This image is a **professional studio asset** designed for **Retina Displays (iPhone, iPad, and MacBooks)**.
```

### Usar modelo Ready Player Me

En la función `createAvatar()`, reemplaza la geometría placeholder con:
```javascript
const loader = new THREE.GLTFLoader();
loader.load('https://models.readyplayer.me/YOUR_MODEL.glb', (gltf) => {
    avatar = gltf.scene;
    // Aplicar materiales holográficos
});
```

## 📱 Optimizaciones para TV Box

- ✅ Touch events (no solo mouse)
- ✅ Botones mínimo 80px
- ✅ Sin hover effects
- ✅ Carga rápida desde CDN
- ✅ Sin dependencias npm

## 🖼️ Vista Previa

![AVA Interface](https://via.placeholder.com/600x1024/000000/00ff9d?text=AVA+Holographic+Interface)

## 📄 Licencia

MIT License - Libre para uso personal y comercial.

---

**Hecho con 💚 y Three.js**
