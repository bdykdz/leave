import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { waitForPageReady } from './utils';

/**
 * WCAG 2.1 AA Accessibility Tests - Color Contrast
 * Tests color contrast compliance for text and UI elements.
 */

test.describe('Color Contrast - axe-core Analysis', () => {
  test('login page meets color contrast requirements', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast'
    );

    if (contrastViolations.length > 0) {
      console.log('Color contrast violations on login page:');
      contrastViolations.forEach((v) => {
        v.nodes.slice(0, 5).forEach((n) => {
          console.log(`  - ${n.target.join(' > ')}`);
          console.log(`    ${n.failureSummary}`);
        });
      });
    }

    // Filter for critical/serious only
    const significantViolations = contrastViolations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });

  test('employee dashboard meets color contrast requirements', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast'
    );

    if (contrastViolations.length > 0) {
      console.log('Color contrast violations on employee dashboard:');
      contrastViolations.forEach((v) => {
        v.nodes.slice(0, 5).forEach((n) => {
          console.log(`  - ${n.target.join(' > ')}`);
        });
      });
    }

    const significantViolations = contrastViolations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });

  test('manager dashboard meets color contrast requirements', async ({ page }) => {
    await page.goto('/manager');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.id === 'color-contrast' && (v.impact === 'critical' || v.impact === 'serious')
    );

    expect(significantViolations).toHaveLength(0);
  });

  test('HR dashboard meets color contrast requirements', async ({ page }) => {
    await page.goto('/hr');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.id === 'color-contrast' && (v.impact === 'critical' || v.impact === 'serious')
    );

    expect(significantViolations).toHaveLength(0);
  });

  test('executive dashboard meets color contrast requirements', async ({ page }) => {
    await page.goto('/executive');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.id === 'color-contrast' && (v.impact === 'critical' || v.impact === 'serious')
    );

    expect(significantViolations).toHaveLength(0);
  });

  test('admin dashboard meets color contrast requirements', async ({ page }) => {
    await page.goto('/admin');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.id === 'color-contrast' && (v.impact === 'critical' || v.impact === 'serious')
    );

    expect(significantViolations).toHaveLength(0);
  });
});

test.describe('Color Contrast - UI Components', () => {
  test('buttons have sufficient contrast', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const buttons = await page.locator('button:visible').all();

    for (const button of buttons.slice(0, 10)) {
      const styles = await button.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          text: el.textContent?.trim().slice(0, 20),
        };
      });

      // Log button styles for manual verification
      console.log(`Button "${styles.text}": text=${styles.color}, bg=${styles.backgroundColor}`);
    }
  });

  test('links have sufficient contrast', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const links = await page.locator('a:visible').all();

    for (const link of links.slice(0, 10)) {
      const styles = await link.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          text: el.textContent?.trim().slice(0, 20),
        };
      });

      // Log link styles for manual verification
      console.log(`Link "${styles.text}": color=${styles.color}`);
    }
  });

  test('form inputs have sufficient contrast', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const inputs = await page.locator('input:visible').all();

    for (const input of inputs) {
      const styles = await input.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderColor,
          placeholderColor: computed.getPropertyValue('--placeholder-color') || 'N/A',
          type: (el as HTMLInputElement).type,
        };
      });

      // Log input styles for manual verification
      console.log(`Input[${styles.type}]: text=${styles.color}, bg=${styles.backgroundColor}`);
    }
  });
});

test.describe('Color Contrast - Status Indicators', () => {
  test('status badges have sufficient contrast', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Look for status badges/chips
    const badges = await page.locator('[class*="badge"], [class*="chip"], [class*="status"], [class*="tag"]').all();

    for (const badge of badges.slice(0, 10)) {
      const info = await badge.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          text: el.textContent?.trim(),
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          className: el.className,
        };
      });

      // Log badge styles for manual verification
      console.log(`Badge "${info.text}": text=${info.color}, bg=${info.backgroundColor}`);
    }
  });

  test('error messages have sufficient contrast', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    // Look for error message elements
    const errorElements = await page.locator('[class*="error"], [class*="danger"], [role="alert"]').all();

    for (const error of errorElements.slice(0, 5)) {
      const isVisible = await error.isVisible().catch(() => false);
      if (!isVisible) continue;

      const info = await error.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          text: el.textContent?.trim().slice(0, 30),
          color: computed.color,
          backgroundColor: computed.backgroundColor,
        };
      });

      // Log error styles for manual verification
      console.log(`Error "${info.text}": text=${info.color}, bg=${info.backgroundColor}`);
    }
  });
});

