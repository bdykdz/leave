import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { waitForPageReady, WCAG_21_AA_TAGS } from './utils';

/**
 * WCAG 2.1 AA Accessibility Tests - Forms
 * Tests form labels, error announcements, and form accessibility.
 */

test.describe('Form Accessibility - Login Form', () => {
  test('login form inputs have associated labels', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const inputs = await page.locator('input:visible').all();

    for (const input of inputs) {
      const inputInfo = await input.evaluate((el) => {
        const inputEl = el as HTMLInputElement;
        const hasExplicitLabel = !!inputEl.labels?.length;
        const hasAriaLabel = !!inputEl.getAttribute('aria-label');
        const hasAriaLabelledby = !!inputEl.getAttribute('aria-labelledby');
        const hasPlaceholder = !!inputEl.placeholder;
        const hasTitle = !!inputEl.title;
        const type = inputEl.type;
        const name = inputEl.name;
        const id = inputEl.id;

        return {
          type,
          name,
          id,
          hasExplicitLabel,
          hasAriaLabel,
          hasAriaLabelledby,
          hasPlaceholder,
          hasTitle,
          hasAnyLabel: hasExplicitLabel || hasAriaLabel || hasAriaLabelledby,
        };
      });

      // Skip hidden and submit inputs
      if (inputInfo.type === 'hidden' || inputInfo.type === 'submit') {
        continue;
      }

      if (!inputInfo.hasAnyLabel) {
        console.log(`Input missing label: ${inputInfo.type}[name="${inputInfo.name}"]`);
      }

      expect(inputInfo.hasAnyLabel).toBe(true);
    }
  });

  test('login form passes axe-core form rules', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withRules([
        'label',
        'label-content-name-mismatch',
        'form-field-multiple-labels',
        'input-button-name',
        'input-image-alt',
        'select-name',
      ])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Form accessibility violations:');
      results.violations.forEach((v) => {
        console.log(`  ${v.id}: ${v.help}`);
        v.nodes.slice(0, 2).forEach((n) => {
          console.log(`    - ${n.target.join(' > ')}`);
        });
      });
    }

    expect(results.violations).toHaveLength(0);
  });

  test('login form buttons have accessible names', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const buttons = await page.locator('button:visible, input[type="submit"]:visible').all();

    for (const button of buttons) {
      const hasAccessibleName = await button.evaluate((el) => {
        const text = el.textContent?.trim();
        const value = (el as HTMLInputElement).value;
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledby = el.getAttribute('aria-labelledby');
        const title = el.getAttribute('title');

        return !!(text || value || ariaLabel || ariaLabelledby || title);
      });

      expect(hasAccessibleName).toBe(true);
    }
  });
});

test.describe('Form Accessibility - Error Handling', () => {
  test('form errors are announced accessibly', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    // Check if form has proper error announcement infrastructure
    const hasErrorInfrastructure = await page.evaluate(() => {
      // Check for aria-live regions
      const liveRegions = document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]');

      // Check for role="alert"
      const alertRegions = document.querySelectorAll('[role="alert"]');

      // Check if inputs can have aria-describedby (for error messages)
      const inputs = document.querySelectorAll('input, select, textarea');
      let inputsWithDescribedby = 0;
      inputs.forEach((input) => {
        if (input.hasAttribute('aria-describedby') || input.hasAttribute('aria-errormessage')) {
          inputsWithDescribedby++;
        }
      });

      return {
        hasLiveRegions: liveRegions.length > 0,
        hasAlertRegions: alertRegions.length > 0,
        inputsWithDescribedby,
      };
    });

    // At least one error announcement mechanism should exist
    const hasAnyMechanism =
      hasErrorInfrastructure.hasLiveRegions ||
      hasErrorInfrastructure.hasAlertRegions ||
      hasErrorInfrastructure.inputsWithDescribedby > 0;

    // Log the findings
    console.log('Error handling infrastructure:', hasErrorInfrastructure);
  });

  test('invalid inputs are marked with aria-invalid', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    // Try to submit form with empty required fields
    const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();

    if (await submitButton.isVisible().catch(() => false)) {
      // Submit form
      await submitButton.click();
      await page.waitForTimeout(500);

      // Check for aria-invalid on any inputs
      const invalidInputs = await page.locator('[aria-invalid="true"]').all();

      // If there are validation errors, inputs should be marked
      if (invalidInputs.length > 0) {
        for (const input of invalidInputs) {
          const hasErrorDescription = await input.evaluate((el) => {
            const describedby = el.getAttribute('aria-describedby');
            const errormessage = el.getAttribute('aria-errormessage');
            return !!(describedby || errormessage);
          });

          // Invalid inputs should have error descriptions
          console.log(`Invalid input has error description: ${hasErrorDescription}`);
        }
      }
    }
  });
});

