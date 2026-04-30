// @ts-check
/**
 * Parsers puros (sin DOM) extraídos del monolito ava.html para que sean
 * unit-testables con Node test runner. La intención es que algún día
 * ava.html los importe como ES modules en vez de tenerlos inline.
 *
 * Estos parsers NO tocan estado global; reciben el contexto necesario
 * y devuelven un descriptor de la acción. La capa de UI lo aplica.
 */

const NUM_WORDS = {
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10,
  primero: 1, primera: 1, segundo: 2, segunda: 2, tercero: 3, tercera: 3,
  cuarto: 4, cuarta: 4, quinto: 5, quinta: 5, sexto: 6, sexta: 6,
  septimo: 7, septima: 7, octavo: 8, octava: 8, noveno: 9, novena: 9,
  decimo: 10, decima: 10,
};

const AVATAR_NAMES_DEFAULT = ['AVA','KIRA','ZANE','FAKER','SAO','NEON','YUKI','REI','MIRA','KAI'];

/** Normaliza texto: lowercase, sin tildes, trim. */
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Detecta si el texto comienza con el wake-word del avatar activo.
 * @param {string} norm - texto normalizado
 * @param {string} currentName - nombre del avatar activo (ej "AVA")
 * @returns {boolean}
 */
export function hasWakeWord(norm, currentName) {
  const cn = String(currentName || 'ava').toLowerCase();
  const re = new RegExp(
    `^\\s*(ava|aba|eva|oye\\s*ava|hey\\s*ava|hola\\s*ava|${cn}|hey\\s*${cn}|oye\\s*${cn})\\b`,
    'i'
  );
  return re.test(norm);
}

/**
 * Comandos de cambio de avatar. Devuelve descriptor de acción o {type:'none'}.
 * @param {string} norm
 * @param {{names?:string[], currentIdx?:number}} [ctx]
 * @returns {{type:'switch',idx:number}|{type:'list'}|{type:'none'}}
 */
