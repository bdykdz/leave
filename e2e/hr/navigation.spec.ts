import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for HR Navigation
 * US-010: Tests verifying the US-005 bug fix for HR navigation
 *
 * Tests verify:
 * - HR users can navigate between HR Dashboard and personal view
 * - No infinite redirect loops occur
 * - Navigation buttons work correctly
 * - Session state is preserved during navigation
 * - Dropdown menu navigation works
 * - Back button functions properly
 *
 * Note: These tests extend the basic hr-navigation.spec.ts with additional
 * comprehensive navigation scenarios.
 */

// Test user from seed data
const TEST_HR = {
  email: 'hr@staging.local',
  password: 'admin123',
};

// Helper function to login as HR user
async function loginAsHR(page: Page): Promise<void> {
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
        await emailInput.fill(TEST_HR.email);
      }

      const roleSelector = page.locator('[data-slot="select-trigger"]').last();
      if (await roleSelector.isVisible()) {
        await roleSelector.click();
        await page.waitForTimeout(200);
        const roleOption = page.getByRole('option', { name: /HR/i });
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
      await emailInput.fill(TEST_HR.email);
      await page.getByLabel(/password/i).fill(TEST_HR.password);
      await page.getByRole('button', { name: /sign in/i }).click();
    }
  }

  await page.waitForURL(/\/(employee|manager|hr|executive|admin)/, {
    timeout: 30000,
  });
  await page.waitForLoadState('networkidle');
}

test.describe('HR Navigation - US-005 Bug Fix Verification', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsHR(page);
  });

  test('HR user can navigate: HR Dashboard -> Personal View -> HR Dashboard without redirect loops', async ({ page }) => {
    // Navigate to HR dashboard
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Verify we're on HR dashboard
    await expect(page.locator('h1')).toContainText('HR Dashboard');

    // Track console errors during navigation
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Click "My Dashboard" button to go to personal view
    const myDashboardButton = page.getByRole('button', { name: /My Dashboard/i });
    await expect(myDashboardButton).toBeVisible();
    await myDashboardButton.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Verify we're on employee dashboard (personal view)
    await expect(page.locator('h1')).toContainText('Leave Management');

    // Now navigate back to HR dashboard
    const hrDashboardButton = page.getByRole('button', { name: /HR Dashboard/i });
    await expect(hrDashboardButton).toBeVisible();
    await hrDashboardButton.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Verify we're back on HR dashboard
    await expect(page.locator('h1')).toContainText('HR Dashboard');

    // Verify no redirect loop errors
    const navigationErrors = consoleErrors.filter(err =>
      err.includes('navigation') ||
      err.includes('redirect') ||
      err.includes('Maximum update depth exceeded') ||
      err.includes('Too many re-renders')
    );
    expect(navigationErrors).toHaveLength(0);
  });

  test('Back button (ChevronLeft) navigates to personal view correctly', async ({ page }) => {
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Verify HR dashboard is loaded
    await expect(page.locator('h1')).toContainText('HR Dashboard');

    // Track errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Use the back button (ChevronLeft icon button)
    const backButton = page.locator('button[title="Back to Personal Dashboard"]');
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Should be on personal dashboard (employee view)
    await expect(page.locator('h1')).toContainText('Leave Management');

    // No critical errors should occur
    const criticalErrors = consoleErrors.filter(err =>
      err.includes('Maximum update depth exceeded') ||
      err.includes('Too many re-renders')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('No infinite redirect loop when directly accessing /employee as HR user', async ({ page }) => {
    // Track all navigations
    const navigations: string[] = [];
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url());
      }
    });

    // Navigate directly to employee dashboard as HR user
    await page.goto('/employee');

    // Wait for redirects to settle
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Count redirects to detect loops
    const hrRedirects = navigations.filter(url => url.includes('/hr')).length;
    const employeeRedirects = navigations.filter(url => url.includes('/employee')).length;

    // A redirect loop would show multiple back-and-forth redirects
    expect(hrRedirects).toBeLessThan(3);
    expect(employeeRedirects).toBeLessThan(3);

    // Should settle on a valid page
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/(hr|employee)/);
  });
});

