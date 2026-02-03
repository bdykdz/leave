/**
 * Soak Test (Endurance Test)
 *
 * Tests system stability over extended periods.
 * Identifies issues like:
 * - Memory leaks
 * - Connection pool exhaustion
 * - Database connection leaks
 * - Gradual performance degradation
 *
 * Run: k6 run tests/performance/soak-test.js
 * Note: This is a long-running test (30 minutes by default)
 */

import { sleep, group, check } from 'k6';
import { Counter, Trend, Gauge } from 'k6/metrics';
import { BASE_URL, ENDPOINTS, LOAD_PROFILES } from './config.js';
import {
  authenticatedGet,
  unauthenticatedGet,
} from './helpers.js';

// Soak-specific metrics
const responseTimeOver5min = new Trend('response_time_interval');
const errorsByInterval = new Counter('errors_by_interval');
const throughputGauge = new Gauge('current_throughput');
const memoryLeakIndicator = new Trend('memory_leak_indicator');

// Thresholds for sustained operation
const soakThresholds = {
  http_req_duration: ['p(50)<750', 'p(95)<2000', 'p(99)<3500'],
  http_req_failed: ['rate<0.01'], // Very strict error rate for soak
  response_time_interval: ['avg<1000'], // Average should stay consistent
};

export const options = {
  scenarios: {
    soak: LOAD_PROFILES.soak,
  },
  thresholds: soakThresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

// Track intervals for degradation detection
let intervalStart = Date.now();
let intervalRequests = 0;
let intervalResponseTime = 0;
const INTERVAL_MS = 5 * 60 * 1000; // 5 minute intervals

// Test setup
export function setup() {
  const healthCheck = unauthenticatedGet(ENDPOINTS.health, { name: 'health' });
  if (healthCheck.status !== 200) {
    throw new Error(`Application health check failed: ${healthCheck.status}`);
  }

  console.log('='.repeat(60));
  console.log('SOAK TEST - Extended Stability Testing');
  console.log('='.repeat(60));
  console.log('Duration: 30 minutes at 15 VUs');
  console.log('Purpose: Detect memory leaks and gradual degradation');
  console.log('='.repeat(60));

  return {
    startTime: new Date().toISOString(),
    startTimestamp: Date.now(),
  };
}

// Main soak test scenario
export default function (data) {
  const currentTime = Date.now();
  const elapsedMinutes = Math.floor((currentTime - data.startTimestamp) / 60000);

  // Rotate through different user types to simulate realistic mix
  const userTypes = ['employee', 'employee', 'employee', 'manager', 'hr'];
  const userType = userTypes[__ITER % userTypes.length];

  // Track interval metrics
  if (currentTime - intervalStart > INTERVAL_MS) {
    // Log interval metrics
    const avgResponseTime = intervalRequests > 0 ? intervalResponseTime / intervalRequests : 0;
    responseTimeOver5min.add(avgResponseTime);
    console.log(`[${elapsedMinutes}m] Interval avg response: ${Math.round(avgResponseTime)}ms, Requests: ${intervalRequests}`);

    // Reset interval tracking
    intervalStart = currentTime;
    intervalRequests = 0;
    intervalResponseTime = 0;
  }

  // Standard operations - realistic usage pattern
  group('Health Check', function () {
    const response = unauthenticatedGet(ENDPOINTS.health, { name: 'health' });
    intervalResponseTime += response.timings.duration;
    intervalRequests++;

    const passed = check(response, {
      'health: status 200': (r) => r.status === 200,
    });
    if (!passed) {
      errorsByInterval.add(1, { minute: String(elapsedMinutes) });
    }

    // Use response time as memory leak indicator (tends to increase with leaks)
    memoryLeakIndicator.add(response.timings.duration);
  });

  sleep(0.5);

  group('Dashboard Access', function () {
    const response = authenticatedGet(ENDPOINTS.dashboardSummary, userType, {
      name: 'dashboard',
    });
    intervalResponseTime += response.timings.duration;
    intervalRequests++;

    const passed = check(response, {
      'dashboard: status ok': (r) => r.status < 500,
      'dashboard: response < 3s': (r) => r.timings.duration < 3000,
    });
    if (!passed) {
      errorsByInterval.add(1, { minute: String(elapsedMinutes) });
    }

    memoryLeakIndicator.add(response.timings.duration);
  });

  sleep(0.5);

  group('Leave Requests', function () {
    const response = authenticatedGet(ENDPOINTS.leaveRequests, userType, {
      name: 'leave_requests',
    });
    intervalResponseTime += response.timings.duration;
    intervalRequests++;

    check(response, {
      'leave requests: status ok': (r) => r.status < 500,
    });

    memoryLeakIndicator.add(response.timings.duration);
  });

  sleep(0.5);

  group('Notifications', function () {
    const response = authenticatedGet(ENDPOINTS.notifications, userType, {
      name: 'notifications',
    });
    intervalResponseTime += response.timings.duration;
    intervalRequests++;

    check(response, {
      'notifications: status ok': (r) => r.status < 500,
    });
  });

  sleep(0.5);

  // Role-specific operations
  if (userType === 'manager') {
    group('Manager: Approvals Check', function () {
      const response = authenticatedGet(ENDPOINTS.managerPendingApprovals, 'manager', {
        name: 'approvals',
      });
      intervalResponseTime += response.timings.duration;
      intervalRequests++;

      check(response, {
        'approvals: status ok': (r) => r.status < 500,
      });
    });
  }

  if (userType === 'hr') {
    group('HR: Analytics', function () {
      const response = authenticatedGet(ENDPOINTS.hrAnalytics, 'hr', {
        name: 'hr_analytics',
      });
      intervalResponseTime += response.timings.duration;
      intervalRequests++;

      check(response, {
        'hr analytics: status ok': (r) => r.status < 500,
      });
    });
  }

  // Update throughput gauge
  throughputGauge.add(intervalRequests);

  // Realistic think time between user sessions
  sleep(1 + Math.random() * 2);
}

// Test teardown
export function teardown(data) {
  const endTime = new Date();
  const durationMinutes = Math.round((endTime.getTime() - data.startTimestamp) / 60000);

  console.log('\n' + '='.repeat(60));
  console.log('SOAK TEST COMPLETED');
  console.log('='.repeat(60));
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test ended at: ${endTime.toISOString()}`);
  console.log(`Total duration: ${durationMinutes} minutes`);
  console.log('\nKey metrics to analyze for stability:');
  console.log('- response_time_interval: Should remain stable over time');
  console.log('- memory_leak_indicator: Increasing trend indicates leak');
  console.log('- errors_by_interval: Should not increase over time');
  console.log('- Compare first 5 min vs last 5 min response times');
  console.log('='.repeat(60));
}
