import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Playwright configuration for Visual Regression Tests.
 *
 * This configuration is specifically optimized for visual regression testing:
 * - Uses consistent viewport sizes for reproducible screenshots
 * - Disables animations to prevent flaky tests
 * - Configures visual comparison thresholds
 *
 * @see https://playwright.dev/docs/test-snapshots
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8082';

export const STORAGE_STATE = path.join(__dirname, '.playwright', '.auth', 'user.json');

// Visual test-specific storage states for different roles
export const EMPLOYEE_STORAGE_STATE = path.join(__dirname, '.playwright', '.auth', 'employee.json');
export const MANAGER_STORAGE_STATE = path.join(__dirname, '.playwright', '.auth', 'manager.json');
export const HR_STORAGE_STATE = path.join(__dirname, '.playwright', '.auth', 'hr.json');
export const EXECUTIVE_STORAGE_STATE = path.join(__dirname, '.playwright', '.auth', 'executive.json');
export const ADMIN_STORAGE_STATE = path.join(__dirname, '.playwright', '.auth', 'admin.json');

export default defineConfig({
  testDir: './e2e/visual-regression',

  // Run tests sequentially for consistent screenshots
  fullyParallel: false,

  forbidOnly: !!process.env.CI,

  // More retries for visual tests due to potential rendering differences
  retries: process.env.CI ? 3 : 1,

  // Single worker for consistent rendering
  workers: 1,

  reporter: [
    ['html', { outputFolder: 'playwright-report-visual', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'visual-test-results.json' }],
  ],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    // Setup project for authentication
    {
      name: 'visual-setup',
      testMatch: /visual\.setup\.ts/,
    },

    // Desktop Chrome - primary visual regression target
    {
      name: 'desktop-chrome',
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        storageState: STORAGE_STATE,
        // Disable animations for consistent screenshots
        launchOptions: {
          args: ['--disable-animations'],
        },
      },
      dependencies: ['visual-setup'],
    },

    // Desktop Firefox for cross-browser visual testing
    {
      name: 'desktop-firefox',
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
        storageState: STORAGE_STATE,
      },
      dependencies: ['visual-setup'],
    },

    // Mobile Chrome viewport
    {
      name: 'mobile-chrome',
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['visual-setup'],
    },

    // Mobile Safari viewport
    {
      name: 'mobile-safari',
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        ...devices['iPhone 12'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['visual-setup'],
    },

    // Tablet viewport
    {
      name: 'tablet',
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        ...devices['iPad (gen 7)'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['visual-setup'],
    },
  ],

  timeout: 90000,

  expect: {
    timeout: 15000,
    toHaveScreenshot: {
      // Allow small differences due to font rendering, etc.
      maxDiffPixels: 100,
      // Color threshold (0-1)
      threshold: 0.2,
      // Disable animations
      animations: 'disabled',
      // Mask dynamic content
      stylePath: './e2e/visual-regression/visual-test-styles.css',
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.05,
    },
  },

  snapshotDir: './e2e/visual-regression/__snapshots__',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{projectName}/{arg}{ext}',

  outputDir: 'test-results-visual',

  // Update snapshots based on environment variable
  updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true' ? 'all' : 'missing',
});
