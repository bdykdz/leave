# Visual Regression Testing

This directory contains visual regression tests for the Leave Management System. These tests capture screenshots of the application and compare them against baseline images to detect unintended UI changes.

## Overview

Visual regression tests help ensure:
- UI consistency across deployments
- Responsive design works correctly across different viewports
- Role-based views render correctly for different user types
- Component styling remains consistent

## Test Structure

```
e2e/visual-regression/
├── __snapshots__/           # Baseline screenshots (committed to git)
├── pages.visual.spec.ts     # Main page screenshots
├── roles.visual.spec.ts     # Role-specific view screenshots
├── responsive.visual.spec.ts # Responsive design screenshots
├── components.visual.spec.ts # UI component screenshots
├── visual.setup.ts          # Authentication setup
├── visual-utils.ts          # Helper utilities
├── visual-test-styles.css   # Styles to mask dynamic content
└── README.md                # This file
```

## Running Visual Tests

### Run All Visual Tests
```bash
pnpm test:visual
```

### Run with UI Mode
```bash
pnpm test:visual -- --ui
```

### Run Specific Test File
```bash
pnpm test:visual -- pages.visual.spec.ts
```

### Run for Specific Viewport
```bash
pnpm test:visual -- --project=desktop-chrome
pnpm test:visual -- --project=mobile-chrome
pnpm test:visual -- --project=tablet
```

## Updating Baselines

When you make intentional UI changes, you need to update the baseline screenshots.

### Update All Baselines
```bash
pnpm test:visual:update
```

### Update Specific Test Baselines
```bash
UPDATE_SNAPSHOTS=true pnpm test:visual -- pages.visual.spec.ts
```

### Update Baselines for Specific Viewport
```bash
UPDATE_SNAPSHOTS=true pnpm test:visual -- --project=mobile-chrome
```

## Baseline Update Process

1. **Make your UI changes** - Implement the intended visual changes
2. **Run visual tests** - `pnpm test:visual` to see what changed
3. **Review the diff** - Open the HTML report to inspect visual differences
4. **Update baselines** - If changes are intentional, run `pnpm test:visual:update`
5. **Commit baselines** - Commit the updated snapshots in `__snapshots__/`

### Viewing Test Reports
```bash
pnpm test:visual:report
```

This opens an HTML report showing:
- Passed/failed tests
- Visual diffs for failed tests
- Before/after comparison

## Best Practices

### When to Update Baselines
- After intentional UI/UX changes
- After design system updates
- After adding new components
- After fixing styling bugs

### When NOT to Update Baselines
- If tests fail unexpectedly
- If the change wasn't intentional
- If you're unsure about the visual change

### Writing New Visual Tests

1. Use the utility functions from `visual-utils.ts`
2. Always call `preparePageForScreenshot()` before taking screenshots
3. Use `maskDynamicElements()` to hide timestamps, counters, etc.
4. Name screenshots descriptively: `{page}-{state}-{variant}.png`

Example:
```typescript
import { test, expect } from '@playwright/test';
import {
  preparePageForScreenshot,
  maskDynamicElements,
  waitForStableVisuals,
} from './visual-utils';

test('my new page visual test', async ({ page }) => {
  await page.goto('/my-page');
  await waitForStableVisuals(page);
  await preparePageForScreenshot(page);
  await maskDynamicElements(page);

  await expect(page).toHaveScreenshot('my-page.png', {
    fullPage: true,
    animations: 'disabled',
  });
});
```

## Handling Flaky Tests

Visual tests can be flaky due to:
- Font rendering differences
- Animation timing
- Dynamic content
- Network-loaded images

Solutions:
1. Mask dynamic content with `maskDynamicElements()`
2. Wait for network idle with `preparePageForScreenshot()`
3. Use `animations: 'disabled'` in screenshot options
4. Adjust `maxDiffPixels` threshold if needed

## CI Integration

Visual tests run as part of the E2E test suite in CI. The workflow:
1. Runs on all PRs and pushes
2. Compares against baseline snapshots
3. Uploads diff artifacts on failure
4. Fails the build if visual differences exceed thresholds

### Updating Baselines in CI

If you need to update baselines for CI:
1. Run tests locally with `pnpm test:visual:update`
2. Commit the updated snapshots
3. Push to your branch

## Viewport Configurations

Tests run on multiple viewports:
- **desktop-chrome**: 1920x1080 (Desktop HD)
- **desktop-firefox**: 1920x1080 (Cross-browser)
- **mobile-chrome**: Pixel 5 dimensions
- **mobile-safari**: iPhone 12 dimensions
- **tablet**: iPad dimensions

## Troubleshooting

### Tests fail with "Snapshot does not exist"
Run `pnpm test:visual:update` to create initial baselines.

### Tests fail intermittently
- Check for dynamic content not being masked
- Increase wait times in `waitForStableVisuals()`
- Adjust `maxDiffPixels` threshold

### Screenshots look different locally vs CI
- Ensure fonts are installed in CI environment
- Use consistent browser versions
- Check for system font rendering differences

### Large diff with no apparent change
- Font anti-aliasing may differ between systems
- Images may load in different order
- Increase `threshold` in screenshot options
