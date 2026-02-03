# Testing Guide

This document describes the testing infrastructure for the Leave Management System.

## Overview

The project uses [Playwright](https://playwright.dev/) for end-to-end testing with:
- Multi-browser testing (Chromium, Firefox, WebKit)
- Mobile viewport testing (Pixel 5, iPhone 12)
- Accessibility testing via [@axe-core/playwright](https://www.npmjs.com/package/@axe-core/playwright)
- Authentication state persistence
- HTML test reports

## Quick Start

```bash
# Run all E2E tests
npm run test:e2e

# Run smoke tests only
npm run test:smoke

# Run tests with interactive UI
npm run test:e2e:ui

# View HTML test report
npm run test:e2e:report
```

## Prerequisites

### 1. Install Playwright Browsers

Browsers are installed automatically with `npm install`, but you can manually install them:

```bash
npx playwright install
```

### 2. Configure Environment

Tests run against the staging environment by default. Set `PLAYWRIGHT_BASE_URL` to override:

```bash
# Run against local development server
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e

# Run against staging
PLAYWRIGHT_BASE_URL=http://localhost:8082 npm run test:e2e
```

### 3. Authentication

Tests require authentication. Configure one of these methods:

**Option A: Development Login (Recommended for Staging)**

Ensure `SHOW_DEV_LOGIN=true` in your staging environment, then set:

```bash
export PLAYWRIGHT_TEST_EMAIL="admin@example.com"
export PLAYWRIGHT_TEST_PASSWORD="admin123"
```

**Option B: Test Authentication Bypass**

For automated CI/CD, configure `TEST_AUTH_SECRET` in your environment and the tests will use the test authentication endpoint.

## Test Structure

```
e2e/
├── auth.setup.ts      # Authentication setup (runs first)
├── smoke.spec.ts      # Smoke tests and accessibility tests
└── *.spec.ts          # Additional test files
```

### Authentication Flow

The `auth.setup.ts` file handles authentication before tests run:

1. Navigates to the login page
2. Uses development credentials or test auth bypass
3. Saves authentication state to `.playwright/.auth/user.json`
4. All subsequent tests reuse this authenticated state

## Configuration

The `playwright.config.ts` file defines:

- **Test directory**: `./e2e`
- **Base URL**: `http://localhost:8082` (staging) or `PLAYWRIGHT_BASE_URL` env var
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Timeouts**: 60s global, 15s action, 30s navigation
- **Artifacts**: Screenshots on failure, videos on retry, traces on retry
- **Reports**: HTML report in `playwright-report/`

## Running Tests

### Run All Tests

```bash
npm run test:e2e
```

### Run Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run Specific Test File

```bash
npx playwright test e2e/smoke.spec.ts
```

### Run in Headed Mode

```bash
npx playwright test --headed
```

### Debug Mode

```bash
npx playwright test --debug
```

### Generate Test Code

Use Playwright's codegen to generate tests interactively:

```bash
npx playwright codegen http://localhost:8082
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/some-page');
    await expect(page.locator('h1')).toHaveText('Expected Title');
  });
});
```

### Accessibility Testing

```typescript
import AxeBuilder from '@axe-core/playwright';

test('page has no accessibility violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### Testing with Authentication

Tests automatically have access to authenticated state. If you need to test unauthenticated scenarios, create a project without the `storageState` dependency.

## Test Artifacts

After running tests, find artifacts in:

- `playwright-report/` - HTML test report
- `test-results/` - Screenshots, videos, traces

View the HTML report:

```bash
npm run test:e2e:report
# or
npx playwright show-report
```

## CI/CD Integration

For CI environments:

1. Set `CI=true` environment variable
2. Configure `PLAYWRIGHT_BASE_URL` to your staging URL
3. Configure authentication (test credentials or `TEST_AUTH_SECRET`)
4. Tests will run with:
   - Single worker (no parallelism)
   - 2 retries on failure
   - HTML report generation

Example GitHub Actions workflow:

```yaml
- name: Run E2E Tests
  run: npm run test:e2e
  env:
    CI: true
    PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}
    PLAYWRIGHT_TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
    PLAYWRIGHT_TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Browser Installation Issues

If browsers fail to install, try:

```bash
npx playwright install --with-deps
```

On Linux without sudo access, install browser dependencies manually:

```bash
sudo apt-get install libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libasound2
```

### Authentication Failures

1. Verify the staging environment is running
2. Check `SHOW_DEV_LOGIN=true` is set in staging
3. Verify test user credentials are correct
4. Check the authentication setup logs in test output

### Slow Tests

- Use `--project=chromium` to run on a single browser
- Use `--grep` to run specific tests
- Consider using `test.only()` during development

### Flaky Tests

- Increase timeouts in `playwright.config.ts`
- Add explicit waits with `page.waitForLoadState('networkidle')`
- Use `expect.toPass()` for retry assertions
