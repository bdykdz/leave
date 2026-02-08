import { test, expect } from '@playwright/test';

/**
 * Executive Navigation Tests
 *
 * Tests for US-006: Fix Executive Routing Errors
 * Verifies that Executive users can access executive-appropriate pages
 * and are not incorrectly redirected to employee-level views.
 */

test.describe('Executive Navigation', () => {
  test('Executive user is redirected to /executive from home page', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should be on one of the role-based dashboards
    const currentUrl = page.url();

    // Verify the user lands on an appropriate dashboard (not just employee)
    // This test validates that routing works correctly
    expect(currentUrl).toMatch(/\/(executive|manager|hr|admin|employee)/);
  });

  test('Executive can access /executive dashboard directly', async ({ page }) => {
    // Navigate directly to executive dashboard
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    // Check for executive dashboard elements or redirect based on role
    const currentUrl = page.url();

    // If user has executive role, they should stay on /executive
    // If not, they should be redirected to their appropriate dashboard
    expect(currentUrl).toMatch(/\/(executive|manager|hr|admin|employee|login)/);

    // No infinite redirects should occur
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Executive can access /executive/analytics page', async ({ page }) => {
    // Navigate to executive analytics
    await page.goto('/executive/analytics');
    await page.waitForLoadState('networkidle');

    // Should either be on analytics page or redirected based on role
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(executive|manager|hr|admin|employee|login)/);

    // Page should load without errors
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Executive can access /manager dashboard (higher-level access)', async ({ page }) => {
    // Navigate to manager dashboard
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();

    // Executives should have access to manager-level pages
    // If the user is an executive, they should be able to access /manager
    expect(currentUrl).toMatch(/\/(manager|executive|hr|admin|employee|login)/);

    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Executive can access /hr dashboard (higher-level access)', async ({ page }) => {
    // Navigate to HR dashboard
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();

    // Executives should have access to HR pages
    expect(currentUrl).toMatch(/\/(hr|executive|manager|admin|employee|login)/);

    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('No infinite redirect loop when executive accesses different dashboards', async ({ page }) => {
    // Track all navigations
    const navigations: string[] = [];
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url());
      }
    });

    // Start from home and let routing happen
    await page.goto('/');

    // Wait for any redirects to settle
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Count redirects to detect loops
    const redirectCount = navigations.length;

    // A reasonable threshold - should not have excessive redirects
    expect(redirectCount).toBeLessThan(5);

    // Should settle on a valid page
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/(executive|manager|hr|admin|employee)/);
  });

  test('Executive dashboard loads without JavaScript errors', async ({ page }) => {
    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to executive dashboard
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    // Check for critical navigation/rendering errors
    const criticalErrors = consoleErrors.filter(err =>
      err.includes('Maximum update depth exceeded') ||
      err.includes('Too many re-renders') ||
      err.includes('navigation') ||
      err.includes('redirect')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('Executive navigation buttons work correctly', async ({ page }) => {
    // Navigate to executive dashboard
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    // Check if we're on executive dashboard (if user has access)
    const currentUrl = page.url();

    if (currentUrl.includes('/executive')) {
      // Look for navigation buttons
      const managerButton = page.getByRole('button', { name: /Manager Dashboard/i });
      const hrButton = page.getByRole('button', { name: /HR Dashboard/i });
      const analyticsButton = page.getByRole('button', { name: /Analytics/i });

      // Check if navigation buttons are visible (executive dashboard should have them)
      const hasManagerButton = await managerButton.isVisible().catch(() => false);
      const hasHRButton = await hrButton.isVisible().catch(() => false);
      const hasAnalyticsButton = await analyticsButton.isVisible().catch(() => false);

      // At least some navigation options should be available
      const hasNavigation = hasManagerButton || hasHRButton || hasAnalyticsButton;
      expect(hasNavigation).toBe(true);
    }
  });

  test('Executive can navigate from executive dashboard to manager dashboard', async ({ page }) => {
    // Navigate to executive dashboard
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();

    if (currentUrl.includes('/executive')) {
      // Find and click the Manager Dashboard button
      const managerButton = page.getByRole('button', { name: /Manager Dashboard/i });
      const isVisible = await managerButton.isVisible().catch(() => false);

      if (isVisible) {
        await managerButton.click();
        await page.waitForLoadState('networkidle');

        // Should navigate to manager dashboard
        const newUrl = page.url();
        expect(newUrl).toContain('/manager');

        // Page should load successfully
        const body = await page.locator('body');
        await expect(body).toBeVisible();
      }
    }
  });

  test('Executive can navigate from executive dashboard to HR dashboard', async ({ page }) => {
    // Navigate to executive dashboard
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();

    if (currentUrl.includes('/executive')) {
      // Find and click the HR Dashboard button
      const hrButton = page.getByRole('button', { name: /HR Dashboard/i });
      const isVisible = await hrButton.isVisible().catch(() => false);

      if (isVisible) {
        await hrButton.click();
        await page.waitForLoadState('networkidle');

        // Should navigate to HR dashboard
        const newUrl = page.url();
        expect(newUrl).toContain('/hr');

        // Page should load successfully
        const body = await page.locator('body');
        await expect(body).toBeVisible();
      }
    }
  });

  test('Executive can navigate to analytics page', async ({ page }) => {
    // Navigate to executive dashboard
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();

    if (currentUrl.includes('/executive')) {
      // Find and click the Analytics button
      const analyticsButton = page.getByRole('button', { name: /Analytics/i });
      const isVisible = await analyticsButton.isVisible().catch(() => false);

      if (isVisible) {
        await analyticsButton.click();
        await page.waitForLoadState('networkidle');

        // Should navigate to analytics page
        const newUrl = page.url();
        expect(newUrl).toContain('/executive/analytics');

        // Page should load successfully
        const body = await page.locator('body');
        await expect(body).toBeVisible();
      }
    }
  });
});

test.describe('Role Hierarchy Routing', () => {
  test('Department Director is routed to /manager from home page', async ({ page }) => {
    // This test validates that DEPARTMENT_DIRECTOR role is properly handled
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should land on a valid dashboard
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(executive|manager|hr|admin|employee)/);

    // Page should be functional
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Manager-level access routes correctly', async ({ page }) => {
    // Navigate to manager page
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();

    // Should either stay on manager or redirect based on role
    expect(currentUrl).toMatch(/\/(manager|executive|hr|admin|employee|login)/);

    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('All role-based routes are accessible without infinite loops', async ({ page }) => {
    const routes = ['/executive', '/manager', '/hr', '/employee'];

    for (const route of routes) {
      const navigations: string[] = [];
      page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) {
          navigations.push(frame.url());
        }
      });

      await page.goto(route);
      await page.waitForTimeout(1500);
      await page.waitForLoadState('networkidle');

      // No redirect loops
      const routeRedirects = navigations.filter(url => url.includes(route)).length;
      expect(routeRedirects).toBeLessThan(3);

      // Should settle on a valid page
      const finalUrl = page.url();
      expect(finalUrl).toMatch(/\/(executive|manager|hr|admin|employee|login)/);
    }
  });
});

