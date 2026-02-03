import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Executive Routing
 * US-011: Tests verifying the US-006 bug fix for Executive Routing Errors
 *
 * Tests verify:
 * - Executive users are correctly routed to /executive dashboard
 * - No infinite redirect loops occur when navigating between dashboards
 * - Executive can access manager and HR dashboards (higher-level access)
 * - Navigation buttons work correctly without errors
 * - Role-based routing handles EXECUTIVE role properly
 */

// Test users from seed data
const TEST_EXECUTIVE = {
  email: 'ceo@staging.local',
  password: 'admin123',
};

const TEST_EXECUTIVE_CTO = {
  email: 'cto@staging.local',
  password: 'admin123',
};

// Helper function to login as executive user
async function loginAsExecutive(page: Page, executive = TEST_EXECUTIVE): Promise<void> {
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
        await emailInput.fill(executive.email);
      }

      const roleSelector = page.locator('[data-slot="select-trigger"]').last();
      if (await roleSelector.isVisible()) {
        await roleSelector.click();
        await page.waitForTimeout(200);
        const roleOption = page.getByRole('option', { name: /Executive/i });
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
      await emailInput.fill(executive.email);
      await page.getByLabel(/password/i).fill(executive.password);
      await page.getByRole('button', { name: /sign in/i }).click();
    }
  }

  await page.waitForURL(/\/(employee|manager|hr|executive|admin)/, {
    timeout: 30000,
  });
  await page.waitForLoadState('networkidle');
}

test.describe('Executive Routing - US-006 Bug Fix Verification', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsExecutive(page);
  });

  test('Executive user is routed to /executive dashboard from home page', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for redirects to settle
    await page.waitForTimeout(2000);

    // Should be redirected to executive dashboard
    const currentUrl = page.url();
    expect(currentUrl).toContain('/executive');

    // Executive dashboard should show executive-specific content
    await expect(page.locator('h1')).toContainText('Executive Dashboard');
  });

  test('Executive can access /executive dashboard directly without redirect loop', async ({ page }) => {
    // Track navigation events to detect redirect loops
    const navigations: string[] = [];
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url());
      }
    });

    // Navigate directly to executive dashboard
    await page.goto('/executive');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Should stay on /executive
    const currentUrl = page.url();
    expect(currentUrl).toContain('/executive');

    // Check for redirect loops - should not have excessive redirects
    const executiveRedirects = navigations.filter(url => url.includes('/executive')).length;
    expect(executiveRedirects).toBeLessThan(3);

    // Page should load successfully
    await expect(page.locator('h1')).toContainText('Executive Dashboard');
  });

  test('No infinite redirect loop when executive accesses home page', async ({ page }) => {
    // Track all navigations
    const navigations: string[] = [];
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url());
      }
    });

    // Navigate to home
    await page.goto('/');
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Check for redirect loops
    const totalRedirects = navigations.length;
    expect(totalRedirects).toBeLessThan(5);

    // Should settle on executive dashboard
    const finalUrl = page.url();
    expect(finalUrl).toContain('/executive');
  });

  test('Executive dashboard loads without JavaScript errors', async ({ page }) => {
    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Track page errors
    const pageErrors: string[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
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
    expect(pageErrors).toHaveLength(0);
  });
});

