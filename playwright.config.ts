import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.RELAY_E2E_BASE_URL || 'http://127.0.0.1:8787',
    trace: 'retain-on-failure',
  },
  webServer: process.env.RELAY_E2E_BASE_URL ? undefined : {
    command: 'npm run start',
    url: 'http://127.0.0.1:8787/api/health',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
