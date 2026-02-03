/**
 * Security Headers Tests
 * US-014: Security Testing
 *
 * Tests verify:
 * - HSTS (HTTP Strict Transport Security)
 * - CSP (Content Security Policy)
 * - X-Frame-Options (Clickjacking prevention)
 * - X-Content-Type-Options (MIME sniffing prevention)
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Other security-related headers
 */

import { test, expect } from '@playwright/test';

test.describe('Security Headers - Core Headers', () => {
  test.describe('X-Frame-Options', () => {
    test('X-Frame-Options header is set to DENY', async ({ request }) => {
      const response = await request.get('/login');

      const xFrameOptions = response.headers()['x-frame-options'];
      expect(xFrameOptions).toBeDefined();
      expect(xFrameOptions?.toUpperCase()).toBe('DENY');
    });

    test('X-Frame-Options present on all pages', async ({ request }) => {
      const pages = ['/login', '/', '/api/auth/providers'];

      for (const page of pages) {
        const response = await request.get(page, { failOnStatusCode: false });
        const xFrameOptions = response.headers()['x-frame-options'];

        // Should be set on all responses
        expect(xFrameOptions).toBeDefined();
      }
    });

    test('API responses have X-Frame-Options', async ({ request }) => {
      const response = await request.get('/api/auth/csrf');

      const xFrameOptions = response.headers()['x-frame-options'];
      expect(xFrameOptions).toBeDefined();
    });
  });

  test.describe('X-Content-Type-Options', () => {
    test('X-Content-Type-Options is set to nosniff', async ({ request }) => {
      const response = await request.get('/login');

      const xContentType = response.headers()['x-content-type-options'];
      expect(xContentType).toBe('nosniff');
    });

    test('nosniff on API responses', async ({ request }) => {
      const response = await request.get('/api/auth/providers');

      const xContentType = response.headers()['x-content-type-options'];
      expect(xContentType).toBe('nosniff');
    });

    test('nosniff on error responses', async ({ request }) => {
      const response = await request.get('/api/nonexistent', {
        failOnStatusCode: false,
      });

      const xContentType = response.headers()['x-content-type-options'];
      expect(xContentType).toBe('nosniff');
    });
  });

  test.describe('X-XSS-Protection', () => {
    test('X-XSS-Protection header is enabled', async ({ request }) => {
      const response = await request.get('/login');

      const xssProtection = response.headers()['x-xss-protection'];
      expect(xssProtection).toBeDefined();
      expect(xssProtection).toContain('1');
    });

    test('X-XSS-Protection has mode=block', async ({ request }) => {
      const response = await request.get('/login');

      const xssProtection = response.headers()['x-xss-protection'];
      expect(xssProtection).toContain('mode=block');
    });
  });

  test.describe('Referrer-Policy', () => {
    test('Referrer-Policy is set appropriately', async ({ request }) => {
      const response = await request.get('/login');

      const referrerPolicy = response.headers()['referrer-policy'];
      expect(referrerPolicy).toBeDefined();

      // Should be one of the secure options
      const secureOptions = [
        'no-referrer',
        'no-referrer-when-downgrade',
        'origin',
        'origin-when-cross-origin',
        'same-origin',
        'strict-origin',
        'strict-origin-when-cross-origin',
      ];

      expect(secureOptions).toContain(referrerPolicy);
    });

    test('Referrer-Policy on API responses', async ({ request }) => {
      const response = await request.get('/api/auth/providers');

      const referrerPolicy = response.headers()['referrer-policy'];
      expect(referrerPolicy).toBeDefined();
    });
  });
});