test.describe('Executive Cross-Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsExecutive(page);
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');
  });

  test('Executive can access Manager Dashboard (higher-level access)', async ({ page }) => {
    // Track navigations
    const navigations: string[] = [];
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url());
      }
    });

    // Click Manager Dashboard button
    const managerButton = page.getByRole('button', { name: /Manager Dashboard/i });
    await expect(managerButton).toBeVisible();
    await managerButton.click();

    await page.waitForLoadState('networkidle');

    // Should navigate to manager dashboard
    const currentUrl = page.url();
    expect(currentUrl).toContain('/manager');

    // Should not redirect back to executive (no ping-pong)
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/manager');
  });

  test('Executive can access HR Dashboard (higher-level access)', async ({ page }) => {
    // Click HR Dashboard button
    const hrButton = page.getByRole('button', { name: /HR Dashboard/i });
    await expect(hrButton).toBeVisible();
    await hrButton.click();

    await page.waitForLoadState('networkidle');

    // Should navigate to HR dashboard
    const currentUrl = page.url();
    expect(currentUrl).toContain('/hr');

    // Page should load successfully
    await expect(page.locator('body')).toBeVisible();
  });

  test('Executive can access Admin Panel', async ({ page }) => {
    // Click Admin Panel button
    const adminButton = page.getByRole('button', { name: /Admin Panel/i });
    await expect(adminButton).toBeVisible();
    await adminButton.click();

    await page.waitForLoadState('networkidle');

    // Should navigate to admin page
    const currentUrl = page.url();
    expect(currentUrl).toContain('/admin');
  });

  test('Executive can access Analytics page', async ({ page }) => {
    // Click Analytics button
    const analyticsButton = page.getByRole('button', { name: /Analytics/i });
    await expect(analyticsButton).toBeVisible();
    await analyticsButton.click();

    await page.waitForLoadState('networkidle');

    // Should navigate to analytics page
    const currentUrl = page.url();
    expect(currentUrl).toContain('/executive/analytics');

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('Executive can navigate from Manager Dashboard back to Executive Dashboard', async ({ page }) => {
    // Go to manager dashboard
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    // Navigate back to executive dashboard
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    // Should be on executive dashboard
    expect(page.url()).toContain('/executive');
    await expect(page.locator('h1')).toContainText('Executive Dashboard');
  });

  test('Executive can navigate from HR Dashboard back to Executive Dashboard', async ({ page }) => {
    // Go to HR dashboard
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Navigate back to executive dashboard
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    // Should be on executive dashboard
    expect(page.url()).toContain('/executive');
    await expect(page.locator('h1')).toContainText('Executive Dashboard');
  });
});

test.describe('Executive Route Access Control', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsExecutive(page);
  });

  test('All executive-accessible routes load without redirect loops', async ({ page }) => {
    const routes = ['/executive', '/executive/analytics', '/manager', '/hr', '/admin'];

    for (const route of routes) {
      const navigations: string[] = [];
      const handler = (frame: any) => {
        if (frame === page.mainFrame()) {
          navigations.push(frame.url());
        }
      };
      page.on('framenavigated', handler);

      await page.goto(route);
      await page.waitForTimeout(1500);
      await page.waitForLoadState('networkidle');

      // No excessive redirects
      expect(navigations.length).toBeLessThan(5);

      // Page should be accessible
      await expect(page.locator('body')).toBeVisible();

      page.off('framenavigated', handler);
    }
  });

  test('Executive can access employee-level features', async ({ page }) => {
    // Navigate to employee leave request page
    await page.goto('/employee/leave-request');
    await page.waitForLoadState('networkidle');

    // Should be able to access (or redirected to executive-appropriate page)
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(employee|executive)/);

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Executive Header Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsExecutive(page);
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');
  });

  test('All navigation buttons are visible in header', async ({ page }) => {
    // Check for navigation buttons
    const managerButton = page.getByRole('button', { name: /Manager Dashboard/i });
    const hrButton = page.getByRole('button', { name: /HR Dashboard/i });
    const adminButton = page.getByRole('button', { name: /Admin Panel/i });
    const analyticsButton = page.getByRole('button', { name: /Analytics/i });

    await expect(managerButton).toBeVisible();
    await expect(hrButton).toBeVisible();
    await expect(adminButton).toBeVisible();
    await expect(analyticsButton).toBeVisible();
  });

  test('Notification bell is visible', async ({ page }) => {
    // Look for notification bell
    const notificationBell = page.locator('[data-testid="notifications"], [aria-label*="notification"], button:has(svg)').first();
    await expect(notificationBell).toBeVisible();
  });

  test('Profile dropdown is visible and functional', async ({ page }) => {
    // Find and click avatar button
    const avatarButton = page.locator('button').filter({ has: page.locator('[class*="avatar"]') }).last();
    await expect(avatarButton).toBeVisible();

    await avatarButton.click();

    // Dropdown should open
    const dropdownContent = page.locator('[role="menu"], [data-state="open"]');
    await expect(dropdownContent).toBeVisible({ timeout: 5000 });

    // Should show user info
    const userInfo = page.locator('text=/ceo@staging|Executive/i');
    const hasUserInfo = await userInfo.isVisible().catch(() => false);
    expect(hasUserInfo).toBeTruthy();
  });

  test('Logout option is available in profile dropdown', async ({ page }) => {
    // Open dropdown
    const avatarButton = page.locator('button').filter({ has: page.locator('[class*="avatar"]') }).last();
    await avatarButton.click();

    // Look for logout option
    const logoutOption = page.getByRole('menuitem', { name: /log out/i });
    await expect(logoutOption).toBeVisible();
  });
});

