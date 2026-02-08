import { Page, expect, Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility test utilities for WCAG 2.1 AA compliance testing.
 * Provides helpers for axe-core integration, keyboard navigation, and ARIA testing.
 */

// WCAG 2.1 AA relevant axe-core tags
export const WCAG_21_AA_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
] as const;

// Impact levels for filtering violations
export type ImpactLevel = 'critical' | 'serious' | 'moderate' | 'minor';

export interface AccessibilityViolation {
  id: string;
  impact: ImpactLevel;
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary?: string;
  }>;
}

export interface AccessibilityScanResult {
  violations: AccessibilityViolation[];
  passes: number;
  incomplete: number;
}

/**
 * Run a comprehensive accessibility scan on the current page.
 * Uses axe-core with WCAG 2.1 AA tags.
 */
export async function runAccessibilityScan(
  page: Page,
  options?: {
    includeSelector?: string;
    excludeSelector?: string;
    disableRules?: string[];
  }
): Promise<AccessibilityScanResult> {
  let builder = new AxeBuilder({ page }).withTags([...WCAG_21_AA_TAGS]);

  if (options?.includeSelector) {
    builder = builder.include(options.includeSelector);
  }

  if (options?.excludeSelector) {
    builder = builder.exclude(options.excludeSelector);
  }

  if (options?.disableRules) {
    builder = builder.disableRules(options.disableRules);
  }

  const results = await builder.analyze();

  return {
    violations: results.violations as AccessibilityViolation[],
    passes: results.passes.length,
    incomplete: results.incomplete.length,
  };
}

/**
 * Assert that a page has no critical or serious accessibility violations.
 */
export async function expectNoAccessibilityViolations(
  page: Page,
  options?: {
    impactThreshold?: ImpactLevel;
    excludeSelector?: string;
    disableRules?: string[];
  }
): Promise<void> {
  const threshold = options?.impactThreshold || 'serious';
  const impactLevels: ImpactLevel[] = ['critical', 'serious', 'moderate', 'minor'];
  const thresholdIndex = impactLevels.indexOf(threshold);
  const relevantImpacts = impactLevels.slice(0, thresholdIndex + 1);

  const results = await runAccessibilityScan(page, {
    excludeSelector: options?.excludeSelector,
    disableRules: options?.disableRules,
  });

  const relevantViolations = results.violations.filter((v) =>
    relevantImpacts.includes(v.impact)
  );

  if (relevantViolations.length > 0) {
    const violationReport = formatViolationReport(relevantViolations);
    throw new Error(
      `Found ${relevantViolations.length} accessibility violation(s):\n${violationReport}`
    );
  }
}

/**
 * Format violations into a readable report.
 */
export function formatViolationReport(violations: AccessibilityViolation[]): string {
  return violations
    .map((v, index) => {
      const nodes = v.nodes
        .slice(0, 3)
        .map((n) => `    - ${n.target.join(' > ')}\n      HTML: ${n.html.slice(0, 100)}...`)
        .join('\n');
      return `${index + 1}. [${v.impact?.toUpperCase()}] ${v.id}: ${v.help}\n   ${v.helpUrl}\n   Affected elements:\n${nodes}`;
    })
    .join('\n\n');
}

/**
 * Generate an accessibility report for a page.
 */
export async function generateAccessibilityReport(
  page: Page
): Promise<{
  summary: string;
  violations: AccessibilityViolation[];
  passCount: number;
  incompleteCount: number;
}> {
  const results = await runAccessibilityScan(page);

  const criticalCount = results.violations.filter((v) => v.impact === 'critical').length;
  const seriousCount = results.violations.filter((v) => v.impact === 'serious').length;
  const moderateCount = results.violations.filter((v) => v.impact === 'moderate').length;
  const minorCount = results.violations.filter((v) => v.impact === 'minor').length;

  const summary = `
Accessibility Report
====================
Total Violations: ${results.violations.length}
  - Critical: ${criticalCount}
  - Serious: ${seriousCount}
  - Moderate: ${moderateCount}
  - Minor: ${minorCount}
Passed Checks: ${results.passes}
Incomplete Checks: ${results.incomplete}
`;

  return {
    summary,
    violations: results.violations,
    passCount: results.passes,
    incompleteCount: results.incomplete,
  };
}

/**
 * Test keyboard navigation by tabbing through focusable elements.
 */