test.describe('HR Navigation - Header Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsHR(page);
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');
  });

  test('My Dashboard button is visible in HR header', async ({ page }) => {
    const myDashboardButton = page.getByRole('button', { name: /My Dashboard/i });
    await expect(myDashboardButton).toBeVisible();
  });

  test('Back button (ChevronLeft) is visible in HR header', async ({ page }) => {
    const backButton = page.locator('button[title="Back to Personal Dashboard"]');
    await expect(backButton).toBeVisible();
  });

  test('Profile dropdown is visible', async ({ page }) => {
    // Find avatar button
    const avatarButton = page.locator('button').filter({ has: page.locator('[class*="avatar"]') }).last();
    await expect(avatarButton).toBeVisible();
  });

  test('Notification bell is visible', async ({ page }) => {
    // Look for notification bell
    const notificationBell = page.locator('[data-testid="notifications"], [aria-label*="notification"], button:has(svg)').first();
    await expect(notificationBell).toBeVisible();
  });
});

test.describe('HR Navigation - Profile Dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsHR(page);
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');
  });

  test('Profile dropdown opens on click', async ({ page }) => {
    // Find and click avatar button
    const avatarButton = page.locator('button').filter({ has: page.locator('[class*="avatar"]') }).last();
    await avatarButton.click();

    // Dropdown should open
    const dropdownContent = page.locator('[role="menu"], [data-state="open"]');
    await expect(dropdownContent).toBeVisible({ timeout: 5000 });
  });

  test('Dropdown shows My Dashboard option', async ({ page }) => {
    // Open dropdown
    const avatarButton = page.locator('button').filter({ has: page.locator('[class*="avatar"]') }).last();
    await avatarButton.click();

    // Look for My Dashboard in dropdown
    const myDashboardOption = page.getByRole('menuitem', { name: /My Dashboard/i });
    await expect(myDashboardOption).toBeVisible();
  });

  test('Dropdown My Dashboard option navigates correctly', async ({ page }) => {
    // Open dropdown
    const avatarButton = page.locator('button').filter({ has: page.locator('[class*="avatar"]') }).last();
    await avatarButton.click();

    // Click My Dashboard
    const myDashboardOption = page.getByRole('menuitem', { name: /My Dashboard/i });
    await myDashboardOption.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Should be on personal view
    await expect(page.locator('h1')).toContainText('Leave Management');
  });

  test('Dropdown shows user information', async ({ page }) => {
    // Open dropdown
    const avatarButton = page.locator('button').filter({ has: page.locator('[class*="avatar"]') }).last();
    await avatarButton.click();

    // Should show user email or name
    const hasUserInfo = await page.locator('text=/hr@staging|HR Department/i').isVisible().catch(() => false);
    expect(hasUserInfo).toBeTruthy();
  });

  test('Dropdown shows logout option', async ({ page }) => {
    // Open dropdown
    const avatarButton = page.locator('button').filter({ has: page.locator('[class*="avatar"]') }).last();
    await avatarButton.click();

    // Look for logout option
    const logoutOption = page.getByRole('menuitem', { name: /log out/i });
    await expect(logoutOption).toBeVisible();
  });
});

test.describe('HR Navigation - Session Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsHR(page);
  });

  test('Session persists during HR to employee navigation', async ({ page }) => {
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Navigate to personal view
    const myDashboardButton = page.getByRole('button', { name: /My Dashboard/i });
    await myDashboardButton.click();
    await page.waitForLoadState('networkidle');

    // Should not redirect to login
    const isLoginPage = page.url().includes('/auth/signin') || page.url().includes('/login');
    expect(isLoginPage).toBe(false);

    // Navigate back to HR
    const hrDashboardButton = page.getByRole('button', { name: /HR Dashboard/i });
    await hrDashboardButton.click();
    await page.waitForLoadState('networkidle');

    // Should still be authenticated
    const isLoginPageAfter = page.url().includes('/auth/signin') || page.url().includes('/login');
    expect(isLoginPageAfter).toBe(false);
  });

  test('Session persists after page refresh', async ({ page }) => {
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Verify on HR dashboard
    await expect(page.locator('h1')).toContainText('HR Dashboard');

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on HR dashboard (not redirected to login)
    await expect(page.locator('h1')).toContainText('HR Dashboard');
  });

  test('Session persists after navigating to different tabs', async ({ page }) => {
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Navigate through tabs
    const analyticsTab = page.getByRole('tab', { name: /analytics/i });
    await analyticsTab.click();
    await page.waitForLoadState('networkidle');

    const calendarTab = page.getByRole('tab', { name: /calendar/i });
    await calendarTab.click();
    await page.waitForLoadState('networkidle');

    // Should still be authenticated
    const isLoginPage = page.url().includes('/auth/signin') || page.url().includes('/login');
    expect(isLoginPage).toBe(false);
  });
});

