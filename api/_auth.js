// @ts-check
// JWT auth opcional. Solo se enforca si JWT_SECRET está configurado.
// Sin JWT_SECRET → todos los requests pasan (modo public, default).
//
// Uso típico desde un handler:
//   import { requireAuth } from './_auth.js';
//   const user = await requireAuth(req, res);
//   if (!user) return; // ya respondió 401

let _jwt = null;
async function _ensureJwt() {
  if (_jwt) return _jwt;
  try {
    const mod = await import('jsonwebtoken');
    _jwt = mod.default || mod;
  } catch { _jwt = null; }
  return _jwt;
}

const SECRET = process.env.JWT_SECRET;

/** True si auth está activado en este deployment. */
export function authEnabled() {
  return !!SECRET;
}

/**
 * Verifica el header Authorization: Bearer <token>.
 * - Sin SECRET configurado → returns { sub: 'public', role: 'public' } (no enforce).
 * - Con SECRET y token válido → returns payload del token.
 * - Con SECRET pero token ausente/inválido → responde 401 y returns null.
 *
 * @param {any} req
 * @param {any} res
 * @returns {Promise<object|null>}
 */
export async function requireAuth(req, res) {
  if (!SECRET) return { sub: 'public', role: 'public' };

  const auth = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(auth));
  if (!m) {
    res.status(401).json({ error: 'auth_required', message: 'Falta header Authorization: Bearer <token>' });
    return null;
  }
  const jwt = await _ensureJwt();
  if (!jwt) {
    res.status(500).json({ error: 'jwt_not_installed' });
    return null;
  }
  try {
    return jwt.verify(m[1], SECRET);
  } catch (e) {
    res.status(401).json({ error: 'auth_invalid', message: e.message });
    return null;
  }
}

/** Genera un token JWT firmado. Útil para scripts de bootstrapping/admin. */
export async function signToken(payload, opts = {}) {
  if (!SECRET) throw new Error('JWT_SECRET no configurado');
  const jwt = await _ensureJwt();
  if (!jwt) throw new Error('jsonwebtoken no instalado');
  return jwt.sign(payload, SECRET, { expiresIn: opts.expiresIn || '7d' });
}