export async function testKeyboardNavigation(
  page: Page,
  options?: {
    maxTabs?: number;
    expectFocusOrder?: string[];
  }
): Promise<{
  focusableElements: string[];
  focusOrder: string[];
  hasFocusTraps: boolean;
}> {
  const maxTabs = options?.maxTabs || 50;
  const focusOrder: string[] = [];
  const focusableElements: string[] = [];

  // Start from the beginning
  await page.keyboard.press('Tab');

  for (let i = 0; i < maxTabs; i++) {
    const activeElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;

      const tagName = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const className = el.className
        ? `.${String(el.className).split(' ').filter(Boolean).slice(0, 2).join('.')}`
        : '';
      const role = el.getAttribute('role') ? `[role="${el.getAttribute('role')}"]` : '';
      const ariaLabel = el.getAttribute('aria-label')
        ? `[aria-label="${el.getAttribute('aria-label')}"]`
        : '';

      return `${tagName}${id}${className}${role}${ariaLabel}`.trim();
    });

    if (!activeElement) break;

    // Detect focus traps (same element focused twice in a row)
    if (focusOrder.length > 0 && focusOrder[focusOrder.length - 1] === activeElement) {
      if (focusOrder.filter((el) => el === activeElement).length >= 2) {
        return {
          focusableElements: Array.from(new Set(focusOrder)),
          focusOrder,
          hasFocusTraps: true,
        };
      }
    }

    focusOrder.push(activeElement);
    if (!focusableElements.includes(activeElement)) {
      focusableElements.push(activeElement);
    }

    await page.keyboard.press('Tab');
  }

  // Check expected focus order if provided
  if (options?.expectFocusOrder) {
    for (let i = 0; i < options.expectFocusOrder.length; i++) {
      expect(focusOrder[i]).toContain(options.expectFocusOrder[i]);
    }
  }

  return {
    focusableElements,
    focusOrder,
    hasFocusTraps: false,
  };
}

/**
 * Test that all interactive elements are keyboard accessible.
 */
export async function testInteractiveElementsKeyboardAccessible(
  page: Page
): Promise<{
  totalInteractive: number;
  keyboardAccessible: number;
  notAccessible: string[];
}> {
  const results = await page.evaluate(() => {
    const interactiveElements = document.querySelectorAll(
      'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [tabindex]'
    );

    const notAccessible: string[] = [];
    let keyboardAccessible = 0;

    interactiveElements.forEach((el) => {
      const tabIndex = el.getAttribute('tabindex');
      const isDisabled =
        el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';

      // Skip disabled elements
      if (isDisabled) {
        keyboardAccessible++;
        return;
      }

      // Check if element is keyboard focusable
      const canFocus =
        tabIndex !== '-1' &&
        (el.matches('button, a[href], input, select, textarea') || tabIndex !== null);

      if (canFocus) {
        keyboardAccessible++;
      } else {
        const tagName = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        notAccessible.push(`${tagName}${id}`);
      }
    });

    return {
      totalInteractive: interactiveElements.length,
      keyboardAccessible,
      notAccessible,
    };
  });

  return results;
}

/**
 * Test that focus is visible on all focusable elements.
 */
export async function testFocusVisibility(
  page: Page,
  selector?: string
): Promise<{
  elementsTested: number;
  elementsWithVisibleFocus: number;
  elementsWithoutVisibleFocus: string[];
}> {
  const focusableSelector =
    selector ||
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

  const elements = await page.locator(focusableSelector).all();
  const elementsWithoutVisibleFocus: string[] = [];

  for (const element of elements.slice(0, 20)) {
    // Test first 20 elements
    try {
      await element.focus();

      // Check if focus styles are applied
      const hasVisibleFocus = await element.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        const focusStyles = window.getComputedStyle(el, ':focus');

        // Check for outline, box-shadow, or border changes
        const hasOutline =
          styles.outline !== 'none' && styles.outlineWidth !== '0px';
        const hasBoxShadow = styles.boxShadow !== 'none';
        const hasBorderChange =
          styles.borderColor !== 'rgb(0, 0, 0)' &&
          styles.borderWidth !== '0px';

        return hasOutline || hasBoxShadow || hasBorderChange;
      });

      if (!hasVisibleFocus) {
        const description = await element.evaluate((el) => {
          const tagName = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const text = el.textContent?.slice(0, 30) || '';
          return `${tagName}${id} "${text}"`;
        });
        elementsWithoutVisibleFocus.push(description);
      }
    } catch {
      // Element may not be visible or focusable
    }
  }

  return {
    elementsTested: Math.min(elements.length, 20),
    elementsWithVisibleFocus: Math.min(elements.length, 20) - elementsWithoutVisibleFocus.length,
    elementsWithoutVisibleFocus,
  };
}

/**
 * Test ARIA labels and roles.
 */
