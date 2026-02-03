import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for API Contract Tests
 * US-018: API Contract Testing
 *
 * Tests verify:
 * - Response schema validation for all API endpoints
 * - Required fields are always present
 * - Correct status codes for success and error cases
 * - Error response format consistency
 */

// Base URL for contract tests
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8082';

export default defineConfig({
  // Test directory for contract tests
  testDir: './tests/contract',

  // Run tests in parallel for speed
  fullyParallel: true,

  // Retry on failure for flaky network tests
  retries: process.env.CI ? 1 : 0,

  // Multiple workers for parallel API requests
  workers: process.env.CI ? 2 : 4,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Reporter configuration
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { outputFolder: 'playwright-report-contract', open: 'never' }],
        ['junit', { outputFile: 'test-results/contract-results.xml' }],
      ]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright-report-contract', open: 'never' }],
      ],

  // Global timeout - 5 minutes max for entire suite
  globalTimeout: 300000,

  // Individual test timeout - 30 seconds per test
  timeout: 30000,

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL,

    // No trace collection for API tests
    trace: 'off',

    // No screenshots for API tests
    screenshot: 'off',

    // No video for API tests
    video: 'off',

    // Reduced timeouts for fast feedback
    actionTimeout: 10000,
    navigationTimeout: 15000,

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },

  // Single project for API tests (no browser rendering needed)
  projects: [
    {
      name: 'contract',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
      },
    },
  ],

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Output folder for test artifacts
  outputDir: 'test-results/contract',
});