export function parseAvatarCommand(norm, ctx = {}) {
  const NAMES = ctx.names || AVATAR_NAMES_DEFAULT;
  const currentIdx = Number.isInteger(ctx.currentIdx) ? ctx.currentIdx : 0;

  if (/\b(que|cuales|lista de|cuantos|dime los)\s+avatar(es)?\b/.test(norm) ||
      /\bavatar(es)?\s+(hay|tienes|disponibles|existen)\b/.test(norm)) {
    return { type: 'list' };
  }

  for (let i = 0; i < NAMES.length; i++) {
    const nm = NAMES[i].toLowerCase();
    const re = new RegExp(`\\b(cambi[ao]|pon|activa|muestra|ponme|ponla|selecciona|quiero a?)\\s+(a|al|la|el)?\\s*${nm}\\b`, 'i');
    if (re.test(norm)) return { type: 'switch', idx: i };
    if (/\bavatar\b/.test(norm) && new RegExp(`\\b${nm}\\b`, 'i').test(norm)) {
      return { type: 'switch', idx: i };
    }
    const short = new RegExp(`^${nm}\\b`, 'i');
    if (short.test(norm) && norm.length < nm.length + 4) return { type: 'switch', idx: i };
  }

  if (/\b(siguiente|otro|otra)\s+avatar\b/.test(norm) || /\bavatar\s+siguiente\b/.test(norm)) {
    return { type: 'switch', idx: (currentIdx + 1) % NAMES.length };
  }
  if (/\b(anterior|previa|previo)\s+avatar\b/.test(norm) || /\bavatar\s+anterior\b/.test(norm)) {
    return { type: 'switch', idx: (currentIdx - 1 + NAMES.length) % NAMES.length };
  }

  const numMatch = norm.match(/\bavatar\s+(?:numero\s+)?(\d{1,2}|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|primer[ao]|segund[ao]|tercer[ao]|cuart[ao]|quint[ao]|sext[ao]|septim[ao]|octav[ao]|noven[ao]|decim[ao])\b/);
  if (numMatch) {
    const tok = numMatch[1];
    const n = Number(tok) || NUM_WORDS[tok] || 0;
    if (n >= 1 && n <= NAMES.length) return { type: 'switch', idx: n - 1 };
  }
  const numCmd = norm.match(/\b(cambi[ao]|pon|activa)\s+(a(l)?|el|la)?\s*(numero\s+)?(\d{1,2}|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/);
  if (numCmd) {
    const tok = numCmd[5];
    const n = Number(tok) || NUM_WORDS[tok] || 0;
    if (n >= 1 && n <= NAMES.length) return { type: 'switch', idx: n - 1 };
  }

  return { type: 'none' };
}

/**
 * Comandos de control de audio.
 * @param {string} norm
 * @returns {{type:string, delta?:number}|null}
 */
export function parseAudioCommand(norm) {
  if (/^(callate|calla|silencio|para|stop|ya basta|cierra la boca)(\s|$)/i.test(norm)) {
    return { type: 'stop' };
  }
  if (/\b(repite|repitelo|dilo otra vez|di eso de nuevo|que dijiste|no te entendi)\b/.test(norm)) {
    return { type: 'repeat' };
  }
  if (/\b(mas fuerte|sube(\s+el)?\s+volumen|volumen arriba|alto|mas alto)\b/.test(norm)) {
    return { type: 'volume_up', delta: +0.2 };
  }
  if (/\b(mas bajo|baja(\s+el)?\s+volumen|volumen abajo|bajo|mas suave)\b/.test(norm)) {
    return { type: 'volume_down', delta: -0.2 };
  }
  if (/\b(mas despacio|mas lento|mas lenta|baja(\s+la)?\s+velocidad)\b/.test(norm)) {
    return { type: 'rate_down', delta: -0.15 };
  }
  if (/\b(mas rapido|mas rapida|mas deprisa|acelera|sube(\s+la)?\s+velocidad)\b/.test(norm)) {
    return { type: 'rate_up', delta: +0.15 };
  }
  if (/\b(volumen normal|velocidad normal|reset audio|reestablece audio)\b/.test(norm)) {
    return { type: 'reset' };
  }
  return null;
}

/**
 * Mapea letra a viseme A/I/U/E/O/M.
 * @param {string} ch
 * @returns {'A'|'I'|'U'|'E'|'O'|'M'|null}
 */
export function visemeFromLetter(ch) {
  const c = (ch || '').toLowerCase();
  if ('aá'.includes(c)) return 'A';
  if ('ií'.includes(c)) return 'I';
  if ('uúü'.includes(c)) return 'U';
  if ('eé'.includes(c)) return 'E';
  if ('oó'.includes(c)) return 'O';
  if ('mbp'.includes(c)) return 'M';
  return null;
}

/**
 * Calcula targets de visemes desde una palabra (suma normalizada).
 * @param {string} word
 * @returns {{A:number,I:number,U:number,E:number,O:number,M:number}}
 */
export function visemeTargetsFromWord(word) {
  const target = { A: 0, I: 0, U: 0, E: 0, O: 0, M: 0 };
  if (!word) return target;
  let count = 0;
  for (const ch of word) {
    const v = visemeFromLetter(ch);
    if (v) { target[v] += 1; count++; }
  }
  if (count > 0) {
    for (const k of /** @type {const} */(['A','I','U','E','O','M'])) {
      target[k] = Math.min(1, target[k] / count * 1.2);
    }
  }
  return target;
}

/**
 * Detector heurístico de comando de "resumen" / "recap".
 * @param {string} norm
 */
export function isSessionSummaryCommand(norm) {
  return /\b(dame\s+un\s+)?resumen(\s+de)?\s+(la\s+)?sesion\b/.test(norm) ||
         /\b(que\s+hicimos\s+hoy|recap)\b/.test(norm);
}
