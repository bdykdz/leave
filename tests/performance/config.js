/**
 * Performance Test Configuration
 *
 * Centralized configuration for all k6 load tests
 */

// Environment configuration
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const TEST_AUTH_SECRET = __ENV.TEST_AUTH_SECRET || 'test-secret-for-performance-testing';

// Test user credentials (for authenticated endpoints)
export const TEST_USERS = {
  employee: {
    email: __ENV.TEST_EMPLOYEE_EMAIL || 'employee@test.com',
    role: 'EMPLOYEE',
  },
  manager: {
    email: __ENV.TEST_MANAGER_EMAIL || 'manager@test.com',
    role: 'MANAGER',
  },
  hr: {
    email: __ENV.TEST_HR_EMAIL || 'hr@test.com',
    role: 'HR',
  },
  executive: {
    email: __ENV.TEST_EXECUTIVE_EMAIL || 'executive@test.com',
    role: 'EXECUTIVE',
  },
  admin: {
    email: __ENV.TEST_ADMIN_EMAIL || 'admin@test.com',
    role: 'ADMIN',
  },
};

// Thresholds for performance acceptance criteria
export const THRESHOLDS = {
  // HTTP request duration thresholds
  http_req_duration: ['p(50)<500', 'p(95)<1500', 'p(99)<3000'],
  // HTTP request failure rate
  http_req_failed: ['rate<0.01'], // Less than 1% failure rate
  // Specific endpoint thresholds
  'http_req_duration{endpoint:health}': ['p(95)<100'],
  'http_req_duration{endpoint:login}': ['p(95)<2000'],
  'http_req_duration{endpoint:dashboard}': ['p(95)<1500'],
  'http_req_duration{endpoint:leave_requests}': ['p(95)<1500'],
  'http_req_duration{endpoint:approvals}': ['p(95)<1500'],
};

// Load profiles
export const LOAD_PROFILES = {
  // Baseline: Normal expected usage
  baseline: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },  // Ramp up to 10 users
      { duration: '2m', target: 10 },   // Stay at 10 users
      { duration: '30s', target: 0 },   // Ramp down
    ],
    gracefulRampDown: '10s',
  },

  // Peak: 2x expected usage
  peak: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 20 },   // Ramp up to 20 users
      { duration: '3m', target: 20 },   // Stay at 20 users
      { duration: '30s', target: 0 },   // Ramp down
    ],
    gracefulRampDown: '10s',
  },

  // Stress: Find breaking point
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },  // Warm up
      { duration: '1m', target: 25 },   // Normal load
      { duration: '1m', target: 50 },   // Moderate load
      { duration: '1m', target: 75 },   // High load
      { duration: '1m', target: 100 },  // Very high load
      { duration: '1m', target: 150 },  // Breaking point search
      { duration: '1m', target: 200 },  // Extreme load
      { duration: '30s', target: 0 },   // Recovery
    ],
    gracefulRampDown: '30s',
  },

  // Spike: Sudden traffic burst
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 5 },   // Normal load
      { duration: '10s', target: 100 }, // Spike!
      { duration: '1m', target: 100 },  // Stay at spike
      { duration: '10s', target: 5 },   // Return to normal
      { duration: '30s', target: 5 },   // Stay at normal
      { duration: '30s', target: 0 },   // Ramp down
    ],
    gracefulRampDown: '10s',
  },

  // Soak: Extended duration test
  soak: {
    executor: 'constant-vus',
    vus: 15,
    duration: '30m',
  },
};

// API Endpoints to test
export const ENDPOINTS = {
  health: '/api/health',
  dashboardSummary: '/api/dashboard/summary',
  leaveRequests: '/api/leave-requests',
  leaveTypes: '/api/leave-types',
  notifications: '/api/notifications',
  managerPendingApprovals: '/api/manager/team/pending-approvals',
  managerTeamLeaveBalance: '/api/manager/team/leave-balance',
  hrEmployees: '/api/hr/employees',
  hrAnalytics: '/api/hr/analytics',
  executiveAnalytics: '/api/executive/analytics',
  calendar: '/api/calendar',
};

// Helper to generate test authentication headers
export function getAuthHeaders(userType = 'employee') {
  const user = TEST_USERS[userType];
  return {
    'Content-Type': 'application/json',
    'X-Test-Auth': TEST_AUTH_SECRET,
    'X-Test-User-Email': user.email,
    'X-Test-User-Role': user.role,
  };
}