export async function testAriaCompliance(page: Page): Promise<{
  totalAriaElements: number;
  issues: string[];
}> {
  const issues = await page.evaluate(() => {
    const issues: string[] = [];

    // Check images for alt text
    document.querySelectorAll('img').forEach((img) => {
      if (!img.alt && !img.getAttribute('aria-label') && !img.getAttribute('aria-hidden')) {
        issues.push(`Image missing alt text: ${img.src.slice(0, 50)}`);
      }
    });

    // Check buttons for accessible names
    document.querySelectorAll('button, [role="button"]').forEach((btn) => {
      const hasAccessibleName =
        btn.textContent?.trim() ||
        btn.getAttribute('aria-label') ||
        btn.getAttribute('aria-labelledby') ||
        btn.getAttribute('title');

      if (!hasAccessibleName) {
        const id = (btn as HTMLElement).id ? `#${(btn as HTMLElement).id}` : '';
        issues.push(`Button missing accessible name: button${id}`);
      }
    });

    // Check form inputs for labels
    document.querySelectorAll('input, select, textarea').forEach((input) => {
      const inputEl = input as HTMLInputElement;
      if (inputEl.type === 'hidden' || inputEl.type === 'submit' || inputEl.type === 'button') {
        return;
      }

      const hasLabel =
        inputEl.labels?.length ||
        inputEl.getAttribute('aria-label') ||
        inputEl.getAttribute('aria-labelledby') ||
        inputEl.placeholder;

      if (!hasLabel) {
        const id = inputEl.id ? `#${inputEl.id}` : '';
        const name = inputEl.name ? `[name="${inputEl.name}"]` : '';
        issues.push(`Form input missing label: ${inputEl.tagName.toLowerCase()}${id}${name}`);
      }
    });

    // Check links for accessible names
    document.querySelectorAll('a[href]').forEach((link) => {
      const hasAccessibleName =
        link.textContent?.trim() ||
        link.getAttribute('aria-label') ||
        link.getAttribute('title') ||
        link.querySelector('img[alt]');

      if (!hasAccessibleName) {
        const href = (link as HTMLAnchorElement).href.slice(0, 30);
        issues.push(`Link missing accessible name: ${href}`);
      }
    });

    // Count total ARIA elements
    const ariaElements = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby], [role]');

    return {
      totalAriaElements: ariaElements.length,
      issues,
    };
  });

  return {
    totalAriaElements: issues.totalAriaElements,
    issues: issues.issues,
  };
}

/**
 * Test color contrast compliance.
 * Note: This is a basic check - axe-core provides more comprehensive contrast analysis.
 */
export async function testColorContrast(page: Page): Promise<{
  elementsChecked: number;
  potentialIssues: string[];
}> {
  // Use axe-core specifically for color contrast
  const results = await new AxeBuilder({ page })
    .withRules(['color-contrast', 'color-contrast-enhanced'])
    .analyze();

  const potentialIssues = results.violations
    .filter((v) => v.id.includes('color-contrast'))
    .flatMap((v) =>
      v.nodes.slice(0, 5).map((n) => `${v.help}: ${n.target.join(' > ')}`)
    );

  return {
    elementsChecked: results.passes.filter((p) => p.id.includes('color-contrast')).length,
    potentialIssues,
  };
}

/**
 * Test form error announcements for screen readers.
 */
export async function testFormErrorAnnouncements(
  page: Page,
  formSelector: string,
  submitButtonSelector: string
): Promise<{
  hasAriaLive: boolean;
  hasAriaInvalid: boolean;
  hasAriaDescribedby: boolean;
  errorMessagesLinked: boolean;
}> {
  // Submit the form to trigger validation
  await page.click(submitButtonSelector);
  await page.waitForTimeout(500);

  const results = await page.evaluate((formSel) => {
    const form = document.querySelector(formSel);
    if (!form) return null;

    // Check for aria-live regions
    const hasAriaLive = !!form.querySelector('[aria-live], [role="alert"], [role="status"]');

    // Check for aria-invalid on inputs
    const hasAriaInvalid = !!form.querySelector('[aria-invalid="true"]');

    // Check for aria-describedby linking errors
    const invalidInputs = form.querySelectorAll('[aria-invalid="true"]');
    let hasAriaDescribedby = false;
    let errorMessagesLinked = false;

    invalidInputs.forEach((input) => {
      const describedBy = input.getAttribute('aria-describedby');
      if (describedBy) {
        hasAriaDescribedby = true;
        const errorElement = document.getElementById(describedBy);
        if (errorElement?.textContent?.trim()) {
          errorMessagesLinked = true;
        }
      }
    });

    return {
      hasAriaLive,
      hasAriaInvalid,
      hasAriaDescribedby,
      errorMessagesLinked,
    };
  }, formSelector);

  return results || {
    hasAriaLive: false,
    hasAriaInvalid: false,
    hasAriaDescribedby: false,
    errorMessagesLinked: false,
  };
}

