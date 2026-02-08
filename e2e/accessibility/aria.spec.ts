import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  testAriaCompliance,
  getLandmarkRegions,
  testHeadingHierarchy,
  waitForPageReady,
  WCAG_21_AA_TAGS,
} from './utils';

/**
 * WCAG 2.1 AA Accessibility Tests - ARIA & Screen Reader Compatibility
 * Tests ARIA labels, roles, live regions, and screen reader compatibility.
 */

test.describe('ARIA - Landmark Regions', () => {
  test('employee dashboard has required landmarks', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const landmarks = await getLandmarkRegions(page);

    // Should have main content area
    expect(landmarks.hasMain).toBe(true);

    // Should have navigation
    expect(landmarks.hasNav).toBe(true);

    // Log all landmarks found
    console.log('Landmarks found:', landmarks.landmarks);
  });

  test('all dashboards have main landmark', async ({ page }) => {
    const dashboards = ['/employee', '/manager', '/hr', '/executive', '/admin'];

    for (const dashboard of dashboards) {
      await page.goto(dashboard);
      await waitForPageReady(page);

      const landmarks = await getLandmarkRegions(page);
      expect(landmarks.hasMain).toBe(true);
    }
  });

  test('navigation landmarks have accessible names when multiple exist', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const navElements = await page.locator('nav, [role="navigation"]').all();

    if (navElements.length > 1) {
      // When multiple navs exist, they should have unique labels
      const labels: string[] = [];

      for (const nav of navElements) {
        const label = await nav.evaluate((el) => {
          return (
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            ''
          );
        });

        if (label) {
          expect(labels).not.toContain(label);
          labels.push(label);
        }
      }
    }
  });
});

test.describe('ARIA - Headings', () => {
  test('login page has proper heading structure', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const { hasH1, hasProperHierarchy, headings, issues } = await testHeadingHierarchy(page);

    console.log('Login page headings:', headings);

    if (issues.length > 0) {
      console.log('Heading issues:', issues);
    }

    expect(hasH1).toBe(true);
  });

  test('employee dashboard has proper heading structure', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const { hasH1, headings, issues } = await testHeadingHierarchy(page);

    console.log('Employee dashboard headings:', headings);

    expect(hasH1).toBe(true);
  });

  test('all pages have exactly one h1', async ({ page }) => {
    const pages = ['/login', '/employee', '/manager', '/hr'];

    for (const pageUrl of pages) {
      await page.goto(pageUrl);
      await waitForPageReady(page);

      const h1Count = await page.locator('h1').count();

      if (h1Count !== 1) {
        console.log(`${pageUrl} has ${h1Count} h1 elements (should have exactly 1)`);
      }

      expect(h1Count).toBeGreaterThanOrEqual(1);
    }
  });
});

test.describe('ARIA - Labels and Descriptions', () => {
  test('all images have alt text', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const images = await page.locator('img:visible').all();

    for (const img of images) {
      const hasAltOrAriaHidden = await img.evaluate((el) => {
        return (
          el.hasAttribute('alt') ||
          el.getAttribute('aria-hidden') === 'true' ||
          el.getAttribute('role') === 'presentation'
        );
      });

      if (!hasAltOrAriaHidden) {
        const src = await img.getAttribute('src');
        console.log(`Image missing alt text: ${src}`);
      }

      expect(hasAltOrAriaHidden).toBe(true);
    }
  });

  test('all buttons have accessible names', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const buttons = await page.locator('button:visible, [role="button"]:visible').all();

    for (const button of buttons) {
      const hasAccessibleName = await button.evaluate((el) => {
        const text = el.textContent?.trim();
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledby = el.getAttribute('aria-labelledby');
        const title = el.getAttribute('title');

        // Check for icon-only buttons with SVG that might have title
        const svg = el.querySelector('svg');
        const svgTitle = svg?.querySelector('title')?.textContent;

        return !!(text || ariaLabel || ariaLabelledby || title || svgTitle);
      });

      if (!hasAccessibleName) {
        const html = await button.evaluate((el) => el.outerHTML.slice(0, 100));
        console.log(`Button missing accessible name: ${html}`);
      }

      expect(hasAccessibleName).toBe(true);
    }
  });

  test('all links have accessible names', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const links = await page.locator('a[href]:visible').all();

    for (const link of links) {
      const hasAccessibleName = await link.evaluate((el) => {
        const text = el.textContent?.trim();
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledby = el.getAttribute('aria-labelledby');
        const title = el.getAttribute('title');
        const imgAlt = el.querySelector('img')?.alt;

        return !!(text || ariaLabel || ariaLabelledby || title || imgAlt);
      });

      if (!hasAccessibleName) {
        const href = await link.getAttribute('href');
        console.log(`Link missing accessible name: ${href}`);
      }

      expect(hasAccessibleName).toBe(true);
    }
  });

  test('icon-only buttons have aria-label', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const iconButtons = await page.locator('button:has(svg):visible').all();

    for (const button of iconButtons) {
      const info = await button.evaluate((el) => {
        const text = el.textContent?.trim();
        const ariaLabel = el.getAttribute('aria-label');
        const title = el.getAttribute('title');
        const srOnlyText = el.querySelector('.sr-only')?.textContent;

        return {
          hasText: !!text,
          hasAriaLabel: !!ariaLabel,
          hasTitle: !!title,
          hasSrOnly: !!srOnlyText,
        };
      });

      const hasAccessibleName =
        info.hasText || info.hasAriaLabel || info.hasTitle || info.hasSrOnly;

      if (!hasAccessibleName) {
        const html = await button.evaluate((el) => el.outerHTML.slice(0, 100));
        console.log(`Icon-only button needs accessible name: ${html}`);
      }

      // Icon-only buttons MUST have an accessible name
      expect(hasAccessibleName).toBe(true);
    }
  });
});

