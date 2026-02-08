import { Page } from '@playwright/test';

/**
 * Shared authentication helper for E2E tests.
 * Uses the dev login "Existing User" dropdown which works with seeded users.
 */

export interface TestUser {
  email: string;
  password: string;
  role: string;
  expectedDashboard: string;
}

// Test users from seed data
export const TEST_USERS: Record<string, TestUser> = {
  EMPLOYEE: {
    email: 'employee@staging.local',
    password: 'password123',
    role: 'EMPLOYEE',
    expectedDashboard: '/employee',
  },
  MANAGER: {
    email: 'manager@staging.local',
    password: 'password123',
    role: 'MANAGER',
    expectedDashboard: '/manager',
  },
  HR: {
    email: 'hr@staging.local',
    password: 'password123',
    role: 'HR',
    expectedDashboard: '/hr',
  },
  EXECUTIVE: {
    email: 'ceo@staging.local',
    password: 'password123',
    role: 'EXECUTIVE',
    expectedDashboard: '/executive',
  },
  ADMIN: {
    email: 'admin@staging.local',
    password: 'password123',
    role: 'ADMIN',
    expectedDashboard: '/admin',
  },
};

/**
 * Login as a specific role using the dev login dropdown.
 * @param page - Playwright page object
 * @param role - Role to login as (EMPLOYEE, MANAGER, HR, EXECUTIVE, ADMIN)
 */
export async function loginAsRole(page: Page, role: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Wait for React hydration

  // Check for dev login
  const devSection = page.locator('text=Development Mode');
  const hasDevLogin = await devSection.isVisible().catch(() => false);

  if (!hasDevLogin) {
    throw new Error('Dev login not available. Ensure SHOW_DEV_LOGIN=true in staging environment');
  }

  // Wait for users dropdown to load
  await page.waitForTimeout(500);

  // Open the user selector dropdown
  const userSelector = page.locator('[data-slot="select-trigger"]').first();
  await userSelector.click();
  await page.waitForTimeout(300);

  // Find user by role
  const userOption = page.getByRole('option').filter({ hasText: new RegExp(role, 'i') }).first();

  if (await userOption.isVisible().catch(() => false)) {
    await userOption.click();
    await page.waitForTimeout(200);
  } else {
    await page.keyboard.press('Escape');
    throw new Error(`User not found for role: ${role}`);
  }

  // Click "Sign in as Selected User" button
  const signInButton = page.getByRole('button', { name: /sign in as selected user/i });
  await signInButton.click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/(employee|manager|hr|executive|admin)/, {
    timeout: 15000,
  });
}

/**
 * Login using a specific TestUser object.
 */
export async function loginWithUser(page: Page, user: TestUser): Promise<void> {
  await loginAsRole(page, user.role);
}

/**
 * Logout the current user.
 */
export async function logout(page: Page): Promise<void> {
  // Navigate to NextAuth signout
  await page.goto('/api/auth/signout');
  await page.waitForLoadState('networkidle');

  // Confirm signout if there's a confirmation button
  const confirmButton = page.getByRole('button', { name: /sign out|logout|yes/i });
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
  }

  // Wait for redirect to login
  await page.waitForURL(/\/(login|auth)/, { timeout: 10000 }).catch(() => {
    // If no redirect, that's OK - we're logged out
  });
}

/**
 * Check if currently logged in by looking for auth indicators.
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  // If we're on a dashboard, we're logged in
  if (/\/(employee|manager|hr|executive|admin)/.test(url)) {
    return true;
  }
  return false;
}

/**
 * Ensure user is logged in with specific role.
 * If already logged in as different user, logs out first.
 */
export async function ensureLoggedInAs(page: Page, role: string): Promise<void> {
  const currentUrl = page.url();

  // Check if we're on the expected dashboard
  const expectedPath = TEST_USERS[role]?.expectedDashboard;
  if (expectedPath && currentUrl.includes(expectedPath)) {
    return; // Already logged in as this role
  }

  // Check if we're logged in but as wrong role
  if (await isLoggedIn(page)) {
    await logout(page);
  }

  await loginAsRole(page, role);
}
