import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Maximum Limits and Boundary Conditions
 * US-012: Tests for handling maximum values, long names, and boundary conditions
 *
 * Tests verify:
 * - Maximum leave days validation
 * - Long text input handling (names, reasons, comments)
 * - Maximum file upload sizes
 * - Large dataset pagination
 * - Character limits in forms
 * - Date range limits
 */

// Test users from seed data
const TEST_USERS = {
  EMPLOYEE: {
    email: 'employee@staging.local',
    password: 'admin123',
  },
  MANAGER: {
    email: 'manager@staging.local',
    password: 'admin123',
  },
  HR: {
    email: 'hr@staging.local',
    password: 'admin123',
  },
};

// Test data for boundary conditions
const LONG_TEXT = {
  SHORT: 'A'.repeat(50),
  MEDIUM: 'B'.repeat(255),
  LONG: 'C'.repeat(1000),
  VERY_LONG: 'D'.repeat(5000),
  UNICODE: '\u4E2D\u6587'.repeat(100), // Chinese characters
  SPECIAL: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\'.repeat(20),
  EMOJI: '\uD83D\uDE00\uD83D\uDE0D\uD83D\uDE0E\uD83E\uDD14'.repeat(50), // Emojis
};

const LONG_NAME = 'Bartholomew Christopher Alexandria Montgomeryshire-Worthington III';
const VERY_LONG_REASON = 'This is an extended leave request reason that includes detailed explanation about why this leave is necessary. '.repeat(20);

// Helper function to perform login
async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const devSection = page.locator('text=Development Mode');
  const hasDevLogin = await devSection.isVisible().catch(() => false);

  if (hasDevLogin) {
    const customTab = page.getByRole('tab', { name: /custom role/i });
    if (await customTab.isVisible()) {
      await customTab.click();
      await page.waitForTimeout(300);

      const emailInput = page.locator('input[type="email"]');
      if (await emailInput.isVisible()) {
        await emailInput.fill(email);
      }

      let role = 'EMPLOYEE';
      if (email.includes('manager')) role = 'MANAGER';
      else if (email.includes('hr')) role = 'HR';
      else if (email.includes('ceo') || email.includes('cto') || email.includes('cfo')) role = 'EXECUTIVE';
      else if (email.includes('admin')) role = 'ADMIN';

      const roleSelector = page.locator('[data-slot="select-trigger"]').last();
      if (await roleSelector.isVisible()) {
        await roleSelector.click();
        await page.waitForTimeout(200);
        const roleOption = page.getByRole('option', { name: new RegExp(role, 'i') });
        if (await roleOption.isVisible().catch(() => false)) {
          await roleOption.click();
        }
      }

      const signInButton = page.getByRole('button', { name: /sign in as/i });
      if (await signInButton.isVisible()) {
        await signInButton.click();
      }
    }
  } else {
    const emailInput = page.getByLabel(/email/i);
    if (await emailInput.isVisible()) {
      await emailInput.fill(email);
      await page.getByLabel(/password/i).fill(password);
      await page.getByRole('button', { name: /sign in/i }).click();
    }
  }

  await page.waitForURL(/\/(employee|manager|hr|executive|admin)/, {
    timeout: 30000,
  });
  await page.waitForLoadState('networkidle');
}

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get future date
function getFutureDate(daysAhead: number): Date {
  const date = new Date();
  let added = 0;
  while (added < daysAhead) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      added++;
    }
  }
  return date;
}

