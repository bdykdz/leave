import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Smoke tests to verify the application is working correctly.
 * These tests verify basic functionality and should run quickly.
 */

test.describe('Smoke Tests', () => {
  test('homepage loads and redirects to login or dashboard', async ({ page }) => {
    await page.goto('/');

    // Should either be on login page or redirected to a dashboard
    await expect(page).toHaveURL(
      /\/(auth\/signin|employee|manager|hr|executive|admin)/
    );
  });

  test('authenticated user can access their dashboard', async ({ page }) => {
    await page.goto('/');

    // Should be redirected to a role-based dashboard
    await page.waitForURL((url) => {
      const path = url.pathname;
      return (
        path.includes('/employee') ||
        path.includes('/manager') ||
        path.includes('/hr') ||
        path.includes('/executive') ||
        path.includes('/admin')
      );
    });

    // Verify the dashboard loaded
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigation menu is accessible', async ({ page }) => {
    await page.goto('/');

    // Wait for redirect to dashboard
    await page.waitForLoadState('networkidle');

    // Check for navigation elements (sidebar or header nav)
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeVisible();
  });

  test('API health check responds', async ({ request }) => {
    // Test a simple API endpoint
    const response = await request.get('/api/auth/providers');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });
});

test.describe('Accessibility Tests', () => {
  test('login page has no critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Filter for critical and serious violations
    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toEqual([]);
  });

  test('dashboard has no critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/');

    // Wait for redirect to dashboard
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Filter for critical and serious violations
    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toEqual([]);
  });
});
