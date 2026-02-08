# PRD: Leave Management System - Environment Separation, Bug Fixes, Testing & Documentation

## Overview

This PRD covers the complete enhancement of an existing Leave Management System running on a VPS with Docker. The system currently has only a dev/QA environment and needs proper environment separation, bug fixes, comprehensive testing infrastructure, and Romanian user documentation.

The project spans four phases:
1. **Discovery & Analysis** - Understand current infrastructure
2. **Staging Environment Setup** - Create isolated test environment
3. **Bug Fixes** - Fix known navigation and approval issues
4. **Comprehensive Testing** - E2E, security, accessibility, performance
5. **Documentation** - API docs with Scalar and Romanian wiki

## Goals

- Establish proper environment separation (Dev/QA, Staging, Production)
- Create isolated staging environment for automated testing
- Fix critical bugs affecting HR, Executive routing, and peer approval
- Build comprehensive test suite covering all user roles and flows
- Document APIs using Scalar OpenAPI tooling
- Create complete Romanian user documentation

## Quality Gates

These commands must pass for every user story:
- `pnpm lint` - Linting
- `pnpm typecheck` - TypeScript type checking  
- `pnpm build` - Build verification

For testing-related stories, also include:
- `pnpm test:e2e` - E2E tests (once configured)
- `pnpm test:smoke` - Smoke tests (once configured)

## User Stories

### US-000: Analyze Existing Infrastructure

As a developer, I want to analyze the current system setup so that I can make informed decisions about environment separation and testing strategy.

**Acceptance Criteria:**
- [ ] Docker Analysis: Read and document docker-compose.yml, identify all services, port mappings, volume mounts, environment variables
- [ ] Codebase Analysis: Document tech stack, authentication implementation, routing logic, existing tests, folder structure
- [ ] Database Analysis: Document database type, review Prisma schema/models, check seeding approach
- [ ] Authentication Analysis: Document Microsoft SSO configuration, Azure AD credential storage, auth middleware and session handling
- [ ] Create DISCOVERY.md with complete tech stack, Docker services map, database schema overview, auth flow diagram
- [ ] Document identified issues, technical debt, and recommendations for staging environment
- [ ] DISCOVERY.md is comprehensive and ready to guide staging environment creation

---

### US-001: Create Staging Environment

As a developer, I want an isolated staging environment so that automated tests can run without affecting production data.

**Acceptance Criteria:**
- [ ] Create docker-compose.staging.yml as override file
- [ ] Configure separate staging containers: app-staging (different port), db-staging (separate database instance)
- [ ] Staging containers use different network isolated from production
- [ ] Staging does NOT share volumes with production database
- [ ] Create .env.staging with staging-specific configuration
- [ ] Create scripts/start-staging.sh startup script
- [ ] Staging environment starts independently with ./scripts/start-staging.sh
- [ ] Staging accessible on designated port (determined during discovery)

---

### US-002: Create Staging Database with Seed Data

As a developer, I want comprehensive seed data in staging so that all user roles and scenarios can be tested.

**Acceptance Criteria:**
- [ ] Create or enhance seed script for staging database
- [ ] Seed includes multiple users for each role: Employee, Manager, HR, Executive, Admin
- [ ] Seed includes all leave types and policies
- [ ] Seed includes historical requests in various states (pending, approved, rejected, cancelled)
- [ ] Seed includes organizational hierarchy with departments
- [ ] Seed includes edge case scenarios (executives who can approve each other)
- [ ] Seed script is idempotent (can run multiple times safely)
- [ ] Document seed data in DISCOVERY.md or separate SEED_DATA.md

---

### US-003: Authentication Handling for Testing

As a developer, I want automated tests to authenticate without manual intervention so that CI/CD pipelines can run unattended.

**Acceptance Criteria:**
- [ ] Implement test authentication mode (environment variable controlled)
- [ ] Test mode only activates in staging environment (never in production)
- [ ] All user roles can be authenticated programmatically
- [ ] Create test user credentials/tokens for each role
- [ ] Document authentication approach in DISCOVERY.md
- [ ] Production authentication flow remains completely unaffected
- [ ] Security review confirms no risk of test mode leaking to production

