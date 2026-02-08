import { test, expect } from '@playwright/test';
import {
  preparePageForScreenshot,
  maskDynamicElements,
  waitForStableVisuals,
} from './visual-utils';

/**
 * Visual Regression Tests for UI Components
 *
 * These tests capture screenshots of individual UI components
 * to ensure consistent styling across the application.
 */

test.describe('Button Components', () => {
  test('primary buttons', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    // Find primary action buttons
    const primaryButtons = page.locator(
      'button[class*="primary"], button[data-variant="default"], .btn-primary'
    );
    if ((await primaryButtons.count()) > 0) {
      await expect(primaryButtons.first()).toHaveScreenshot('button-primary.png', {
        animations: 'disabled',
      });
    }
  });

  test('secondary buttons', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    const secondaryButtons = page.locator(
      'button[class*="secondary"], button[data-variant="secondary"], .btn-secondary'
    );
    if ((await secondaryButtons.count()) > 0) {
      await expect(secondaryButtons.first()).toHaveScreenshot('button-secondary.png', {
        animations: 'disabled',
      });
    }
  });
});

test.describe('Card Components', () => {
  test('dashboard cards', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    const cards = page.locator('[class*="card"], .card, [data-testid*="card"]');
    if ((await cards.count()) > 0) {
      await expect(cards.first()).toHaveScreenshot('card-dashboard.png', {
        animations: 'disabled',
      });
    }
  });

  test('stat cards', async ({ page }) => {
    await page.goto('/hr');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    const statCards = page.locator(
      '[data-testid*="stat"], .stat-card, [class*="stats"]'
    );
    if ((await statCards.count()) > 0) {
      await expect(statCards.first()).toHaveScreenshot('card-stats.png', {
        animations: 'disabled',
      });
    }
  });
});

test.describe('Form Components', () => {
  test('input fields', async ({ page }) => {
    await page.goto('/auth/signin');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    const inputs = page.locator('input[type="text"], input[type="email"]');
    if ((await inputs.count()) > 0) {
      await expect(inputs.first()).toHaveScreenshot('input-text.png', {
        animations: 'disabled',
      });
    }
  });

  test('select dropdowns', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);

    // Look for select/dropdown components
    const selects = page.locator(
      'select, [role="combobox"], [data-testid*="select"]'
    );
    if ((await selects.count()) > 0) {
      await preparePageForScreenshot(page);
      await expect(selects.first()).toHaveScreenshot('select-dropdown.png', {
        animations: 'disabled',
      });
    }
  });

  test('date picker', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);

    // Look for date picker trigger
    const datePicker = page.locator(
      '[data-testid*="date"], button[aria-label*="date"], input[type="date"]'
    );
    if ((await datePicker.count()) > 0) {
      await preparePageForScreenshot(page);
      await expect(datePicker.first()).toHaveScreenshot('date-picker.png', {
        animations: 'disabled',
      });
    }
  });
});

test.describe('Navigation Components', () => {
  test('sidebar navigation', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    const sidebar = page.locator(
      'aside, nav[class*="sidebar"], [data-testid="sidebar"]'
    );
    if ((await sidebar.count()) > 0) {
      await expect(sidebar.first()).toHaveScreenshot('navigation-sidebar.png', {
        animations: 'disabled',
      });
    }
  });

  test('header navigation', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    const header = page.locator('header, [role="banner"]');
    if ((await header.count()) > 0) {
      await expect(header.first()).toHaveScreenshot('navigation-header.png', {
        animations: 'disabled',
      });
    }
  });

  test('breadcrumb navigation', async ({ page }) => {
    await page.goto('/hr/employees');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    const breadcrumb = page.locator(
      'nav[aria-label*="breadcrumb"], [class*="breadcrumb"]'
    );
    if ((await breadcrumb.count()) > 0) {
      await expect(breadcrumb.first()).toHaveScreenshot('navigation-breadcrumb.png', {
        animations: 'disabled',
      });
    }
  });
});

test.describe('Table Components', () => {
  test('data table with headers', async ({ page }) => {
    await page.goto('/hr/employees');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    const table = page.locator('table, [role="table"]');
    if ((await table.count()) > 0) {
      await expect(table.first()).toHaveScreenshot('table-data.png', {
        animations: 'disabled',
      });
    }
  });

  test('table pagination', async ({ page }) => {
    await page.goto('/hr/employees');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    const pagination = page.locator(
      '[class*="pagination"], nav[aria-label*="pagination"]'
    );
    if ((await pagination.count()) > 0) {
      await expect(pagination.first()).toHaveScreenshot('table-pagination.png', {
        animations: 'disabled',
      });
    }
  });
});

test.describe('Alert and Notification Components', () => {
  test('toast notifications', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);

    // Look for toast/notification container
    const toastContainer = page.locator(
      '[class*="toast"], [data-sonner-toaster], [role="alert"]'
    );
    if ((await toastContainer.count()) > 0 && (await toastContainer.first().isVisible())) {
      await preparePageForScreenshot(page);
      await expect(toastContainer.first()).toHaveScreenshot('toast-notification.png', {
        animations: 'disabled',
      });
    }
  });
});

test.describe('Badge and Tag Components', () => {
  test('status badges', async ({ page }) => {
    await page.goto('/manager/approvals');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);

    const badges = page.locator(
      '[class*="badge"], [class*="tag"], [data-testid*="status"]'
    );
    if ((await badges.count()) > 0) {
      await expect(badges.first()).toHaveScreenshot('badge-status.png', {
        animations: 'disabled',
      });
    }
  });
});

test.describe('Modal and Dialog Components', () => {
  test('confirmation dialog', async ({ page }) => {
    await page.goto('/employee');
    await waitForStableVisuals(page);

    // Try to trigger a dialog by clicking a delete or action button
    const actionButton = page.locator(
      'button[aria-haspopup="dialog"], [data-testid*="delete"], [data-testid*="cancel"]'
    ).first();

    if (await actionButton.isVisible()) {
      await actionButton.click();
      await waitForStableVisuals(page);

      const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
      if ((await dialog.count()) > 0 && (await dialog.first().isVisible())) {
        await preparePageForScreenshot(page);
        await expect(dialog.first()).toHaveScreenshot('dialog-confirmation.png', {
          animations: 'disabled',
        });
      }
    }
  });
});

test.describe('Calendar Components', () => {
  test('calendar view', async ({ page }) => {
    await page.goto('/team-calendar');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    const calendar = page.locator(
      '[class*="calendar"], [data-testid*="calendar"], [role="grid"]'
    );
    if ((await calendar.count()) > 0) {
      await expect(calendar.first()).toHaveScreenshot('calendar-view.png', {
        animations: 'disabled',
      });
    }
  });
});

test.describe('Chart Components', () => {
  test('analytics charts', async ({ page }) => {
    await page.goto('/analytics');
    await waitForStableVisuals(page);
    await preparePageForScreenshot(page);
    await maskDynamicElements(page);

    // Wait extra time for charts to render
    await page.waitForTimeout(1000);

    const charts = page.locator(
      '[class*="chart"], [class*="recharts"], svg[class*="chart"]'
    );
    if ((await charts.count()) > 0) {
      await expect(charts.first()).toHaveScreenshot('chart-analytics.png', {
        animations: 'disabled',
      });
    }
  });
});
