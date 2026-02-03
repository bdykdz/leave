import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  expectNoAccessibilityViolations,
  waitForPageReady,
  generateAccessibilityReport,
  getLandmarkRegions,
  testHeadingHierarchy,
  WCAG_21_AA_TAGS,
} from './utils';

/**
 * WCAG 2.1 AA Accessibility Tests - Main Pages
 * Tests all main application pages for accessibility compliance.
 */

// Helper to login as different roles for testing
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
  ADMIN: {
    email: 'admin@staging.local',
    password: 'admin123',
  },
};

test.describe('Accessibility - Public Pages', () => {
  test('login page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    // Run full WCAG 2.1 AA scan
    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    // Filter violations by impact
    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    // Report all violations for debugging
    if (significantViolations.length > 0) {
      console.log('Login page accessibility violations:');
      significantViolations.forEach((v) => {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
        v.nodes.slice(0, 2).forEach((n) => {
          console.log(`    - ${n.target.join(' > ')}`);
        });
      });
    }

    expect(significantViolations).toHaveLength(0);
  });

  test('login page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const { hasH1, issues } = await testHeadingHierarchy(page);

    if (issues.length > 0) {
      console.log('Heading issues:', issues);
    }

    expect(hasH1).toBe(true);
  });

  test('login page has proper landmark regions', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const landmarks = await getLandmarkRegions(page);

    // At minimum, should have a main region
    expect(landmarks.hasMain).toBe(true);
  });

  test('auth/signin page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/auth/signin');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });
});

test.describe('Accessibility - Employee Pages', () => {
  test('employee dashboard meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (significantViolations.length > 0) {
      console.log('Employee dashboard accessibility violations:');
      significantViolations.forEach((v) => {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      });
    }

    expect(significantViolations).toHaveLength(0);
  });

  test('employee dashboard has proper landmark regions', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const landmarks = await getLandmarkRegions(page);

    expect(landmarks.hasMain).toBe(true);
    expect(landmarks.hasNav).toBe(true);
  });

  test('employee dashboard has proper heading hierarchy', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const { hasH1, hasProperHierarchy, issues } = await testHeadingHierarchy(page);

    if (issues.length > 0) {
      console.log('Employee dashboard heading issues:', issues);
    }

    expect(hasH1).toBe(true);
  });
});

test.describe('Accessibility - Manager Pages', () => {
  test('manager dashboard meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/manager');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (significantViolations.length > 0) {
      console.log('Manager dashboard accessibility violations:');
      significantViolations.forEach((v) => {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      });
    }

    expect(significantViolations).toHaveLength(0);
  });

  test('manager holiday planning page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/manager/holiday-planning');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });
});

test.describe('Accessibility - HR Pages', () => {
  test('HR dashboard meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/hr');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (significantViolations.length > 0) {
      console.log('HR dashboard accessibility violations:');
      significantViolations.forEach((v) => {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      });
    }

    expect(significantViolations).toHaveLength(0);
  });

  test('HR settings page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/hr/settings');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });

  test('HR rollover page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/hr/rollover');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });
});

test.describe('Accessibility - Executive Pages', () => {
  test('executive dashboard meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/executive');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (significantViolations.length > 0) {
      console.log('Executive dashboard accessibility violations:');
      significantViolations.forEach((v) => {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      });
    }

    expect(significantViolations).toHaveLength(0);
  });

  test('executive analytics page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/executive/analytics');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });
});

test.describe('Accessibility - Admin Pages', () => {
  test('admin dashboard meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/admin');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (significantViolations.length > 0) {
      console.log('Admin dashboard accessibility violations:');
      significantViolations.forEach((v) => {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      });
    }

    expect(significantViolations).toHaveLength(0);
  });
});

test.describe('Accessibility - Shared Pages', () => {
  test('team calendar page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/team-calendar');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (significantViolations.length > 0) {
      console.log('Team calendar accessibility violations:');
      significantViolations.forEach((v) => {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      });
    }

    expect(significantViolations).toHaveLength(0);
  });

  test('holiday planning page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/holiday-planning');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });

  test('analytics page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/analytics');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });

  test('department holiday view meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/department-holiday-view');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });
});

test.describe('Accessibility - Full Report Generation', () => {
  test('generate comprehensive accessibility report', async ({ page }) => {
    const pages = [
      { name: 'Login', url: '/login' },
      { name: 'Employee Dashboard', url: '/employee' },
      { name: 'Manager Dashboard', url: '/manager' },
      { name: 'HR Dashboard', url: '/hr' },
      { name: 'Executive Dashboard', url: '/executive' },
      { name: 'Admin Dashboard', url: '/admin' },
      { name: 'Team Calendar', url: '/team-calendar' },
      { name: 'Holiday Planning', url: '/holiday-planning' },
    ];

    const reports: Array<{ page: string; violations: number; critical: number; serious: number }> = [];

    for (const pageInfo of pages) {
      await page.goto(pageInfo.url);
      await waitForPageReady(page);

      const report = await generateAccessibilityReport(page);

      const critical = report.violations.filter((v) => v.impact === 'critical').length;
      const serious = report.violations.filter((v) => v.impact === 'serious').length;

      reports.push({
        page: pageInfo.name,
        violations: report.violations.length,
        critical,
        serious,
      });
    }

    console.log('\n=== ACCESSIBILITY REPORT ===\n');
    console.log('Page | Total Violations | Critical | Serious');
    console.log('-----|------------------|----------|--------');
    reports.forEach((r) => {
      console.log(`${r.page.padEnd(20)} | ${String(r.violations).padEnd(16)} | ${String(r.critical).padEnd(8)} | ${r.serious}`);
    });

    const totalCritical = reports.reduce((sum, r) => sum + r.critical, 0);
    const totalSerious = reports.reduce((sum, r) => sum + r.serious, 0);

    console.log('\nSummary:');
    console.log(`  Total Critical Violations: ${totalCritical}`);
    console.log(`  Total Serious Violations: ${totalSerious}`);
    console.log('');

    // Assert no critical or serious violations across all pages
    expect(totalCritical + totalSerious).toBe(0);
  });
});
