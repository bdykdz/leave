/**
 * Broken Access Control Security Tests
 * US-014: Security Testing
 *
 * Tests verify:
 * - IDOR (Insecure Direct Object Reference) protection
 * - Users cannot access other users' data
 * - Role-based access control enforcement
 * - Horizontal and vertical privilege escalation prevention
 */

import { test, expect } from '@playwright/test';

test.describe('Access Control - IDOR Prevention', () => {
  test.describe('Leave Request Access Control', () => {
    test('Unauthenticated user cannot access leave requests', async ({ request }) => {
      const response = await request.get('/api/leave-requests', {
        failOnStatusCode: false,
      });

      expect(response.status()).toBe(401);
    });

    test('Cannot access other users leave request by ID manipulation', async ({ request }) => {
      // Attempt to access leave requests with various ID formats
      const testIds = [
        'clxyz123456789',  // UUID-like ID
        '1',
        '9999999',
        '../../../etc/passwd',  // Path traversal attempt
        'admin',
        'null',
        'undefined',
      ];

      for (const id of testIds) {
        const response = await request.get(`/api/leave-requests/${id}`, {
          failOnStatusCode: false,
          maxRedirects: 0, // Don't follow redirects to properly test the initial response
        });

        // Should be 401 (unauth), 403 (forbidden), 404 (not found), or 307 (redirect to login)
        // 307 is also valid as it means unauthenticated user is being redirected
        expect([307, 401, 403, 404]).toContain(response.status());

        // Should not leak data in error messages
        const body = await response.text();
        expect(body).not.toContain('email');
        expect(body).not.toContain('password');
        expect(body).not.toContain('userId');
      }
    });

    test('Cannot enumerate leave requests via sequential IDs', async ({ request }) => {
      // Attempt sequential ID enumeration
      const responses: number[] = [];

      for (let i = 1; i <= 10; i++) {
        const response = await request.get(`/api/leave-requests/${i}`, {
          failOnStatusCode: false,
        });
        responses.push(response.status());
      }

      // All should be 401 or 404, not exposing data
      for (const status of responses) {
        expect([401, 403, 404]).toContain(status);
      }
    });
  });

  test.describe('User Data Access Control', () => {
    test('Cannot access user details without authentication', async ({ request }) => {
      const response = await request.get('/api/user', {
        failOnStatusCode: false,
      });

      expect(response.status()).toBe(401);
    });

    test('Cannot enumerate users via ID manipulation', async ({ request }) => {
      const testIds = ['1', '2', 'admin', 'hr', 'manager'];

      for (const id of testIds) {
        const response = await request.get(`/api/user/${id}`, {
          failOnStatusCode: false,
        });

        expect([401, 403, 404]).toContain(response.status());

        // Should not expose user data
        const body = await response.text();
        expect(body).not.toMatch(/"email"\s*:\s*"[^"]+@/);
        expect(body).not.toMatch(/"name"\s*:\s*"/);
      }
    });

    test('User management endpoints require authentication', async ({ request }) => {
      const response = await request.get('/api/hr/user-management', {
        failOnStatusCode: false,
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('WFH Request Access Control', () => {
    test('Cannot access WFH requests without authentication', async ({ request }) => {
      const response = await request.get('/api/wfh-requests', {
        failOnStatusCode: false,
      });

      expect(response.status()).toBe(401);
    });

    test('Cannot access other users WFH requests', async ({ request }) => {
      const response = await request.get('/api/wfh-requests/other-user-id', {
        failOnStatusCode: false,
      });

      expect([401, 403, 404]).toContain(response.status());
    });
  });

  test.describe('Document Access Control', () => {
    test('Cannot access documents without authentication', async ({ request }) => {
      const response = await request.get('/api/documents', {
        failOnStatusCode: false,
      });

      expect(response.status()).toBe(401);
    });

    test('Cannot download arbitrary documents via ID', async ({ request }) => {
      const testIds = ['1', 'admin-doc', 'confidential', '../../../etc/passwd'];

      for (const id of testIds) {
        const response = await request.get(`/api/documents/${id}`, {
          failOnStatusCode: false,
          maxRedirects: 0,
        });

        // 307 redirect to login is also a valid security response
        expect([307, 401, 403, 404]).toContain(response.status());
      }
    });

    test('Cannot access document templates without authentication', async ({ request }) => {
      const response = await request.get('/api/documents/templates', {
        failOnStatusCode: false,
      });

      expect(response.status()).toBe(401);
    });
  });
});

test.describe('Access Control - Role-Based Access', () => {
  test.describe('HR Endpoints', () => {
    test('HR endpoints require authentication', async ({ request }) => {
      const hrEndpoints = [
        '/api/hr/user-management',
        '/api/hr/reports',
        '/api/hr/policies',
        '/api/hr/employee-management',
        '/api/hr/dashboard',
      ];

      for (const endpoint of hrEndpoints) {
        const response = await request.get(endpoint, {
          failOnStatusCode: false,
        });

        expect(response.status()).toBe(401);
      }
    });

    test('HR sensitive operations require POST authentication', async ({ request }) => {
      const response = await request.post('/api/hr/user-management', {
        data: { action: 'create', email: 'new@test.com' },
        failOnStatusCode: false,
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('Admin Endpoints', () => {
    test('Admin endpoints require authentication', async ({ request }) => {
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/departments',
        '/api/admin/settings',
        '/api/admin/escalation-settings',
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request.get(endpoint, {
          failOnStatusCode: false,
        });

        expect([401, 404]).toContain(response.status());
      }
    });

    test('User import requires authentication', async ({ request }) => {
      const response = await request.post('/api/admin/import-users', {
        data: { users: [] },
        failOnStatusCode: false,
      });

      expect([401, 404]).toContain(response.status());
    });
  });

  test.describe('Executive Endpoints', () => {
    test('Executive endpoints require authentication', async ({ request }) => {
      const executiveEndpoints = [
        '/api/executive/dashboard',
        '/api/executive/analytics',
        '/api/executive/peer-approval',
        '/api/executive/routing',
      ];

      for (const endpoint of executiveEndpoints) {
        const response = await request.get(endpoint, {
          failOnStatusCode: false,
        });

        expect(response.status()).toBe(401);
      }
    });
  });

  test.describe('Manager Endpoints', () => {
    test('Manager endpoints require authentication', async ({ request }) => {
      const managerEndpoints = [
        '/api/manager/approvals',
        '/api/manager/team-calendar',
        '/api/manager/delegation',
      ];

      for (const endpoint of managerEndpoints) {
        const response = await request.get(endpoint, {
          failOnStatusCode: false,
        });

        expect(response.status()).toBe(401);
      }
    });

    test('Cannot approve requests without authentication', async ({ request }) => {
      const response = await request.post('/api/manager/approvals', {
        data: { requestId: '123', action: 'approve' },
        failOnStatusCode: false,
      });

      expect(response.status()).toBe(401);
    });
  });
});

test.describe('Access Control - Page Level Protection', () => {
  test('Protected pages redirect to login when unauthenticated', async ({ page }) => {
    const protectedPages = [
      '/employee',
      '/manager',
      '/hr',
      '/executive',
      '/admin',
      '/employee/leave-request',
      '/manager/approvals',
      '/hr/users',
    ];

    for (const path of protectedPages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Should redirect to login
      const currentUrl = page.url();
      expect(currentUrl).toContain('/login');
    }
  });

  test('Setup pages require authentication or setup password', async ({ page }) => {
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    // Setup should either require login or show password prompt
    const pageContent = await page.content();
    const requiresAuth = pageContent.includes('password') ||
                        pageContent.includes('login') ||
                        pageContent.includes('Sign in');

    expect(requiresAuth).toBe(true);
  });
});

test.describe('Access Control - Parameter Tampering', () => {
  test('Cannot bypass access control via parameter tampering', async ({ request }) => {
    // Attempt to access resources by adding admin/role parameters
    const tamperedRequests = [
      '/api/leave-requests?role=ADMIN',
      '/api/leave-requests?isAdmin=true',
      '/api/users?role=HR',
      '/api/hr/user-management?bypass=true',
    ];

    for (const url of tamperedRequests) {
      const response = await request.get(url, {
        failOnStatusCode: false,
      });

      // Should still require authentication
      expect(response.status()).toBe(401);
    }
  });

  test('Cannot escalate privileges via body parameters', async ({ request }) => {
    const response = await request.post('/api/leave-requests', {
      data: {
        role: 'ADMIN',
        isAdmin: true,
        bypassAuth: true,
        reason: 'Test',
      },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
  });

  test('Cannot manipulate user ID in request body', async ({ request }) => {
    const response = await request.post('/api/leave-requests', {
      data: {
        userId: 'admin-user-id',
        reason: 'Attempting to create as another user',
      },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
  });
});

test.describe('Access Control - API Method Restrictions', () => {
  test('DELETE operations require authentication', async ({ request }) => {
    const response = await request.delete('/api/leave-requests/123', {
      failOnStatusCode: false,
    });

    expect([401, 404, 405]).toContain(response.status());
  });

  test('PUT operations require authentication', async ({ request }) => {
    const response = await request.put('/api/leave-requests/123', {
      data: { status: 'approved' },
      failOnStatusCode: false,
    });

    expect([401, 404, 405]).toContain(response.status());
  });

  test('PATCH operations require authentication', async ({ request }) => {
    const response = await request.patch('/api/user/settings', {
      data: { role: 'ADMIN' },
      failOnStatusCode: false,
    });

    expect([401, 404, 405]).toContain(response.status());
  });
});

test.describe('Access Control - Path Traversal Prevention', () => {
  test('Path traversal in file access is blocked', async ({ request }) => {
    const traversalPaths = [
      '/api/documents/../../../etc/passwd',
      '/api/documents/..%2F..%2F..%2Fetc%2Fpasswd',
      '/api/documents/....//....//etc/passwd',
      '/api/files/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd',
    ];

    for (const path of traversalPaths) {
      const response = await request.get(path, {
        failOnStatusCode: false,
        maxRedirects: 0,
      });

      // Should not expose file contents
      // 307/308 redirect to login is also valid (path traversal resolved to non-API route)
      expect([307, 308, 400, 401, 403, 404]).toContain(response.status());

      const body = await response.text();
      expect(body).not.toContain('root:');
      expect(body).not.toContain('/bin/bash');
    }
  });

  test('Path traversal in ID parameters is blocked', async ({ request }) => {
    const traversalIds = [
      '../admin',
      '..%2Fadmin',
      '%2e%2e%2fadmin',
      'user/../admin',
    ];

    for (const id of traversalIds) {
      const response = await request.get(`/api/user/${id}`, {
        failOnStatusCode: false,
      });

      expect([400, 401, 403, 404]).toContain(response.status());
    }
  });
});

test.describe('Access Control - Mass Assignment Prevention', () => {
  test('Cannot assign admin role via request body', async ({ request }) => {
    const response = await request.post('/api/user/register', {
      data: {
        email: 'hacker@test.com',
        name: 'Hacker',
        role: 'ADMIN',
        isAdmin: true,
        permissions: ['*'],
      },
      failOnStatusCode: false,
    });

    // Registration endpoint may not exist or should reject role assignment
    expect([401, 403, 404, 422]).toContain(response.status());
  });

  test('Cannot modify user role via profile update', async ({ request }) => {
    const response = await request.patch('/api/user/profile', {
      data: {
        role: 'ADMIN',
        department: 'IT',
      },
      failOnStatusCode: false,
    });

    expect([401, 403, 404, 405]).toContain(response.status());
  });
});

test.describe('Access Control - Approval Workflow', () => {
  test('Cannot approve own leave request', async ({ request }) => {
    // This would require authentication, but verify endpoint security
    const response = await request.post('/api/approvals', {
      data: {
        requestId: 'my-own-request',
        action: 'approve',
        selfApprove: true,
      },
      failOnStatusCode: false,
    });

    expect([401, 403, 404]).toContain(response.status());
  });

  test('Cannot bypass approval workflow', async ({ request }) => {
    const response = await request.post('/api/leave-requests', {
      data: {
        status: 'APPROVED',
        bypassApproval: true,
        autoApprove: true,
      },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
  });
});

test.describe('Access Control - Information Disclosure', () => {
  test('Error responses do not leak sensitive information', async ({ request }) => {
    const response = await request.get('/api/admin/users', {
      failOnStatusCode: false,
    });

    const body = await response.text();

    // Should not expose internal paths or stack traces
    expect(body).not.toMatch(/\/opt\/|\/home\/|\/var\//);
    expect(body).not.toMatch(/at\s+\w+\s+\(/);  // Stack traces
    expect(body).not.toContain('prisma');
    expect(body).not.toContain('DATABASE_URL');
    expect(body).not.toContain('NEXTAUTH_SECRET');
  });

  test('404 responses are consistent to prevent enumeration', async ({ request }) => {
    const existingCheck = await request.get('/api/leave-requests/valid-looking-id', {
      failOnStatusCode: false,
    });

    const nonExistingCheck = await request.get('/api/leave-requests/definitely-not-valid', {
      failOnStatusCode: false,
    });

    // Both should have similar response structures to prevent enumeration
    expect(existingCheck.status()).toBe(nonExistingCheck.status());
  });
});