test.describe('Executive Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsExecutive(page);
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard tab is active by default', async ({ page }) => {
    // Look for Dashboard tab
    const dashboardTab = page.locator('button').filter({ hasText: /Dashboard/i }).first();
    await expect(dashboardTab).toBeVisible();

    // Should have active styling (purple border)
    const hasActiveClass = await dashboardTab.evaluate(el =>
      el.className.includes('border-purple') || el.className.includes('text-purple')
    );
    expect(hasActiveClass).toBeTruthy();
  });

  test('Company Calendar tab is visible', async ({ page }) => {
    const calendarTab = page.locator('button').filter({ hasText: /Company Calendar/i });
    await expect(calendarTab).toBeVisible();
  });

  test('Clicking Company Calendar tab switches content', async ({ page }) => {
    const calendarTab = page.locator('button').filter({ hasText: /Company Calendar/i });
    await calendarTab.click();
    await page.waitForLoadState('networkidle');

    // Calendar content should be visible
    await page.waitForTimeout(1000);

    // Dashboard tab should no longer be active
    const dashboardTab = page.locator('button').filter({ hasText: /Dashboard/i }).first();
    const isActive = await dashboardTab.evaluate(el =>
      el.className.includes('border-purple') || el.className.includes('text-purple')
    );
    expect(isActive).toBeFalsy();
  });

  test('Tab switching preserves URL on /executive', async ({ page }) => {
    // Switch to calendar tab
    const calendarTab = page.locator('button').filter({ hasText: /Company Calendar/i });
    await calendarTab.click();
    await page.waitForLoadState('networkidle');

    // URL should still be /executive
    expect(page.url()).toContain('/executive');

    // Switch back to dashboard tab
    const dashboardTab = page.locator('button').filter({ hasText: /Dashboard/i }).first();
    await dashboardTab.click();
    await page.waitForLoadState('networkidle');

    // URL should still be /executive
    expect(page.url()).toContain('/executive');
  });
});

test.describe('Executive Session Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsExecutive(page);
  });

  test('Session persists during cross-dashboard navigation', async ({ page }) => {
    // Start on executive dashboard
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    // Navigate to manager
    const managerButton = page.getByRole('button', { name: /Manager Dashboard/i });
    await managerButton.click();
    await page.waitForLoadState('networkidle');

    // Should not redirect to login
    expect(page.url()).not.toContain('/login');
    expect(page.url()).not.toContain('/auth/signin');

    // Navigate to HR
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');

    // Should still be authenticated
    expect(page.url()).not.toContain('/login');

    // Navigate back to executive
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    // Should still be on executive dashboard
    expect(page.url()).toContain('/executive');
  });

  test('Session persists after page refresh', async ({ page }) => {
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    // Verify on executive dashboard
    await expect(page.locator('h1')).toContainText('Executive Dashboard');

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on executive dashboard
    await expect(page.locator('h1')).toContainText('Executive Dashboard');
    expect(page.url()).toContain('/executive');
  });
});

test.describe('Executive Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('Executive dashboard is accessible on mobile', async ({ page }) => {
    await loginAsExecutive(page);
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    // Dashboard should be visible
    await expect(page.locator('h1')).toContainText('Executive Dashboard');
  });

  test('Navigation remains functional on mobile', async ({ page }) => {
    await loginAsExecutive(page);
    await page.goto('/executive');
    await page.waitForLoadState('networkidle');

    // Check that content is visible
    await expect(page.locator('body')).toBeVisible();

    // Tab navigation should work
    const calendarTab = page.locator('button').filter({ hasText: /Calendar/i });
    const isCalendarVisible = await calendarTab.isVisible().catch(() => false);

    if (isCalendarVisible) {
      await calendarTab.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/executive');
    }
  });
});
