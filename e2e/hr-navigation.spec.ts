import { test, expect } from '@playwright/test';

/**
 * HR Navigation Tests
 *
 * Tests for US-005: Fix HR Navigation Issue
 * Verifies that HR users can navigate between HR Dashboard and personal view seamlessly.
 */

test.describe('HR Navigation', () => {
  // This test will initially fail to demonstrate the bug
  test('HR user can navigate: HR Dashboard -> Personal View -> HR Dashboard without errors', async ({ page }) => {
    // Navigate to HR dashboard
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Verify we're on the HR dashboard
    await expect(page.locator('h1')).toContainText('HR Dashboard');

    // Look for console errors during navigation
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

    // Verify we can access personal view (employee dashboard)
    // The employee page should be accessible without immediately redirecting back
    const currentUrl = page.url();

    // HR user should be able to see the employee dashboard (personal view)
    // If this fails with a redirect loop, the bug exists
    await expect(page.locator('h1')).toContainText('Leave Management');

    // Now navigate back to HR dashboard
    const hrDashboardButton = page.getByRole('button', { name: /HR Dashboard/i });
    await expect(hrDashboardButton).toBeVisible();
    await hrDashboardButton.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Verify we're back on HR dashboard
    await expect(page.locator('h1')).toContainText('HR Dashboard');

    // No console errors should have occurred during navigation
    const navigationErrors = consoleErrors.filter(err =>
      err.includes('navigation') ||
      err.includes('redirect') ||
      err.includes('Maximum update depth exceeded')
    );
    expect(navigationErrors).toHaveLength(0);
  });

  test('HR dashboard navigation buttons are visible and accessible', async ({ page }) => {
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Verify HR Dashboard header
    await expect(page.locator('h1')).toContainText('HR Dashboard');

    // Check for "My Dashboard" button (main button in header)
    const myDashboardButton = page.getByRole('button', { name: /My Dashboard/i });
    await expect(myDashboardButton).toBeVisible();

    // Check for back button (ChevronLeft icon button)
    const backButton = page.locator('button[title="Back to Personal Dashboard"]');
    await expect(backButton).toBeVisible();
  });

  test('HR user can use back button to navigate to personal view', async ({ page }) => {
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Verify we're on HR dashboard
    await expect(page.locator('h1')).toContainText('HR Dashboard');

    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Use the back button (ChevronLeft icon)
    const backButton = page.locator('button[title="Back to Personal Dashboard"]');
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Should be on personal dashboard (employee view)
    await expect(page.locator('h1')).toContainText('Leave Management');

    // No critical navigation errors
    const criticalErrors = consoleErrors.filter(err =>
      err.includes('Maximum update depth exceeded') ||
      err.includes('Too many re-renders')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Navigation state is preserved during HR role switching', async ({ page }) => {
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Verify initial HR dashboard state
    await expect(page.locator('h1')).toContainText('HR Dashboard');

    // Navigate to personal view
    const myDashboardButton = page.getByRole('button', { name: /My Dashboard/i });
    await myDashboardButton.click();
    await page.waitForLoadState('networkidle');

    // Check that user session is still valid (no login redirect)
    const loginPage = page.url().includes('/auth/signin') || page.url().includes('/login');
    expect(loginPage).toBe(false);

    // Navigate back to HR dashboard
    const hrDashboardButton = page.getByRole('button', { name: /HR Dashboard/i });
    await hrDashboardButton.click();
    await page.waitForLoadState('networkidle');

    // Verify we're back on HR dashboard with proper state
    await expect(page.locator('h1')).toContainText('HR Dashboard');

    // Session should still be valid
    const sessionLost = page.url().includes('/auth/signin') || page.url().includes('/login');
    expect(sessionLost).toBe(false);
  });

  test('Dropdown menu My Dashboard option works correctly', async ({ page }) => {
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Verify we're on HR dashboard
    await expect(page.locator('h1')).toContainText('HR Dashboard');

    // Open profile dropdown menu
    const avatarButton = page.locator('button').filter({ has: page.locator('[class*="avatar"]') }).last();
    await avatarButton.click();

    // Click "My Dashboard" in dropdown
    const dropdownMyDashboard = page.getByRole('menuitem', { name: /My Dashboard/i });
    await expect(dropdownMyDashboard).toBeVisible();
    await dropdownMyDashboard.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Should be on personal view without redirect loops
    await expect(page.locator('h1')).toContainText('Leave Management');
  });

  test('No infinite redirect loop when HR user accesses employee dashboard', async ({ page }) => {
    // Track all navigations
    const navigations: string[] = [];
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url());
      }
    });

    // Navigate directly to employee dashboard as HR user
    await page.goto('/employee');

    // Wait a bit for any redirects to settle
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Count redirects to detect loops
    const hrRedirects = navigations.filter(url => url.includes('/hr')).length;
    const employeeRedirects = navigations.filter(url => url.includes('/employee')).length;

    // If there's a redirect loop, we'd see multiple back-and-forth redirects
    // A reasonable threshold is less than 3 redirects to each page
    expect(hrRedirects).toBeLessThan(3);
    expect(employeeRedirects).toBeLessThan(3);

    // Should settle on a valid page (either /hr or /employee, not stuck in loop)
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/(hr|employee)/);
  });
});
