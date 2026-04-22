// @ts-check
// state.js — FSM del avatar extraído de ava.html como ejemplo de modularización.
// Este módulo es auto-contenido, sin side-effects globales.

/** @typedef {'IDLE'|'LISTENING'|'THINKING'|'TALKING'} AvatarState */

/**
 * Crea un state manager con suscriptores.
 * @returns {{get: () => AvatarState, set: (s: AvatarState) => void, on: (cb: (s: AvatarState) => void) => () => void}}
 */
export function createState(initial = /** @type {AvatarState} */ ('IDLE')) {
  let state = initial;
  /** @type {Set<(s: AvatarState) => void>} */
  const listeners = new Set();
  return {
    get: () => state,
    set: (s) => {
      if (s === state) return;
      state = s;
      for (const cb of listeners) {
        try { cb(s); } catch (e) { console.warn('[state] listener error:', e); }
      }
    },
    on: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  };
}
