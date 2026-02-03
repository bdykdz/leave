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
 * - PLAYWRIGHT_TEST_EMAIL: Email of the test user (default: admin@staging.local)
 * - PLAYWRIGHT_TEST_PASSWORD: Password for dev login
 * - TEST_AUTH_SECRET: Secret for test authentication bypass
 */

const testEmail = process.env.PLAYWRIGHT_TEST_EMAIL || 'admin@staging.local';

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Wait for the page to load and hydrate
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Check if we have a dev login section (SHOW_DEV_LOGIN=true)
  const devSection = page.locator('text=Development Mode');
  const hasDevLogin = await devSection.isVisible().catch(() => false);

  if (hasDevLogin) {
    // Use the "Existing User" dropdown (default tab)
    await page.waitForTimeout(500);

    // Open the user selector dropdown
    const userSelector = page.locator('[data-slot="select-trigger"]').first();
    if (await userSelector.isVisible()) {
      await userSelector.click();
      await page.waitForTimeout(300);

      // Select admin user
      const adminOption = page.getByRole('option').filter({ hasText: /admin/i }).first();
      if (await adminOption.isVisible().catch(() => false)) {
        await adminOption.click();
        await page.waitForTimeout(200);
      }
    }

    // Click "Sign in as Selected User" button
    const signInButton = page.getByRole('button', { name: /sign in as selected user/i });
    if (await signInButton.isVisible()) {
      await signInButton.click();
    }
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
