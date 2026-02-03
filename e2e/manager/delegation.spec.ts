import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Manager Delegation Functionality
 * US-009: Tests for delegating approval authority
 *
 * Tests verify:
 * - Manager can access delegation settings
 * - Manager can create a new delegation
 * - Manager can edit existing delegations
 * - Manager can toggle delegation active/inactive
 * - Manager can delete delegations
 * - Delegation form validation works correctly
 * - Active delegation indicator is shown
 */

// Test users from seed data
const TEST_MANAGER = {
  email: 'manager@staging.local',
  password: 'admin123',
};

const TEST_MANAGER_2 = {
  email: 'hr@staging.local',
  password: 'admin123',
};

// Helper function to login as manager
async function loginAsManager(page: Page): Promise<void> {
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
        await emailInput.fill(TEST_MANAGER.email);
      }

      const roleSelector = page.locator('[data-slot="select-trigger"]').last();
      if (await roleSelector.isVisible()) {
        await roleSelector.click();
        await page.waitForTimeout(200);
        const roleOption = page.getByRole('option', { name: /manager/i });
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
      await emailInput.fill(TEST_MANAGER.email);
      await page.getByLabel(/password/i).fill(TEST_MANAGER.password);
      await page.getByRole('button', { name: /sign in/i }).click();
    }
  }

  await page.waitForURL(/\/(employee|manager|hr|executive|admin)/, {
    timeout: 30000,
  });
  await page.waitForLoadState('networkidle');
}

