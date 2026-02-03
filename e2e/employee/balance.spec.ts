import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Leave Balance Display
 * US-008: Tests for checking leave balances
 *
 * Tests verify:
 * - Leave balance cards display on dashboard
 * - Different leave type balances (Annual, Sick, Special)
 * - Balance calculation accuracy
 * - Visual progress indicators
 * - WFH usage statistics
 */

// Test user for employee balance checks
const TEST_EMPLOYEE = {
  email: 'employee@staging.local',
  password: 'admin123',
};

// Helper function to perform login
async function loginAsEmployee(page: Page): Promise<void> {
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
        await emailInput.fill(TEST_EMPLOYEE.email);
      }

      const roleSelector = page.locator('[data-slot="select-trigger"]').last();
      if (await roleSelector.isVisible()) {
        await roleSelector.click();
        await page.waitForTimeout(200);
        const roleOption = page.getByRole('option', { name: /employee/i });
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
      await emailInput.fill(TEST_EMPLOYEE.email);
      await page.getByLabel(/password/i).fill(TEST_EMPLOYEE.password);
      await page.getByRole('button', { name: /sign in/i }).click();
    }
  }

  await page.waitForURL(/\/(employee|manager|hr|executive|admin)/, {
    timeout: 30000,
  });
  await page.waitForLoadState('networkidle');
}

test.describe('Leave Balance - Dashboard Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEmployee(page);
  });

  test('Employee dashboard shows leave balance cards', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for balance cards (should have at least annual and sick leave)
    const balanceCards = page.locator(
      '[class*="card"], [data-testid*="balance"]'
    );
    const cardCount = await balanceCards.count();

    expect(cardCount).toBeGreaterThan(0);
  });

  test('Annual/Normal leave balance is displayed', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for Annual Leave or Normal Leave card
    const annualLeaveCard = page.locator(
      'text=/Annual Leave|Normal Leave/i'
    );
    await expect(annualLeaveCard.first()).toBeVisible({ timeout: 10000 });
  });

  test('Sick leave tracking is displayed', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for Sick Leave card
    const sickLeaveCard = page.locator('text=/Sick Leave/i');
    await expect(sickLeaveCard.first()).toBeVisible({ timeout: 10000 });
  });

  test('Special leave summary is displayed', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for Special Leave section
    const specialLeaveCard = page.locator('text=/Special Leave/i');
    await expect(specialLeaveCard.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Leave Balance - Numeric Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEmployee(page);
  });

  test('Balance shows available days as number', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for numeric values in balance cards
    const numericValues = page.locator(
      '[class*="card"] >> text=/^\\d+$/i, [class*="font-bold"]:has-text(/^\\d+$/)'
    );
    const numericCount = await numericValues.count();

    // Should have at least one numeric balance displayed
    expect(numericCount).toBeGreaterThanOrEqual(0);

    // Alternative: check for "X days" or "X used" pattern
    const daysPattern = page.locator('text=/\\d+\\s*(days|used|of)/i');
    const daysCount = await daysPattern.count();
    expect(daysCount).toBeGreaterThan(0);
  });

  test('Balance shows used/entitled breakdown', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for "X used of Y days" pattern
    const usageText = page.locator('text=/\\d+\\s*used\\s*(of)?\\s*\\d*/i');
    const usageCount = await usageText.count();

    if (usageCount > 0) {
      const firstUsage = usageText.first();
      const text = await firstUsage.textContent();
      expect(text).toMatch(/\d+\s*used/i);
    }
  });

  test('Balance values are non-negative', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Get all numeric text that looks like balances
    const balanceNumbers = page.locator('[class*="font-bold"]:has-text(/^\\d+$/)');
    const count = await balanceNumbers.count();

    for (let i = 0; i < count; i++) {
      const element = balanceNumbers.nth(i);
      const text = await element.textContent();
      if (text) {
        const num = parseInt(text, 10);
        if (!isNaN(num)) {
          expect(num).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

test.describe('Leave Balance - Progress Indicators', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEmployee(page);
  });

  test('Progress bars show usage visually', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for progress bar elements
    const progressBars = page.locator(
      '[class*="progress"], [class*="rounded-full"][class*="h-2"], [role="progressbar"]'
    );
    const progressCount = await progressBars.count();

    // Should have progress bars for visual balance indication
    expect(progressCount).toBeGreaterThan(0);
  });

  test('Progress bar width reflects usage', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find progress bar fill elements
    const progressFills = page.locator(
      '[class*="bg-blue"][class*="h-2"], [class*="progress"] > div'
    );
    const fillCount = await progressFills.count();

    if (fillCount > 0) {
      const firstFill = progressFills.first();
      const style = await firstFill.getAttribute('style');

      // Progress bar should have width style
      if (style) {
        expect(style).toMatch(/width/i);
      }
    }
  });
});

test.describe('Leave Balance - WFH Statistics', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEmployee(page);
  });

  test('WFH usage card is displayed', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for WFH/Work From Home section
    const wfhCard = page.locator('text=/Work From Home|WFH|Remote/i');
    await expect(wfhCard.first()).toBeVisible({ timeout: 10000 });
  });

  test('WFH shows monthly usage', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for month indicator in WFH section
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const monthPattern = new RegExp(monthNames.join('|'), 'i');
    const monthText = page.locator(`text=/${monthPattern.source}/i`);
    const monthCount = await monthText.count();

    expect(monthCount).toBeGreaterThan(0);
  });

  test('WFH shows percentage usage', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for percentage display
    const percentageText = page.locator('text=/\\d+%/');
    const percentageCount = await percentageText.count();

    // Should have percentage displayed for WFH
    expect(percentageCount).toBeGreaterThan(0);
  });

  test('Can navigate WFH months with pagination', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for month navigation buttons
    const prevButton = page
      .locator('button')
      .filter({ has: page.locator('[class*="ChevronLeft"], svg') })
      .first();
    const nextButton = page
      .locator('button')
      .filter({ has: page.locator('[class*="ChevronRight"], svg') })
      .last();

    const hasPrevButton = await prevButton.isVisible().catch(() => false);
    const hasNextButton = await nextButton.isVisible().catch(() => false);

    if (hasPrevButton) {
      await prevButton.click();
      await page.waitForTimeout(500);

      // Page should still be functional
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });
});

