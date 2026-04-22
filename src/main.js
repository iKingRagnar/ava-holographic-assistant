// @ts-check
// main.js — entry point del frontend modular (Vite). Esqueleto mínimo.
// La migración completa del monolito ava.html (5300 líneas) a módulos
// requiere ~5-8 sesiones dedicadas. Este archivo es la fundación.
//
// Módulos objetivo (futuros splits):
//   ./state.js      — FSM de avatar state (IDLE/LISTENING/THINKING/TALKING) + AMOVE
//   ./render.js     — Three.js scene setup + post-processing pipeline
//   ./vrm-anim.js   — animateVRM + bone cache + rest pose shield
//   ./voice.js      — STT (SpeechRecognition / Deepgram) + barge-in VAD
//   ./tts.js        — TTS dispatch (browser / elevenlabs / openai) + lip-sync viseme
//   ./chat.js       — cliente de /api/chat con streaming SSE
//   ./rag.js        — client-side RAG con fallback a /api/rag-store
//   ./ui.js         — HUD, avatar selector, config overlay

import { createState } from './state.js';

const state = createState();

function boot() {
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = 'BOOT OK — src/main.js cargado';

  console.log('[AVA-Vite] skeleton listo. state:', state.get());
  console.warn('[AVA-Vite] Esta build es experimental. Usa /ava.html para el asistente completo.');
}

document.addEventListener('DOMContentLoaded', boot);
