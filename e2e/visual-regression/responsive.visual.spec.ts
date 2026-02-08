import { test, expect } from '@playwright/test';
import {
  preparePageForScreenshot,
  maskDynamicElements,
  scrollToTop,
  waitForStableVisuals,
} from './visual-utils';

/**
 * Visual Regression Tests for Responsive Design
 *
 * These tests verify the visual appearance of the application
 * across different viewport sizes to ensure responsive design works correctly.
 *
 * Tests are run across multiple viewport configurations defined in playwright.visual.config.ts:
 * - Desktop HD (1920x1080)
 * - Desktop (1280x720)
 * - Tablet (iPad)
 * - Mobile (iPhone 12, Pixel 5)
 */

test.describe('Responsive Layout - Employee Section', () => {
  test('employee dashboard responsive layout', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('responsive-employee-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('employee navigation responsive', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    // Test navigation component
    const nav = page.locator('nav, [role="navigation"]').first();
    if (await nav.isVisible()) {
      await expect(nav).toHaveScreenshot('responsive-employee-nav.png', {
        animations: 'disabled',
      });
    }
  });

  test('employee cards and grid layout', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    // Capture main content area to verify grid responsiveness
    const main = page.locator('main, [role="main"]').first();
    if (await main.isVisible()) {
      await expect(main).toHaveScreenshot('responsive-employee-main.png', {
        animations: 'disabled',
      });
    }
  });
});

test.describe('Responsive Layout - Manager Section', () => {
  test('manager dashboard responsive layout', async ({ page }) => {
    await page.goto('/manager');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('responsive-manager-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('manager approval list responsive', async ({ page }) => {
    await page.goto('/manager/approvals');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('responsive-manager-approvals.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('manager calendar responsive', async ({ page }) => {
    await page.goto('/manager/team-calendar');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('responsive-manager-calendar.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Responsive Layout - HR Section', () => {
  test('HR dashboard responsive layout', async ({ page }) => {
    await page.goto('/hr');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('responsive-hr-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('HR employee table responsive', async ({ page }) => {
    await page.goto('/hr/employees');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('responsive-hr-employees.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('HR reports charts responsive', async ({ page }) => {
    await page.goto('/hr/reports');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('responsive-hr-reports.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Responsive Layout - Shared Components', () => {
  test('login page responsive', async ({ page }) => {
    await page.goto('/auth/signin');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('responsive-login.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('team calendar responsive', async ({ page }) => {
    await page.goto('/team-calendar');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('responsive-team-calendar.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('holiday planning responsive', async ({ page }) => {
    await page.goto('/holiday-planning');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);
    await scrollToTop(page);

    await expect(page).toHaveScreenshot('responsive-holiday-planning.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Responsive Navigation Patterns', () => {
  test('mobile menu toggle', async ({ page, browserName }) => {
    // This test is most relevant for mobile viewports
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 768) {
      test.skip();
      return;
    }

    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    // Look for mobile menu toggle
    const menuToggle = page.locator(
      '[data-testid="mobile-menu"], [aria-label*="menu"], button[aria-expanded]'
    ).first();

    if (await menuToggle.isVisible()) {
      await expect(page).toHaveScreenshot('mobile-menu-closed.png', {
        fullPage: true,
        animations: 'disabled',
      });

      await menuToggle.click();
      await waitForStableVisuals(page);

      await expect(page).toHaveScreenshot('mobile-menu-open.png', {
        fullPage: true,
        animations: 'disabled',
      });
    }
  });

  test('sidebar collapse on tablet', async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 768 || viewport.width >= 1280) {
      test.skip();
      return;
    }

    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    await expect(page).toHaveScreenshot('tablet-sidebar.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Responsive Form Layouts', () => {
  test('leave request form responsive', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);

    // Try to open leave request form
    const newRequestBtn = page.getByRole('button', { name: /new|request|leave/i }).first();
    if (await newRequestBtn.isVisible()) {
      await newRequestBtn.click();
      await waitForStableVisuals(page);
      await preparePageForScreenshot(page);
      await maskDynamicElements(page);

      await expect(page).toHaveScreenshot('responsive-leave-form.png', {
        fullPage: true,
        animations: 'disabled',
      });
    }
  });
});

test.describe('Responsive Tables and Data Display', () => {
  test('data tables responsive', async ({ page }) => {
    await page.goto('/hr/employees');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    // Check for table component
    const table = page.locator('table, [role="table"], [data-testid*="table"]').first();
    if (await table.isVisible()) {
      await expect(table).toHaveScreenshot('responsive-data-table.png', {
        animations: 'disabled',
      });
    }
  });

  test('cards grid responsive', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    // Look for card grids
    const cardGrid = page.locator('.grid, [class*="grid"]').first();
    if (await cardGrid.isVisible()) {
      await expect(cardGrid).toHaveScreenshot('responsive-card-grid.png', {
        animations: 'disabled',
      });
    }
  });
});
