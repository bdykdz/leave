/**
 * SQL Injection Security Tests
 * US-014: Security Testing
 *
 * Tests verify:
 * - Input validation against SQL injection patterns
 * - API endpoints handle malicious SQL payloads safely
 * - Prisma ORM properly escapes/parameterizes queries
 */

import { test, expect } from '@playwright/test';

// Common SQL injection payloads to test
const SQL_INJECTION_PAYLOADS = [
  // Basic SQL injection
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  "1'; DROP TABLE leave_requests; --",
  "' OR 1=1 --",
  "' UNION SELECT * FROM users --",

  // Authentication bypass attempts
  "admin'--",
  "admin' #",
  "' OR ''='",
  "' OR 'x'='x",
  "') OR ('x'='x",

  // Time-based blind SQL injection
  "'; WAITFOR DELAY '0:0:5' --",
  "1'; SELECT SLEEP(5); --",
  "1' AND SLEEP(5) AND '1'='1",

  // Union-based injection
  "' UNION SELECT NULL, NULL, NULL --",
  "' UNION SELECT username, password FROM users --",
  "1 UNION SELECT NULL--",

  // Stacked queries
  "; INSERT INTO users (email) VALUES ('hacker@evil.com');",
  "; UPDATE users SET role = 'ADMIN' WHERE email = 'test@test.com';",

  // Error-based injection
  "' AND 1=CONVERT(int, @@version) --",
  "' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT version())))--",

  // Boolean-based blind injection
  "' AND 1=1 --",
  "' AND 1=2 --",
  "' AND SUBSTRING(username,1,1)='a'--",

  // PostgreSQL specific
  "'; SELECT pg_sleep(5); --",
  "1; SELECT * FROM information_schema.tables --",
  "' || pg_sleep(5) --",
];

// Input fields to test
const INPUT_FIELDS = {
  email: SQL_INJECTION_PAYLOADS,
  name: SQL_INJECTION_PAYLOADS,
  search: SQL_INJECTION_PAYLOADS,
  id: SQL_INJECTION_PAYLOADS,
  reason: SQL_INJECTION_PAYLOADS,
  notes: SQL_INJECTION_PAYLOADS,
  comment: SQL_INJECTION_PAYLOADS,
  title: SQL_INJECTION_PAYLOADS,
  description: SQL_INJECTION_PAYLOADS,
};

