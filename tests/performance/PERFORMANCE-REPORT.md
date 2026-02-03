# Leave Management System - Performance Test Report

## Executive Summary

This document outlines the performance testing strategy, test scenarios, expected metrics, and recommendations for the Leave Management System.

## Test Environment

### Application Stack
- **Framework**: Next.js 15.2.6 with App Router
- **Runtime**: Node.js with React 19
- **Database**: PostgreSQL 15 with Prisma ORM
- **Cache**: Redis via ioredis
- **Authentication**: NextAuth.js with JWT sessions

### Infrastructure Requirements for Testing
- k6 load testing tool
- Application running on target environment
- Database with representative data volume
- Network access to target endpoints

## Performance Test Types

### 1. Baseline Load Test
**Purpose**: Establish normal operating performance baseline

| Parameter | Value |
|-----------|-------|
| Virtual Users | 10 |
| Duration | 3 minutes |
| Ramp-up | 30 seconds |
| Think Time | 1-3 seconds |

**Expected Metrics**:
- p50 Response Time: < 500ms
- p95 Response Time: < 1500ms
- p99 Response Time: < 3000ms
- Error Rate: < 1%

### 2. Peak Load Test (2x Expected)
**Purpose**: Validate system handles peak traffic periods

| Parameter | Value |
|-----------|-------|
| Virtual Users | 20 |
| Duration | 4.5 minutes |
| Ramp-up | 1 minute |
| Think Time | 0.5-1 seconds |

**Expected Metrics**:
- p50 Response Time: < 750ms
- p95 Response Time: < 2000ms
- p99 Response Time: < 4000ms
- Error Rate: < 2%

### 3. Stress Test
**Purpose**: Find system breaking point

| Parameter | Value |
|-----------|-------|
| Virtual Users | 10 → 200 (progressive) |
| Duration | 6.5 minutes |
| Stages | 10 → 25 → 50 → 75 → 100 → 150 → 200 VUs |

**Key Metrics to Identify**:
- VU count where error rate exceeds 5%
- VU count where p95 exceeds 3 seconds
- Maximum sustainable throughput
- Breaking point characteristics

### 4. Spike Test
**Purpose**: Validate sudden traffic burst handling

| Parameter | Value |
|-----------|-------|
| Normal Load | 5 VUs |
| Spike Load | 100 VUs |
| Spike Duration | 1 minute |
| Recovery | 30 seconds |

**Expected Metrics**:
- System recovers within 30 seconds of spike end
- Error rate during spike: < 5%
- Post-spike response times return to baseline

### 5. Soak Test
**Purpose**: Identify memory leaks and gradual degradation

| Parameter | Value |
|-----------|-------|
| Virtual Users | 15 |
| Duration | 30 minutes |

**Key Indicators**:
- Response time trend should remain flat
- No increase in error rate over time
- Memory usage should stabilize

## Critical Endpoints Tested

### Authentication Endpoints
| Endpoint | Method | SLA (p95) |
|----------|--------|-----------|
| `/login` | GET | < 2000ms |
| `/api/auth/session` | GET | < 1000ms |

### Dashboard Endpoints
| Endpoint | Method | SLA (p95) |
|----------|--------|-----------|
| `/api/dashboard/summary` | GET | < 1500ms |
| `/api/notifications` | GET | < 1000ms |

### Leave Request Endpoints
| Endpoint | Method | SLA (p95) |
|----------|--------|-----------|
| `/api/leave-requests` | GET | < 1500ms |
| `/api/leave-requests` | POST | < 2000ms |
| `/api/leave-types` | GET | < 1000ms |

### Approval Endpoints
| Endpoint | Method | SLA (p95) |
|----------|--------|-----------|
| `/api/manager/team/pending-approvals` | GET | < 1500ms |
| `/api/manager/team/approve-request/[id]` | POST | < 2000ms |
| `/api/manager/team/leave-balance` | GET | < 1500ms |

### HR/Analytics Endpoints
| Endpoint | Method | SLA (p95) |
|----------|--------|-----------|
| `/api/hr/employees` | GET | < 2000ms |
| `/api/hr/analytics` | GET | < 2500ms |
| `/api/executive/analytics` | GET | < 2500ms |

## Performance Thresholds

### Response Time Targets
| Percentile | Target | Warning | Critical |
|------------|--------|---------|----------|
| p50 | < 500ms | < 750ms | > 1000ms |
| p95 | < 1500ms | < 2000ms | > 3000ms |
| p99 | < 3000ms | < 4000ms | > 5000ms |

### Error Rate Targets
| Scenario | Target | Warning | Critical |
|----------|--------|---------|----------|
| Baseline | < 0.1% | < 0.5% | > 1% |
| Peak | < 0.5% | < 1% | > 2% |
| Stress | < 2% | < 5% | > 10% |
| Spike | < 2% | < 5% | > 10% |

