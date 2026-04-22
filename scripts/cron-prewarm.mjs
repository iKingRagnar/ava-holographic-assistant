// @ts-check
// Script ejecutado por Railway Cron (o cron externo) para mantener el servicio
// "tibio" (evita cold starts) y pre-calentar los TTS providers.
//
// Configuración Railway:
//   1. Añade un nuevo servicio desde el mismo repo.
//   2. Settings → Cron Schedule → "*/10 * * * *"  (cada 10 min)
//   3. Settings → Start Command → "node scripts/cron-prewarm.mjs"
//   4. Environment → Variable PREWARM_URL = https://<tu-dominio>.up.railway.app
//
// Railway mata el servicio al finalizar exitosamente, así que el costo es
// solo el tiempo de ejecución (~2-5s por run).

const BASE = process.env.PREWARM_URL || process.env.RAILWAY_PUBLIC_DOMAIN
  ? (process.env.PREWARM_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`)
  : 'http://localhost:3333';

const PHRASES = [
  'Hola',
  'Un momento',
  'Entendido',
  'Te escucho',
  'Claro que sí',
];

async function warm(path, init) {
  const url = `${BASE}${path}`;
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    console.log(`  ${path} → ${r.status}`);
    return r.ok;
  } catch (e) {
    console.log(`  ${path} → ERR ${e.message}`);
    return false;
  }
}

async function main() {
  console.log(`⏰ Prewarm run @ ${new Date().toISOString()}`);
  console.log(`   Base: ${BASE}`);

  // 1. Healthcheck (wake-up básico)
  await warm('/health');

  // 2. TTS prewarm — fuerza a que el proveedor primario esté cache-cargado
  for (const phrase of PHRASES) {
    await warm('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: phrase, voice: 'ava' }),
    });
  }

  console.log('✓ Prewarm completed');
  process.exit(0);
}

main().catch((e) => {
  console.error('✗ Prewarm failed:', e);
  process.exit(1);
});
