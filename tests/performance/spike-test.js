/**
 * Spike Test
 *
 * Tests system behavior under sudden traffic spikes.
 * Simulates scenarios like:
 * - Company-wide announcement causing rush to check leave
 * - Holiday planning window opening
 * - End of month deadline rush
 *
 * Run: k6 run tests/performance/spike-test.js
 */

import { sleep, group, check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, ENDPOINTS, LOAD_PROFILES } from './config.js';
import {
  authenticatedGet,
  unauthenticatedGet,
  checkApiResponse,
} from './helpers.js';

// Spike-specific metrics
const spikeRecoveryTime = new Trend('spike_recovery_time');
const errorsduringSpike = new Counter('errors_during_spike');
const errorsduringRecovery = new Counter('errors_during_recovery');

// Thresholds allowing for some degradation during spike
const spikeThresholds = {
  http_req_duration: ['p(50)<1000', 'p(95)<3000', 'p(99)<5000'],
  http_req_failed: ['rate<0.05'], // Allow 5% failure during spike
};

export const options = {
  scenarios: {
    spike: LOAD_PROFILES.spike,
  },
  thresholds: spikeThresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

// Test setup
export function setup() {
  const healthCheck = unauthenticatedGet(ENDPOINTS.health, { name: 'health' });
  if (healthCheck.status !== 200) {
    throw new Error(`Application health check failed: ${healthCheck.status}`);
  }

  console.log('='.repeat(60));
  console.log('SPIKE TEST - Testing Sudden Traffic Surge');
  console.log('='.repeat(60));
  console.log('Pattern: 5 VUs -> 100 VUs (spike) -> 5 VUs (recovery)');
  console.log('Watch for: System recovery after spike');
  console.log('='.repeat(60));

  return {
    startTime: new Date().toISOString(),
    spikeDetected: false,
  };
}

// Main spike test scenario
export default function (data) {
  const vuCount = __VU;
  const isSpike = vuCount > 20; // Consider it spike territory when VUs exceed 20

  // Mix of common operations during spike
  group('Health Check', function () {
    const response = unauthenticatedGet(ENDPOINTS.health, { name: 'health' });
    const passed = check(response, {
      'health: available': (r) => r.status === 200,
    });
    if (!passed) {
      if (isSpike) {
        errorsduringSpike.add(1);
      } else {
        errorsduringRecovery.add(1);
      }
    }
  });

  sleep(0.1);

  group('Dashboard - Primary Action', function () {
    const startTime = Date.now();
    const response = authenticatedGet(ENDPOINTS.dashboardSummary, 'employee', {
      name: 'dashboard',
    });
    const duration = Date.now() - startTime;

    const passed = check(response, {
      'dashboard: status ok': (r) => r.status < 500,
      'dashboard: response < 5s': (r) => r.timings.duration < 5000,
    });

    if (!passed || response.status >= 500) {
      if (isSpike) {
        errorsduringSpike.add(1);
      } else {
        errorsduringRecovery.add(1);
      }
    }

    // Track recovery time after spike
    if (!isSpike) {
      spikeRecoveryTime.add(response.timings.duration);
    }
  });

  sleep(0.1);

  group('Leave Requests - Common Action', function () {
    const response = authenticatedGet(ENDPOINTS.leaveRequests, 'employee', {
      name: 'leave_requests',
    });

    const passed = check(response, {
      'leave requests: status ok': (r) => r.status < 500,
    });

    if (!passed || response.status >= 500) {
      if (isSpike) {
        errorsduringSpike.add(1);
      } else {
        errorsduringRecovery.add(1);
      }
    }
  });

  sleep(0.1);

  group('Notifications - Frequent Check', function () {
    const response = authenticatedGet(ENDPOINTS.notifications, 'employee', {
      name: 'notifications',
    });

    check(response, {
      'notifications: status ok': (r) => r.status < 500,
    });
  });

  // Minimal delay to maximize spike impact
  sleep(0.2);
}

// Test teardown
export function teardown(data) {
  console.log('\n' + '='.repeat(60));
  console.log('SPIKE TEST COMPLETED');
  console.log('='.repeat(60));
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test ended at: ${new Date().toISOString()}`);
  console.log('\nKey metrics to analyze:');
  console.log('- errors_during_spike: Errors when load was at 100 VUs');
  console.log('- errors_during_recovery: Errors after returning to normal');
  console.log('- spike_recovery_time: Response times after spike subsides');
  console.log('='.repeat(60));
}
