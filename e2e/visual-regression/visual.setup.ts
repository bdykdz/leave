import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Visual regression test setup for authentication.
 *
 * This setup authenticates test users and saves their session state
 * for use in visual regression tests.
 */

const STORAGE_STATE = path.join(__dirname, '../../.playwright', '.auth', 'user.json');

const testEmail = process.env.PLAYWRIGHT_TEST_EMAIL || 'admin@example.com';
const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD || 'admin123';

setup('visual-authenticate', async ({ page }) => {
  await page.goto('/auth/signin');
  await page.waitForLoadState('networkidle');

  const devLoginForm = page.locator('form[action*="credentials"]');
  const hasDevLogin = (await devLoginForm.count()) > 0;

  if (hasDevLogin) {
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
  } else {
    const testAuthSecret = process.env.TEST_AUTH_SECRET;

    if (testAuthSecret) {
      await page.goto(
        `/api/auth/test-login?email=${encodeURIComponent(testEmail)}&secret=${encodeURIComponent(testAuthSecret)}`
      );
    } else {
      throw new Error(
        'No authentication method available. ' +
          'Either enable SHOW_DEV_LOGIN=true in staging environment, ' +
          'or configure TEST_AUTH_SECRET for test authentication bypass.'
      );
    }
  }

  await page.waitForURL(
    (url) => {
      const urlPath = url.pathname;
      return (
        urlPath.includes('/employee') ||
        urlPath.includes('/manager') ||
        urlPath.includes('/hr') ||
        urlPath.includes('/executive') ||
        urlPath.includes('/admin')
      );
    },
    { timeout: 30000 }
  );

  await expect(page.locator('body')).toBeVisible();
  await page.context().storageState({ path: STORAGE_STATE });
});