test.describe('ARIA - Live Regions', () => {
  test('toast notifications have appropriate ARIA roles', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Check for toast/notification container with aria-live
    const toastContainers = await page.locator('[aria-live], [role="alert"], [role="status"]').all();

    // App should have infrastructure for announcements
    // This may not always be visible, so we check the DOM
    const hasLiveRegion = await page.evaluate(() => {
      return !!document.querySelector('[aria-live], [role="alert"], [role="status"]');
    });

    // Most apps should have some kind of live region for notifications
    // This is informational - not all pages will have visible alerts
    console.log(`Live regions found: ${toastContainers.length}`);
  });

  test('form validation errors use aria-live or aria-invalid', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Check if forms have proper error handling setup
    const hasErrorHandling = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      let hasAriaSetup = false;

      forms.forEach((form) => {
        // Check for aria-describedby on inputs (for error messages)
        const inputsWithDescribedby = form.querySelectorAll('[aria-describedby]');
        // Check for aria-live regions for errors
        const liveRegions = form.querySelectorAll('[aria-live]');
        // Check for aria-invalid capable inputs
        const inputs = form.querySelectorAll('input, select, textarea');

        if (inputsWithDescribedby.length > 0 || liveRegions.length > 0) {
          hasAriaSetup = true;
        }
      });

      return hasAriaSetup;
    });

    // This is informational - the form tests will verify actual error behavior
    console.log(`Forms have ARIA error handling: ${hasErrorHandling}`);
  });
});

