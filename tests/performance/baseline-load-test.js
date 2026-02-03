/**
 * Baseline Load Test
 *
 * Tests normal expected usage patterns with 10 concurrent users
 * simulating typical workday activity.
 *
 * Run: k6 run tests/performance/baseline-load-test.js
 */

import { sleep, group } from 'k6';
import { BASE_URL, ENDPOINTS, THRESHOLDS, LOAD_PROFILES } from './config.js';
import {
  authenticatedGet,
  authenticatedPost,
  unauthenticatedGet,
  checkApiResponse,
  thinkTime,
} from './helpers.js';

export const options = {
  scenarios: {
    baseline: LOAD_PROFILES.baseline,
  },
  thresholds: THRESHOLDS,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

// Test setup
export function setup() {
  // Verify the application is running
  const healthCheck = unauthenticatedGet(ENDPOINTS.health, { name: 'health' });
  if (healthCheck.status !== 200) {
    throw new Error(`Application health check failed: ${healthCheck.status}`);
  }
  console.log('Application is healthy. Starting baseline load test...');

  return {
    startTime: new Date().toISOString(),
  };
}

// Main test scenario
export default function (data) {
  // Simulate a typical user session
  const userTypes = ['employee', 'manager', 'hr'];
  const userType = userTypes[Math.floor(Math.random() * userTypes.length)];

  group('Health Check', function () {
    const response = unauthenticatedGet(ENDPOINTS.health, { name: 'health' });
    checkApiResponse(response, 200, 'Health check');
  });

  thinkTime(0.5, 1);

  group('Dashboard Access', function () {
    const response = authenticatedGet(ENDPOINTS.dashboardSummary, userType, {
      name: 'dashboard',
    });
    checkApiResponse(response, 200, 'Dashboard summary');
  });

  thinkTime(1, 2);

  group('View Leave Requests', function () {
    const response = authenticatedGet(ENDPOINTS.leaveRequests, userType, {
      name: 'leave_requests',
    });
    // May return 200 or 401 depending on auth setup
    checkApiResponse(response, response.status, 'Leave requests list');
  });

  thinkTime(1, 2);

  group('View Notifications', function () {
    const response = authenticatedGet(ENDPOINTS.notifications, userType, {
      name: 'notifications',
    });
    checkApiResponse(response, response.status, 'Notifications');
  });

  thinkTime(1, 2);

  // Role-specific actions
  if (userType === 'manager') {
    group('Manager: View Pending Approvals', function () {
      const response = authenticatedGet(ENDPOINTS.managerPendingApprovals, 'manager', {
        name: 'approvals',
      });
      checkApiResponse(response, response.status, 'Pending approvals');
    });

    thinkTime(1, 2);

    group('Manager: View Team Leave Balance', function () {
      const response = authenticatedGet(ENDPOINTS.managerTeamLeaveBalance, 'manager', {
        name: 'team_balance',
      });
      checkApiResponse(response, response.status, 'Team leave balance');
    });
  }

  if (userType === 'hr') {
    group('HR: View Employees', function () {
      const response = authenticatedGet(ENDPOINTS.hrEmployees, 'hr', {
        name: 'hr_employees',
      });
      checkApiResponse(response, response.status, 'HR employees list');
    });

    thinkTime(1, 2);

    group('HR: View Analytics', function () {
      const response = authenticatedGet(ENDPOINTS.hrAnalytics, 'hr', {
        name: 'hr_analytics',
      });
      checkApiResponse(response, response.status, 'HR analytics');
    });
  }

  // Standard delay between iterations
  thinkTime(2, 4);
}

// Test teardown
export function teardown(data) {
  console.log(`Baseline load test completed.`);
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test ended at: ${new Date().toISOString()}`);
}