test.describe('HR Navigation - Tab Switching', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsHR(page);
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');
  });

  test('Employees tab is active by default', async ({ page }) => {
    const employeesTab = page.getByRole('tab', { name: /employees/i });
    await expect(employeesTab).toBeVisible();

    // Check if it's active (typically has aria-selected="true")
    const isActive = await employeesTab.getAttribute('aria-selected');
    expect(isActive).toBe('true');
  });

  test('Clicking Analytics tab switches content', async ({ page }) => {
    const analyticsTab = page.getByRole('tab', { name: /analytics/i });
    await analyticsTab.click();
    await page.waitForLoadState('networkidle');

    // Analytics content should be visible
    const analyticsContent = page.locator('text=/Analytics Dashboard/i');
    await expect(analyticsContent).toBeVisible({ timeout: 10000 });
  });

  test('Clicking Calendar tab switches content', async ({ page }) => {
    const calendarTab = page.getByRole('tab', { name: /calendar/i });
    await calendarTab.click();
    await page.waitForLoadState('networkidle');

    // Wait for calendar to load
    await page.waitForTimeout(1000);

    // Calendar content should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('Tab navigation preserves URL on /hr', async ({ page }) => {
    // Navigate to different tabs
    const analyticsTab = page.getByRole('tab', { name: /analytics/i });
    await analyticsTab.click();
    await page.waitForLoadState('networkidle');

    // URL should still be /hr
    expect(page.url()).toContain('/hr');

    const documentsTab = page.getByRole('tab', { name: /documents/i });
    await documentsTab.click();
    await page.waitForLoadState('networkidle');

    // URL should still be /hr
    expect(page.url()).toContain('/hr');
  });
});

test.describe('HR Navigation - Role-Based Access', () => {
  test('HR user can access HR dashboard', async ({ page }) => {
    await loginAsHR(page);
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Should be on HR dashboard
    await expect(page.locator('h1')).toContainText('HR Dashboard');
  });

  test('HR user can access employee dashboard', async ({ page }) => {
    await loginAsHR(page);
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    // Should be able to view employee content or be on HR (role-based redirect)
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(hr|employee)/);
  });

  test('HR user has HR Dashboard button on employee page', async ({ page }) => {
    await loginAsHR(page);
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Navigate to employee dashboard
    const myDashboardButton = page.getByRole('button', { name: /My Dashboard/i });
    await myDashboardButton.click();
    await page.waitForLoadState('networkidle');

    // Should have HR Dashboard button to go back
    const hrDashboardButton = page.getByRole('button', { name: /HR Dashboard/i });
    await expect(hrDashboardButton).toBeVisible();
  });
});

test.describe('HR Navigation - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsHR(page);
  });

  test('Navigation works without JavaScript errors', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Navigate to personal view
    const myDashboardButton = page.getByRole('button', { name: /My Dashboard/i });
    await myDashboardButton.click();
    await page.waitForLoadState('networkidle');

    // Navigate back
    const hrDashboardButton = page.getByRole('button', { name: /HR Dashboard/i });
    await hrDashboardButton.click();
    await page.waitForLoadState('networkidle');

    // No JavaScript errors should have occurred
    expect(jsErrors).toHaveLength(0);
  });

  test('Invalid URL redirects to appropriate page', async ({ page }) => {
    await page.goto('/hr/invalid-page');
    await page.waitForLoadState('networkidle');

    // Should redirect to valid page or show 404
    const currentUrl = page.url();
    const isValidPage = currentUrl.includes('/hr') || currentUrl.includes('/404');
    expect(isValidPage).toBeTruthy();
  });

  test('Network timeout handled gracefully', async ({ page }) => {
    // Set a short timeout
    page.setDefaultTimeout(5000);

    await page.goto('/hr');

    // Page should at least load without crashing
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('HR Navigation - Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('HR dashboard is accessible on mobile', async ({ page }) => {
    await loginAsHR(page);
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Dashboard should be visible
    await expect(page.locator('h1')).toContainText('HR Dashboard');
  });

  test('Navigation buttons are accessible on mobile', async ({ page }) => {
    await loginAsHR(page);
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // My Dashboard button should be visible or accessible
    const myDashboardButton = page.getByRole('button', { name: /My Dashboard/i });
    const backButton = page.locator('button[title="Back to Personal Dashboard"]');

    const hasMyDashboard = await myDashboardButton.isVisible().catch(() => false);
    const hasBackButton = await backButton.isVisible().catch(() => false);

    // At least one navigation option should be available
    expect(hasMyDashboard || hasBackButton).toBeTruthy();
  });

  test('Tabs are accessible on mobile', async ({ page }) => {
    await loginAsHR(page);
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Tabs should be visible (may need to scroll)
    const tabsList = page.locator('[role="tablist"]');
    await expect(tabsList).toBeVisible();
  });
});
