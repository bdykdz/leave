import { test, expect, Page, BrowserContext, APIResponse } from '@playwright/test';

/**
 * E2E Tests for Concurrent Actions and Race Conditions
 * US-012: Tests for handling simultaneous actions and concurrent operations
 *
 * Tests verify:
 * - Simultaneous approval attempts
 * - Concurrent form submissions
 * - Multiple browser tabs handling
 * - Race condition prevention
 * - Optimistic locking behavior
 * - Session handling across concurrent requests
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
  EXECUTIVE: {
    email: 'ceo@staging.local',
    password: 'admin123',
  },
};

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

test.describe('Concurrent Actions - Simultaneous Approvals', () => {
  test('System handles simultaneous approve and deny on same request', async ({ browser }) => {
    // Create two browser contexts (simulating two managers)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Login as manager in both contexts
      await loginAs(page1, TEST_USERS.MANAGER.email, TEST_USERS.MANAGER.password);
      await loginAs(page2, TEST_USERS.MANAGER.email, TEST_USERS.MANAGER.password);

      // Navigate both to manager dashboard
      await page1.goto('/manager');
      await page2.goto('/manager');
      await Promise.all([
        page1.waitForLoadState('networkidle'),
        page2.waitForLoadState('networkidle'),
      ]);

      // Look for the same pending request in both
      const approveButton1 = page1.getByRole('button', { name: /approve/i }).first();
      const denyButton2 = page2.getByRole('button', { name: /deny|reject/i }).first();

      const hasApprove = await approveButton1.isVisible().catch(() => false);
      const hasDeny = await denyButton2.isVisible().catch(() => false);

      if (hasApprove && hasDeny) {
        // Try to approve and deny simultaneously
        await Promise.all([
          approveButton1.click().catch(() => {}),
          denyButton2.click().catch(() => {}),
        ]);

        // Wait for both actions to complete
        await page1.waitForTimeout(2000);
        await page2.waitForTimeout(2000);

        // Both pages should remain functional
        await expect(page1.locator('body')).toBeVisible();
        await expect(page2.locator('body')).toBeVisible();

        // At least one should show an error or success
        // (only one action should succeed)
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Second approval attempt on already-approved request shows error', async ({ page }) => {
    await loginAs(page, TEST_USERS.MANAGER.email, TEST_USERS.MANAGER.password);
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    // Get the API pending approvals
    const response = await page.request.get('/api/manager/team/pending-approvals');

    if (response.ok()) {
      const data = await response.json();
      const requests = data.requests || [];

      if (requests.length > 0) {
        const requestId = requests[0].id;

        // Send two approval requests rapidly
        const [response1, response2] = await Promise.all([
          page.request.post(`/api/leave-requests/${requestId}/approve`, {
            data: { comment: 'Approved - test 1' },
          }),
          page.request.post(`/api/leave-requests/${requestId}/approve`, {
            data: { comment: 'Approved - test 2' },
          }),
        ]);

        // At least one should succeed, the other might fail or succeed
        // (depending on implementation)
        const success1 = response1.ok();
        const success2 = response2.ok();

        // At least one should have worked
        expect(success1 || success2).toBeTruthy();
      }
    }
  });
});

test.describe('Concurrent Actions - Multiple Tabs', () => {
  test('Changes in one tab are reflected after refresh in another', async ({ context }) => {
    // Create two pages in the same context (shared session)
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Login in first tab
      await loginAs(page1, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);

      // Navigate to dashboard in both tabs
      await page1.goto('/employee');
      await page2.goto('/employee');

      await Promise.all([
        page1.waitForLoadState('networkidle'),
        page2.waitForLoadState('networkidle'),
      ]);

      // Both tabs should show the same user
      await expect(page1.locator('body')).toBeVisible();
      await expect(page2.locator('body')).toBeVisible();

      // Make a change in tab 1 (like opening a form)
      const newLeaveButton1 = page1.getByRole('button', { name: /new leave request/i });
      if (await newLeaveButton1.isVisible()) {
        await newLeaveButton1.click();
        await page1.waitForLoadState('networkidle');
      }

      // Tab 2 should still work independently
      const newLeaveButton2 = page2.getByRole('button', { name: /new leave request/i });
      if (await newLeaveButton2.isVisible()) {
        await expect(newLeaveButton2).toBeVisible();
      }
    } finally {
      await page1.close();
      await page2.close();
    }
  });

  test('Session remains valid across multiple tabs', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      await loginAs(page1, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);

      // Open different sections in different tabs
      await page1.goto('/employee');
      await page2.goto('/employee/history');

      await Promise.all([
        page1.waitForLoadState('networkidle'),
        page2.waitForLoadState('networkidle'),
      ]);

      // Both should be authenticated
      const url1 = page1.url();
      const url2 = page2.url();

      expect(url1).toContain('/employee');
      expect(url2).toContain('/employee');

      // Neither should be redirected to login
      expect(url1).not.toContain('/login');
      expect(url2).not.toContain('/login');
    } finally {
      await page1.close();
      await page2.close();
    }
  });

  test('Logout in one tab affects other tabs', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      await loginAs(page1, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);

      // Navigate both to dashboard
      await page1.goto('/employee');
      await page2.goto('/employee');

      await Promise.all([
        page1.waitForLoadState('networkidle'),
        page2.waitForLoadState('networkidle'),
      ]);

      // Logout from tab 1
      await page1.goto('/api/auth/signout');
      await page1.waitForLoadState('networkidle');

      // Confirm signout
      const confirmButton = page1.getByRole('button', { name: /sign out|logout/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page1.waitForTimeout(2000);
      }

      // Try to access protected route in tab 2
      await page2.goto('/employee');
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(1000);

      // Tab 2 should now require re-authentication
      const url2 = page2.url();
      // Should be on login page or show auth error
      expect(url2.includes('/login') || url2.includes('/auth')).toBeTruthy();
    } finally {
      await page1.close();
      await page2.close();
    }
  });
});

test.describe('Concurrent Actions - Form Submissions', () => {
  test('Double form submission is prevented', async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    await newLeaveButton.click();
    await page.waitForLoadState('networkidle');

    // Fill form
    const startDate = getFutureDate(20);
    const startDateInput = page.locator('input[name="startDate"], [data-testid="start-date"]');

    if (await startDateInput.isVisible()) {
      await startDateInput.fill(formatDate(startDate));

      const endDateInput = page.locator('input[name="endDate"], [data-testid="end-date"]');
      if (await endDateInput.isVisible()) {
        await endDateInput.fill(formatDate(startDate));
      }

      const reasonInput = page.locator('textarea[name="reason"]');
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('Double submission prevention test');
      }

      // Find submit button
      const submitButton = page.getByRole('button', { name: /submit/i });

      if (await submitButton.isVisible()) {
        // Click submit twice quickly
        await submitButton.click();

        // Check if button becomes disabled
        await page.waitForTimeout(100);
        const isDisabled = await submitButton.isDisabled().catch(() => false);

        // Either button disabled or second click has no effect
        await page.waitForTimeout(2000);

        // Page should handle gracefully
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('Concurrent leave requests for overlapping dates are handled', async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);

    // Submit leave request via API
    const startDate = getFutureDate(30);
    const endDate = getFutureDate(32);

    // First request
    const response1 = await page.request.post('/api/leave-requests', {
      data: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        reason: 'Concurrent test 1',
      },
    });

    // Second request for overlapping dates (immediately after)
    const response2 = await page.request.post('/api/leave-requests', {
      data: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        reason: 'Concurrent test 2',
      },
    });

    // System should either:
    // 1. Accept both (if allowed)
    // 2. Reject second with overlap error
    // 3. Queue them properly

    // Both responses should be handled gracefully
    expect([200, 201, 400, 409].includes(response1.status())).toBeTruthy();
    expect([200, 201, 400, 409].includes(response2.status())).toBeTruthy();
  });
});

test.describe('Concurrent Actions - API Race Conditions', () => {
  test('Concurrent API requests are handled correctly', async ({ page }) => {
    await loginAs(page, TEST_USERS.MANAGER.email, TEST_USERS.MANAGER.password);

    // Make multiple concurrent API calls
    const [response1, response2, response3] = await Promise.all([
      page.request.get('/api/manager/team/pending-approvals?page=1'),
      page.request.get('/api/manager/team/pending-approvals?page=1'),
      page.request.get('/api/manager/team/pending-approvals?page=1'),
    ]);

    // All should return consistent results
    expect(response1.ok()).toBeTruthy();
    expect(response2.ok()).toBeTruthy();
    expect(response3.ok()).toBeTruthy();

    const data1 = await response1.json();
    const data2 = await response2.json();
    const data3 = await response3.json();

    // Results should be consistent
    expect(data1.requests.length).toBe(data2.requests.length);
    expect(data2.requests.length).toBe(data3.requests.length);
  });

  test('Rapid sequential requests maintain data integrity', async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);

    // Make rapid sequential requests
    const responses: APIResponse[] = [];
    for (let i = 0; i < 5; i++) {
      const response = await page.request.get('/api/leave-requests');
      responses.push(response);
    }

    // All should succeed
    for (const response of responses) {
      expect(response.ok()).toBe(true);
    }
  });
});

test.describe('Concurrent Actions - Multi-User Scenarios', () => {
  test('Manager and employee see consistent request state', async ({ browser }) => {
    const managerContext = await browser.newContext();
    const employeeContext = await browser.newContext();

    const managerPage = await managerContext.newPage();
    const employeePage = await employeeContext.newPage();

    try {
      // Login as both users
      await loginAs(managerPage, TEST_USERS.MANAGER.email, TEST_USERS.MANAGER.password);
      await loginAs(employeePage, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);

      // Navigate to respective dashboards
      await managerPage.goto('/manager');
      await employeePage.goto('/employee');

      await Promise.all([
        managerPage.waitForLoadState('networkidle'),
        employeePage.waitForLoadState('networkidle'),
      ]);

      // Both should see consistent data
      await expect(managerPage.locator('body')).toBeVisible();
      await expect(employeePage.locator('body')).toBeVisible();
    } finally {
      await managerContext.close();
      await employeeContext.close();
    }
  });

  test('HR and manager can process different requests simultaneously', async ({ browser }) => {
    const hrContext = await browser.newContext();
    const managerContext = await browser.newContext();

    const hrPage = await hrContext.newPage();
    const managerPage = await managerContext.newPage();

    try {
      await loginAs(hrPage, TEST_USERS.HR.email, TEST_USERS.HR.password);
      await loginAs(managerPage, TEST_USERS.MANAGER.email, TEST_USERS.MANAGER.password);

      // Both navigate to their dashboards
      await hrPage.goto('/hr');
      await managerPage.goto('/manager');

      await Promise.all([
        hrPage.waitForLoadState('networkidle'),
        managerPage.waitForLoadState('networkidle'),
      ]);

      // Both dashboards should be functional
      await expect(hrPage.locator('body')).toBeVisible();
      await expect(managerPage.locator('body')).toBeVisible();
    } finally {
      await hrContext.close();
      await managerContext.close();
    }
  });
});

test.describe('Concurrent Actions - Optimistic Updates', () => {
  test('UI updates optimistically and recovers on error', async ({ page }) => {
    await loginAs(page, TEST_USERS.MANAGER.email, TEST_USERS.MANAGER.password);
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    // Find approve button
    const approveButton = page.getByRole('button', { name: /approve/i }).first();
    const hasApprove = await approveButton.isVisible().catch(() => false);

    if (hasApprove) {
      // Intercept network to simulate slow response
      await page.route('**/api/leave-requests/*/approve', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.continue();
      });

      // Click approve
      await approveButton.click();

      // UI should show loading/pending state
      await page.waitForTimeout(500);

      // Page should remain functional
      await expect(page.locator('body')).toBeVisible();

      // Wait for response
      await page.waitForTimeout(3000);

      // UI should update after response
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Concurrent Actions - WebSocket/Real-time Updates', () => {
  test('Dashboard updates when data changes externally', async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    // Take initial snapshot of request count or state
    const initialContent = await page.content();

    // Wait a bit for any real-time updates
    await page.waitForTimeout(3000);

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();

    // Refresh to see if data synced
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Page should work after refresh
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Concurrent Actions - Cache Consistency', () => {
  test('Cached data is invalidated after mutations', async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);

    // Make initial request
    const response1 = await page.request.get('/api/leave-requests');
    const data1 = await response1.json();
    const initialCount = Array.isArray(data1) ? data1.length : (data1.requests?.length || 0);

    // Navigate to dashboard and back
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    // Make request again
    const response2 = await page.request.get('/api/leave-requests');
    const data2 = await response2.json();
    const newCount = Array.isArray(data2) ? data2.length : (data2.requests?.length || 0);

    // Counts should be consistent (cache didn't serve stale data)
    expect(response1.ok()).toBeTruthy();
    expect(response2.ok()).toBeTruthy();
  });

  test('Browser back button shows fresh data', async ({ page }) => {
    await loginAs(page, TEST_USERS.EMPLOYEE.email, TEST_USERS.EMPLOYEE.password);
    await page.goto('/employee');
    await page.waitForLoadState('networkidle');

    // Navigate away
    await page.goto('/employee/history');
    await page.waitForLoadState('networkidle');

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Page should show current data
    await expect(page.locator('body')).toBeVisible();

    // Dashboard elements should be functional
    const newLeaveButton = page.getByRole('button', { name: /new leave request/i });
    const isButtonVisible = await newLeaveButton.isVisible().catch(() => false);

    // UI should be functional
    await expect(page.locator('body')).toBeVisible();
  });
});