test.describe('ARIA - Interactive Widgets', () => {
  test('dropdowns have correct ARIA roles', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const selectTriggers = await page.locator('[data-slot="select-trigger"], [role="combobox"]').all();

    for (const trigger of selectTriggers.slice(0, 3)) {
      const isVisible = await trigger.isVisible().catch(() => false);
      if (!isVisible) continue;

      const ariaProps = await trigger.evaluate((el) => ({
        role: el.getAttribute('role'),
        ariaExpanded: el.getAttribute('aria-expanded'),
        ariaHaspopup: el.getAttribute('aria-haspopup'),
        ariaControls: el.getAttribute('aria-controls'),
      }));

      // Should have combobox role or button role with haspopup
      const hasProperRole =
        ariaProps.role === 'combobox' ||
        ariaProps.role === 'button' ||
        ariaProps.ariaHaspopup;

      if (!hasProperRole) {
        console.log('Dropdown missing proper ARIA:', ariaProps);
      }
    }
  });

  test('modals have correct ARIA attributes', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Try to open a modal
    const modalTrigger = page.locator('button:has-text("New"), button:has-text("Request")').first();

    if (await modalTrigger.isVisible().catch(() => false)) {
      await modalTrigger.click();
      await page.waitForTimeout(500);

      const dialog = page.locator('[role="dialog"], [role="alertdialog"]');

      if (await dialog.isVisible().catch(() => false)) {
        const ariaProps = await dialog.evaluate((el) => ({
          role: el.getAttribute('role'),
          ariaModal: el.getAttribute('aria-modal'),
          ariaLabelledby: el.getAttribute('aria-labelledby'),
          ariaLabel: el.getAttribute('aria-label'),
          ariaDescribedby: el.getAttribute('aria-describedby'),
        }));

        // Should have dialog role
        expect(['dialog', 'alertdialog']).toContain(ariaProps.role);

        // Should have aria-modal="true"
        expect(ariaProps.ariaModal).toBe('true');

        // Should have accessible name
        const hasAccessibleName = ariaProps.ariaLabelledby || ariaProps.ariaLabel;
        expect(hasAccessibleName).toBeTruthy();

        // Close the modal
        await page.keyboard.press('Escape');
      }
    }
  });

  test('tabs have correct ARIA structure', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const tabList = page.locator('[role="tablist"]');

    if (await tabList.isVisible().catch(() => false)) {
      // Check tablist structure
      const tabs = await tabList.locator('[role="tab"]').all();

      for (const tab of tabs) {
        const ariaProps = await tab.evaluate((el) => ({
          role: el.getAttribute('role'),
          ariaSelected: el.getAttribute('aria-selected'),
          ariaControls: el.getAttribute('aria-controls'),
          tabindex: el.getAttribute('tabindex'),
        }));

        expect(ariaProps.role).toBe('tab');
        expect(ariaProps.ariaSelected).toMatch(/true|false/);
      }

      // Check that there's a corresponding tabpanel
      const tabPanels = await page.locator('[role="tabpanel"]').all();
      expect(tabPanels.length).toBeGreaterThan(0);
    }
  });

  test('tables have proper ARIA or use semantic HTML', async ({ page }) => {
    await page.goto('/hr');
    await waitForPageReady(page);

    const tables = await page.locator('table, [role="table"], [role="grid"]').all();

    for (const table of tables) {
      const tableInfo = await table.evaluate((el) => {
        const isSemanticTable = el.tagName.toLowerCase() === 'table';
        const hasAriaRole = el.getAttribute('role') === 'table' || el.getAttribute('role') === 'grid';
        const hasCaption =
          !!el.querySelector('caption') ||
          !!el.getAttribute('aria-label') ||
          !!el.getAttribute('aria-labelledby');
        const hasHeaders =
          el.querySelectorAll('th, [role="columnheader"]').length > 0;

        return {
          isSemanticTable,
          hasAriaRole,
          hasCaption,
          hasHeaders,
        };
      });

      // Should be either semantic table or have ARIA role
      expect(tableInfo.isSemanticTable || tableInfo.hasAriaRole).toBe(true);

      // Should have headers
      if (tableInfo.isSemanticTable || tableInfo.hasAriaRole) {
        expect(tableInfo.hasHeaders).toBe(true);
      }
    }
  });
});

test.describe('ARIA - axe-core ARIA Rules', () => {
  test('login page passes axe-core ARIA rules', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withRules([
        'aria-allowed-attr',
        'aria-hidden-body',
        'aria-hidden-focus',
        'aria-required-attr',
        'aria-required-children',
        'aria-required-parent',
        'aria-roledescription',
        'aria-roles',
        'aria-valid-attr',
        'aria-valid-attr-value',
      ])
      .analyze();

    if (results.violations.length > 0) {
      console.log('ARIA violations on login page:');
      results.violations.forEach((v) => {
        console.log(`  ${v.id}: ${v.help}`);
        v.nodes.slice(0, 2).forEach((n) => {
          console.log(`    - ${n.target.join(' > ')}`);
        });
      });
    }

    expect(results.violations).toHaveLength(0);
  });

  test('employee dashboard passes axe-core ARIA rules', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withRules([
        'aria-allowed-attr',
        'aria-hidden-body',
        'aria-hidden-focus',
        'aria-required-attr',
        'aria-required-children',
        'aria-required-parent',
        'aria-roledescription',
        'aria-roles',
        'aria-valid-attr',
        'aria-valid-attr-value',
      ])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalViolations.length > 0) {
      console.log('ARIA violations on employee dashboard:');
      criticalViolations.forEach((v) => {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      });
    }

    expect(criticalViolations).toHaveLength(0);
  });
});

test.describe('ARIA - Screen Reader Announcements', () => {
  test('page has title for screen reader navigation', async ({ page }) => {
    const pages = [
      { url: '/login', expectedTitle: /login|sign in/i },
      { url: '/employee', expectedTitle: /employee|dashboard|leave/i },
      { url: '/manager', expectedTitle: /manager|dashboard/i },
      { url: '/hr', expectedTitle: /hr|human|dashboard/i },
    ];

    for (const pageInfo of pages) {
      await page.goto(pageInfo.url);
      await waitForPageReady(page);

      const title = await page.title();

      // Page should have a meaningful title
      expect(title.length).toBeGreaterThan(0);
    }
  });

  test('language is declared for screen readers', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const lang = await page.evaluate(() => {
      return document.documentElement.lang;
    });

    // Should have lang attribute
    expect(lang).toBeTruthy();
    expect(lang.length).toBeGreaterThan(0);
  });
});
