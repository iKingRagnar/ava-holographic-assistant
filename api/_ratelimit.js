// @ts-check
// Rate-limit compartido entre endpoints.
// - Si REDIS_URL está configurado (Railway Redis plugin), usa Redis con INCR+EXPIRE
//   → estado persistente entre cold-starts y entre réplicas del servicio.
// - Fallback: in-memory token-bucket (el mismo que teníamos en api/chat.js).

let _redis = null;
let _redisReady = false;
let _redisTried = false;

async function _getRedis() {
  if (_redisTried) return _redis;
  _redisTried = true;
  const url = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;
  if (!url) return null;
  try {
    const { default: Redis } = await import('ioredis');
    _redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
      reconnectOnError: () => true,
    });
    _redis.on('ready', () => { _redisReady = true; console.log('[rate] Redis ready'); });
    _redis.on('error', (e) => { console.warn('[rate] Redis error:', e.message); _redisReady = false; });
  } catch (e) {
    console.warn('[rate] ioredis no disponible, fallback in-memory:', e.message);
    _redis = null;
  }
  return _redis;
}

// ── In-memory fallback (token-bucket) ──────────────────────────────────
const _bucket = new Map();
function _checkInMemory(key, max, windowMs) {
  const now = Date.now();
  const rec = _bucket.get(key) || { tokens: max, last: now };
  const elapsed = now - rec.last;
  rec.tokens = Math.min(max, rec.tokens + (elapsed / windowMs) * max);
  rec.last = now;
  if (rec.tokens < 1) { _bucket.set(key, rec); return { ok: false, remaining: 0 }; }
  rec.tokens -= 1;
  _bucket.set(key, rec);
  if (_bucket.size > 5000) {
    for (const [k, v] of _bucket.entries()) if (now - v.last > 3_600_000) _bucket.delete(k);
  }
  return { ok: true, remaining: Math.floor(rec.tokens) };
}

// ── Redis fixed-window counter ─────────────────────────────────────────
async function _checkRedis(redis, key, max, windowMs) {
  const windowKey = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
  try {
    const [count] = await redis
      .multi()
      .incr(windowKey)
      .pexpire(windowKey, windowMs)
      .exec()
      .then(r => r?.map(x => x?.[1]) || [0]);
    const c = Number(count) || 0;
    return { ok: c <= max, remaining: Math.max(0, max - c) };
  } catch (e) {
    console.warn('[rate] Redis check failed, fallback in-memory:', e.message);
    return _checkInMemory(key, max, windowMs);
  }
}

/**
 * Chequea y decrementa un token para `key`. Devuelve `{ ok, remaining }`.
 * @param {string} key
 * @param {number} [max=30]
 * @param {number} [windowMs=60000]
 */
export async function checkRate(key, max = 30, windowMs = 60_000) {
  const r = await _getRedis();
  if (r && _redisReady) return _checkRedis(r, key, max, windowMs);
  return _checkInMemory(key, max, windowMs);
}

/** Extrae IP del cliente respetando proxy headers de Railway. */
export function clientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}