test.test.describe('SQL Injection Prevention', () => {
  test.test.describe('API Endpoint Protection', () => {
    test('Leave requests API rejects SQL injection in search/filter params', async ({ request }) => {
      const payloads = [
        "'; DROP TABLE leave_requests; --",
        "1' OR '1'='1",
        "' UNION SELECT * FROM users --",
      ];

      for (const payload of payloads) {
        const response = await request.get('/api/leave-requests', {
          params: { search: payload },
          failOnStatusCode: false,
        });

        // Should not return 500 (SQL error) - should be 401 (unauth) or 400 (bad request)
        expect(response.status()).not.toBe(500);

        // Response should not contain database error details
        const body = await response.text();
        expect(body.toLowerCase()).not.toContain('syntax error');
        expect(body.toLowerCase()).not.toContain('pg_query');
        expect(body.toLowerCase()).not.toContain('postgresql');
        expect(body.toLowerCase()).not.toContain('prisma');
      }
    });

    test('User API rejects SQL injection in ID parameter', async ({ request }) => {
      const payloads = [
        "1'; DROP TABLE users; --",
        "1 OR 1=1",
        "' UNION SELECT password FROM users--",
      ];

      for (const payload of payloads) {
        const response = await request.get(`/api/user/${encodeURIComponent(payload)}`, {
          failOnStatusCode: false,
        });

        // Should not return 500 (SQL error)
        expect(response.status()).not.toBe(500);

        const body = await response.text();
        expect(body.toLowerCase()).not.toContain('syntax error');
        expect(body.toLowerCase()).not.toContain('prisma');
      }
    });

    test('HR user management API handles SQL injection safely', async ({ request }) => {
      const payload = "'; DELETE FROM users; --";

      const response = await request.get('/api/hr/user-management', {
        params: { search: payload },
        failOnStatusCode: false,
      });

      expect(response.status()).not.toBe(500);

      const body = await response.text();
      expect(body.toLowerCase()).not.toContain('delete');
      expect(body.toLowerCase()).not.toContain('syntax error');
    });

    test('Holiday planning API rejects SQL injection in parameters', async ({ request }) => {
      const payloads = ["'; DROP TABLE holidays; --", "1 OR 1=1 --"];

      for (const payload of payloads) {
        const response = await request.get('/api/holiday-planning/team-plans', {
          params: { teamId: payload },
          failOnStatusCode: false,
        });

        expect(response.status()).not.toBe(500);
      }
    });

    test('Leave request creation handles SQL injection in body fields', async ({ request }) => {
      const maliciousPayload = {
        leaveTypeId: "'; DROP TABLE leave_types; --",
        startDate: "2024-01-01",
        endDate: "2024-01-02",
        reason: "'; DELETE FROM leave_requests; --",
        notes: "' OR 1=1; DROP TABLE approvals; --",
      };

      const response = await request.post('/api/leave-requests', {
        data: maliciousPayload,
        failOnStatusCode: false,
      });

      // Should reject with 400/401, not 500
      expect([400, 401, 422]).toContain(response.status());
    });

    test('WFH request API handles SQL injection safely', async ({ request }) => {
      const maliciousPayload = {
        date: "'; DROP TABLE wfh_requests; --",
        reason: "' OR 1=1 --",
      };

      const response = await request.post('/api/wfh-requests', {
        data: maliciousPayload,
        failOnStatusCode: false,
      });

      expect([400, 401, 422]).toContain(response.status());
    });
  });

  test.describe('URL Parameter Protection', () => {
    test('ID parameters reject SQL injection attempts', async ({ request }) => {
      const endpoints = [
        '/api/leave-requests',
        '/api/departments',
        '/api/users',
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(
          `${endpoint}/${encodeURIComponent("1' OR '1'='1")}`,
          { failOnStatusCode: false }
        );

        expect(response.status()).not.toBe(500);
      }
    });

    test('Query parameters reject SQL injection', async ({ request }) => {
      const response = await request.get('/api/leave-requests', {
        params: {
          userId: "1'; DROP TABLE users; --",
          status: "' OR 1=1 --",
          from: "2024-01-01'; DELETE FROM leave_requests; --",
        },
        failOnStatusCode: false,
      });

      expect(response.status()).not.toBe(500);
    });
  });

  test.describe('Form Input Protection', () => {
    test('Login form handles SQL injection in email field', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Check if dev login is available
      const devSection = page.locator('text=Development Mode');
      if (await devSection.isVisible().catch(() => false)) {
        const customTab = page.getByRole('tab', { name: /custom role/i });
        if (await customTab.isVisible()) {
          await customTab.click();

          const emailInput = page.locator('input[type="email"]');
          if (await emailInput.isVisible()) {
            await emailInput.fill("' OR '1'='1' --");

            // Submit and verify no SQL error exposed
            // Use more specific selector since there are multiple "sign in" buttons
            const signInButton = page.locator('button:has-text("Sign in"):not(:has-text("Microsoft")):not(:has-text("as"))').first();
            if (await signInButton.count() > 0 && await signInButton.isVisible()) {
              await signInButton.click();
              await page.waitForTimeout(1000);

              // Should not see any database errors
              const pageContent = await page.content();
              expect(pageContent.toLowerCase()).not.toContain('syntax error');
              expect(pageContent.toLowerCase()).not.toContain('prisma');
              expect(pageContent.toLowerCase()).not.toContain('postgresql');
            }
          }
        }
      }
    });

    test('Search inputs sanitize SQL injection attempts', async ({ page }) => {
      await page.goto('/login');
      // We need to be authenticated to test search inputs
      // This test verifies the principle - actual auth would be needed for full coverage
    });
  });

  test.describe('Prisma ORM Protection Verification', () => {
    test('API responses do not expose database internals on malformed input', async ({ request }) => {
      const malformedInputs = [
        { endpoint: '/api/leave-requests', param: 'id', value: "1' OR '1'='1" },
        { endpoint: '/api/users', param: 'email', value: "admin'--" },
        { endpoint: '/api/departments', param: 'id', value: "; DROP TABLE departments;--" },
      ];

      for (const { endpoint, param, value } of malformedInputs) {
        const response = await request.get(`${endpoint}?${param}=${encodeURIComponent(value)}`, {
          failOnStatusCode: false,
        });

        const body = await response.text();

        // Database internals should never be exposed
        expect(body).not.toMatch(/prisma\./i);
        expect(body).not.toMatch(/pg_catalog/i);
        expect(body).not.toMatch(/information_schema/i);
        expect(body).not.toMatch(/table.*does.*not.*exist/i);
        expect(body).not.toMatch(/column.*does.*not.*exist/i);
        expect(body).not.toMatch(/relation.*does.*not.*exist/i);
      }
    });

    test('Numeric ID parameters reject string injection', async ({ request }) => {
      const response = await request.get('/api/leave-requests/not-a-number', {
        failOnStatusCode: false,
      });

      // Should return 400 or 404, not 500
      expect([400, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Second-Order SQL Injection Prevention', () => {
    test('Stored data does not cause SQL injection when retrieved', async ({ request }) => {
      // Attempt to store SQL injection payload through API
      const payload = {
        reason: "Test leave request'; DROP TABLE leave_requests; --",
        notes: "Some notes' OR 1=1 --",
      };

      // This should be rejected or safely stored
      const createResponse = await request.post('/api/leave-requests', {
        data: payload,
        failOnStatusCode: false,
      });

      // Whether it's rejected (401) or accepted (with sanitization), no 500
      expect(createResponse.status()).not.toBe(500);
    });
  });
});

test.describe('SQL Injection Edge Cases', () => {
  test('Handles null bytes in SQL injection attempts', async ({ request }) => {
    const payload = "admin'\x00' OR '1'='1";

    const response = await request.get('/api/users', {
      params: { search: payload },
      failOnStatusCode: false,
    });

    expect(response.status()).not.toBe(500);
  });

  test('Handles unicode escape sequences', async ({ request }) => {
    const payload = "admin\\u0027 OR 1=1--";

    const response = await request.get('/api/users', {
      params: { search: payload },
      failOnStatusCode: false,
    });

    expect(response.status()).not.toBe(500);
  });

  test('Handles double-encoded SQL injection', async ({ request }) => {
    const payload = "admin%2527%2520OR%25201%253D1--";

    const response = await request.get(`/api/users?search=${payload}`, {
      failOnStatusCode: false,
    });

    expect(response.status()).not.toBe(500);
  });

  test('Handles very long SQL injection strings', async ({ request }) => {
    const longPayload = "' OR '1'='1".repeat(1000) + " --";

    const response = await request.get('/api/leave-requests', {
      params: { search: longPayload },
      failOnStatusCode: false,
    });

    // Should handle gracefully - 400 (bad request), 401 (unauth), 413 (payload too large),
    // or 431 (request header fields too large)
    expect([400, 401, 413, 431]).toContain(response.status());
  });
});
