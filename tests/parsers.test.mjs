// @ts-check
// Tests unitarios de parsers — Node test runner (built-in, sin dependencias).
// Ejecutar:  node --test tests/parsers.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize,
  hasWakeWord,
  parseAvatarCommand,
  parseAudioCommand,
  visemeFromLetter,
  visemeTargetsFromWord,
  isSessionSummaryCommand,
} from '../src/parsers.mjs';

const NAMES = ['AVA','KIRA','ZANE','FAKER','SAO','NEON','YUKI','REI','MIRA','KAI'];

// ── normalize ────────────────────────────────────────────────────────
test('normalize quita tildes y baja a minúsculas', () => {
  assert.equal(normalize('HOLA, ¿cómo estás?'), 'hola, ¿como estas?');
  assert.equal(normalize('  Está  '), 'esta');
  assert.equal(normalize(''), '');
  assert.equal(normalize(undefined), '');
});

// ── hasWakeWord ─────────────────────────────────────────────────────
test('hasWakeWord acepta nombre del avatar activo', () => {
  assert.ok(hasWakeWord('ava hola', 'AVA'));
  assert.ok(hasWakeWord('kira consejo para ranked', 'KIRA'));
  assert.ok(hasWakeWord('hey ava', 'AVA'));
  assert.ok(hasWakeWord('oye ava ven', 'AVA'));
});
test('hasWakeWord rechaza si no empieza con wake-word', () => {
  assert.equal(hasWakeWord('hola como estas', 'AVA'), false);
  assert.equal(hasWakeWord('ranked consejo', 'KIRA'), false);
});
test('hasWakeWord acepta variantes ava/aba/eva siempre', () => {
  assert.ok(hasWakeWord('aba hola', 'KIRA')); // aún con KIRA, "aba" funciona
  assert.ok(hasWakeWord('eva test', 'ZANE'));
});

// ── parseAvatarCommand ──────────────────────────────────────────────
test('parseAvatarCommand: lista', () => {
  assert.deepEqual(parseAvatarCommand('que avatares hay'), { type: 'list' });
  assert.deepEqual(parseAvatarCommand('cuales avatares tienes'), { type: 'list' });
});
test('parseAvatarCommand: por número en dígito', () => {
  assert.deepEqual(parseAvatarCommand('avatar 2'), { type: 'switch', idx: 1 });
  assert.deepEqual(parseAvatarCommand('avatar 10'), { type: 'switch', idx: 9 });
  assert.deepEqual(parseAvatarCommand('avatar numero 5'), { type: 'switch', idx: 4 });
});
test('parseAvatarCommand: por número en palabra', () => {
  assert.deepEqual(parseAvatarCommand('avatar dos'), { type: 'switch', idx: 1 });
  assert.deepEqual(parseAvatarCommand('avatar tercero'), { type: 'switch', idx: 2 });
  assert.deepEqual(parseAvatarCommand('cambia al avatar cuatro'), { type: 'switch', idx: 3 });
});
test('parseAvatarCommand: por nombre', () => {
  assert.deepEqual(parseAvatarCommand('cambia a kira'), { type: 'switch', idx: 1 });
  assert.deepEqual(parseAvatarCommand('pon a sao'), { type: 'switch', idx: 4 });
  assert.deepEqual(parseAvatarCommand('activa a neon'), { type: 'switch', idx: 5 });
});
test('parseAvatarCommand: siguiente/anterior', () => {
  assert.deepEqual(parseAvatarCommand('siguiente avatar', { currentIdx: 0 }), { type: 'switch', idx: 1 });
  assert.deepEqual(parseAvatarCommand('avatar anterior', { currentIdx: 0 }), { type: 'switch', idx: 9 });
  assert.deepEqual(parseAvatarCommand('avatar siguiente', { currentIdx: 9 }), { type: 'switch', idx: 0 });
});
test('parseAvatarCommand: none por default', () => {
  assert.deepEqual(parseAvatarCommand('hola que tal'), { type: 'none' });
  assert.deepEqual(parseAvatarCommand('explicame DAX'), { type: 'none' });
});

// ── parseAudioCommand ──────────────────────────────────────────────
test('parseAudioCommand: stop / repeat', () => {
  assert.deepEqual(parseAudioCommand('callate'), { type: 'stop' });
  assert.deepEqual(parseAudioCommand('silencio'), { type: 'stop' });
  assert.deepEqual(parseAudioCommand('repite'), { type: 'repeat' });
  assert.deepEqual(parseAudioCommand('dilo otra vez'), { type: 'repeat' });
});
test('parseAudioCommand: volumen', () => {
  assert.equal(parseAudioCommand('mas fuerte').type, 'volume_up');
  assert.equal(parseAudioCommand('sube el volumen').type, 'volume_up');
  assert.equal(parseAudioCommand('mas bajo').type, 'volume_down');
  assert.equal(parseAudioCommand('baja el volumen').type, 'volume_down');
});
test('parseAudioCommand: velocidad', () => {
  assert.equal(parseAudioCommand('mas despacio').type, 'rate_down');
  assert.equal(parseAudioCommand('mas rapido').type, 'rate_up');
});
test('parseAudioCommand: reset', () => {
  assert.equal(parseAudioCommand('volumen normal').type, 'reset');
});
test('parseAudioCommand: null si no aplica', () => {
  assert.equal(parseAudioCommand('hola'), null);
});

// ── visemes ────────────────────────────────────────────────────────
test('visemeFromLetter mapea correctamente', () => {
  assert.equal(visemeFromLetter('a'), 'A');
  assert.equal(visemeFromLetter('Á'), 'A');
  assert.equal(visemeFromLetter('o'), 'O');
  assert.equal(visemeFromLetter('M'), 'M');
  assert.equal(visemeFromLetter('p'), 'M'); // bilabial → M
  assert.equal(visemeFromLetter('z'), null);
});
test('visemeTargetsFromWord normaliza y suma', () => {
  const t = visemeTargetsFromWord('hola');
  assert.ok(t.O > 0);
  assert.ok(t.A > 0);
  assert.equal(t.I, 0);
  // Todos los valores deben estar en [0, 1]
  for (const v of Object.values(t)) {
    assert.ok(v >= 0 && v <= 1, `valor fuera de rango: ${v}`);
  }
});
test('visemeTargetsFromWord vacío', () => {
  const t = visemeTargetsFromWord('');
  assert.deepEqual(t, { A:0,I:0,U:0,E:0,O:0,M:0 });
});

// ── session summary ────────────────────────────────────────────────
test('isSessionSummaryCommand', () => {
  assert.ok(isSessionSummaryCommand('resumen de sesion'));
  assert.ok(isSessionSummaryCommand('dame un resumen de la sesion'));
  assert.ok(isSessionSummaryCommand('que hicimos hoy'));
  assert.ok(isSessionSummaryCommand('recap'));
  assert.equal(isSessionSummaryCommand('hola'), false);
});
