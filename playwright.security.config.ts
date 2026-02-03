import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Security Tests
 * US-014: Security Testing
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8082';

export default defineConfig({
  testDir: './tests/security',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-security', open: 'never' }],
  ],

  timeout: 30000,

  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 10000,
    navigationTimeout: 15000,
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },

  projects: [
    {
      name: 'security',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
      },
    },
  ],

  expect: {
    timeout: 5000,
  },

  outputDir: 'test-results/security',
});
