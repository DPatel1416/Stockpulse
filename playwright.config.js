/**
 * File purpose: Configures Playwright smoke tests for the deployed-style Vite frontend and Express API.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev --prefix server',
      url: 'http://127.0.0.1:5000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: '5000',
        CLIENT_URL: 'http://127.0.0.1:5173',
        JWT_SECRET: 'test-jwt-secret-that-is-long-enough-for-stockpulse',
        RESEND_API_KEY: 'test-resend-api-key',
        MONGO_URI: '',
      },
    },
    {
      command: 'npm run dev --prefix client',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        // The client API layer reads VITE_API_BASE_URL, so E2E runs must set the same variable used in production.
        VITE_API_BASE_URL: 'http://127.0.0.1:5000/api',
      },
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
});