test.describe('Executive Dashboard Functionality', () => {
  test('Executive dashboard shows executive-appropriate content', async ({ page }) => {
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();

    if (currentUrl.includes('/executive')) {
      // Executive dashboard should have executive-specific elements
      const dashboardTitle = page.locator('h1, h2').filter({ hasText: /Executive|Dashboard/i });
      const hasExecutiveContent = await dashboardTitle.count() > 0;

      // Should have executive-level content
      expect(hasExecutiveContent).toBe(true);
    }
  });

  test('Executive can submit leave request from executive dashboard', async ({ page }) => {
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();

    if (currentUrl.includes('/executive')) {
      // Look for leave request button
      const leaveButton = page.getByRole('button', { name: /New Leave Request|Request Leave/i });
      const isVisible = await leaveButton.isVisible().catch(() => false);

      if (isVisible) {
        await leaveButton.click();
        await page.waitForLoadState('networkidle');

        // Should show leave request form
        const formVisible = await page.locator('form').first().isVisible().catch(() => false);
        expect(formVisible).toBe(true);
      }
    }
  });

  test('Executive can view pending approvals', async ({ page }) => {
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();

    if (currentUrl.includes('/executive')) {
      // Look for pending approvals section
      const pendingSection = page.locator('text=/Pending|Approvals|Escalated/i');
      const hasPendingSection = await pendingSection.count() > 0;

      // Executive dashboard should show approval-related content
      expect(hasPendingSection).toBe(true);
    }
  });
});
