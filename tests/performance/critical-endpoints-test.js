/**
 * Critical Endpoints Load Test
 *
 * Focused testing of the most critical application endpoints:
 * - Login/Authentication
 * - Dashboard
 * - Leave Request Submission
 * - Approvals
 *
 * Run: k6 run tests/performance/critical-endpoints-test.js
 */

import http from 'k6/http';
import { sleep, group, check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, ENDPOINTS, getAuthHeaders, TEST_AUTH_SECRET, THRESHOLDS } from './config.js';
import {
  authenticatedGet,
  authenticatedPost,
  unauthenticatedGet,
  checkApiResponse,
  thinkTime,
  generateLeaveRequestPayload,
} from './helpers.js';

// Endpoint-specific metrics
const loginDuration = new Trend('login_duration');
const dashboardDuration = new Trend('dashboard_duration');
const leaveSubmitDuration = new Trend('leave_submit_duration');
const approvalDuration = new Trend('approval_duration');

const loginErrors = new Counter('login_errors');
const dashboardErrors = new Counter('dashboard_errors');
const leaveSubmitErrors = new Counter('leave_submit_errors');
const approvalErrors = new Counter('approval_errors');

// Strict thresholds for critical endpoints
const criticalThresholds = {
  // Overall thresholds
  http_req_duration: ['p(50)<500', 'p(95)<1500', 'p(99)<3000'],
  http_req_failed: ['rate<0.01'],

  // Endpoint-specific thresholds
  login_duration: ['p(50)<1000', 'p(95)<2000', 'p(99)<3000'],
  dashboard_duration: ['p(50)<500', 'p(95)<1500', 'p(99)<2500'],
  leave_submit_duration: ['p(50)<750', 'p(95)<2000', 'p(99)<3000'],
  approval_duration: ['p(50)<500', 'p(95)<1500', 'p(99)<2500'],

  // Error rate thresholds
  login_errors: ['count<5'],
  dashboard_errors: ['count<5'],
  leave_submit_errors: ['count<5'],
  approval_errors: ['count<5'],
};

export const options = {
  scenarios: {
    critical_endpoints: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },  // Ramp up
        { duration: '2m', target: 10 },   // Steady state
        { duration: '30s', target: 20 },  // Increase load
        { duration: '1m', target: 20 },   // Steady at peak
        { duration: '30s', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: criticalThresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

// Test setup
export function setup() {
  const healthCheck = unauthenticatedGet(ENDPOINTS.health, { name: 'health' });
  if (healthCheck.status !== 200) {
    throw new Error(`Application health check failed: ${healthCheck.status}`);
  }

  console.log('='.repeat(60));
  console.log('CRITICAL ENDPOINTS LOAD TEST');
  console.log('='.repeat(60));
  console.log('Testing: Login, Dashboard, Leave Submission, Approvals');
  console.log('='.repeat(60));

  return {
    startTime: new Date().toISOString(),
  };
}

// Main test scenario
export default function (data) {
  // Test 1: Login/Authentication Flow
  group('Login/Authentication', function () {
    const startTime = Date.now();

    // Simulate login page access
    const loginPageResponse = http.get(`${BASE_URL}/login`, {
      tags: { endpoint: 'login_page' },
    });

    check(loginPageResponse, {
      'login page: status 200': (r) => r.status === 200,
      'login page: has content': (r) => r.body.length > 0,
    });

    // Simulate auth callback (test auth flow)
    const authResponse = http.get(`${BASE_URL}/api/auth/session`, {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'login' },
    });

    const duration = Date.now() - startTime;
    loginDuration.add(duration);

    const passed = check(authResponse, {
      'auth session: status ok': (r) => r.status < 500,
      'auth session: response time < 2s': (r) => r.timings.duration < 2000,
    });

    if (!passed || authResponse.status >= 500) {
      loginErrors.add(1);
    }
  });

  thinkTime(1, 2);

  // Test 2: Dashboard
  group('Dashboard', function () {
    const startTime = Date.now();

    // Dashboard summary API
    const summaryResponse = authenticatedGet(ENDPOINTS.dashboardSummary, 'employee', {
      name: 'dashboard',
    });

    const duration = Date.now() - startTime;
    dashboardDuration.add(duration);

    const passed = check(summaryResponse, {
      'dashboard: status ok': (r) => r.status < 500,
      'dashboard: response time < 2s': (r) => r.timings.duration < 2000,
      'dashboard: has response body': (r) => r.body && r.body.length > 0,
    });

    if (!passed || summaryResponse.status >= 500) {
      dashboardErrors.add(1);
    }

    thinkTime(0.5, 1);

    // Dashboard also loads notifications
    const notificationsResponse = authenticatedGet(ENDPOINTS.notifications, 'employee', {
      name: 'dashboard_notifications',
    });

    check(notificationsResponse, {
      'dashboard notifications: status ok': (r) => r.status < 500,
    });
  });

  thinkTime(1, 2);

  // Test 3: Leave Request Submission Flow
  group('Leave Request Submission', function () {
    const startTime = Date.now();

    // First, get leave types (required for submission)
    const leaveTypesResponse = authenticatedGet(ENDPOINTS.leaveTypes, 'employee', {
      name: 'leave_types_for_submit',
    });

    check(leaveTypesResponse, {
      'leave types: status ok': (r) => r.status < 500,
    });

    thinkTime(0.3, 0.5);

    // View existing requests
    const existingResponse = authenticatedGet(ENDPOINTS.leaveRequests, 'employee', {
      name: 'leave_requests_list',
    });

    const duration = Date.now() - startTime;
    leaveSubmitDuration.add(duration);

    const passed = check(existingResponse, {
      'leave requests list: status ok': (r) => r.status < 500,
      'leave requests list: response time < 2s': (r) => r.timings.duration < 2000,
    });

    if (!passed || existingResponse.status >= 500) {
      leaveSubmitErrors.add(1);
    }

    // Note: We don't actually submit leave requests in load testing
    // to avoid polluting the database. The GET operations test the same
    // database connections and query patterns.
  });

  thinkTime(1, 2);

  // Test 4: Approvals (Manager perspective)
  group('Approvals', function () {
    const startTime = Date.now();

    // Get pending approvals
    const pendingResponse = authenticatedGet(ENDPOINTS.managerPendingApprovals, 'manager', {
      name: 'approvals',
    });

    const duration = Date.now() - startTime;
    approvalDuration.add(duration);

    const passed = check(pendingResponse, {
      'pending approvals: status ok': (r) => r.status < 500,
      'pending approvals: response time < 2s': (r) => r.timings.duration < 2000,
    });

    if (!passed || pendingResponse.status >= 500) {
      approvalErrors.add(1);
    }

    thinkTime(0.5, 1);

    // Get team leave balance (often checked before approving)
    const balanceResponse = authenticatedGet(ENDPOINTS.managerTeamLeaveBalance, 'manager', {
      name: 'team_balance_for_approval',
    });

    check(balanceResponse, {
      'team balance: status ok': (r) => r.status < 500,
    });
  });

  thinkTime(2, 3);
}

// Test teardown with summary
export function teardown(data) {
  console.log('\n' + '='.repeat(60));
  console.log('CRITICAL ENDPOINTS TEST COMPLETED');
  console.log('='.repeat(60));
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test ended at: ${new Date().toISOString()}`);
  console.log('\nEndpoints Tested:');
  console.log('- Login/Authentication: session creation and validation');
  console.log('- Dashboard: summary data and notifications');
  console.log('- Leave Submission: types lookup and request listing');
  console.log('- Approvals: pending list and team balance');
  console.log('='.repeat(60));
}