---

### US-004: Testing Tools Setup

As a developer, I want testing infrastructure configured so that I can write and run comprehensive tests.

**Acceptance Criteria:**
- [ ] Install Playwright with all browsers: @playwright/test
- [ ] Install accessibility testing: @axe-core/playwright
- [ ] Create playwright.config.ts pointing to staging environment
- [ ] Configure auth state persistence in Playwright
- [ ] Configure HTML reporter for test results
- [ ] Add npm scripts: test:e2e, test:smoke
- [ ] Verify Playwright can connect to staging and run a basic test
- [ ] Document testing setup in README or TESTING.md

---

### US-005: Fix HR Navigation Issue

As an HR user, I want to navigate between HR dashboard and my personal section seamlessly so that I can manage both HR duties and my own leave requests.

**Acceptance Criteria:**
- [ ] Write E2E test that reproduces HR navigation bug (initially failing)
- [ ] Investigate and identify root cause in navigation/routing code
- [ ] Fix navigation logic for HR role switching
- [ ] E2E test passes after fix
- [ ] HR user can: HR Dashboard → Personal View → HR Dashboard without errors
- [ ] No console errors during navigation
- [ ] Navigation state is preserved correctly
- [ ] Manual verification confirms fix works

---

### US-006: Fix Executive Routing Errors

As an Executive user, I want to access executive-appropriate pages so that I'm not incorrectly redirected to employee-level views.

**Acceptance Criteria:**
- [ ] Map all routes and their role guards
- [ ] Write E2E tests for all executive navigation paths
- [ ] Identify where executive role incorrectly falls through to employee
- [ ] Fix route guards and role hierarchy logic
- [ ] All executive routes land on correct pages (manager-level or higher, not employee)
- [ ] E2E tests cover all executive-specific routes
- [ ] Role hierarchy is correctly implemented and documented

---

### US-007: Fix Executive Leave Approval Flow

As an Executive, I want to submit leave requests and have them approved by peer executives so that executives aren't blocked from taking leave.

**Acceptance Criteria:**
- [ ] Write E2E test: Executive A submits leave → Executive B can approve
- [ ] Trace and document approval chain logic for executives
- [ ] Fix approval chain to correctly assign peer executive as approver
- [ ] Peer executive can view, approve, and reject the request
- [ ] Notifications are sent to correct approver
- [ ] Handle edge case: designated approver is on leave (fallback approver)
- [ ] Handle edge case: only one executive exists (escalation path)
- [ ] Prevent circular approval (executive cannot approve own request)
- [ ] E2E tests pass for all executive approval scenarios

---

### US-008: E2E Test Suite - Authentication & Core Flows

As a developer, I want E2E tests for authentication and core flows so that basic functionality is always verified.

**Acceptance Criteria:**
- [ ] Create tests/e2e/auth.spec.ts covering login/logout for all roles
- [ ] Create tests/e2e/employee/leave-request.spec.ts for submitting leave
- [ ] Create tests/e2e/employee/leave-history.spec.ts for viewing history
- [ ] Create tests/e2e/employee/balance.spec.ts for checking balances
- [ ] All tests run against staging environment
- [ ] Tests use proper authentication fixtures
- [ ] HTML report generated after test run
- [ ] All tests pass

---

### US-009: E2E Test Suite - Manager Flows

As a developer, I want E2E tests for manager functionality so that approval workflows are verified.

**Acceptance Criteria:**
- [ ] Create tests/e2e/manager/approvals.spec.ts for approval actions
- [ ] Create tests/e2e/manager/team-calendar.spec.ts for team view
- [ ] Create tests/e2e/manager/delegation.spec.ts for delegating approvals
- [ ] Tests cover approve, reject, and request-more-info actions
- [ ] Tests verify notifications are triggered
- [ ] All tests pass against staging

---

### US-010: E2E Test Suite - HR Flows

As a developer, I want E2E tests for HR functionality so that HR-specific features are verified.

