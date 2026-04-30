# 📚 Guía completa de configuración — AVA Holographic Assistant

Esta guía explica paso a paso cómo activar **TODAS** las features avanzadas del repo. **Nada de esto es obligatorio** — sin estas configuraciones AVA sigue funcionando con fallbacks. Pero con todo activado:

- VRMs servidos desde CDN (clone instantáneo, repo <5 MB)
- Memoria persistente entre sesiones
- Rate-limit que sobrevive redeploys
- RAG con embeddings reales en lugar de TF-IDF
- Logs estructurados production-ready

---

## 🔥 Prioridad 1 — Lo más fácil y de mayor impacto

### A) HuggingFace token (RAG con embeddings reales) — 2 minutos

**¿Qué hace?** Convierte tu RAG (búsqueda de documentos) de TF-IDF (palabra-match básico) a embeddings semánticos reales — entiende sinónimos, contexto, intenciones.

**Pasos:**

1. Ve a [huggingface.co](https://huggingface.co) → crea cuenta gratis si no tienes (con email)
2. Una vez dentro: tu avatar arriba-derecha → **Settings** → **Access Tokens**
3. **+ Create new token** → tipo `Read` → name: `ava-holograma` → **Generate**
4. Copia el token (empieza con `hf_...`) — **se muestra UNA VEZ**, guárdalo
5. Ve a tu Railway → proyecto AVA → servicio `ava-holographic-assistant` → tab **Variables**
6. **+ New Variable**:
   - Name: `HUGGINGFACE_TOKEN`
   - Value: `hf_xxxxx...` (el que copiaste)
7. Railway re-deploya automáticamente en ~45s

**Verificación**: una vez deploy listo:
```bash
curl https://<tu-ava>.up.railway.app/health
# busca: "huggingface": ... — confirmado
```

---

### B) Postgres en Railway (memoria persistente) — 1 minuto

**¿Qué hace?** Guarda toda tu conversación en una base de datos. AVA recuerda lo que dijiste hace una semana cuando le preguntes "¿qué te conté del proyecto X?".

**Pasos:**

1. Tu Railway → tu proyecto AVA → botón **+ New** (arriba derecha)
2. Selecciona **Database** → **Add PostgreSQL**
3. Railway crea el servicio Postgres y **automáticamente inyecta** la variable `DATABASE_URL` en TODOS los servicios del proyecto. **No tienes que copiar nada.**
4. Tu servicio AVA re-deploya solo
5. Verifica: `curl https://<tu-ava>.up.railway.app/health?deep=1` → `"postgres": "alive"`

**Costo**: Railway Hobby tier incluye $5 de crédito/mes. Postgres pequeño consume ~$3/mes. Pro tier ($20/mes) lo tienes incluido sin preocupación.

---

### C) Redis en Railway (rate-limit persistente) — 1 minuto

**¿Qué hace?** Sin Redis, tu rate-limit (30 mensajes/min por usuario) se reinicia con cada deploy. Con Redis sobrevive redeploys y entre réplicas.

**Pasos:**

1. Tu Railway → tu proyecto AVA → **+ New** → **Database** → **Add Redis**
2. Variable `REDIS_URL` se inyecta automática
3. AVA re-deploya
4. Verifica: `curl https://<tu-ava>.up.railway.app/health?deep=1` → `"redis": "alive"`

**Costo**: ~$1-2/mes en Hobby tier.

---

## 🌥️ Prioridad 2 — Cloudflare R2 (mover VRMs al CDN)

Esto es **lo más complejo** pero **lo de mayor impacto** para tu repo: sin esto, los 10 archivos VRM (~40MB cada uno = 400MB total) viven en `/public` del repo. Con esto:

- Repo baja de 400MB a <5MB
- Clone instantáneo
- Railway deploy 10× más rápido
- VRMs cargan más rápido (CDN edge global)

**Cloudflare R2 = clone de S3 sin egress fees. 10GB gratis para siempre.** Perfecto para tu caso.

### Paso 1 — Crear cuenta Cloudflare (5 min)

1. Ve a [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. Email + password. Verifica email.
3. Skip todo lo de "agregar dominio" si te aparece (no lo necesitas para R2).

### Paso 2 — Activar R2 (3 min)

1. En el dashboard izquierdo: **R2 Object Storage**
2. Te pedirá agregar tarjeta (no cobra hasta superar el free tier — 10GB de storage + 1M operaciones/mes gratis)
3. Click **Purchase R2** (subscription gratis al $0/mes)
4. Cuando termine: **Create bucket**
   - Nombre: `ava-vrms` (o el que quieras, debe ser único globalmente)
   - Location: `Automatic`
   - Click **Create bucket**

### Paso 3 — Hacer el bucket público (2 min)

1. Dentro del bucket → tab **Settings**
2. Sección **Public access** → click **Allow Access**
3. Confirma → ahora tienes una URL `pub-XXXXX.r2.dev` (gratis, ya funciona)
   - Copia esta URL — es tu `S3_PUBLIC_URL`

### Paso 4 — Crear API tokens (3 min)

1. Vuelve a R2 dashboard (atrás del bucket) → click derecha **Manage R2 API Tokens**
2. **+ Create API Token**
   - Token name: `ava-upload`
   - Permissions: **Object Read & Write**
   - Specify bucket(s): selecciona tu bucket `ava-vrms`
   - TTL: forever
   - Click **Create API Token**
3. **GUARDA TODO LO QUE TE MUESTRA** — no se vuelve a ver:
   - **Access Key ID** → este es `S3_ACCESS_KEY_ID`
   - **Secret Access Key** → este es `S3_SECRET_ACCESS_KEY`
   - **Endpoint** (algo como `https://<account>.r2.cloudflarestorage.com`) → este es `S3_ENDPOINT`

### Paso 5 — Subir los VRMs (5 min)

En tu máquina local, en `C:\Users\ragna\Downloads\Holograma_AI`:

1. Instala el SDK:
   ```bash
   npm install --save-dev @aws-sdk/client-s3
   ```

2. Crea un archivo `.env.upload` (NO `.env.local` — es temporal):
   ```
   S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
   S3_BUCKET=ava-vrms
   S3_ACCESS_KEY_ID=tu_access_key
   S3_SECRET_ACCESS_KEY=tu_secret_key
   S3_REGION=auto
   S3_PUBLIC_URL=https://pub-xxxxx.r2.dev
   ```

3. Carga las vars y corre el upload (PowerShell):
   ```powershell
   Get-Content .env.upload | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { Set-Item -Path "env:$($Matches[1])" -Value $Matches[2] } }
   npm run upload:vrms
   ```

   O en bash/git-bash:
   ```bash
   set -a; source .env.upload; set +a
   npm run upload:vrms
   ```

4. Deberías ver:
   ```
   📦 Encontrados 10 VRM en ./public
     ↑ 5664079...vrm (38.4MB) ... OK → https://pub-xxxxx.r2.dev/5664079...vrm
     ↑ 3477026...vrm (39.2MB) ... OK → https://pub-xxxxx.r2.dev/3477026...vrm
     ...
   ✓ Upload completo.
   ```

5. Verifica que están allí:
   ```bash
   VRM_CDN_BASE=https://pub-xxxxx.r2.dev npm run verify:vrms
   ```

### Paso 6 — Configurar Railway para usar el CDN (1 min)

1. Railway → AVA → Variables → **+ New Variable**:
   - Name: `VRM_CDN_BASE`
   - Value: `https://pub-xxxxx.r2.dev` (tu URL de R2 público)
2. Railway re-deploya
3. Ahora cuando alguien pida `/5664079...vrm`, server.js redirige 302 al CDN

### Paso 7 — Quitar VRMs del repo (opcional pero recomendado)

Una vez verificado que el CDN funciona perfecto:

```bash
# Mover VRMs fuera del repo (backup local)
mkdir -p ../vrm-backup
mv public/*.vrm ../vrm-backup/

# Actualizar .gitignore
echo "public/*.vrm" >> .gitignore

# Commit
git add -A
git commit -m "chore: VRMs migrados a R2 CDN, removidos del repo"
git push
```

Esto baja el repo de ~400MB a <5MB.

⚠️ **No borres `../vrm-backup/`** — si algún día cambias de CDN, los necesitas.

---

## 🎙️ Prioridad 3 — Tokens opcionales adicionales

### D) Tavily API (web search premium)

**¿Qué hace?** Cuando dices "AVA busca en internet sobre X", actualmente usa DuckDuckGo + Wikipedia (gratis). Con Tavily la búsqueda es 10× mejor — usa un crawler especializado para AI.

**Pasos:**
1. [tavily.com](https://tavily.com) → Sign up (gratis)
2. Dashboard → **API Keys** → copia tu key (empieza con `tvly-`)
3. Railway → Variables → `TAVILY_API_KEY` = `tvly-xxx`
4. Free tier: 1000 búsquedas/mes (más que suficiente para uso personal)

### E) GitHub token (búsqueda de repos sin rate limit estricto)

**¿Qué hace?** Sin token, AVA puede buscar 60 veces/hora en GitHub. Con token: 5000 veces/hora.

**Pasos:**
1. [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**
2. Note: `ava-search`
3. Expiration: 90 days (o lo que quieras)
4. Scopes: solo `public_repo` (es búsqueda pública)
5. Generate → copia el token
6. Railway → Variables → `GITHUB_TOKEN` = `ghp_xxx`

### F) NewsData API (noticias)

**¿Qué hace?** Cuando preguntas "AVA noticias del día" sin esto usa Wikipedia current events. Con esto, noticias reales en español.

**Pasos:**
1. [newsdata.io/register](https://newsdata.io/register) → cuenta gratis
2. Dashboard → **API Key**
3. Railway → Variables → `NEWSDATA_API_KEY` = `pub_xxx`
4. Free tier: 200 requests/día

### G) ALLOWED_ORIGINS (CORS endurecido)

**¿Qué hace?** Sin esto, tu API acepta requests desde cualquier origen (`*`). Con esto, solo tu dominio y localhost.

**Pasos:**
1. Railway → Variables → `ALLOWED_ORIGINS` = `https://tu-ava.up.railway.app,http://localhost:3333`
2. (Solo lista los dominios separados por coma)

### H) JWT_SECRET (auth opcional)

**¿Qué hace?** Sin esto, tu API es pública (cualquiera con la URL puede hablarle a AVA). Con esto, los endpoints protegidos requieren un Bearer token.

**Pasos:**
1. Genera un secret aleatorio: en local PowerShell
   ```powershell
   [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```
   O en Linux:
   ```bash
   openssl rand -base64 32
   ```
2. Railway → Variables → `JWT_SECRET` = `<el resultado>`
3. Para generar tokens, usa el helper `signToken()` de `api/_auth.js`

---

## 📊 Tabla resumen — todas las variables

| Variable | Prioridad | Sin esto... |
|---|---|---|
| `ANTHROPIC_API_KEY` | ⭐⭐⭐ | Pierdes el modelo principal |
| `GROQ_API_KEY` | ⭐⭐ | Sin fallback gratis y rápido |
| `GEMINI_API_KEY` | ⭐⭐ | Sin fallback gratis |
| `DEEPGRAM_API_KEY` | ⭐ | STT del navegador (peor calidad) |
| `ELEVENLABS_API_KEY` | ⭐ | Voz del navegador (limitada) |
| `HUGGINGFACE_TOKEN` | ⭐⭐ | RAG con TF-IDF en lugar de embeddings |
| `DATABASE_URL` | ⭐⭐ | Memoria solo en IndexedDB del navegador |
| `REDIS_URL` | ⭐ | Rate-limit se reinicia con cada deploy |
| `TAVILY_API_KEY` | ⭐ | Web search vía DuckDuckGo+Wikipedia |
| `GITHUB_TOKEN` | ⭐ | GitHub search 60 req/h en lugar de 5000 |
| `NEWSDATA_API_KEY` | ⭐ | Noticias vía Wikipedia |
| `VRM_CDN_BASE` | ⭐⭐ | VRMs servidos desde tu Railway (más lento) |
| `JWT_SECRET` | depende | Tu API es pública |
| `ALLOWED_ORIGINS` | ⭐ | CORS abierto a todos |
| `AVA_TIMEZONE` | nice | Zona horaria por default `America/Mexico_City` |
| `LOG_LEVEL` | debug | Default `info` |

---

## 🆘 Preguntas frecuentes

**¿Tengo que poner TODO esto?**
No. Lo único OBLIGATORIO es **una** API key de LLM (Anthropic, OpenAI, Gemini o Groq). Lo demás es opcional con fallback gracioso.

**¿Cuánto cuesta todo activado?**
- Railway Hobby ($5 crédito/mes): cubre AVA + Postgres + Redis pequeños = ~$0-2 fuera del crédito
- Cloudflare R2: $0 hasta 10GB
- HuggingFace, Tavily, GitHub, NewsData, Groq: **gratis** en su tier free
- Anthropic / OpenAI: pay-as-you-go (con prompt caching activado, ~$3/mes con uso intenso)

**Total realista**: $5-10/mes con todo prendido si usas mucho. $0 si tienes uso ocasional.

**¿Y si pierdo un token / lo expongo accidentalmente?**
Cada provider permite revocar y regenerar. Solo no commits NUNCA tokens en código. Si lo haces, [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) sirve para purgar la historia.

**¿Cómo sé que algo se rompió?**
- `curl https://<tu-ava>.up.railway.app/health?deep=1` te dice qué servicios están vivos
- Railway dashboard → tu servicio → **Logs** → busca errores

---

¿Dudas con un paso específico? Pega el screenshot del lugar donde te atoraste y te ayudo.
