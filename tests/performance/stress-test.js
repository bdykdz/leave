/**
 * Stress Test
 *
 * Tests system limits by gradually increasing load until breaking point.
 * Ramps from 10 to 200 concurrent users to identify:
 * - Maximum sustainable throughput
 * - Error rate degradation
 * - Response time degradation
 * - System breaking point
 *
 * Run: k6 run tests/performance/stress-test.js
 */

import { sleep, group, check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, ENDPOINTS, LOAD_PROFILES } from './config.js';
import {
  authenticatedGet,
  unauthenticatedGet,
  checkApiResponse,
  thinkTime,
} from './helpers.js';

// Custom metrics for stress testing
const stressErrors = new Counter('stress_errors');
const degradationPoint = new Trend('degradation_point');

// Relaxed thresholds - stress test is about finding limits, not passing
const stressThresholds = {
  http_req_duration: ['p(50)<2000', 'p(95)<5000'], // More lenient
  http_req_failed: ['rate<0.10'], // Allow up to 10% failure during stress
  'http_req_duration{endpoint:health}': ['p(95)<500'],
};

export const options = {
  scenarios: {
    stress: LOAD_PROFILES.stress,
  },
  thresholds: stressThresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

// Track degradation metrics
let metricsPerStage = [];
let currentStage = 0;
let stageStartTime = null;
let stageMetrics = {
  requests: 0,
  errors: 0,
  totalResponseTime: 0,
};

// Test setup
export function setup() {
  const healthCheck = unauthenticatedGet(ENDPOINTS.health, { name: 'health' });
  if (healthCheck.status !== 200) {
    throw new Error(`Application health check failed: ${healthCheck.status}`);
  }
  console.log('='.repeat(60));
  console.log('STRESS TEST - Finding System Breaking Point');
  console.log('='.repeat(60));
  console.log('Load progression: 10 -> 25 -> 50 -> 75 -> 100 -> 150 -> 200 VUs');
  console.log('Watch for: Error rate spikes, Response time degradation');
  console.log('='.repeat(60));

  return {
    startTime: new Date().toISOString(),
  };
}

// Main stress test scenario
export default function (data) {
  // Determine current VU count for adaptive behavior
  const vuCount = __VU;

  // Critical path - always test these
  group('Critical: Health Check', function () {
    const response = unauthenticatedGet(ENDPOINTS.health, { name: 'health' });
    const passed = check(response, {
      'health: status 200': (r) => r.status === 200,
      'health: response < 1s': (r) => r.timings.duration < 1000,
    });
    if (!passed) {
      stressErrors.add(1, { type: 'health_degradation' });
    }
  });

  sleep(0.1);

  group('Critical: Dashboard', function () {
    const response = authenticatedGet(ENDPOINTS.dashboardSummary, 'employee', {
      name: 'dashboard',
    });
    const passed = check(response, {
      'dashboard: status ok': (r) => r.status < 500,
      'dashboard: response < 3s': (r) => r.timings.duration < 3000,
    });
    if (!passed || response.status >= 500) {
      stressErrors.add(1, { type: 'dashboard_failure' });
    }
    degradationPoint.add(response.timings.duration, { vus: String(vuCount) });
  });

  sleep(0.1);

  group('Critical: Leave Requests', function () {
    const response = authenticatedGet(ENDPOINTS.leaveRequests, 'employee', {
      name: 'leave_requests',
    });
    const passed = check(response, {
      'leave_requests: status ok': (r) => r.status < 500,
      'leave_requests: response < 3s': (r) => r.timings.duration < 3000,
    });
    if (!passed || response.status >= 500) {
      stressErrors.add(1, { type: 'leave_requests_failure' });
    }
    degradationPoint.add(response.timings.duration, { vus: String(vuCount) });
  });

  sleep(0.1);

  // Secondary paths - test under stress
  group('Secondary: Notifications', function () {
    const response = authenticatedGet(ENDPOINTS.notifications, 'employee', {
      name: 'notifications',
    });
    check(response, {
      'notifications: status ok': (r) => r.status < 500,
    });
    if (response.status >= 500) {
      stressErrors.add(1, { type: 'notifications_failure' });
    }
  });

  sleep(0.1);

  group('Secondary: Calendar', function () {
    const response = authenticatedGet(ENDPOINTS.calendar, 'employee', {
      name: 'calendar',
    });
    check(response, {
      'calendar: status ok': (r) => r.status < 500,
    });
    if (response.status >= 500) {
      stressErrors.add(1, { type: 'calendar_failure' });
    }
  });

  sleep(0.1);

  // Role-based paths - stress the approval system
  if (vuCount % 3 === 0) {
    group('Manager: Pending Approvals', function () {
      const response = authenticatedGet(ENDPOINTS.managerPendingApprovals, 'manager', {
        name: 'approvals',
      });
      check(response, {
        'approvals: status ok': (r) => r.status < 500,
      });
      if (response.status >= 500) {
        stressErrors.add(1, { type: 'approvals_failure' });
      }
    });
  }

  if (vuCount % 5 === 0) {
    group('HR: Analytics', function () {
      const response = authenticatedGet(ENDPOINTS.hrAnalytics, 'hr', {
        name: 'hr_analytics',
      });
      check(response, {
        'hr_analytics: status ok': (r) => r.status < 500,
      });
      if (response.status >= 500) {
        stressErrors.add(1, { type: 'hr_analytics_failure' });
      }
    });
  }

  // Minimal think time during stress to maximize load
  sleep(0.2);
}

// Test teardown
export function teardown(data) {
  console.log('\n' + '='.repeat(60));
  console.log('STRESS TEST COMPLETED');
  console.log('='.repeat(60));
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test ended at: ${new Date().toISOString()}`);
  console.log('\nAnalyze the output to identify:');
  console.log('- At what VU count did error rate exceed 5%?');
  console.log('- At what VU count did p95 response time exceed 3s?');
  console.log('- What was the maximum sustainable throughput?');
  console.log('='.repeat(60));
}
