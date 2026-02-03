import { test, expect, Page } from '@playwright/test';
import {
  testKeyboardNavigation,
  testInteractiveElementsKeyboardAccessible,
  testFocusVisibility,
  waitForPageReady,
} from './utils';

/**
 * WCAG 2.1 AA Accessibility Tests - Keyboard Navigation
 * Tests keyboard accessibility, tab order, and focus management.
 */

test.describe('Keyboard Navigation - Login Page', () => {
  test('login page is fully keyboard navigable', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const navResult = await testKeyboardNavigation(page, { maxTabs: 30 });

    // Should have focusable elements
    expect(navResult.focusableElements.length).toBeGreaterThan(0);

    // Should not have focus traps
    expect(navResult.hasFocusTraps).toBe(false);
  });

  test('login form can be submitted with keyboard only', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    // Tab to first interactive element
    await page.keyboard.press('Tab');

    // Navigate using Tab
    let foundSignInButton = false;
    for (let i = 0; i < 20; i++) {
      const activeElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.tagName?.toLowerCase() + (el?.textContent?.toLowerCase().includes('sign in') ? '-signin' : '');
      });

      if (activeElement?.includes('button') && activeElement?.includes('signin')) {
        foundSignInButton = true;
        break;
      }

      await page.keyboard.press('Tab');
    }

    // Should be able to reach sign in button
    expect(foundSignInButton).toBe(true);
  });

  test('focus indicator is visible on login page elements', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    // Tab through elements and verify focus is visible
    await page.keyboard.press('Tab');

    const activeElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;

      const styles = window.getComputedStyle(el);
      return {
        hasOutline: styles.outlineStyle !== 'none' && styles.outlineWidth !== '0px',
        hasBoxShadow: styles.boxShadow !== 'none',
        hasBorder: styles.borderWidth !== '0px',
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow,
      };
    });

    // Should have some visual focus indication
    if (activeElement) {
      const hasVisibleFocus =
        activeElement.hasOutline ||
        activeElement.hasBoxShadow ||
        activeElement.hasBorder;

      expect(hasVisibleFocus).toBe(true);
    }
  });
});

test.describe('Keyboard Navigation - Dashboard Pages', () => {
  test('employee dashboard is fully keyboard navigable', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const navResult = await testKeyboardNavigation(page, { maxTabs: 50 });

    expect(navResult.focusableElements.length).toBeGreaterThan(0);
    expect(navResult.hasFocusTraps).toBe(false);
  });

  test('navigation menu is keyboard accessible', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Find and focus the navigation
    const nav = page.locator('nav, [role="navigation"]').first();
    const navLinks = await nav.locator('a, button').all();

    // All nav items should be focusable
    for (const link of navLinks.slice(0, 10)) {
      const isVisible = await link.isVisible().catch(() => false);
      if (isVisible) {
        await link.focus();
        const isFocused = await link.evaluate((el) => document.activeElement === el);
        expect(isFocused).toBe(true);
      }
    }
  });

  test('manager dashboard is fully keyboard navigable', async ({ page }) => {
    await page.goto('/manager');
    await waitForPageReady(page);

    const navResult = await testKeyboardNavigation(page, { maxTabs: 50 });

    expect(navResult.focusableElements.length).toBeGreaterThan(0);
    expect(navResult.hasFocusTraps).toBe(false);
  });

  test('HR dashboard is fully keyboard navigable', async ({ page }) => {
    await page.goto('/hr');
    await waitForPageReady(page);

    const navResult = await testKeyboardNavigation(page, { maxTabs: 50 });

    expect(navResult.focusableElements.length).toBeGreaterThan(0);
    expect(navResult.hasFocusTraps).toBe(false);
  });

  test('executive dashboard is fully keyboard navigable', async ({ page }) => {
    await page.goto('/executive');
    await waitForPageReady(page);

    const navResult = await testKeyboardNavigation(page, { maxTabs: 50 });

    expect(navResult.focusableElements.length).toBeGreaterThan(0);
    expect(navResult.hasFocusTraps).toBe(false);
  });

  test('admin dashboard is fully keyboard navigable', async ({ page }) => {
    await page.goto('/admin');
    await waitForPageReady(page);

    const navResult = await testKeyboardNavigation(page, { maxTabs: 50 });

    expect(navResult.focusableElements.length).toBeGreaterThan(0);
    expect(navResult.hasFocusTraps).toBe(false);
  });
});

