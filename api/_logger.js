// @ts-check
// Pino structured logger compartido. Falla suave si pino no está instalado
// (devuelve un wrapper console-based que cumple la API mínima).

let _log = null;

async function _ensureLog() {
  if (_log) return _log;
  try {
    const pino = (await import('pino')).default;
    _log = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'production'
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true } },
      base: {
        service: 'ava-holographic-assistant',
        env: process.env.NODE_ENV || 'development',
      },
    });
  } catch {
    // Fallback console-based
    const fmt = (lvl, msg, meta) => {
      const ts = new Date().toISOString();
      const m = meta ? ' ' + JSON.stringify(meta) : '';
      return `[${ts}] ${lvl.toUpperCase()} ${msg}${m}`;
    };
    _log = {
      info:  (m, ...a) => console.log(fmt('info',  typeof m === 'string' ? m : JSON.stringify(m), a[0])),
      warn:  (m, ...a) => console.warn(fmt('warn',  typeof m === 'string' ? m : JSON.stringify(m), a[0])),
      error: (m, ...a) => console.error(fmt('error', typeof m === 'string' ? m : JSON.stringify(m), a[0])),
      debug: (m, ...a) => console.debug(fmt('debug', typeof m === 'string' ? m : JSON.stringify(m), a[0])),
      child: () => _log,
    };
  }
  return _log;
}

/** Devuelve el logger (lazy init). */
export async function getLogger() {
  return _ensureLog();
}

/** Log helper síncrono — usa el último logger inicializado, sino console. */
export function log(level, msg, meta) {
  if (_log && typeof _log[level] === 'function') {
    return meta ? _log[level](meta, msg) : _log[level](msg);
  }
  // Pre-init fallback
  const fn = console[level === 'debug' ? 'debug' : level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log'];
  fn(`[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}`, meta || '');
}

/** Genera request-id corto (8 chars hex). */
export function requestId() {
  return Math.random().toString(16).slice(2, 10);
}