### Throughput Expectations
| Scenario | Expected RPS | Minimum RPS |
|----------|--------------|-------------|
| Baseline (10 VUs) | 20-30 | 15 |
| Peak (20 VUs) | 40-60 | 30 |
| Maximum Sustainable | 100-150 | 80 |

## Running Performance Tests

### Prerequisites
1. Install k6:
   ```bash
   # macOS
   brew install k6

   # Ubuntu/Debian
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
     --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
     sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update && sudo apt-get install k6

   # Windows
   choco install k6
   ```

2. Start the application:
   ```bash
   pnpm dev  # Development
   # or
   pnpm start  # Production
   ```

### Running Tests

```bash
# Run individual tests
./tests/performance/run-tests.sh baseline
./tests/performance/run-tests.sh peak
./tests/performance/run-tests.sh stress
./tests/performance/run-tests.sh spike
./tests/performance/run-tests.sh soak
./tests/performance/run-tests.sh critical

# Run all standard tests
./tests/performance/run-tests.sh all

# Run against specific URL
./tests/performance/run-tests.sh baseline -u http://staging.example.com:3000

# Or run k6 directly
k6 run -e BASE_URL=http://localhost:3000 tests/performance/baseline-load-test.js
```

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Application base URL | `http://localhost:3000` |
| `TEST_AUTH_SECRET` | Test authentication secret | `test-secret-for-performance-testing` |
| `TEST_EMPLOYEE_EMAIL` | Test employee email | `employee@test.com` |
| `TEST_MANAGER_EMAIL` | Test manager email | `manager@test.com` |
| `TEST_HR_EMAIL` | Test HR email | `hr@test.com` |

## Analyzing Results

### Key Metrics to Monitor

1. **http_req_duration**: Overall request latency
   - `p(50)`: Median response time
   - `p(95)`: 95th percentile (most users' experience)
   - `p(99)`: Worst-case experience

2. **http_req_failed**: Failed request rate
   - Should stay below threshold for scenario

3. **http_reqs**: Total requests made
   - Divide by duration for throughput (RPS)

4. **vus**: Virtual users at any point
   - Correlate with response times

### Sample Report Analysis

```
     ✓ http_req_duration............: avg=245ms min=89ms med=198ms max=1.2s p(90)=456ms p(95)=678ms p(99)=890ms
     ✓ http_req_failed...............: 0.12% ✓ 12 ✗ 9988
       http_reqs......................: 10000 166.67/s
       vus...........................: 10 min=0 max=10
```

**Interpretation**:
- Average response: 245ms (good)
- p95: 678ms (under 1500ms target)
- Error rate: 0.12% (under 1% target)
- Throughput: ~167 RPS

## Recommendations

### Infrastructure Scaling

Based on stress test results, consider:

1. **Horizontal Scaling**: Add application instances behind load balancer when:
   - p95 response time exceeds 2 seconds
   - Error rate approaches 2%
   - CPU utilization exceeds 70%

2. **Database Optimization**:
   - Add read replicas when database becomes bottleneck
   - Implement connection pooling (PgBouncer)
   - Add indexes for frequently queried fields

3. **Caching Strategy**:
   - Redis cache for session data (already implemented)
   - Cache dashboard summary data (5-minute TTL)
   - Cache leave type and department lists

### Performance Optimization Areas

1. **API Response Optimization**:
   - Implement pagination for list endpoints
   - Add field selection to reduce payload size
   - Use database projections (select specific fields)

2. **Frontend Optimization**:
   - Implement lazy loading for heavy components
   - Use React.memo for expensive renders
   - Consider React Server Components for data-heavy pages

3. **Database Query Optimization**:
   - Review N+1 query patterns in Prisma
   - Add composite indexes for common filters
   - Implement cursor-based pagination

### Monitoring Recommendations

1. **Application Performance Monitoring**:
   - Sentry (already integrated) for error tracking
   - Add custom performance spans for critical paths
   - Monitor database query durations

2. **Infrastructure Monitoring**:
   - CPU, Memory, Disk I/O metrics
   - Database connection pool utilization
   - Redis memory and connection metrics

3. **Alerting Thresholds**:
   - p95 response time > 2s: Warning
   - Error rate > 1%: Warning
   - Error rate > 5%: Critical
   - Database connections > 80%: Warning

## Test File Reference

| File | Description |
|------|-------------|
| `config.js` | Shared configuration and thresholds |
| `helpers.js` | Common test utilities |
| `baseline-load-test.js` | Normal load (10 VUs) |
| `peak-load-test.js` | Peak load (20 VUs) |
| `stress-test.js` | Breaking point discovery |
| `spike-test.js` | Sudden traffic burst |
| `soak-test.js` | Extended stability (30 min) |
| `critical-endpoints-test.js` | Critical path focused |
| `run-tests.sh` | Test runner script |

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-01 | Initial performance test suite |
