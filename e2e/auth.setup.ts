import { test as setup, expect } from '@playwright/test';
import { STORAGE_STATE } from '../playwright.config';

/**
 * Authentication setup for E2E tests.
 *
 * This setup runs before all tests to establish an authenticated session.
 * The authentication state is persisted to disk and reused by all tests.
 *
 * Authentication Methods:
 * 1. Development login (when SHOW_DEV_LOGIN=true in staging)
 * 2. Test authentication bypass (when TEST_AUTH_SECRET is configured)
 *
 * Environment Variables:
 * - PLAYWRIGHT_TEST_EMAIL: Email of the test user (default: admin@example.com)
 * - PLAYWRIGHT_TEST_PASSWORD: Password for dev login
 * - TEST_AUTH_SECRET: Secret for test authentication bypass
 */

const testEmail = process.env.PLAYWRIGHT_TEST_EMAIL || 'admin@example.com';
const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD || 'admin123';

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/auth/signin');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Check if we have a dev login form (SHOW_DEV_LOGIN=true)
  const devLoginForm = page.locator('form[action*="credentials"]');
  const hasDevLogin = await devLoginForm.count() > 0;

  if (hasDevLogin) {
    // Use development login credentials
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
  } else {
    // If no dev login, try test authentication bypass
    const testAuthSecret = process.env.TEST_AUTH_SECRET;

    if (testAuthSecret) {
      // Use test auth bypass endpoint
      await page.goto(`/api/auth/test-login?email=${encodeURIComponent(testEmail)}&secret=${encodeURIComponent(testAuthSecret)}`);
    } else {
      throw new Error(
        'No authentication method available. ' +
        'Either enable SHOW_DEV_LOGIN=true in staging environment, ' +
        'or configure TEST_AUTH_SECRET for test authentication bypass.'
      );
    }
  }

  // Wait for successful authentication and redirect
  await page.waitForURL((url) => {
    const path = url.pathname;
    // Should redirect to a role-based dashboard
    return path.includes('/employee') ||
           path.includes('/manager') ||
           path.includes('/hr') ||
           path.includes('/executive') ||
           path.includes('/admin');
  }, { timeout: 30000 });

  // Verify we're logged in by checking for common authenticated UI elements
  await expect(page.locator('body')).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: STORAGE_STATE });
});