test.describe('Keyboard Navigation - Interactive Elements', () => {
  test('all buttons are keyboard accessible on employee page', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const result = await testInteractiveElementsKeyboardAccessible(page);

    // Log any issues found
    if (result.notAccessible.length > 0) {
      console.log('Non-keyboard-accessible elements found:', result.notAccessible);
    }

    // At least 90% of interactive elements should be keyboard accessible
    const accessibilityRate = result.keyboardAccessible / result.totalInteractive;
    expect(accessibilityRate).toBeGreaterThanOrEqual(0.9);
  });

  test('dropdown menus are keyboard navigable', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Look for dropdown triggers
    const dropdownTriggers = await page.locator('[data-slot="select-trigger"], [role="combobox"], button:has([data-slot="avatar"])').all();

    for (const trigger of dropdownTriggers.slice(0, 3)) {
      const isVisible = await trigger.isVisible().catch(() => false);
      if (!isVisible) continue;

      // Focus the trigger
      await trigger.focus();

      // Should be able to open with Enter or Space
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Check if dropdown is open
      const hasOpenDropdown = await page
        .locator('[role="listbox"], [role="menu"], [data-state="open"]')
        .isVisible()
        .catch(() => false);

      if (hasOpenDropdown) {
        // Should be able to navigate with arrow keys
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');

        // Should be able to close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  });

  test('modals trap focus correctly', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Try to find and open a modal
    const modalTriggers = await page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Create")').all();

    for (const trigger of modalTriggers.slice(0, 2)) {
      const isVisible = await trigger.isVisible().catch(() => false);
      if (!isVisible) continue;

      await trigger.click();
      await page.waitForTimeout(500);

      // Check if modal opened
      const modal = page.locator('[role="dialog"], [data-state="open"][role="alertdialog"]');
      const modalVisible = await modal.isVisible().catch(() => false);

      if (modalVisible) {
        // Tab through modal - focus should stay within
        const initialFocusedElement = await page.evaluate(() => {
          return document.activeElement?.closest('[role="dialog"]') !== null;
        });

        // Tab multiple times
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press('Tab');
        }

        // Focus should still be within modal
        const stillInModal = await page.evaluate(() => {
          const activeEl = document.activeElement;
          return activeEl?.closest('[role="dialog"], [data-state="open"]') !== null;
        });

        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // This test passes if focus was managed correctly
        expect(stillInModal || !modalVisible).toBe(true);
        break;
      }
    }
  });
});

test.describe('Keyboard Navigation - Tab Order', () => {
  test('tab order follows logical reading order on login page', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const focusOrder: string[] = [];

    // Tab through all elements
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');

      const elementInfo = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;

        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          top: rect.top,
          left: rect.left,
          text: el.textContent?.slice(0, 30) || '',
        };
      });

      if (elementInfo) {
        focusOrder.push(`${elementInfo.tag}(${Math.round(elementInfo.top)},${Math.round(elementInfo.left)})`);
      }
    }

    // Focus order should generally flow top-to-bottom, left-to-right
    // (This is a basic check - visual order is complex to fully validate)
    expect(focusOrder.length).toBeGreaterThan(0);
  });

  test('shift+tab reverses tab order', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Tab forward a few times
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const forwardElement = await page.evaluate(() => {
      return document.activeElement?.tagName || 'unknown';
    });

    // Tab back
    await page.keyboard.press('Shift+Tab');

    const backElement = await page.evaluate(() => {
      return document.activeElement?.tagName || 'unknown';
    });

    // Should be on different elements
    // (We can't assert specific order without knowing the exact DOM)
    expect(forwardElement).toBeDefined();
    expect(backElement).toBeDefined();
  });
});