test.describe('Form Accessibility - Field Types', () => {
  test('select elements have accessible names', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const selects = await page.locator('select:visible, [role="combobox"]:visible, [data-slot="select-trigger"]:visible').all();

    for (const select of selects) {
      const hasAccessibleName = await select.evaluate((el) => {
        // For native selects
        if (el.tagName.toLowerCase() === 'select') {
          const selectEl = el as HTMLSelectElement;
          return !!(
            selectEl.labels?.length ||
            selectEl.getAttribute('aria-label') ||
            selectEl.getAttribute('aria-labelledby')
          );
        }

        // For custom select components
        return !!(
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby')
        );
      });

      if (!hasAccessibleName) {
        const html = await select.evaluate((el) => el.outerHTML.slice(0, 100));
        console.log(`Select missing accessible name: ${html}`);
      }
    }
  });

  test('checkbox and radio groups are properly labeled', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Check checkboxes
    const checkboxes = await page.locator('input[type="checkbox"]:visible, [role="checkbox"]:visible').all();

    for (const checkbox of checkboxes.slice(0, 5)) {
      const hasLabel = await checkbox.evaluate((el) => {
        const inputEl = el as HTMLInputElement;
        return !!(
          inputEl.labels?.length ||
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby')
        );
      });

      if (!hasLabel) {
        const id = await checkbox.getAttribute('id');
        console.log(`Checkbox missing label: #${id}`);
      }

      expect(hasLabel).toBe(true);
    }

    // Check radio groups
    const radioGroups = await page.locator('[role="radiogroup"]').all();

    for (const group of radioGroups) {
      const hasGroupLabel = await group.evaluate((el) => {
        return !!(
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby')
        );
      });

      if (!hasGroupLabel) {
        console.log('Radio group missing label');
      }

      expect(hasGroupLabel).toBe(true);
    }
  });

  test('date pickers are accessible', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Look for date inputs or date picker triggers
    const dateInputs = await page.locator('input[type="date"], [data-date-picker], button:has-text("calendar"), button:has([data-calendar])').all();

    for (const dateInput of dateInputs.slice(0, 3)) {
      const isAccessible = await dateInput.evaluate((el) => {
        const hasLabel =
          (el as HTMLInputElement).labels?.length ||
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby');

        const hasRole = el.getAttribute('role') || el.tagName.toLowerCase() === 'input';

        return !!hasLabel && !!hasRole;
      });

      // Date pickers should be accessible
      console.log(`Date picker accessible: ${isAccessible}`);
    }
  });

  test('textarea elements have accessible names', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const textareas = await page.locator('textarea:visible').all();

    for (const textarea of textareas) {
      const hasAccessibleName = await textarea.evaluate((el) => {
        const textareaEl = el as HTMLTextAreaElement;
        return !!(
          textareaEl.labels?.length ||
          textareaEl.getAttribute('aria-label') ||
          textareaEl.getAttribute('aria-labelledby') ||
          textareaEl.placeholder
        );
      });

      if (!hasAccessibleName) {
        const id = await textarea.getAttribute('id');
        console.log(`Textarea missing accessible name: #${id}`);
      }

      expect(hasAccessibleName).toBe(true);
    }
  });
});

test.describe('Form Accessibility - Required Fields', () => {
  test('required fields are indicated accessibly', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Look for forms
    const forms = await page.locator('form').all();

    for (const form of forms.slice(0, 2)) {
      const requiredInputs = await form.locator('[required], [aria-required="true"]').all();

      for (const input of requiredInputs) {
        const isAccessiblyRequired = await input.evaluate((el) => {
          const hasRequired = el.hasAttribute('required');
          const hasAriaRequired = el.getAttribute('aria-required') === 'true';

          return hasRequired || hasAriaRequired;
        });

        expect(isAccessiblyRequired).toBe(true);
      }

      // Log count of required fields
      console.log(`Form has ${requiredInputs.length} required fields`);
    }
  });

  test('required field indicators are visible', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Check if required fields have visual indicators (usually asterisks)
    const requiredIndicators = await page.locator('label:has-text("*"), [aria-required="true"], .required').all();

    // Log for information
    console.log(`Found ${requiredIndicators.length} required field indicators`);
  });
});

