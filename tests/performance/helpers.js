/**
 * Performance Test Helpers
 *
 * Common utilities for k6 load tests
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, getAuthHeaders } from './config.js';

// Custom metrics
export const errorCounter = new Counter('errors');
export const requestsPerEndpoint = new Counter('requests_per_endpoint');
export const errorRate = new Rate('error_rate');
export const responseTimeByEndpoint = new Trend('response_time_by_endpoint');

/**
 * Make an authenticated GET request
 */
export function authenticatedGet(endpoint, userType = 'employee', tags = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = getAuthHeaders(userType);

  const response = http.get(url, {
    headers,
    tags: { endpoint: tags.name || endpoint, ...tags },
  });

  // Track custom metrics
  requestsPerEndpoint.add(1, { endpoint: tags.name || endpoint });
  responseTimeByEndpoint.add(response.timings.duration, {
    endpoint: tags.name || endpoint,
  });

  if (response.status >= 400) {
    errorCounter.add(1, { endpoint: tags.name || endpoint });
    errorRate.add(true);
  } else {
    errorRate.add(false);
  }

  return response;
}

/**
 * Make an authenticated POST request
 */
export function authenticatedPost(endpoint, body, userType = 'employee', tags = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = getAuthHeaders(userType);

  const response = http.post(url, JSON.stringify(body), {
    headers,
    tags: { endpoint: tags.name || endpoint, ...tags },
  });

  requestsPerEndpoint.add(1, { endpoint: tags.name || endpoint });
  responseTimeByEndpoint.add(response.timings.duration, {
    endpoint: tags.name || endpoint,
  });

  if (response.status >= 400) {
    errorCounter.add(1, { endpoint: tags.name || endpoint });
    errorRate.add(true);
  } else {
    errorRate.add(false);
  }

  return response;
}

/**
 * Make an unauthenticated GET request
 */
export function unauthenticatedGet(endpoint, tags = {}) {
  const url = `${BASE_URL}${endpoint}`;

  const response = http.get(url, {
    tags: { endpoint: tags.name || endpoint, ...tags },
  });

  requestsPerEndpoint.add(1, { endpoint: tags.name || endpoint });
  responseTimeByEndpoint.add(response.timings.duration, {
    endpoint: tags.name || endpoint,
  });

  if (response.status >= 400 && response.status !== 401) {
    errorCounter.add(1, { endpoint: tags.name || endpoint });
    errorRate.add(true);
  } else {
    errorRate.add(false);
  }

  return response;
}

/**
 * Standard checks for API responses
 */
export function checkApiResponse(response, expectedStatus = 200, description = 'API call') {
  return check(response, {
    [`${description}: status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${description}: response time < 3s`]: (r) => r.timings.duration < 3000,
    [`${description}: has response body`]: (r) => r.body && r.body.length > 0,
  });
}

/**
 * Random think time between requests (simulates real user behavior)
 */
export function thinkTime(min = 1, max = 3) {
  sleep(Math.random() * (max - min) + min);
}

/**
 * Generate random date in the future (for leave requests)
 */
export function getRandomFutureDate(daysAhead = 30) {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead) + 1);
  return date.toISOString().split('T')[0];
}

/**
 * Generate random leave request payload
 */
export function generateLeaveRequestPayload() {
  const startDate = getRandomFutureDate(30);
  const endDate = startDate; // Single day request for simplicity

  return {
    leaveTypeId: 'annual', // Will need to be replaced with actual ID
    startDate,
    endDate,
    reason: `Performance test leave request - ${Date.now()}`,
    isHalfDay: false,
  };
}

/**
 * Log performance summary
 */
export function logSummary(data) {
  console.log('\n=== Performance Test Summary ===');
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Failed Requests: ${data.metrics.http_req_failed?.values?.fails || 0}`);
  console.log(`Avg Response Time: ${Math.round(data.metrics.http_req_duration.values.avg)}ms`);
  console.log(`P50 Response Time: ${Math.round(data.metrics.http_req_duration.values['p(50)'])}ms`);
  console.log(`P95 Response Time: ${Math.round(data.metrics.http_req_duration.values['p(95)'])}ms`);
  console.log(`P99 Response Time: ${Math.round(data.metrics.http_req_duration.values['p(99)'])}ms`);
  console.log(`Max Response Time: ${Math.round(data.metrics.http_req_duration.values.max)}ms`);
  console.log('================================\n');
}