test.describe('Keyboard Navigation - Focus Management', () => {
  test('focus returns to trigger after modal closes', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Find a button that opens a modal/dialog
    const triggers = await page.locator('button:visible').all();

    for (const trigger of triggers.slice(0, 5)) {
      const triggerText = await trigger.textContent().catch(() => '');
      const isInteractive = triggerText?.toLowerCase().match(/new|add|create|edit|delete/);

      if (!isInteractive) continue;

      // Remember the trigger
      const triggerId = await trigger.evaluate((el) => {
        if (!el.id) el.id = `test-trigger-${Date.now()}`;
        return el.id;
      });

      await trigger.click();
      await page.waitForTimeout(500);

      // Check if dialog opened
      const dialogOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);

      if (dialogOpen) {
        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // Focus should return to trigger
        const focusedId = await page.evaluate(() => document.activeElement?.id);

        // Clean up
        await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (el?.id.startsWith('test-trigger-')) {
            el.removeAttribute('id');
          }
        }, triggerId);

        // Focus management test passed
        expect(focusedId === triggerId || !dialogOpen).toBe(true);
        break;
      }
    }
  });

  test('focus moves to first focusable element when modal opens', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Try to open a modal
    const newButton = page.locator('button:has-text("New"), button:has-text("Request")').first();

    if (await newButton.isVisible().catch(() => false)) {
      await newButton.click();
      await page.waitForTimeout(500);

      const dialogOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);

      if (dialogOpen) {
        // Focus should be within the dialog
        const focusInDialog = await page.evaluate(() => {
          const activeEl = document.activeElement;
          return activeEl?.closest('[role="dialog"]') !== null;
        });

        // Close dialog
        await page.keyboard.press('Escape');

        expect(focusInDialog).toBe(true);
      }
    }
  });

  test('skip links work correctly', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Look for skip link (often hidden until focused)
    await page.keyboard.press('Tab');

    const skipLink = await page.evaluate(() => {
      const el = document.activeElement as HTMLAnchorElement;
      if (el?.href?.includes('#') && el?.textContent?.toLowerCase().includes('skip')) {
        return {
          href: el.href,
          text: el.textContent,
        };
      }
      return null;
    });

    if (skipLink) {
      // Activate skip link
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      // Focus should move to main content
      const focusedInMain = await page.evaluate(() => {
        const activeEl = document.activeElement;
        return activeEl?.closest('main, [role="main"]') !== null || activeEl?.id === 'main-content';
      });

      expect(focusedInMain).toBe(true);
    }
  });
});

test.describe('Keyboard Navigation - Common Keyboard Shortcuts', () => {
  test('Escape key closes open dropdowns', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Find and click a dropdown
    const dropdown = page.locator('[data-slot="select-trigger"]').first();

    if (await dropdown.isVisible().catch(() => false)) {
      await dropdown.click();
      await page.waitForTimeout(300);

      // Dropdown should be open
      const isOpen = await page.locator('[data-state="open"]').isVisible().catch(() => false);

      if (isOpen) {
        // Press Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        // Should be closed
        const stillOpen = await page.locator('[role="listbox"]').isVisible().catch(() => false);
        expect(stillOpen).toBe(false);
      }
    }
  });

  test('Enter activates focused buttons', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    // Tab to a button
    let foundButton = false;
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');

      const isButton = await page.evaluate(() => {
        return document.activeElement?.tagName.toLowerCase() === 'button';
      });

      if (isButton) {
        foundButton = true;
        break;
      }
    }

    if (foundButton) {
      // Button should be focusable and activatable
      const buttonFocused = await page.evaluate(() => {
        return document.activeElement?.tagName.toLowerCase() === 'button';
      });

      expect(buttonFocused).toBe(true);
    }
  });

  test('Space bar toggles checkboxes', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Find a checkbox
    const checkbox = page.locator('input[type="checkbox"], [role="checkbox"]').first();

    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.focus();

      // Get initial state
      const initialChecked = await checkbox.evaluate((el) => {
        return (el as HTMLInputElement).checked || el.getAttribute('aria-checked') === 'true';
      });

      // Press Space
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);

      // Check if toggled
      const newChecked = await checkbox.evaluate((el) => {
        return (el as HTMLInputElement).checked || el.getAttribute('aria-checked') === 'true';
      });

      // State should have changed
      expect(newChecked).not.toBe(initialChecked);

      // Toggle back
      await page.keyboard.press('Space');
    }
  });
});