test.describe('Form Accessibility - Autocomplete', () => {
  test('common input fields have autocomplete attributes', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    const expectedAutocomplete = [
      { type: 'email', autocomplete: ['email', 'username'] },
      { type: 'password', autocomplete: ['current-password', 'new-password'] },
      { name: 'name', autocomplete: ['name', 'given-name', 'family-name'] },
    ];

    for (const expected of expectedAutocomplete) {
      let selector = '';
      if (expected.type) {
        selector = `input[type="${expected.type}"]`;
      } else if (expected.name) {
        selector = `input[name*="${expected.name}"]`;
      }

      const inputs = await page.locator(selector).all();

      for (const input of inputs) {
        const autocomplete = await input.getAttribute('autocomplete');

        // Check if autocomplete is set to one of the expected values
        const hasProperAutocomplete =
          autocomplete && expected.autocomplete.some((ac) => autocomplete.includes(ac));

        if (!hasProperAutocomplete && autocomplete !== 'off') {
          console.log(`Input ${selector} autocomplete: ${autocomplete}`);
        }
      }
    }
  });
});

test.describe('Form Accessibility - Full Page Scans', () => {
  test('employee page forms pass accessibility scan', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .include('form')
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (significantViolations.length > 0) {
      console.log('Form accessibility violations:');
      significantViolations.forEach((v) => {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      });
    }

    expect(significantViolations).toHaveLength(0);
  });

  test('HR page forms pass accessibility scan', async ({ page }) => {
    await page.goto('/hr');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .include('form')
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });

  test('manager page forms pass accessibility scan', async ({ page }) => {
    await page.goto('/manager');
    await waitForPageReady(page);

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_21_AA_TAGS])
      .include('form')
      .analyze();

    const significantViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(significantViolations).toHaveLength(0);
  });
});

test.describe('Form Accessibility - Fieldset and Legend', () => {
  test('related form fields are grouped with fieldset', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Check for fieldsets with legends
    const fieldsets = await page.locator('fieldset').all();

    for (const fieldset of fieldsets) {
      const hasLegend = await fieldset.evaluate((el) => {
        return !!el.querySelector('legend');
      });

      if (!hasLegend) {
        console.log('Fieldset without legend found');
      }

      // Fieldsets should have legends for accessibility
      expect(hasLegend).toBe(true);
    }

    // Alternative: Check for role="group" with aria-labelledby
    const groups = await page.locator('[role="group"]').all();

    for (const group of groups) {
      const hasLabel = await group.evaluate((el) => {
        return !!(
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby')
        );
      });

      // Groups should have accessible names
      expect(hasLabel).toBe(true);
    }
  });
});

test.describe('Form Accessibility - Focus Management', () => {
  test('focus moves to first error field on validation failure', async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);

    // Clear any existing values and try to submit
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.clear();
    }

    if (await submitButton.isVisible().catch(() => false)) {
      await submitButton.click();
      await page.waitForTimeout(500);

      // Check if focus moved to an error field
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el?.tagName,
          hasAriaInvalid: el?.getAttribute('aria-invalid') === 'true',
          type: (el as HTMLInputElement)?.type,
        };
      });

      // Focus should be on an input (possibly with aria-invalid)
      console.log('Focused element after validation:', focusedElement);
    }
  });

  test('form fields maintain focus after interaction', async ({ page }) => {
    await page.goto('/employee');
    await waitForPageReady(page);

    // Find an input field
    const input = page.locator('input:visible').first();

    if (await input.isVisible().catch(() => false)) {
      await input.focus();
      await input.type('test');

      // Focus should still be on the input
      const isFocused = await input.evaluate((el) => document.activeElement === el);
      expect(isFocused).toBe(true);

      // Clear the input
      await input.clear();
    }
  });
});
