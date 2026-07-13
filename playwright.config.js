/**
 * File purpose: Configures Playwright smoke tests for the deployed-style Vite frontend and Express API.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:5180',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev --prefix server',
      url: 'http://127.0.0.1:5050/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: '5050',
        CLIENT_URL: 'http://127.0.0.1:5180',
        JWT_SECRET: 'test-jwt-secret-that-is-long-enough-for-stockpulse',
        RESEND_API_KEY: 'test-resend-api-key',
        MONGO_URI: '',
      },
    },
    {
      command: 'npm run dev --prefix client -- --port 5180 --strictPort',
      url: 'http://127.0.0.1:5180',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        // E2E uses isolated loopback ports so it never reuses a developer's Mongo-backed server.
        VITE_API_BASE_URL: 'http://127.0.0.1:5050/api',
      },
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
});


