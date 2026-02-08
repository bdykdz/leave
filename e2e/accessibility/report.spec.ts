import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';
import { waitForPageReady, WCAG_21_AA_TAGS, formatViolationReport } from './utils';

/**
 * WCAG 2.1 AA Accessibility Report Generator
 * Generates comprehensive accessibility reports for the application.
 */

interface PageReport {
  url: string;
  name: string;
  timestamp: string;
  violations: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    details: Array<{
      id: string;
      impact: string;
      description: string;
      help: string;
      helpUrl: string;
      affectedNodes: number;
      examples: string[];
    }>;
  };
  passes: number;
  incomplete: number;
}

interface AccessibilityReport {
  generatedAt: string;
  summary: {
    totalPages: number;
    pagesWithViolations: number;
    totalViolations: number;
    criticalViolations: number;
    seriousViolations: number;
    wcagCompliant: boolean;
  };
  pages: PageReport[];
}

test.describe('Accessibility Report Generation', () => {
  test('generate comprehensive WCAG 2.1 AA accessibility report', async ({ page }) => {
    const pagesToTest = [
      { url: '/login', name: 'Login Page' },
      { url: '/auth/signin', name: 'Auth Sign In Page' },
      { url: '/employee', name: 'Employee Dashboard' },
      { url: '/manager', name: 'Manager Dashboard' },
      { url: '/hr', name: 'HR Dashboard' },
      { url: '/hr/settings', name: 'HR Settings' },
      { url: '/hr/rollover', name: 'HR Rollover' },
      { url: '/executive', name: 'Executive Dashboard' },
      { url: '/executive/analytics', name: 'Executive Analytics' },
      { url: '/admin', name: 'Admin Dashboard' },
      { url: '/team-calendar', name: 'Team Calendar' },
      { url: '/holiday-planning', name: 'Holiday Planning' },
      { url: '/analytics', name: 'Analytics' },
      { url: '/department-holiday-view', name: 'Department Holiday View' },
      { url: '/manager/holiday-planning', name: 'Manager Holiday Planning' },
    ];

    const report: AccessibilityReport = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalPages: pagesToTest.length,
        pagesWithViolations: 0,
        totalViolations: 0,
        criticalViolations: 0,
        seriousViolations: 0,
        wcagCompliant: true,
      },
      pages: [],
    };

    for (const pageInfo of pagesToTest) {
      await page.goto(pageInfo.url);
      await waitForPageReady(page);

      const results = await new AxeBuilder({ page })
        .withTags([...WCAG_21_AA_TAGS])
        .analyze();

      const violations = results.violations;
      const criticalCount = violations.filter((v) => v.impact === 'critical').length;
      const seriousCount = violations.filter((v) => v.impact === 'serious').length;
      const moderateCount = violations.filter((v) => v.impact === 'moderate').length;
      const minorCount = violations.filter((v) => v.impact === 'minor').length;

      const pageReport: PageReport = {
        url: pageInfo.url,
        name: pageInfo.name,
        timestamp: new Date().toISOString(),
        violations: {
          total: violations.length,
          critical: criticalCount,
          serious: seriousCount,
          moderate: moderateCount,
          minor: minorCount,
          details: violations.map((v) => ({
            id: v.id,
            impact: v.impact || 'unknown',
            description: v.description,
            help: v.help,
            helpUrl: v.helpUrl,
            affectedNodes: v.nodes.length,
            examples: v.nodes.slice(0, 3).map((n) => n.target.join(' > ')),
          })),
        },
        passes: results.passes.length,
        incomplete: results.incomplete.length,
      };

      report.pages.push(pageReport);

      // Update summary
      if (violations.length > 0) {
        report.summary.pagesWithViolations++;
      }
      report.summary.totalViolations += violations.length;
      report.summary.criticalViolations += criticalCount;
      report.summary.seriousViolations += seriousCount;
    }

    // Determine WCAG compliance (no critical or serious violations)
    report.summary.wcagCompliant =
      report.summary.criticalViolations === 0 && report.summary.seriousViolations === 0;

    // Output the report
    console.log('\n');
    console.log('='.repeat(80));
    console.log('WCAG 2.1 AA ACCESSIBILITY REPORT');
    console.log('='.repeat(80));
    console.log(`Generated: ${report.generatedAt}`);
    console.log('');
    console.log('SUMMARY');
    console.log('-'.repeat(40));
    console.log(`Total Pages Tested:     ${report.summary.totalPages}`);
    console.log(`Pages with Violations:  ${report.summary.pagesWithViolations}`);
    console.log(`Total Violations:       ${report.summary.totalViolations}`);
    console.log(`  - Critical:           ${report.summary.criticalViolations}`);
    console.log(`  - Serious:            ${report.summary.seriousViolations}`);
    console.log(`WCAG 2.1 AA Compliant:  ${report.summary.wcagCompliant ? 'YES ✓' : 'NO ✗'}`);
    console.log('');
    console.log('PAGE DETAILS');
    console.log('-'.repeat(40));

    for (const pageReport of report.pages) {
      const status =
        pageReport.violations.critical === 0 && pageReport.violations.serious === 0
          ? '✓'
          : '✗';
      console.log(`${status} ${pageReport.name} (${pageReport.url})`);
      console.log(
        `   Violations: ${pageReport.violations.total} (C:${pageReport.violations.critical} S:${pageReport.violations.serious} M:${pageReport.violations.moderate} m:${pageReport.violations.minor})`
      );
      console.log(`   Passes: ${pageReport.passes}`);

      if (pageReport.violations.details.length > 0) {
        console.log('   Issues:');
        for (const detail of pageReport.violations.details.slice(0, 5)) {
          console.log(`     - [${detail.impact}] ${detail.id}: ${detail.help}`);
        }
        if (pageReport.violations.details.length > 5) {
          console.log(`     ... and ${pageReport.violations.details.length - 5} more`);
        }
      }
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('');

    // Save report to file
    const reportDir = path.join(process.cwd(), 'test-results', 'accessibility');
    try {
      fs.mkdirSync(reportDir, { recursive: true });
      const reportPath = path.join(reportDir, 'wcag-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Report saved to: ${reportPath}`);
    } catch {
      console.log('Could not save report file (likely running in restricted mode)');
    }

    // Assert WCAG 2.1 AA compliance
    expect(report.summary.criticalViolations).toBe(0);
    expect(report.summary.seriousViolations).toBe(0);
  });

  test('generate summary accessibility report', async ({ page }) => {
    const corePagesToTest = [
      { url: '/login', name: 'Login' },
      { url: '/employee', name: 'Employee' },
      { url: '/manager', name: 'Manager' },
      { url: '/hr', name: 'HR' },
      { url: '/executive', name: 'Executive' },
      { url: '/admin', name: 'Admin' },
    ];

    console.log('\nAccessibility Quick Summary');
    console.log('============================\n');
    console.log('Page           | Critical | Serious | Moderate | Minor | Total');
    console.log('---------------|----------|---------|----------|-------|------');

    let totalCritical = 0;
    let totalSerious = 0;

    for (const pageInfo of corePagesToTest) {
      await page.goto(pageInfo.url);
      await waitForPageReady(page);

      const results = await new AxeBuilder({ page })
        .withTags([...WCAG_21_AA_TAGS])
        .analyze();

      const critical = results.violations.filter((v) => v.impact === 'critical').length;
      const serious = results.violations.filter((v) => v.impact === 'serious').length;
      const moderate = results.violations.filter((v) => v.impact === 'moderate').length;
      const minor = results.violations.filter((v) => v.impact === 'minor').length;
      const total = results.violations.length;

      totalCritical += critical;
      totalSerious += serious;

      console.log(
        `${pageInfo.name.padEnd(14)} | ${String(critical).padEnd(8)} | ${String(serious).padEnd(7)} | ${String(moderate).padEnd(8)} | ${String(minor).padEnd(5)} | ${total}`
      );
    }

    console.log('---------------|----------|---------|----------|-------|------');
    console.log(`TOTAL          | ${totalCritical}        | ${totalSerious}       |          |       |`);
    console.log('');

    // Test passes if no critical or serious violations
    expect(totalCritical + totalSerious).toBe(0);
  });
});