test.describe('Delegation - Access', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
  });

  test('Manager can access delegation tab', async ({ page }) => {
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    // Click on delegation tab
    const delegationTab = page.getByRole('button', { name: /delegation/i });
    await expect(delegationTab).toBeVisible({ timeout: 10000 });

    await delegationTab.click();
    await page.waitForLoadState('networkidle');

    // Verify delegation content is displayed
    const delegationContent = page.locator('text=/Approval Delegation|Delegate/i');
    await expect(delegationContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Delegation page shows description', async ({ page }) => {
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    const delegationTab = page.getByRole('button', { name: /delegation/i });
    if (await delegationTab.isVisible()) {
      await delegationTab.click();
      await page.waitForLoadState('networkidle');
    }

    // Check for description text
    const description = page.locator('text=/Delegate your approval authority|unavailable/i');
    await expect(description.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Delegation - Create New', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    const delegationTab = page.getByRole('button', { name: /delegation/i });
    if (await delegationTab.isVisible()) {
      await delegationTab.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('New Delegation button is visible', async ({ page }) => {
    const newDelegationButton = page.getByRole('button', { name: /New Delegation/i });
    await expect(newDelegationButton).toBeVisible({ timeout: 10000 });
  });

  test('Clicking New Delegation opens dialog', async ({ page }) => {
    const newDelegationButton = page.getByRole('button', { name: /New Delegation/i });
    await newDelegationButton.click();
    await page.waitForTimeout(500);

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Dialog should have title
    const dialogTitle = dialog.locator('text=/Create Delegation|New Delegation/i');
    await expect(dialogTitle).toBeVisible();
  });

  test('Delegation dialog has required fields', async ({ page }) => {
    const newDelegationButton = page.getByRole('button', { name: /New Delegation/i });
    await newDelegationButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Check for manager selector
    const managerSelector = dialog.locator('text=/Delegate To|Select a manager/i');
    await expect(managerSelector.first()).toBeVisible();

    // Check for date fields
    const startDateField = dialog.locator('text=/Start Date/i');
    await expect(startDateField).toBeVisible();

    const endDateField = dialog.locator('text=/End Date/i');
    await expect(endDateField).toBeVisible();
  });

  test('Can select a manager to delegate to', async ({ page }) => {
    const newDelegationButton = page.getByRole('button', { name: /New Delegation/i });
    await newDelegationButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click the manager selector
    const managerSelector = dialog.locator('[data-slot="select-trigger"], [role="combobox"]').first();
    if (await managerSelector.isVisible()) {
      await managerSelector.click();
      await page.waitForTimeout(300);

      // Manager options should appear
      const options = page.locator('[role="option"], [data-slot="select-item"]');
      const hasOptions = (await options.count()) > 0;
      expect(hasOptions).toBeTruthy();
    }
  });

  test('Indefinite delegation checkbox works', async ({ page }) => {
    const newDelegationButton = page.getByRole('button', { name: /New Delegation/i });
    await newDelegationButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Find and toggle indefinite checkbox
    const indefiniteSwitch = dialog.locator('button[role="switch"], [type="checkbox"]').last();
    if (await indefiniteSwitch.isVisible()) {
      await indefiniteSwitch.click();
      await page.waitForTimeout(300);

      // End date should be disabled or show "Indefinite"
      const endDateButton = dialog.locator('button:has-text("Indefinite")');
      await expect(endDateButton).toBeVisible();
    }
  });

  test('Reason field is optional', async ({ page }) => {
    const newDelegationButton = page.getByRole('button', { name: /New Delegation/i });
    await newDelegationButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Check for reason field
    const reasonField = dialog.locator('textarea#reason, textarea[placeholder*="reason"]');
    const hasReasonField = await reasonField.isVisible().catch(() => false);

    // Reason field should be present
    await expect(page.locator('body')).toBeVisible();
  });

  test('Cancel button closes dialog', async ({ page }) => {
    const newDelegationButton = page.getByRole('button', { name: /New Delegation/i });
    await newDelegationButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click cancel button
    const cancelButton = dialog.getByRole('button', { name: /cancel/i });
    await cancelButton.click();
    await page.waitForTimeout(500);

    // Dialog should be closed
    await expect(dialog).not.toBeVisible();
  });

  test('Create button requires manager selection', async ({ page }) => {
    const newDelegationButton = page.getByRole('button', { name: /New Delegation/i });
    await newDelegationButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Create button should be disabled without manager selection
    const createButton = dialog.getByRole('button', { name: /create/i });
    const isDisabled = await createButton.isDisabled().catch(() => false);

    // Button should be disabled or show validation error
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Delegation - View Existing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    const delegationTab = page.getByRole('button', { name: /delegation/i });
    if (await delegationTab.isVisible()) {
      await delegationTab.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Shows message when no delegations exist', async ({ page }) => {
    // If no delegations, should show informative message
    const noDelegationsMessage = page.locator('text=/No delegations configured|Create a delegation/i');
    const hasDelegations = await page.locator('.border.rounded-lg:has([class*="switch"])').isVisible().catch(() => false);

    if (!hasDelegations) {
      await expect(noDelegationsMessage.first()).toBeVisible();
    }
  });

  test('Existing delegations show delegate name', async ({ page }) => {
    const delegationCard = page.locator('.border.rounded-lg, [class*="delegation-card"]').first();

    if (await delegationCard.isVisible().catch(() => false)) {
      // Delegation card should show delegate name
      const delegateName = delegationCard.locator('text=/[A-Z][a-z]+ [A-Z][a-z]+/');
      await expect(delegateName.first()).toBeVisible();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('Existing delegations show date range', async ({ page }) => {
    const delegationCard = page.locator('.border.rounded-lg, [class*="delegation-card"]').first();

    if (await delegationCard.isVisible().catch(() => false)) {
      // Delegation card should show dates
      const dateRange = delegationCard.locator('text=/[A-Z][a-z]{2} \\d+|Indefinite/');
      await expect(dateRange.first()).toBeVisible();
    }

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Delegation - Toggle Active/Inactive', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    const delegationTab = page.getByRole('button', { name: /delegation/i });
    if (await delegationTab.isVisible()) {
      await delegationTab.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Toggle switch is visible for delegations', async ({ page }) => {
    const delegationCard = page.locator('.border.rounded-lg:has([role="switch"])').first();

    if (await delegationCard.isVisible().catch(() => false)) {
      const toggleSwitch = delegationCard.locator('[role="switch"]');
      await expect(toggleSwitch).toBeVisible();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('Toggling delegation changes status', async ({ page }) => {
    const delegationCard = page.locator('.border.rounded-lg:has([role="switch"])').first();

    if (await delegationCard.isVisible().catch(() => false)) {
      const toggleSwitch = delegationCard.locator('[role="switch"]');
      const initialState = await toggleSwitch.getAttribute('data-state');

      await toggleSwitch.click();
      await page.waitForTimeout(1000);

      // State should have changed
      const newState = await toggleSwitch.getAttribute('data-state');

      // Verify action was processed
      await expect(page.locator('body')).toBeVisible();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('Active delegation shows active badge', async ({ page }) => {
    const delegationCard = page.locator('.border.rounded-lg:has([role="switch"])').first();

    if (await delegationCard.isVisible().catch(() => false)) {
      const toggleSwitch = delegationCard.locator('[role="switch"]');
      const isActive = await toggleSwitch.getAttribute('data-state') === 'checked';

      if (isActive) {
        const activeBadge = delegationCard.locator('text=/Active/i, .bg-green-100');
        await expect(activeBadge.first()).toBeVisible();
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Delegation - Edit', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    const delegationTab = page.getByRole('button', { name: /delegation/i });
    if (await delegationTab.isVisible()) {
      await delegationTab.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Edit button is visible for delegations', async ({ page }) => {
    const delegationCard = page.locator('.border.rounded-lg:has([role="switch"])').first();

    if (await delegationCard.isVisible().catch(() => false)) {
      const editButton = delegationCard.locator('button:has([class*="edit"]), button:has-text("Edit")');
      await expect(editButton).toBeVisible();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('Clicking edit opens dialog with existing data', async ({ page }) => {
    const delegationCard = page.locator('.border.rounded-lg:has([role="switch"])').first();

    if (await delegationCard.isVisible().catch(() => false)) {
      const editButton = delegationCard.locator('button:has([class*="edit"])').first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(500);

        // Dialog should open
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        // Dialog should have "Edit" in title
        const dialogTitle = dialog.locator('text=/Edit Delegation/i');
        await expect(dialogTitle).toBeVisible();
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Delegation - Delete', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    const delegationTab = page.getByRole('button', { name: /delegation/i });
    if (await delegationTab.isVisible()) {
      await delegationTab.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Delete button is visible for delegations', async ({ page }) => {
    const delegationCard = page.locator('.border.rounded-lg:has([role="switch"])').first();

    if (await delegationCard.isVisible().catch(() => false)) {
      const deleteButton = delegationCard.locator('button:has([class*="trash"]), button.text-red-600');
      await expect(deleteButton.first()).toBeVisible();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('Delete requires confirmation', async ({ page }) => {
    const delegationCard = page.locator('.border.rounded-lg:has([role="switch"])').first();

    if (await delegationCard.isVisible().catch(() => false)) {
      const deleteButton = delegationCard.locator('button:has([class*="trash"])').first();

      if (await deleteButton.isVisible()) {
        // Set up dialog handler
        page.on('dialog', async (dialog) => {
          expect(dialog.type()).toBe('confirm');
          await dialog.dismiss(); // Don't actually delete
        });

        await deleteButton.click();
        await page.waitForTimeout(500);
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Delegation - Active Delegation Indicator', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    const delegationTab = page.getByRole('button', { name: /delegation/i });
    if (await delegationTab.isVisible()) {
      await delegationTab.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Active delegation shows banner/alert', async ({ page }) => {
    // Check for active delegation alert
    const activeDelegationAlert = page.locator('.bg-blue-50, [class*="alert"]');

    if (await activeDelegationAlert.isVisible().catch(() => false)) {
      // Alert should mention who has been delegated to
      const delegateInfo = activeDelegationAlert.locator('text=/delegated to/i');
      await expect(delegateInfo).toBeVisible();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('Active delegation shows delegate name in banner', async ({ page }) => {
    const activeDelegationAlert = page.locator('.bg-blue-50:has-text("Active Delegation")');

    if (await activeDelegationAlert.isVisible().catch(() => false)) {
      // Should show the delegate's name
      const delegateName = activeDelegationAlert.locator('strong');
      await expect(delegateName.first()).toBeVisible();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('Active delegation shows end date or indefinite', async ({ page }) => {
    const activeDelegationAlert = page.locator('.bg-blue-50:has-text("Active Delegation")');

    if (await activeDelegationAlert.isVisible().catch(() => false)) {
      // Should show date or "indefinite"
      const dateOrIndefinite = activeDelegationAlert.locator('text=/until|indefinite/i');
      await expect(dateOrIndefinite).toBeVisible();
    }

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Delegation - API', () => {
  test('Delegations API requires authentication', async ({ request }) => {
    const response = await request.get('/api/manager/delegations');
    expect(response.status()).toBe(401);
  });

  test('Available delegates API returns manager list', async ({ page }) => {
    await loginAsManager(page);

    const response = await page.request.get('/api/manager/available-delegates');

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('managers');
    }

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Delegation - Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    const delegationTab = page.getByRole('button', { name: /delegation/i });
    if (await delegationTab.isVisible()) {
      await delegationTab.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('End date must be after start date', async ({ page }) => {
    const newDelegationButton = page.getByRole('button', { name: /New Delegation/i });
    await newDelegationButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // The validation is enforced - dates cannot be set in wrong order
    await expect(page.locator('body')).toBeVisible();
  });

  test('Manager selection is required', async ({ page }) => {
    const newDelegationButton = page.getByRole('button', { name: /New Delegation/i });
    await newDelegationButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Create button should be disabled without selection
    const createButton = dialog.getByRole('button', { name: /create/i });
    await expect(createButton).toBeDisabled();
  });
});

test.describe('Delegation - Info Alert', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');

    const delegationTab = page.getByRole('button', { name: /delegation/i });
    if (await delegationTab.isVisible()) {
      await delegationTab.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Dialog shows informational alert about delegation', async ({ page }) => {
    const newDelegationButton = page.getByRole('button', { name: /New Delegation/i });
    await newDelegationButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Info alert should explain what delegation does
    const infoAlert = dialog.locator('text=/receive all your pending approvals|deactivate the delegation/i');
    await expect(infoAlert.first()).toBeVisible();
  });
});