**Acceptance Criteria:**
- [ ] Create tests/e2e/hr/employee-management.spec.ts
- [ ] Create tests/e2e/hr/policies.spec.ts for leave policy management
- [ ] Create tests/e2e/hr/reports.spec.ts for report generation
- [ ] Create tests/e2e/hr/navigation.spec.ts verifying bug fix (US-005)
- [ ] Tests cover CRUD operations for employees
- [ ] Tests verify report export functionality
- [ ] All tests pass against staging

---

### US-011: E2E Test Suite - Executive Flows

As a developer, I want E2E tests for executive functionality so that executive-specific features are verified.

**Acceptance Criteria:**
- [ ] Create tests/e2e/executive/routing.spec.ts verifying bug fix (US-006)
- [ ] Create tests/e2e/executive/peer-approval.spec.ts verifying bug fix (US-007)
- [ ] Create tests/e2e/executive/dashboard.spec.ts for executive dashboard
- [ ] Tests cover all executive-specific routes
- [ ] Tests verify peer approval workflow end-to-end
- [ ] All tests pass against staging

---

### US-012: E2E Test Suite - Edge Cases

As a developer, I want E2E tests for edge cases so that unusual scenarios don't break the system.

**Acceptance Criteria:**
- [ ] Create tests/e2e/edge-cases/empty-states.spec.ts (new users, no history)
- [ ] Create tests/e2e/edge-cases/max-limits.spec.ts (max leave days, long names)
- [ ] Create tests/e2e/edge-cases/concurrent-actions.spec.ts (simultaneous approvals)
- [ ] Create tests/e2e/edge-cases/error-handling.spec.ts (network errors, invalid data)
- [ ] Tests verify graceful handling of edge cases
- [ ] All tests pass against staging

---

### US-013: WCAG 2.1 AA Accessibility Testing

As a user with disabilities, I want the application to be accessible so that I can use it with assistive technologies.

**Acceptance Criteria:**
- [ ] Integrate @axe-core/playwright into test suite
- [ ] Create accessibility tests for all main pages
- [ ] Test color contrast compliance
- [ ] Test full keyboard navigation (tab order, focus management)
- [ ] Test screen reader compatibility (ARIA labels, roles)
- [ ] Test form labels and error announcements
- [ ] Fix all WCAG 2.1 AA violations found
- [ ] Generate accessibility report
- [ ] Zero violations in final test run

---

### US-014: Security Testing

As a security-conscious organization, I want the application tested for vulnerabilities so that user data is protected.

