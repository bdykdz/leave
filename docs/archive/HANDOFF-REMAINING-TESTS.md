# Remaining Test Work - Handoff Document

## Date: 2026-02-03

## Current Test Status

| Test Suite | Status | Command |
|------------|--------|---------|
| Security | ✅ 163/163 passed | `npm run test:security` |
| Smoke | ✅ 20/20 passed (1 skipped) | `npm run test:smoke` |
| Contract | ✅ 128/128 passed (fixed) | `npm run test:contract` |
| Accessibility | ✅ 119/119 passed | `npm run test:a11y` |
| Visual | ❌ Needs env config | `npm run test:visual` |
| E2E | ⏸️ Not completed | `npm run test:e2e` |
| Performance | ⏭️ Needs k6 | `npm run test:perf` |

## What's Left To Do

### 1. Visual Tests (needs SHOW_DEV_LOGIN)
Visual tests require authentication. Fix:

```bash
# Option A: Add to .env.staging
SHOW_DEV_LOGIN=true

# Then rebuild staging
docker-compose -f docker-compose.staging.yml build app-staging
docker-compose -f docker-compose.staging.yml up -d app-staging

# Run visual tests
PLAYWRIGHT_BASE_URL=http://localhost:8082 npm run test:visual
```

### 2. E2E Tests
Full E2E test suite - takes a long time to run:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8082 npm run test:e2e
```

### 3. Performance Tests (optional)
Requires k6 installation:

```bash
# Install k6
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Run perf tests
npm run test:perf
```

## Quick Verification Commands

```bash
# Run all passing tests
PLAYWRIGHT_BASE_URL=http://localhost:8082 npm run test:security
PLAYWRIGHT_BASE_URL=http://localhost:8082 npm run test:smoke
PLAYWRIGHT_BASE_URL=http://localhost:8082 npm run test:contract
PLAYWRIGHT_BASE_URL=http://localhost:8082 npm run test:a11y

# Verify staging is running
curl -s http://localhost:8082/api/health

# If staging is down, restart it
docker-compose -f docker-compose.staging.yml up -d
```

## Commits Made This Session

1. `31ba378` - fix: resolve security test failures and improve rate limiting
2. `62e30f8` - docs: update handoff document with completed security test status
3. `d382e41` - fix: contract test path traversal redirect handling

## Summary

- All security, smoke, contract, and accessibility tests pass
- Visual tests need `SHOW_DEV_LOGIN=true` in staging environment
- E2E tests were stopped mid-run (takes very long)
- Performance tests require k6 installation