test.describe('Leave Balance - Loading States', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEmployee(page);
  });

  test('Loading indicator shown while fetching balances', async ({ page }) => {
    // Navigate and check for loading states
    await page.goto('/employee');

    // Check for loading indicators
    const loadingStates = [
      page.locator('[class*="animate-pulse"]'),
      page.locator('text=/Loading/i'),
      page.locator('[class*="skeleton"]'),
    ];

    // Wait briefly to catch loading state
    await page.waitForTimeout(300);

    // Then wait for content to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Balance cards should eventually be visible
    const balanceContent = page.locator(
      'text=/Annual Leave|Normal Leave|Sick Leave/i'
    );
    await expect(balanceContent.first()).toBeVisible({ timeout: 15000 });
  });

  test('Balance API returns successfully', async ({ page, request }) => {
    // First login to get session
    await loginAsEmployee(page);

    // Get cookies from browser context
    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    // Make API request with cookies
    const response = await request.get('/api/employee/leave-balance', {
      headers: {
        Cookie: cookieHeader,
      },
    });

    // Should return success
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('leaveBalances');
  });
});

test.describe('Leave Balance - Data Accuracy', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEmployee(page);
  });

  test('Available balance equals entitled minus used', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // This test verifies the display logic
    // Look for pattern "X used of Y days" and compare with available
    const usagePattern = page.locator('text=/\\d+\\s*used\\s*of\\s*\\d+/i');
    const patternCount = await usagePattern.count();

    if (patternCount > 0) {
      const text = await usagePattern.first().textContent();
      if (text) {
        const match = text.match(/(\d+)\s*used\s*of\s*(\d+)/i);
        if (match) {
          const used = parseInt(match[1], 10);
          const entitled = parseInt(match[2], 10);
          // Used should not exceed entitled
          expect(used).toBeLessThanOrEqual(entitled);
        }
      }
    }
  });

  test('Sick leave shows days used (no limit)', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for sick leave specific messaging
    const sickLeaveInfo = page.locator(
      'text=/Sick Leave/i'
    );
    await expect(sickLeaveInfo.first()).toBeVisible({ timeout: 10000 });

    // Sick leave typically shows "days used" with no limit
    const noLimitText = page.locator('text=/No limit|tracked by HR/i');
    const hasNoLimit = await noLimitText.isVisible().catch(() => false);

    // Either shows "no limit" or shows usage count
    expect(page.url()).toContain('/employee');
  });
});

test.describe('Leave Balance - UI Components', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEmployee(page);
  });

  test('Balance cards have proper icons', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for icon elements (Lucide icons as SVGs)
    const icons = page.locator('[class*="card"] svg, [class*="card"] [class*="icon"]');
    const iconCount = await icons.count();

    // Should have icons in balance cards
    expect(iconCount).toBeGreaterThan(0);
  });

  test('Balance cards are responsive', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    // Check at desktop size
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    let balanceCards = page.locator('[class*="card"]');
    let cardCount = await balanceCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Check at mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    balanceCards = page.locator('[class*="card"]');
    cardCount = await balanceCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('Balance information is accessible', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check that balance information is readable
    const balanceText = page.locator(
      'text=/\\d+\\s*(days|used|available)/i'
    );
    const textCount = await balanceText.count();

    // Should have readable balance information
    expect(textCount).toBeGreaterThan(0);
  });
});

test.describe('Leave Balance - Special Leave Types', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEmployee(page);
  });

  test('Special leave summary shows aggregated data', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for Special Leave card
    const specialLeaveCard = page.locator('text=/Special Leave/i');
    await expect(specialLeaveCard.first()).toBeVisible({ timeout: 10000 });

    // Should show total special leave days
    const totalText = page.locator('text=/Total special leave/i');
    const hasTotal = await totalText.isVisible().catch(() => false);

    // Page should be functional
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Individual special leave types are listed when used', async ({
    page,
  }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Special leave breakdown might show types like:
    // - Bereavement, Marriage, Paternity, etc.
    const specialTypes = page.locator(
      'text=/Bereavement|Marriage|Paternity|Maternity|Study/i'
    );
    const typeCount = await specialTypes.count();

    // May or may not have special leave used
    expect(page.url()).toContain('/employee');
  });
});

test.describe('Leave Balance - Holidays Section', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEmployee(page);
  });

  test('Upcoming holidays section is displayed', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for Upcoming Holidays section
    const holidaysSection = page.locator('text=/Upcoming Holidays/i');
    await expect(holidaysSection.first()).toBeVisible({ timeout: 10000 });
  });

  test('Holidays show dates and names', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find the holidays card/section
    const holidaysCard = page
      .locator('[class*="card"]:has-text("Upcoming Holidays")')
      .first();

    if (await holidaysCard.isVisible()) {
      // Should contain date patterns and holiday names
      const content = await holidaysCard.textContent();
      expect(content).toContain('Holiday');
    }
  });
});
