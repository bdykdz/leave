import { test, expect } from '@playwright/test';
import {
  preparePageForScreenshot,
  maskDynamicElements,
  scrollToTop,
  waitForStableVisuals,
} from './visual-utils';

/**
 * Visual Regression Tests for Different User Roles
 *
 * These tests verify the visual appearance of dashboards and pages
 * when accessed by users with different roles in the system.
 *
 * Note: These tests use the default authenticated user and navigate
 * to role-specific pages to capture their visual state.
 */

test.describe('Role-Based Dashboard Visuals', () => {
  test.describe('Employee Role Views', () => {
    test('employee dashboard layout', async ({ page }) => {
      await page.goto('/employee');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('role-employee-dashboard.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('employee leave balance cards', async ({ page }) => {
      await page.goto('/employee');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);

      // Capture the leave balance section
      const balanceSection = page.locator('[data-testid="leave-balance"], .leave-balance, section').first();
      if (await balanceSection.isVisible()) {
        await expect(balanceSection).toHaveScreenshot('employee-balance-cards.png', {
          animations: 'disabled',
        });
      }
    });

    test('employee navigation menu', async ({ page }) => {
      await page.goto('/employee');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);

      const nav = page.locator('nav, [role="navigation"]').first();
      await expect(nav).toHaveScreenshot('employee-navigation.png', {
        animations: 'disabled',
      });
    });
  });

  test.describe('Manager Role Views', () => {
    test('manager dashboard layout', async ({ page }) => {
      await page.goto('/manager');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('role-manager-dashboard.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('manager approval queue', async ({ page }) => {
      await page.goto('/manager/approvals');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('manager-approval-queue.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('manager team overview', async ({ page }) => {
      await page.goto('/manager/team-calendar');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('manager-team-overview.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('manager delegation settings', async ({ page }) => {
      await page.goto('/manager/delegation');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('manager-delegation.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });

  test.describe('HR Role Views', () => {
    test('HR dashboard layout', async ({ page }) => {
      await page.goto('/hr');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('role-hr-dashboard.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('HR employee list view', async ({ page }) => {
      await page.goto('/hr/employees');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('hr-employee-list.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('HR policy management', async ({ page }) => {
      await page.goto('/hr/policies');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('hr-policy-management.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('HR reports dashboard', async ({ page }) => {
      await page.goto('/hr/reports');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('hr-reports-dashboard.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });

  test.describe('Executive Role Views', () => {
    test('executive dashboard layout', async ({ page }) => {
      await page.goto('/executive');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('role-executive-dashboard.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('executive analytics view', async ({ page }) => {
      await page.goto('/analytics');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('executive-analytics.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });

  test.describe('Admin Role Views', () => {
    test('admin dashboard layout', async ({ page }) => {
      await page.goto('/admin');
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);
      await scrollToTop(page);

      await expect(page).toHaveScreenshot('role-admin-dashboard.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });
});

test.describe('Role-Based Navigation Differences', () => {
  test('employee navigation items', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toHaveScreenshot('nav-employee-role.png', {
      animations: 'disabled',
    });
  });

  test('manager navigation items', async ({ page }) => {
    await page.goto('/manager');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toHaveScreenshot('nav-manager-role.png', {
      animations: 'disabled',
    });
  });

  test('HR navigation items', async ({ page }) => {
    await page.goto('/hr');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toHaveScreenshot('nav-hr-role.png', {
      animations: 'disabled',
    });
  });

  test('executive navigation items', async ({ page }) => {
    await page.goto('/executive');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toHaveScreenshot('nav-executive-role.png', {
      animations: 'disabled',
    });
  });

  test('admin navigation items', async ({ page }) => {
    await page.goto('/admin');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toHaveScreenshot('nav-admin-role.png', {
      animations: 'disabled',
    });
  });
});
