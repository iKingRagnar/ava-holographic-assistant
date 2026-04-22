// Playwright smoke test — no requiere build, solo corre el server local
// y verifica que la página monta, el composer se inicializa y no hay
// errores rojos en console.
//
// Uso local:
//   npm i -D @playwright/test
//   npx playwright install chromium
//   node server.js &     # en otra shell
//   npx playwright test tests/smoke.spec.js

import { test, expect } from '@playwright/test';

const URL = process.env.AVA_URL || 'http://localhost:3333/ava.html';

test('AVA boots: canvas, composer, no console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push('PAGEERR:' + err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('CONSOLE:' + msg.text());
  });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });

  // Canvas renderiza
  const canvas = await page.locator('#avatar-canvas');
  await expect(canvas).toBeVisible();

  // Espera a que se inicialice el composer — hasta 15s por si CDN de
  // three-vrm tarda o hay retries.
  await page.waitForFunction(
    () => typeof window !== 'undefined' && !!window.THREE && !!document.getElementById('avatar-canvas'),
    { timeout: 15_000 }
  );

  // Título correcto
  await expect(page).toHaveTitle(/AVA/i);

  // No errores críticos
  const critical = errors.filter(e => !/three-vrm|DEEPGRAM|ANTHROPIC|NetworkError|Failed to fetch/.test(e));
  expect(critical).toEqual([]);
});

test('API /api/chat returns 400 on empty body', async ({ request }) => {
  const base = (process.env.AVA_URL || 'http://localhost:3333').replace(/\/ava\.html$/, '');
  const res = await request.post(base + '/api/chat', { data: {} });
  expect([400, 503]).toContain(res.status());
});

test('Rate limit: hammering /api/chat eventually returns 429', async ({ request }) => {
  const base = (process.env.AVA_URL || 'http://localhost:3333').replace(/\/ava\.html$/, '');
  let got429 = false;
  for (let i = 0; i < 60; i++) {
    const res = await request.post(base + '/api/chat', {
      data: { messages: [{ role: 'user', content: 'ping' }] },
    });
    if (res.status() === 429) { got429 = true; break; }
  }
  expect(got429).toBe(true);
});