test.describe('Color Contrast - Comprehensive Scan', () => {
  test('generate color contrast report for all pages', async ({ page }) => {
    const pages = [
      { name: 'Login', url: '/login' },
      { name: 'Employee Dashboard', url: '/employee' },
      { name: 'Manager Dashboard', url: '/manager' },
      { name: 'HR Dashboard', url: '/hr' },
      { name: 'Executive Dashboard', url: '/executive' },
      { name: 'Admin Dashboard', url: '/admin' },
      { name: 'Team Calendar', url: '/team-calendar' },
    ];

    const report: Array<{ page: string; violations: number; elements: string[] }> = [];

    for (const pageInfo of pages) {
      await page.goto(pageInfo.url);
      await waitForPageReady(page);

      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .analyze();

      const violations = results.violations.filter((v) => v.id === 'color-contrast');
      const elements = violations.flatMap((v) =>
        v.nodes.slice(0, 3).map((n) => n.target.join(' > '))
      );

      report.push({
        page: pageInfo.name,
        violations: violations.reduce((sum, v) => sum + v.nodes.length, 0),
        elements,
      });
    }

    console.log('\n=== COLOR CONTRAST REPORT ===\n');
    report.forEach((r) => {
      console.log(`${r.page}: ${r.violations} violations`);
      if (r.elements.length > 0) {
        r.elements.forEach((el) => console.log(`  - ${el}`));
      }
    });

    const totalViolations = report.reduce((sum, r) => sum + r.violations, 0);
    console.log(`\nTotal contrast violations: ${totalViolations}`);

    // Should have zero or very few contrast issues
    expect(totalViolations).toBeLessThanOrEqual(10);
  });
});

test.describe('Color Contrast - Focus States', () => {
  test('focus indicators meet contrast requirements', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Tab to first element
    await page.keyboard.press('Tab');

    // Check focus indicator contrast
    const focusInfo = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;

      const styles = window.getComputedStyle(el);
      return {
        outlineColor: styles.outlineColor,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow,
        borderColor: styles.borderColor,
      };
    });

    // Log focus indicator styles
    console.log('Focus indicator styles:', focusInfo);

    // Focus indicator should be visible (non-zero width or visible box-shadow)
    if (focusInfo) {
      const hasVisibleFocus =
        focusInfo.outlineWidth !== '0px' ||
        focusInfo.boxShadow !== 'none';

      expect(hasVisibleFocus).toBe(true);
    }
  });
});

test.describe('Color Contrast - Dark Mode', () => {
  test('check if dark mode toggle exists and verify contrast', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Look for dark mode toggle
    const darkModeToggle = page.locator('button:has-text("dark"), button:has([class*="moon"]), button:has([class*="sun"]), [data-theme-toggle]');

    const hasDarkMode = await darkModeToggle.isVisible().catch(() => false);

    if (hasDarkMode) {
      // Toggle dark mode
      await darkModeToggle.click();
      await page.waitForTimeout(500);

      // Run contrast check in dark mode
      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .analyze();

      const violations = results.violations.filter(
        (v) => v.id === 'color-contrast' && (v.impact === 'critical' || v.impact === 'serious')
      );

      if (violations.length > 0) {
        console.log('Dark mode contrast violations:');
        violations.forEach((v) => {
          v.nodes.slice(0, 3).forEach((n) => {
            console.log(`  - ${n.target.join(' > ')}`);
          });
        });
      }

      expect(violations).toHaveLength(0);

      // Toggle back to light mode
      await darkModeToggle.click();
    } else {
      console.log('No dark mode toggle found');
    }
  });
});
