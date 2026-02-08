import { test, expect } from '@playwright/test';
import {
  preparePageForScreenshot,
  maskDynamicElements,
  scrollToTop,
  waitForStableVisuals,
} from './visual-utils';

/**
 * Visual Regression Tests for Main Pages
 *
 * These tests capture screenshots of all main pages in the application
 * and compare them against baseline images to detect unintended UI changes.
 *
 * To update baselines when intentional changes are made:
 * UPDATE_SNAPSHOTS=true pnpm test:visual
 */

test.describe('Authentication Pages', () => {
  test('login page', async ({ page }) => {
    // Use incognito context to test unauthenticated view
    await page.goto('/auth/signin');
    await preparePageForScreenshot(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Employee Dashboard', () => {
  test('employee main dashboard', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('employee-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('leave request form', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);

    // Look for and click new leave request button
    const newRequestBtn = page.getByRole('button', { name: /new|request|leave/i }).first();
    if (await newRequestBtn.isVisible()) {
      await newRequestBtn.click();
      await waitForStableVisuals(page);
    }

    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    await expect(page).toHaveScreenshot('leave-request-form.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Manager Dashboard', () => {
  test('manager main dashboard', async ({ page }) => {
    await page.goto('/manager');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('manager-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('team calendar view', async ({ page }) => {
    await page.goto('/manager/team-calendar');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('manager-team-calendar.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('pending approvals', async ({ page }) => {
    await page.goto('/manager/approvals');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('manager-approvals.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('HR Dashboard', () => {
  test('HR main dashboard', async ({ page }) => {
    await page.goto('/hr');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('hr-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('employee management page', async ({ page }) => {
    await page.goto('/hr/employees');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('hr-employees.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('leave policies page', async ({ page }) => {
    await page.goto('/hr/policies');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('hr-policies.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('reports page', async ({ page }) => {
    await page.goto('/hr/reports');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('hr-reports.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Executive Dashboard', () => {
  test('executive main dashboard', async ({ page }) => {
    await page.goto('/executive');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('executive-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('analytics page', async ({ page }) => {
    await page.goto('/analytics');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('analytics.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Admin Dashboard', () => {
  test('admin main dashboard', async ({ page }) => {
    await page.goto('/admin');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('admin-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Shared Pages', () => {
  test('holiday planning page', async ({ page }) => {
    await page.goto('/holiday-planning');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('holiday-planning.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('team calendar page', async ({ page }) => {
    await page.goto('/team-calendar');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('team-calendar.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Navigation Components', () => {
  test('sidebar navigation expanded', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);

    const sidebar = page.locator('nav, [role="navigation"]').first();
    await expect(sidebar).toBeVisible();

    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    await expect(sidebar).toHaveScreenshot('sidebar-navigation.png', {
      animations: 'disabled',
    });
  });
});