test.describe('Accessibility Compliance Check', () => {
  test('all core pages pass WCAG 2.1 AA', async ({ page }) => {
    const pages = [
      '/login',
      '/employee',
      '/manager',
      '/hr',
      '/executive',
      '/admin',
    ];

    const failures: string[] = [];

    for (const url of pages) {
      await page.goto(url);
      await waitForPageReady(page);

      const results = await new AxeBuilder({ page })
        .withTags([...WCAG_21_AA_TAGS])
        .analyze();

      const significantViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      if (significantViolations.length > 0) {
        failures.push(
          `${url}: ${significantViolations.length} violations (${significantViolations.map((v) => v.id).join(', ')})`
        );
      }
    }

    if (failures.length > 0) {
      console.log('WCAG 2.1 AA Compliance Failures:');
      failures.forEach((f) => console.log(`  - ${f}`));
    }

    expect(failures).toHaveLength(0);
  });

  test('zero critical accessibility violations', async ({ page }) => {
    const pages = ['/login', '/employee', '/manager', '/hr', '/executive', '/admin'];

    let criticalCount = 0;

    for (const url of pages) {
      await page.goto(url);
      await waitForPageReady(page);

      const results = await new AxeBuilder({ page })
        .withTags([...WCAG_21_AA_TAGS])
        .analyze();

      const critical = results.violations.filter((v) => v.impact === 'critical');
      criticalCount += critical.length;

      if (critical.length > 0) {
        console.log(`${url}: ${critical.length} critical violations`);
        critical.forEach((v) => {
          console.log(`  - ${v.id}: ${v.help}`);
        });
      }
    }

    expect(criticalCount).toBe(0);
  });

  test('zero serious accessibility violations', async ({ page }) => {
    const pages = ['/login', '/employee', '/manager', '/hr', '/executive', '/admin'];

    let seriousCount = 0;

    for (const url of pages) {
      await page.goto(url);
      await waitForPageReady(page);

      const results = await new AxeBuilder({ page })
        .withTags([...WCAG_21_AA_TAGS])
        .analyze();

      const serious = results.violations.filter((v) => v.impact === 'serious');
      seriousCount += serious.length;

      if (serious.length > 0) {
        console.log(`${url}: ${serious.length} serious violations`);
        serious.forEach((v) => {
          console.log(`  - ${v.id}: ${v.help}`);
        });
      }
    }

    expect(seriousCount).toBe(0);
  });
});
