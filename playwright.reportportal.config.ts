import { defineConfig, devices } from '@playwright/test';
import RPconfig from './reportportal.config.json';

/**
 * Playwright config with ReportPortal integration
 *
 * Usage:
 * 1. Start ReportPortal: docker-compose -f docker-compose.reportportal.yml up -d
 * 2. Get API key from ReportPortal UI (http://localhost:9090)
 * 3. Update reportportal.config.json with your API key
 * 4. Run tests: PLAYWRIGHT_BASE_URL=http://localhost:8082 npx playwright test --config=playwright.reportportal.config.ts
 */

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['@reportportal/agent-js-playwright', RPconfig],
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
