// @ts-check
// Verifica que tu VRM_CDN_BASE responde correctamente para todos los VRMs.
// Ejecutar:  VRM_CDN_BASE=https://vrm.tudominio.com node scripts/verify-vrm-cdn.mjs

import { readdirSync } from 'node:fs';

const BASE = (process.env.VRM_CDN_BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('✗ Define VRM_CDN_BASE primero. Ejemplo:\n  VRM_CDN_BASE=https://vrm.tudominio.com node scripts/verify-vrm-cdn.mjs');
  process.exit(1);
}

const localFiles = readdirSync('public').filter(f => f.endsWith('.vrm'));
console.log(`📦 Verificando ${localFiles.length} VRMs contra ${BASE}/\n`);

let ok = 0, fail = 0;
for (const file of localFiles) {
  const url = `${BASE}/${file}`;
  process.stdout.write(`  ${file.padEnd(30)} `);
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) });
    const sizeMb = r.headers.get('content-length')
      ? (Number(r.headers.get('content-length')) / 1048576).toFixed(1)
      : '?';
    if (r.ok) {
      console.log(`✓ ${r.status} (${sizeMb} MB)`);
      ok++;
    } else {
      console.log(`✗ ${r.status}`);
      fail++;
    }
  } catch (e) {
    console.log(`✗ ${e.message}`);
    fail++;
  }
}

console.log(`\n${ok}/${localFiles.length} OK · ${fail} fallidos`);
if (fail > 0) {
  console.error('\n✗ Algunos VRMs no están en el CDN. Corre: npm run upload:vrms');
  process.exit(1);
}
console.log('\n✓ Todos los VRMs disponibles en CDN. Ya puedes setear VRM_CDN_BASE en Railway.');
