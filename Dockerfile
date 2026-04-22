# AVA — imagen de producción opcional para Railway
# Nixpacks es el default (ver nixpacks.toml). Si prefieres Docker, Railway lo
# detecta automáticamente por la presencia de este archivo.
#
# Build: docker build -t ava-holo .
# Run:   docker run -p 3333:3333 --env-file .env.local ava-holo

FROM node:20-alpine AS base
WORKDIR /app
# Dependencias del sistema (si algún build nativo las necesita)
RUN apk add --no-cache dumb-init

# ── Install stage: cache de node_modules ────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# ── Runtime stage: imagen mínima ────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Usuario no-root para defensa en profundidad
RUN addgroup -S ava && adduser -S ava -G ava

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=ava:ava . .

USER ava
EXPOSE 3333
# Healthcheck interno — Railway usa el externo de railway.json
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3333}/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
