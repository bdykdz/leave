/**
 * Peak Load Test
 *
 * Tests 2x expected usage patterns with 20 concurrent users
 * simulating peak activity periods (e.g., holiday booking season, month-end).
 *
 * Run: k6 run tests/performance/peak-load-test.js
 */

import { sleep, group } from 'k6';
import { BASE_URL, ENDPOINTS, THRESHOLDS, LOAD_PROFILES } from './config.js';
import {
  authenticatedGet,
  authenticatedPost,
  unauthenticatedGet,
  checkApiResponse,
  thinkTime,
  generateLeaveRequestPayload,
} from './helpers.js';

// Stricter thresholds for peak load
const peakThresholds = {
  ...THRESHOLDS,
  http_req_duration: ['p(50)<750', 'p(95)<2000', 'p(99)<4000'],
  http_req_failed: ['rate<0.02'], // Allow 2% failure rate under peak
};

export const options = {
  scenarios: {
    peak: LOAD_PROFILES.peak,
  },
  thresholds: peakThresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

// Test setup
export function setup() {
  const healthCheck = unauthenticatedGet(ENDPOINTS.health, { name: 'health' });
  if (healthCheck.status !== 200) {
    throw new Error(`Application health check failed: ${healthCheck.status}`);
  }
  console.log('Application is healthy. Starting peak load test (2x normal usage)...');

  return {
    startTime: new Date().toISOString(),
  };
}

// Main test scenario - more aggressive than baseline
export default function (data) {
  // Mix of user types weighted towards employees (most common)
  const userTypes = ['employee', 'employee', 'employee', 'manager', 'manager', 'hr'];
  const userType = userTypes[Math.floor(Math.random() * userTypes.length)];

  // Quick health check
  group('Health Check', function () {
    const response = unauthenticatedGet(ENDPOINTS.health, { name: 'health' });
    checkApiResponse(response, 200, 'Health check');
  });

  thinkTime(0.3, 0.5);

  // All users access dashboard
  group('Dashboard Access', function () {
    const response = authenticatedGet(ENDPOINTS.dashboardSummary, userType, {
      name: 'dashboard',
    });
    checkApiResponse(response, response.status, 'Dashboard summary');
  });

  thinkTime(0.5, 1);

  // Heavy leave request activity during peak
  group('Leave Request Operations', function () {
    // View leave requests
    const listResponse = authenticatedGet(ENDPOINTS.leaveRequests, userType, {
      name: 'leave_requests',
    });
    checkApiResponse(listResponse, listResponse.status, 'Leave requests list');

    thinkTime(0.5, 1);

    // View leave types
    const typesResponse = authenticatedGet(ENDPOINTS.leaveTypes, userType, {
      name: 'leave_types',
    });
    checkApiResponse(typesResponse, typesResponse.status, 'Leave types');
  });

  thinkTime(0.5, 1);

  // Notifications check (frequent during peak)
  group('Notification Check', function () {
    const response = authenticatedGet(ENDPOINTS.notifications, userType, {
      name: 'notifications',
    });
    checkApiResponse(response, response.status, 'Notifications');
  });

  thinkTime(0.5, 1);

  // Calendar view (very common during holiday planning)
  group('Calendar View', function () {
    const response = authenticatedGet(ENDPOINTS.calendar, userType, {
      name: 'calendar',
    });
    checkApiResponse(response, response.status, 'Calendar');
  });

  thinkTime(0.5, 1);

  // Role-specific peak activities
  if (userType === 'manager') {
    group('Manager Peak Activities', function () {
      // Pending approvals - checked frequently during peak
      const approvalsResponse = authenticatedGet(ENDPOINTS.managerPendingApprovals, 'manager', {
        name: 'approvals',
      });
      checkApiResponse(approvalsResponse, approvalsResponse.status, 'Pending approvals');

      thinkTime(0.3, 0.5);

      // Team balance - important for approval decisions
      const balanceResponse = authenticatedGet(ENDPOINTS.managerTeamLeaveBalance, 'manager', {
        name: 'team_balance',
      });
      checkApiResponse(balanceResponse, balanceResponse.status, 'Team leave balance');
    });
  }

  if (userType === 'hr') {
    group('HR Peak Activities', function () {
      // Employee list - frequent lookups during peak
      const employeesResponse = authenticatedGet(ENDPOINTS.hrEmployees, 'hr', {
        name: 'hr_employees',
      });
      checkApiResponse(employeesResponse, employeesResponse.status, 'HR employees');

      thinkTime(0.3, 0.5);

      // Analytics - monitoring during peak periods
      const analyticsResponse = authenticatedGet(ENDPOINTS.hrAnalytics, 'hr', {
        name: 'hr_analytics',
      });
      checkApiResponse(analyticsResponse, analyticsResponse.status, 'HR analytics');
    });
  }

  // Shorter think time during peak (users are more active)
  thinkTime(1, 2);
}

// Test teardown
export function teardown(data) {
  console.log(`Peak load test completed.`);
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test ended at: ${new Date().toISOString()}`);
  console.log(`Peak load simulated 2x normal traffic (20 concurrent users)`);
}