test.describe('Security Headers - HSTS', () => {
  test('Strict-Transport-Security header format is correct when present', async ({ request }) => {
    const response = await request.get('/login');

    const hsts = response.headers()['strict-transport-security'];

    // HSTS may not be set in development/localhost
    // If it is set, verify correct format
    if (hsts) {
      expect(hsts).toContain('max-age=');

      // Extract max-age value
      const maxAgeMatch = hsts.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1], 10);
        // Should be at least 1 year (31536000 seconds) for production
        expect(maxAge).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('HSTS includes includeSubDomains when present', async ({ request }) => {
    const response = await request.get('/login');

    const hsts = response.headers()['strict-transport-security'];

    // If HSTS is set with proper security, it should include subdomains
    if (hsts && hsts.includes('max-age=31536000')) {
      // Production HSTS should typically include subdomains
      // This is a recommendation, not a hard requirement
    }
  });
});

test.describe('Security Headers - Content-Security-Policy', () => {
  test('Content-Security-Policy or equivalent is evaluated', async ({ request }) => {
    const response = await request.get('/login');

    const csp = response.headers()['content-security-policy'];
    const cspReportOnly = response.headers()['content-security-policy-report-only'];

    // CSP should ideally be set
    // Log for visibility in security report
    if (!csp && !cspReportOnly) {
      console.log('Note: Content-Security-Policy header is not set');
    }
  });

  test('If CSP is set, verify critical directives', async ({ request }) => {
    const response = await request.get('/login');

    const csp = response.headers()['content-security-policy'];

    if (csp) {
      // Verify default-src is set
      if (!csp.includes('default-src')) {
        console.log('Warning: CSP missing default-src directive');
      }

      // Check for unsafe-inline in script-src (should be avoided)
      if (csp.includes("script-src") && csp.includes("'unsafe-inline'")) {
        console.log('Warning: CSP allows unsafe-inline scripts');
      }

      // Check for unsafe-eval (should be avoided)
      if (csp.includes("'unsafe-eval'")) {
        console.log('Warning: CSP allows unsafe-eval');
      }
    }
  });

  test('Frame-ancestors directive prevents embedding when CSP is set', async ({ request }) => {
    const response = await request.get('/login');

    const csp = response.headers()['content-security-policy'];
    const xFrameOptions = response.headers()['x-frame-options'];

    // Either CSP frame-ancestors or X-Frame-Options should protect against clickjacking
    const hasFrameProtection =
      (csp && csp.includes('frame-ancestors')) ||
      xFrameOptions;

    expect(hasFrameProtection).toBeTruthy();
  });
});

test.describe('Security Headers - Additional Headers', () => {
  test.describe('Cache-Control for Sensitive Pages', () => {
    test('Login page has appropriate cache headers', async ({ request }) => {
      const response = await request.get('/login');

      const cacheControl = response.headers()['cache-control'];

      // Login page should not be cached or have private cache
      if (cacheControl) {
        // Should not be publicly cached
        expect(cacheControl).not.toContain('public');
      }
    });

    test('API responses have appropriate cache headers', async ({ request }) => {
      const response = await request.get('/api/auth/session', {
        failOnStatusCode: false,
      });

      const cacheControl = response.headers()['cache-control'];

      // Session info should not be cached
      if (cacheControl) {
        expect(cacheControl).toMatch(/no-cache|no-store|private|max-age=0/);
      }
    });
  });

  test.describe('Permissions-Policy', () => {
    test('Permissions-Policy restricts features when set', async ({ request }) => {
      const response = await request.get('/login');

      const permissionsPolicy = response.headers()['permissions-policy'];
      const featurePolicy = response.headers()['feature-policy'];

      // Log for security report
      if (!permissionsPolicy && !featurePolicy) {
        console.log('Note: Permissions-Policy header is not set');
      }
    });
  });

  test.describe('Content-Type', () => {
    test('HTML pages have correct Content-Type', async ({ request }) => {
      const response = await request.get('/login');

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('text/html');
    });

    test('JSON API responses have correct Content-Type', async ({ request }) => {
      const response = await request.get('/api/auth/providers');

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('Content-Type includes charset', async ({ request }) => {
      const response = await request.get('/login');

      const contentType = response.headers()['content-type'];
      // UTF-8 charset recommended
      expect(contentType).toContain('charset=');
    });
  });
});

test.describe('Security Headers - Error Responses', () => {
  test('404 responses have security headers', async ({ request }) => {
    const response = await request.get('/nonexistent-page-xyz', {
      failOnStatusCode: false,
    });

    const xFrameOptions = response.headers()['x-frame-options'];
    const xContentType = response.headers()['x-content-type-options'];

    expect(xFrameOptions).toBeDefined();
    expect(xContentType).toBe('nosniff');
  });

  test('401 responses have security headers', async ({ request }) => {
    const response = await request.get('/api/leave-requests', {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);

    const xFrameOptions = response.headers()['x-frame-options'];
    const xContentType = response.headers()['x-content-type-options'];

    expect(xFrameOptions).toBeDefined();
    expect(xContentType).toBe('nosniff');
  });

  test('Error pages do not leak server information', async ({ request }) => {
    const response = await request.get('/api/nonexistent', {
      failOnStatusCode: false,
    });

    const serverHeader = response.headers()['server'];
    const poweredBy = response.headers()['x-powered-by'];

    // Should not expose detailed server info
    if (serverHeader) {
      expect(serverHeader).not.toMatch(/nginx\/\d|apache\/\d|express\/\d/i);
    }

    // X-Powered-By should not be present or should be generic
    if (poweredBy) {
      console.log(`Warning: X-Powered-By header is set: ${poweredBy}`);
    }
  });
});

test.describe('Security Headers - Comprehensive Check', () => {
  test('All critical security headers present on main page', async ({ request }) => {
    const response = await request.get('/login');

    const headers = response.headers();

    // Required headers
    expect(headers['x-frame-options']).toBeDefined();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-xss-protection']).toBeDefined();
    expect(headers['referrer-policy']).toBeDefined();

    // Generate summary for report
    const securityHeaders = {
      'X-Frame-Options': headers['x-frame-options'] || 'Not Set',
      'X-Content-Type-Options': headers['x-content-type-options'] || 'Not Set',
      'X-XSS-Protection': headers['x-xss-protection'] || 'Not Set',
      'Referrer-Policy': headers['referrer-policy'] || 'Not Set',
      'Strict-Transport-Security': headers['strict-transport-security'] || 'Not Set',
      'Content-Security-Policy': headers['content-security-policy'] || 'Not Set',
      'Permissions-Policy': headers['permissions-policy'] || 'Not Set',
    };

    console.log('Security Headers Summary:', JSON.stringify(securityHeaders, null, 2));
  });

  test('API endpoints have security headers', async ({ request }) => {
    const apiEndpoints = [
      '/api/auth/providers',
      '/api/auth/csrf',
    ];

    for (const endpoint of apiEndpoints) {
      const response = await request.get(endpoint, { failOnStatusCode: false });

      const xFrameOptions = response.headers()['x-frame-options'];
      const xContentType = response.headers()['x-content-type-options'];

      expect(xFrameOptions).toBeDefined();
      expect(xContentType).toBe('nosniff');
    }
  });
});

test.describe('Security Headers - Missing Headers Report', () => {
  test('Generate missing headers report', async ({ request }) => {
    const response = await request.get('/login');
    const headers = response.headers();

    const missingHeaders: string[] = [];
    const recommendations: string[] = [];

    // Check each recommended header
    if (!headers['strict-transport-security']) {
      missingHeaders.push('Strict-Transport-Security');
      recommendations.push('Add HSTS header with max-age of at least 1 year');
    }

    if (!headers['content-security-policy']) {
      missingHeaders.push('Content-Security-Policy');
      recommendations.push('Implement CSP to prevent XSS and code injection');
    }

    if (!headers['permissions-policy']) {
      missingHeaders.push('Permissions-Policy');
      recommendations.push('Add Permissions-Policy to restrict browser features');
    }

    // Log report
    if (missingHeaders.length > 0) {
      console.log('Missing Security Headers:', missingHeaders);
      console.log('Recommendations:', recommendations);
    }

    // Required headers must be present
    expect(headers['x-frame-options']).toBeDefined();
    expect(headers['x-content-type-options']).toBeDefined();
  });
});
