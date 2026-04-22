// @ts-check
// Sube los VRMs de /public a un bucket S3-compatible (Cloudflare R2, Backblaze B2,
// Wasabi, AWS S3). Usar cuando quieras que el repo no contenga los 10 archivos VRM
// (~40MB cada uno = 400MB total) y en cambio se sirvan desde CDN.
//
// Requisitos:
//   npm i -D @aws-sdk/client-s3
//
// Env vars (ejemplo Cloudflare R2):
//   S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
//   S3_BUCKET=ava-vrms
//   S3_ACCESS_KEY_ID=...
//   S3_SECRET_ACCESS_KEY=...
//   S3_REGION=auto
//   S3_PUBLIC_URL=https://vrm.tudominio.com   (después de configurar custom domain en R2)
//
// Uso: node scripts/upload-vrms.mjs
// Tras subir, exportar VRM_CDN_BASE=$S3_PUBLIC_URL en Railway Variables.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const {
  S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
  S3_REGION = 'auto', S3_PUBLIC_URL,
} = process.env;

if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  console.error('✗ Falta config S3. Define S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.');
  process.exit(1);
}

const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3').catch(() => {
  console.error('✗ Instala primero: npm i -D @aws-sdk/client-s3');
  process.exit(1);
});

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
});

const publicDir = 'public';
const files = readdirSync(publicDir).filter((f) => f.endsWith('.vrm'));
console.log(`📦 Encontrados ${files.length} VRM en ./${publicDir}`);

for (const file of files) {
  const fullPath = join(publicDir, file);
  const size = statSync(fullPath).size;
  const sizeMb = (size / 1024 / 1024).toFixed(1);
  process.stdout.write(`  ↑ ${file} (${sizeMb}MB) ... `);
  try {
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: file,
      Body: readFileSync(fullPath),
      ContentType: 'model/gltf-binary',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    const publicUrl = S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${file}` : `${S3_ENDPOINT}/${S3_BUCKET}/${file}`;
    console.log(`OK → ${publicUrl}`);
  } catch (e) {
    console.log(`✗ ${e.message}`);
  }
}

console.log('\n✓ Upload completo.');
if (S3_PUBLIC_URL) {
  console.log(`\nAhora en Railway Variables setea:`);
  console.log(`   VRM_CDN_BASE=${S3_PUBLIC_URL}`);
  console.log(`\nY opcionalmente elimina /public/*.vrm del repo (ahorra ~400MB de clone).`);
}