**Acceptance Criteria:**
- [ ] Create tests/security/ directory for security tests
- [ ] Test SQL injection on all input fields and API endpoints
- [ ] Test XSS on all input fields and URL parameters
- [ ] Test broken access control (accessing other users' data, IDOR)
- [ ] Test authentication (session timeout, token expiration, logout invalidation)
- [ ] Verify CSRF protection on state-changing operations
- [ ] Check security headers (HSTS, CSP, X-Frame-Options)
- [ ] Run npm audit and document/fix vulnerabilities
- [ ] No critical or high vulnerabilities in final assessment
- [ ] Generate security report documenting all tests and results

---

### US-015: Performance Testing

As a system administrator, I want to know the application's performance limits so that I can plan for scaling.

**Acceptance Criteria:**
- [ ] Set up k6 or artillery for load testing
- [ ] Create load test for normal expected usage (baseline)
- [ ] Create load test for peak usage (2x expected)
- [ ] Create stress test to find breaking point
- [ ] Test critical endpoints: login, dashboard, leave request submission, approvals
- [ ] Measure and document p50, p95, p99 response times
- [ ] Document error rates under load
- [ ] Document throughput limits
- [ ] Generate performance report with recommendations

---

### US-016: Smoke Tests

As a DevOps engineer, I want quick deployment verification tests so that I can confirm deployments are successful.

**Acceptance Criteria:**
- [ ] Create tests/smoke/smoke.spec.ts
- [ ] Test: application loads without errors
- [ ] Test: authentication works
- [ ] Test: main pages render for each role
- [ ] Test: API health check endpoint responds
- [ ] Test: database connection is functional
- [ ] Test: can submit and rollback a test request
- [ ] Entire smoke suite runs in under 2 minutes
- [ ] Add pnpm test:smoke script
- [ ] Clear pass/fail output suitable for CI/CD

---

### US-017: Visual Regression Tests

As a developer, I want visual regression tests so that unintended UI changes are caught.

**Acceptance Criteria:**
- [ ] Configure Playwright visual comparison
- [ ] Capture baseline screenshots for all main pages
- [ ] Capture screenshots for different user roles
- [ ] Capture screenshots for mobile viewport
- [ ] Capture screenshots for desktop viewport
- [ ] Visual tests integrated into E2E suite
- [ ] Document process for updating baselines when intentional changes are made
- [ ] Visual tests run in CI

---

### US-018: API Contract Tests

As an API consumer, I want API responses to be consistent so that integrations don't break.

**Acceptance Criteria:**
- [ ] Identify all API endpoints from codebase analysis
- [ ] Create contract tests validating response schemas
- [ ] Test required fields are always present
- [ ] Test correct status codes for success and error cases
- [ ] Test error response format consistency
- [ ] Contract tests integrated into test suite
- [ ] All API endpoints have contract test coverage

---

### US-019: API Documentation with Scalar

As a developer/integrator, I want comprehensive API documentation so that I can understand and use the API.

**Acceptance Criteria:**
- [ ] Create or update openapi.yaml/openapi.json specification
- [ ] Document all API endpoints with path, method, description
- [ ] Document request parameters, body schemas, headers
- [ ] Document response schemas for success and error cases
- [ ] Document authentication requirements for each endpoint
- [ ] Include request/response examples for each endpoint
- [ ] Integrate Scalar UI into application (e.g., /api/docs route)
- [ ] Scalar documentation is accessible and renders correctly
- [ ] Auth flow clearly documented

---

### US-020: Wiki în Română - Ghid de Pornire

As a Romanian-speaking user, I want a getting started guide in Romanian so that I can quickly learn to use the application.

**Acceptance Criteria:**
- [ ] Create docs/wiki/ro/01-ghid-de-pornire.md
- [ ] Write introduction explaining application purpose
- [ ] Document authentication steps with Microsoft
- [ ] Include annotated screenshots of main interface
- [ ] Write step-by-step guide for submitting first leave request
- [ ] Document how to check leave balance
- [ ] Include role-specific first steps for Managers
- [ ] Include role-specific first steps for HR
- [ ] Include role-specific first steps for Executives
- [ ] Use modern professional Romanian ("tu" form)
- [ ] No machine translation - natural Romanian language

---

### US-021: Wiki în Română - Funcționalități

As a Romanian-speaking user, I want feature documentation in Romanian so that I can use all application features.

**Acceptance Criteria:**
- [ ] Create docs/wiki/ro/02-functionalitati.md
- [ ] Document leave management: types, requesting, cancelling, modifying, history
- [ ] Document approval workflow: how it works, approving, rejecting, delegating
- [ ] Document executive peer approval process
- [ ] Document reports: available reports, generating, exporting (CSV, PDF)
- [ ] Document calendar: team calendar, personal calendar, Outlook integration (if exists)
- [ ] Document notifications: types, configuration
- [ ] Include relevant screenshots
- [ ] Step-by-step instructions for each feature
- [ ] Modern professional Romanian throughout

---

### US-022: Wiki în Română - Întrebări Frecvente

As a Romanian-speaking user, I want an FAQ in Romanian so that I can find quick answers to common questions.

**Acceptance Criteria:**
- [ ] Create docs/wiki/ro/03-intrebari-frecvente.md
- [ ] Include minimum 15 questions with answers
- [ ] Cover: password reset, missing requests, modifying submitted requests
- [ ] Cover: manager on leave, balance calculations, balance reset timing
- [ ] Cover: retroactive requests, unused leave carryover
- [ ] Cover: team calendar viewing, delegation setup
- [ ] Cover: rejected request reasons, technical support contact
- [ ] Cover: mobile usage, report export, error handling
- [ ] Clear, helpful answers in natural Romanian
- [ ] Easy-to-search format with clear headings

---

### US-023: Wiki în Română - Depanare

As a Romanian-speaking user, I want a troubleshooting guide in Romanian so that I can resolve common issues myself.

**Acceptance Criteria:**
- [ ] Create docs/wiki/ro/04-depanare.md
- [ ] Document authentication problems and solutions
- [ ] Document request submission problems and solutions
- [ ] Document display/rendering problems and solutions
- [ ] Document performance problems and solutions
- [ ] Include step-by-step troubleshooting instructions
- [ ] Document how to report bugs (what info to include, where to send)
- [ ] Include support contact information
- [ ] Natural Romanian language throughout

---

### US-024: Wiki în Română - Ghid API

As a Romanian-speaking technical user, I want API documentation in Romanian so that I can integrate with the system.

**Acceptance Criteria:**
- [ ] Create docs/wiki/ro/05-ghid-api.md
- [ ] Write API introduction in Romanian
- [ ] Document authentication (how to obtain tokens)
- [ ] List available endpoints with descriptions
- [ ] Include working code examples in cURL, JavaScript, Python
- [ ] Document response codes and error formats
- [ ] Document rate limiting if applicable
- [ ] Include practical examples: check balance, submit request, list pending
- [ ] Technical terms can remain in English with Romanian explanations
- [ ] Code examples are tested and functional

## Functional Requirements

- FR-1: Staging environment must be completely isolated from production (separate database, network, containers)
- FR-2: Test authentication must only work when NODE_ENV=staging
- FR-3: All E2E tests must run against staging environment, never production
- FR-4: Seed data must include all roles and representative scenarios
- FR-5: HR users must be able to switch between HR and personal views without navigation errors
- FR-6: Executive users must land on appropriate pages (not employee-level)
- FR-7: Executive leave requests must route to peer executives for approval
- FR-8: Smoke tests must complete in under 2 minutes
- FR-9: Application must have zero WCAG 2.1 AA accessibility violations
- FR-10: Application must have no critical/high security vulnerabilities
- FR-11: API documentation must be accessible at /api/docs
- FR-12: Romanian documentation must use natural language (not machine translation)

## Non-Goals (Out of Scope)

- Production deployment automation (focus is on staging and testing)
- Azure AD test user provisioning (document approach but don't automate)
- System theme auto-detection for UI
- Mobile native application testing (web responsive only)
- Multi-language support beyond Romanian (English is assumed as default)
- Database migration from current dev/QA to production (separate task)
- CI/CD pipeline setup (tests are designed to be CI-compatible but pipeline not configured)
- Performance optimization beyond identifying bottlenecks

## Technical Considerations

- **Docker**: Use docker-compose override files for staging to keep base config intact
- **Database**: Staging must use separate PostgreSQL instance; never share volumes
- **Authentication**: Test mode via environment variable; must be impossible to enable in production
- **Testing**: Playwright chosen for E2E; supports multiple browsers and visual regression
- **Security**: OWASP Top 10 coverage; npm audit for dependencies
- **Performance**: k6 for load testing; focus on critical paths
- **Documentation**: Scalar for OpenAPI; static markdown for wiki

## Success Metrics

- All 24 user stories completed and verified
- DISCOVERY.md provides complete infrastructure understanding
- Staging environment fully isolated and functional
- All 3 bugs fixed with E2E test coverage
- E2E test coverage for all user roles and main flows
- Zero WCAG 2.1 AA accessibility violations
- Zero critical/high security vulnerabilities
- Performance baseline documented with breaking point identified
- Smoke tests run in under 2 minutes
- Complete API documentation accessible via Scalar
- 5 Romanian wiki documents with comprehensive user guidance

## Priority Order

1. **Phase 0**: US-000 (Discovery) - MUST BE FIRST
2. **Phase 1**: US-001, US-002, US-003, US-004 (Staging Setup)
3. **Phase 2**: US-005, US-006, US-007 (Bug Fixes)
4. **Phase 3**: US-008 through US-018 (Testing)
5. **Phase 4**: US-019 through US-024 (Documentation)

## Open Questions

- What is the current staging port in use (if any) for dev/QA environment?
- Are there existing test accounts in Azure AD, or do they need to be created?
- What is the expected concurrent user load for performance testing baselines?
- Is there an existing OpenAPI specification, or will it be created from scratch?
- What is the support contact email/channel for Romanian documentation?