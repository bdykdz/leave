import { Page, expect } from '@playwright/test';

/**
 * Visual regression testing utilities.
 *
 * These utilities provide helper functions for visual regression tests
 * to ensure consistent screenshots across different test runs.
 */

/**
 * Prepares the page for visual testing by:
 * - Waiting for network idle
 * - Waiting for all images to load
 * - Waiting for fonts to load
 * - Hiding dynamic elements
 */
export async function preparePageForScreenshot(page: Page): Promise<void> {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle');

  // Wait for all images to load
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.onload = img.onerror = resolve;
            })
        )
    );
  });

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);

  // Hide dynamic content that could cause flakiness
  await page.addStyleTag({
    content: `
      [data-testid="current-time"],
      [data-testid="timestamp"],
      .relative-time,
      .ago {
        visibility: hidden !important;
      }
    `,
  });

  // Wait for any animations to complete
  await page.waitForTimeout(500);
}

/**
 * Takes a full page screenshot with consistent settings.
 */
export async function takeFullPageScreenshot(
  page: Page,
  name: string
): Promise<void> {
  await preparePageForScreenshot(page);

  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: 'disabled',
  });
}

/**
 * Takes a screenshot of a specific element.
 */
export async function takeElementScreenshot(
  page: Page,
  selector: string,
  name: string
): Promise<void> {
  await preparePageForScreenshot(page);

  const element = page.locator(selector);
  await expect(element).toBeVisible();

  await expect(element).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
  });
}

/**
 * Masks dynamic elements before taking a screenshot.
 */
export async function maskDynamicElements(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Mask dates and times
    const dateElements = document.querySelectorAll(
      'time, [data-testid*="date"], [data-testid*="time"]'
    );
    dateElements.forEach((el) => {
      (el as HTMLElement).style.backgroundColor = '#f0f0f0';
      (el as HTMLElement).style.color = 'transparent';
    });

    // Mask notification badges
    const badges = document.querySelectorAll(
      '[data-testid*="count"], [data-testid*="badge"]'
    );
    badges.forEach((el) => {
      (el as HTMLElement).style.backgroundColor = '#e0e0e0';
      (el as HTMLElement).style.color = 'transparent';
    });

    // Mask avatars
    const avatars = document.querySelectorAll(
      '[data-testid*="avatar"] img, .avatar img'
    );
    avatars.forEach((el) => {
      (el as HTMLElement).style.visibility = 'hidden';
    });
  });
}

/**
 * Scrolls to ensure consistent viewport position.
 */
export async function scrollToTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
}

/**
 * Waits for page to be stable for visual testing.
 */
export async function waitForStableVisuals(page: Page): Promise<void> {
  // Wait for any loading states to complete
  const loadingIndicators = page.locator(
    '[data-loading="true"], .loading, .skeleton'
  );
  if ((await loadingIndicators.count()) > 0) {
    await loadingIndicators.first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
      // Ignore if no loading indicators
    });
  }

  // Wait for animations
  await page.waitForTimeout(300);
}

/**
 * Gets the current viewport name for screenshot naming.
 */
export function getViewportName(page: Page): string {
  const viewport = page.viewportSize();
  if (!viewport) return 'unknown';

  if (viewport.width >= 1920) return 'desktop-hd';
  if (viewport.width >= 1280) return 'desktop';
  if (viewport.width >= 768) return 'tablet';
  return 'mobile';
}