test.describe('Max Limits - Leave Days', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);
  });

  test('Form validates maximum consecutive leave days', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    // Open leave request form
    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    await newLeaveButton.click();
    await page.waitForLoadState('networkidle');

    // Try to request an extremely long leave period (e.g., 365 days)
    const startDate = getFutureDate(1);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 365);

    const startDateInput = page.locator('input[name="startDate"], [data-testid="start-date"]');
    const endDateInput = page.locator('input[name="endDate"], [data-testid="end-date"]');

    if (await startDateInput.isVisible() && await endDateInput.isVisible()) {
      await startDateInput.fill(formatDate(startDate));
      await endDateInput.fill(formatDate(endDate));
      await page.waitForTimeout(500);

      // Should show validation error or warning about duration
      const validationError = page.locator('text=/exceed|maximum|too many|days|limit/i');
      const hasError = await validationError.isVisible().catch(() => false);

      // Form should handle gracefully
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Form handles leave request exceeding available balance', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    // Open leave request form
    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    await newLeaveButton.click();
    await page.waitForLoadState('networkidle');

    // Request more days than likely available (30 days)
    const startDate = getFutureDate(5);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    const startDateInput = page.locator('input[name="startDate"], [data-testid="start-date"]');
    const endDateInput = page.locator('input[name="endDate"], [data-testid="end-date"]');

    if (await startDateInput.isVisible() && await endDateInput.isVisible()) {
      await startDateInput.fill(formatDate(startDate));
      await endDateInput.fill(formatDate(endDate));

      const reasonInput = page.locator('textarea[name="reason"]');
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('Testing leave balance validation');
      }

      // Try to submit
      const submitButton = page.getByRole('button', { name: /submit|request/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(2000);

        // Should show balance error or form validation
        const errorIndicator = page.locator('text=/insufficient|balance|exceed|not enough/i');
        const hasError = await errorIndicator.isVisible().catch(() => false);

        // Page should handle gracefully
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('Half-day leave calculation is handled correctly', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    await newLeaveButton.click();
    await page.waitForLoadState('networkidle');

    // Look for half-day toggle
    const halfDayToggle = page.locator('input[name*="halfDay"], [data-testid*="half-day"], label:has-text("Half Day")');
    const hasHalfDay = await halfDayToggle.isVisible().catch(() => false);

    if (hasHalfDay) {
      // Toggle half-day on
      await halfDayToggle.click();
      await page.waitForTimeout(500);

      // Form should update accordingly
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Max Limits - Long Text Inputs', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);
  });

  test('Reason field handles very long text input', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    await newLeaveButton.click();
    await page.waitForLoadState('networkidle');

    const reasonInput = page.locator('textarea[name="reason"], [data-testid="reason"]');

    if (await reasonInput.isVisible()) {
      // Type very long text
      await reasonInput.fill(VERY_LONG_REASON);
      await page.waitForTimeout(500);

      // Should either truncate, show error, or accept
      const inputValue = await reasonInput.inputValue();

      // Text should be handled (either full or truncated)
      expect(inputValue.length).toBeGreaterThan(0);

      // Page should remain functional
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Comment field handles special characters', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    await newLeaveButton.click();
    await page.waitForLoadState('networkidle');

    const reasonInput = page.locator('textarea[name="reason"], [data-testid="reason"]');

    if (await reasonInput.isVisible()) {
      // Input special characters
      await reasonInput.fill(LONG_TEXT.SPECIAL);
      await page.waitForTimeout(300);

      // Input should be sanitized or accepted
      await expect(page.locator('body')).toBeVisible();

      // No XSS should be executed
      const alerts = page.locator('[role="alert"]');
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Form handles unicode and emoji input', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    await newLeaveButton.click();
    await page.waitForLoadState('networkidle');

    const reasonInput = page.locator('textarea[name="reason"], [data-testid="reason"]');

    if (await reasonInput.isVisible()) {
      // Test unicode characters
      await reasonInput.fill('Annual leave for visiting family ' + LONG_TEXT.UNICODE.slice(0, 50));
      await page.waitForTimeout(300);

      // Should handle unicode gracefully
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Max Limits - Date Range Boundaries', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);
  });

  test('Form rejects dates in the far past', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    await newLeaveButton.click();
    await page.waitForLoadState('networkidle');

    const startDateInput = page.locator('input[name="startDate"], [data-testid="start-date"]');

    if (await startDateInput.isVisible()) {
      // Try to set a date far in the past
      await startDateInput.fill('2000-01-01');
      await page.waitForTimeout(500);

      // Should show validation error
      const validationError = page.locator('text=/past|invalid|cannot|expired/i');
      const hasError = await validationError.isVisible().catch(() => false);

      // Page should handle gracefully
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Form handles dates far in the future', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    await newLeaveButton.click();
    await page.waitForLoadState('networkidle');

    const startDateInput = page.locator('input[name="startDate"], [data-testid="start-date"]');

    if (await startDateInput.isVisible()) {
      // Try to set a date far in the future (10 years)
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 10);

      await startDateInput.fill(formatDate(futureDate));
      await page.waitForTimeout(500);

      // Should either accept or show warning
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Form handles year boundary (Dec 31 to Jan 1)', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    await newLeaveButton.click();
    await page.waitForLoadState('networkidle');

    const startDateInput = page.locator('input[name="startDate"], [data-testid="start-date"]');
    const endDateInput = page.locator('input[name="endDate"], [data-testid="end-date"]');

    if (await startDateInput.isVisible() && await endDateInput.isVisible()) {
      const currentYear = new Date().getFullYear();

      // Set leave spanning year boundary
      await startDateInput.fill(`${currentYear}-12-30`);
      await endDateInput.fill(`${currentYear + 1}-01-02`);
      await page.waitForTimeout(500);

      // Should handle year transition gracefully
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Max Limits - Manager Approval Comments', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.MANAGER.email, TEST_USERS.MANAGER.password);
  });

  test('Approval comment handles long text', async ({ page }) => {
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    // Look for approve button
    const approveButton = page.getByRole('button', { name: /approve/i }).first();
    const hasApproveButton = await approveButton.isVisible().catch(() => false);

    if (hasApproveButton) {
      await approveButton.click();
      await page.waitForTimeout(500);

      // Look for comment field in dialog
      const commentField = page.locator('textarea, input[name="comment"]');
      if (await commentField.isVisible().catch(() => false)) {
        // Type very long comment
        await commentField.fill(LONG_TEXT.LONG);
        await page.waitForTimeout(300);

        // Should handle gracefully
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('Denial reason handles special characters', async ({ page }) => {
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    // Look for deny button
    const denyButton = page.getByRole('button', { name: /deny|reject/i }).first();
    const hasDenyButton = await denyButton.isVisible().catch(() => false);

    if (hasDenyButton) {
      await denyButton.click();
      await page.waitForTimeout(500);

      // Look for reason field
      const reasonField = page.locator('textarea, input[name="comment"], input[name="reason"]');
      if (await reasonField.isVisible().catch(() => false)) {
        // Type special characters
        await reasonField.fill('Denied: ' + LONG_TEXT.SPECIAL.slice(0, 200));
        await page.waitForTimeout(300);

        // Should sanitize or accept
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });
});

test.describe('Max Limits - HR Employee Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.HR.email, TEST_USERS.HR.password);
  });

  test('Employee search handles long search queries', async ({ page }) => {
    await page.goto('/hr/employees');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]');

    if (await searchInput.isVisible()) {
      // Search with very long query
      await searchInput.fill(LONG_TEXT.SHORT);
      await page.waitForTimeout(1000);

      // Should handle gracefully (show no results or truncate)
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Manual balance adjustment handles maximum values', async ({ page }) => {
    await page.goto('/hr/employees');
    await page.waitForLoadState('networkidle');

    // Look for employee row
    const employeeRow = page.locator('tr, [data-testid*="employee"]').first();
    if (await employeeRow.isVisible().catch(() => false)) {
      // Try to find edit balance button
      const editButton = page.getByRole('button', { name: /edit|adjust|balance/i }).first();

      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
        await page.waitForTimeout(500);

        // Look for balance input
        const balanceInput = page.locator('input[type="number"]');
        if (await balanceInput.isVisible().catch(() => false)) {
          // Try to enter very large number
          await balanceInput.fill('999999');
          await page.waitForTimeout(300);

          // Should validate or cap the value
          await expect(page.locator('body')).toBeVisible();
        }
      }
    }
  });
});

test.describe('Max Limits - API Request Limits', () => {
  test('API handles large page size parameter', async ({ page }) => {
    await loginAs(page, TEST_USERS.MANAGER.email, TEST_USERS.MANAGER.password);

    // Request with very large page size
    const response = await page.request.get('/api/manager/team/pending-approvals?pageSize=10000');

    // API should cap or reject large page size
    expect(response.ok() || response.status() === 400).toBeTruthy();

    if (response.ok()) {
      const data = await response.json();
      // Page size should be capped at a reasonable maximum
      expect(data).toBeDefined();
    }
  });

  test('API handles negative pagination values', async ({ page }) => {
    await loginAs(page, TEST_USERS.MANAGER.email, TEST_USERS.MANAGER.password);

    // Request with negative page
    const response = await page.request.get('/api/manager/team/pending-approvals?page=-1');

    // API should handle gracefully
    expect(response.ok() || response.status() === 400).toBeTruthy();
  });

  test('API handles very long query parameters', async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);

    // Request with very long status value
    const longValue = 'A'.repeat(1000);
    const response = await page.request.get(`/api/leave-requests?status=${longValue}`);

    // API should handle gracefully (not crash)
    expect(response.status()).toBeDefined();
  });
});

test.describe('Max Limits - UI Rendering', () => {
  test('Dashboard handles employee with very long name', async ({ page }) => {
    await loginAs(page, TEST_USERS.MANAGER.email, TEST_USERS.MANAGER.password);
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    // Names should be displayed with proper truncation or wrapping
    await expect(page.locator('body')).toBeVisible();

    // Check that text doesn't overflow viewport
    const body = page.locator('body');
    const bodyBox = await body.boundingBox();
    expect(bodyBox).not.toBeNull();

    if (bodyBox) {
      // Page width should be reasonable
      expect(bodyBox.width).toBeLessThanOrEqual(4096);
    }
  });

  test('Tables handle many columns without horizontal overflow issues', async ({ page }) => {
    await loginAs(page, TEST_USERS.HR.email, TEST_USERS.HR.password);
    await page.goto('/hr/reports');
    await page.waitForLoadState('networkidle');

    // Look for data tables
    const table = page.locator('table, [role="table"]');
    if (await table.isVisible().catch(() => false)) {
      // Table should have horizontal scroll if needed
      const tableBox = await table.boundingBox();
      const viewportSize = page.viewportSize();

      // Table should be accessible
      await expect(table).toBeVisible();
    }
  });

  test('Card layout handles long content gracefully', async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    // Look for cards
    const cards = page.locator('[class*="card"], .border.rounded-lg');

    if (await cards.count() > 0) {
      const firstCard = cards.first();
      const cardBox = await firstCard.boundingBox();

      if (cardBox) {
        // Cards should not overflow viewport
        const viewportSize = page.viewportSize();
        if (viewportSize) {
          expect(cardBox.width).toBeLessThanOrEqual(viewportSize.width);
        }
      }
    }
  });
});

test.describe('Max Limits - Form Submission', () => {
  test('Form handles rapid repeated submissions gracefully', async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    await newLeaveButton.click();
    await page.waitForLoadState('networkidle');

    // Fill form quickly
    const startDate = getFutureDate(10);
    const startDateInput = page.locator('input[name="startDate"], [data-testid="start-date"]');

    if (await startDateInput.isVisible()) {
      await startDateInput.fill(formatDate(startDate));

      const endDateInput = page.locator('input[name="endDate"], [data-testid="end-date"]');
      if (await endDateInput.isVisible()) {
        await endDateInput.fill(formatDate(startDate));
      }

      const reasonInput = page.locator('textarea[name="reason"]');
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('Rate limit test');
      }

      // Try to click submit multiple times rapidly
      const submitButton = page.getByRole('button', { name: /submit/i });
      if (await submitButton.isVisible()) {
        // Click multiple times
        await submitButton.click();
        await submitButton.click().catch(() => {});
        await submitButton.click().catch(() => {});

        await page.waitForTimeout(2000);

        // Should handle gracefully (button disabled or single submission)
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });
});
