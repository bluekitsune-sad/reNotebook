import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: 'html',
  timeout: 30000,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter @synced-notepad/web dev',
      port: 3000,
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: 'pnpm --filter @synced-notepad/server dev',
      port: 3001,
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
