import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Smoke Tests
 * US-016: Quick deployment verification tests
 *
 * Optimized for:
 * - Fast execution (under 2 minutes)
 * - Clear pass/fail CI/CD output
 * - Single browser for speed
 * - No retries on failure (fast feedback)
 */

// Base URL for smoke tests
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8082';

export default defineConfig({
  // Test directory for smoke tests
  testDir: './tests/smoke',

  // Run tests in files in parallel for speed
  fullyParallel: true,

  // Fail fast - no retries for smoke tests
  retries: 0,

  // Use single worker for predictable CI output
  workers: process.env.CI ? 1 : 4,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Reporter configuration - list format for clear CI/CD output
  reporter: process.env.CI
    ? [
        ['list'],
        ['junit', { outputFile: 'test-results/smoke-results.xml' }],
      ]
    : [['list']],

  // Global timeout - 2 minutes max for entire suite
  globalTimeout: 120000,

  // Individual test timeout - 30 seconds per test
  timeout: 30000,

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL,

    // No trace collection for speed
    trace: 'off',

    // No screenshots for speed
    screenshot: 'off',

    // No video for speed
    video: 'off',

    // Reduced timeouts for fast feedback
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  // Single browser project for speed
  projects: [
    {
      name: 'smoke',
      use: {
        ...devices['Desktop Chrome'],
        // Headless mode for CI
        headless: true,
      },
    },
  ],

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Output folder for test artifacts
  outputDir: 'test-results/smoke',
});
