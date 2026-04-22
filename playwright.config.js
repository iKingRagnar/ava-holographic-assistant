// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: './tests',
  timeout: 45_000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
};

export default config;