/**
 * Test skip links functionality.
 */
export async function testSkipLinks(page: Page): Promise<{
  hasSkipLink: boolean;
  skipLinkWorks: boolean;
  mainContentId?: string;
}> {
  // Check for skip link
  const skipLink = await page
    .locator('a[href^="#"]:has-text(/skip|jump|main content/i)')
    .first();

  const hasSkipLink = (await skipLink.count()) > 0;

  if (!hasSkipLink) {
    return { hasSkipLink: false, skipLinkWorks: false };
  }

  // Get the target ID
  const href = await skipLink.getAttribute('href');
  const mainContentId = href?.replace('#', '');

  // Check if target exists
  const targetExists = mainContentId
    ? (await page.locator(`#${mainContentId}`).count()) > 0
    : false;

  return {
    hasSkipLink,
    skipLinkWorks: targetExists,
    mainContentId: mainContentId || undefined,
  };
}

/**
 * Helper to wait for page to be ready for accessibility testing.
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // Allow for any animations to complete
}

/**
 * Get all landmark regions on the page.
 */
export async function getLandmarkRegions(page: Page): Promise<{
  landmarks: Array<{ role: string; label?: string }>;
  hasMain: boolean;
  hasNav: boolean;
  hasHeader: boolean;
  hasFooter: boolean;
}> {
  const landmarks = await page.evaluate(() => {
    const landmarkRoles = ['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'search', 'region'];
    const landmarks: Array<{ role: string; label?: string }> = [];

    // Check for role attributes
    landmarkRoles.forEach((role) => {
      document.querySelectorAll(`[role="${role}"]`).forEach((el) => {
        landmarks.push({
          role,
          label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || undefined,
        });
      });
    });

    // Check for semantic HTML elements
    document.querySelectorAll('main').forEach((el) => {
      if (!el.getAttribute('role')) {
        landmarks.push({ role: 'main', label: el.getAttribute('aria-label') || undefined });
      }
    });

    document.querySelectorAll('nav').forEach((el) => {
      if (!el.getAttribute('role')) {
        landmarks.push({ role: 'navigation', label: el.getAttribute('aria-label') || undefined });
      }
    });

    document.querySelectorAll('header').forEach((el) => {
      const parent = el.parentElement;
      if (!el.getAttribute('role') && (!parent || parent.tagName !== 'ARTICLE' && parent.tagName !== 'SECTION')) {
        landmarks.push({ role: 'banner', label: el.getAttribute('aria-label') || undefined });
      }
    });

    document.querySelectorAll('footer').forEach((el) => {
      const parent = el.parentElement;
      if (!el.getAttribute('role') && (!parent || parent.tagName !== 'ARTICLE' && parent.tagName !== 'SECTION')) {
        landmarks.push({ role: 'contentinfo', label: el.getAttribute('aria-label') || undefined });
      }
    });

    return landmarks;
  });

  return {
    landmarks,
    hasMain: landmarks.some((l) => l.role === 'main'),
    hasNav: landmarks.some((l) => l.role === 'navigation'),
    hasHeader: landmarks.some((l) => l.role === 'banner'),
    hasFooter: landmarks.some((l) => l.role === 'contentinfo'),
  };
}

/**
 * Test heading hierarchy.
 */
export async function testHeadingHierarchy(page: Page): Promise<{
  headings: Array<{ level: number; text: string }>;
  hasH1: boolean;
  hasProperHierarchy: boolean;
  issues: string[];
}> {
  const result = await page.evaluate(() => {
    const headings: Array<{ level: number; text: string }> = [];
    const issues: string[] = [];

    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      const level = parseInt(h.tagName[1]);
      headings.push({
        level,
        text: h.textContent?.trim().slice(0, 50) || '',
      });
    });

    // Check for h1
    const h1Count = headings.filter((h) => h.level === 1).length;
    if (h1Count === 0) {
      issues.push('Page missing h1 heading');
    } else if (h1Count > 1) {
      issues.push(`Page has ${h1Count} h1 headings (should have only one)`);
    }

    // Check for proper hierarchy (no skipping levels)
    let hasProperHierarchy = true;
    for (let i = 1; i < headings.length; i++) {
      const diff = headings[i].level - headings[i - 1].level;
      if (diff > 1) {
        hasProperHierarchy = false;
        issues.push(
          `Heading level skipped: h${headings[i - 1].level} to h${headings[i].level}`
        );
      }
    }

    return {
      headings,
      hasH1: h1Count === 1,
      hasProperHierarchy,
      issues,
    };
  });

  return result;
}
