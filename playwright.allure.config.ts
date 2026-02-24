import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config with Allure reporting
 *
 * Usage:
 * 1. Start Allure server: docker-compose -f docker-compose.allure.yml up -d
 * 2. Run tests: PLAYWRIGHT_BASE_URL=http://localhost:8082 npx playwright test --config=playwright.allure.config.ts
 * 3. View reports: http://localhost:5252
 */

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['allure-playwright', { outputFolder: 'allure-results' }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
