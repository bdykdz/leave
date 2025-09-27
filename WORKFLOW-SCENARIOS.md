# Leave Management Workflow Scenarios

## Overview

This document defines all possible workflow scenarios, edge cases, and approval flows in the leave management system.

## User Hierarchy

```
EXECUTIVE
    ↓
DEPARTMENT_DIRECTOR
    ↓
MANAGER
    ↓
EMPLOYEE
```

## Standard Workflow Rules

### 1. Regular Employee Workflows

#### Case 1.1: Employee with Manager and Department Director
- **User**: EMPLOYEE role
- **Hierarchy**: Has both managerId and departmentDirectorId
- **Flow**:
  1. Employee submits request → Signs document
  2. Manager reviews → Approves/Rejects with signature
  3. Department Director reviews → Approves/Rejects with signature (if different from manager)
  4. HR processes (optional based on leave type)
- **Document Status**: Complete when all required signatures collected

#### Case 1.2: Employee with Only Manager (No Department Director)
- **User**: EMPLOYEE role
- **Hierarchy**: Has managerId but no departmentDirectorId
- **Flow**:
  1. Employee submits request → Signs document
  2. Manager reviews → Approves/Rejects with signature
  3. HR processes (if required)
- **Document Status**: Complete after manager approval

#### Case 1.3: Employee with No Direct Manager
- **User**: EMPLOYEE role
- **Hierarchy**: No managerId (orphaned employee)
- **Flow**:
  1. Employee submits request → Signs document
  2. HR reviews directly → Approves/Rejects with signature
- **Document Status**: Complete after HR approval
- **Note**: System flags this as irregular hierarchy

### 2. Manager Workflows

#### Case 2.1: Manager with Department Director
- **User**: MANAGER role
- **Hierarchy**: Reports to departmentDirectorId
- **Flow**:
  1. Manager submits request → Signs document
  2. Department Director reviews → Approves/Rejects with signature
  3. HR processes (if required)
- **Document Status**: Complete after director approval

#### Case 2.2: Manager with Executive Above
- **User**: MANAGER role
- **Hierarchy**: departmentDirectorId is an EXECUTIVE
- **Flow**:
  1. Manager submits request → Signs document
  2. Executive reviews → Approves/Rejects with signature
- **Document Status**: Complete after executive approval

#### Case 2.3: Manager - Extended Leave (>5 days)
- **User**: MANAGER role
- **Condition**: totalDays > 5
- **Flow**:
  1. Manager submits request → Signs document
  2. Department Director reviews → Approves/Rejects
  3. HR review required → Approves/Rejects
  4. May require Executive approval for very long leaves
- **Document Status**: Complete after all approvals

### 3. Department Director Workflows

#### Case 3.1: Department Director - Standard Leave
- **User**: DEPARTMENT_DIRECTOR role
- **Hierarchy**: May or may not have a manager above
- **Flow**:
  1. Director submits request → Signs document
  2. If has manager above → Manager approves (rare case)
  3. Otherwise → Executive approval required
- **Document Status**: Complete after executive appro
val

#### Case 3.2: Department Director - Extended Leave (>5 days)
- **User**: DEPARTMENT_DIRECTOR role
- **Condition**: totalDays > 5
- **Flow**:
  1. Director submits request → Signs document
  2. Executive approval required → Approves/Rejects
  3. HR notification sent
- **Document Status**: Complete after executive approval

### 4. Executive Workflows

#### Case 4.1: Executive - Self Approval
- **User**: EXECUTIVE role
- **Special Rule**: Can approve own requests
- **Flow**:
  1. Executive submits request → Signs document as employee
  2. System auto-marks as self-approved (no additional signatures needed)
  3. HR notified for record keeping
- **Document Status**: Complete immediately

#### Case 4.2: Executive with Peer Approval
- **User**: EXECUTIVE role
- **Configuration**: Organization requires peer executive approval
- **Flow**:
  1. Executive submits request → Signs document
  2. Another Executive reviews → Approves/Rejects
  3. HR processes
- **Document Status**: Complete after peer approval

### 5. HR Workflows

#### Case 5.1: HR Employee Request
- **User**: HR role
- **Flow**:
  1. HR employee submits → Signs document
  2. HR Manager reviews → Approves/Rejects
  3. If no HR Manager → Department Director/Executive approves
- **Document Status**: Complete after approval

#### Case 5.2: HR as Final Processor
- **User**: Any role
- **Condition**: HR signature required by policy
- **Flow**:
  1. All management approvals complete
  2. HR reviews for policy compliance
  3. HR signs to finalize
- **Document Status**: Complete after HR signature

## Special Leave Type Workflows

### 6. Sick Leave Workflows

#### Case 6.1: Sick Leave ≤ 3 days
- **Leave Type**: SICK
- **Condition**: totalDays ≤ 3
- **Flow**:
  1. Employee submits with reason → Signs document
  2. Manager notified → Can approve/reject
  3. Auto-approved if no action in 24 hours
  4. Medical certificate optional
- **Document Status**: Auto-complete or manager approval

#### Case 6.2: Sick Leave > 3 days
- **Leave Type**: SICK
- **Condition**: totalDays > 3
- **Flow**:
  1. Employee submits → Signs document
  2. Medical certificate required (uploaded)
  3. Manager reviews → Approves/Rejects
  4. HR validates certificate → Final approval
- **Document Status**: Complete after HR validation

### 7. Emergency Leave

#### Case 7.1: Emergency Leave - Same Day
- **Leave Type**: EMERGENCY
- **Condition**: startDate = today
- **Flow**:
  1. Employee submits → Signs document
  2. Immediate notification to manager
  3. Retroactive approval allowed
  4. HR notified
- **Document Status**: Pending until manager action

### 8. Annual Leave

#### Case 8.1: Annual Leave - Sufficient Balance
- **Leave Type**: ANNUAL
- **Condition**: available balance ≥ requested days
- **Flow**: Standard based on role
- **Special**: Balance automatically deducted upon approval

#### Case 8.2: Annual Leave - Insufficient Balance
- **Leave Type**: ANNUAL
- **Condition**: available balance < requested days
- **Flow**:
  1. System flags insufficient balance
  2. Employee can still submit with justification
  3. Requires additional HR approval
  4. May result in unpaid leave for excess days
- **Document Status**: Requires HR override

## Signature Rules & Edge Cases

### 9. Duplicate Role Prevention

#### Case 9.1: Same Person Multiple Roles
- **Scenario**: Manager is also Department Director
- **Rule**: Person signs only once with highest authority role
- **Example**: If John is both manager and director, he signs once as "Department Director"

#### Case 9.2: Self-Reporting Scenarios
- **Scenario**: Executive is their own manager
- **Rule**: Single signature as "Executive (Self-Approved)"
- **Document**: Shows special notation for self-approval

### 10. Rejection Scenarios

#### Case 10.1: Manager Rejection
- **Action**: Manager rejects request
- **Flow**:
  1. Manager provides rejection reason
  2. Document updated with rejection checkbox ✓
  3. Employee notified immediately
  4. Request status → REJECTED
  5. Document marked as complete (no further signatures)
- **Can Resubmit**: Yes, as new request

#### Case 10.2: Partial Approval
- **Scenario**: Manager approves but Director rejects
- **Flow**:
  1. Document shows manager approval ✓
  2. Document shows director rejection ✓
  3. Overall status → REJECTED
  4. Both decisions preserved in document
- **Audit Trail**: Complete history maintained

### 11. Delegation & Substitution

#### Case 11.1: Manager on Leave
- **Scenario**: Employee's manager is on leave
- **Flow**:
  1. System checks manager's status
  2. If manager has delegate → Routes to delegate
  3. If no delegate → Escalates to department director
  4. Notification sent about escalation
- **Document**: Notes "Approved by delegate" or "Escalated approval"

#### Case 11.2: Substitute Employee Approval
- **Scenario**: Employee designates substitute
- **Flow**:
  1. Employee selects substitute in request
  2. Substitute receives notification
  3. Substitute must acknowledge (not approve/reject)
  4. Managers still perform normal approval
- **Document**: Shows substitute acknowledgment separately

## Workflow Configuration Rules

### 12. Priority-Based Rule Evaluation

Rules are evaluated in priority order (highest first):

1. **Priority 100**: Executive rules
2. **Priority 90**: Department Director extended leave
3. **Priority 80**: Manager extended leave
4. **Priority 70**: Employee extended leave
5. **Priority 60**: Sick leave special rules
6. **Priority 10**: Standard employee leave
7. **Priority 0**: Default catch-all rule

### 13. Conditional Approvals

#### Case 13.1: Days-Based Escalation
- **Condition**: totalDays > X
- **Rules**:
  - ≤ 3 days: Manager only
  - 4-10 days: Manager + Director
  - 11-20 days: Manager + Director + HR
  - > 20 days: All above + Executive

#### Case 13.2: Department-Based Rules
- **Condition**: Specific departments
- **Example**: 
  - Finance dept: Always requires CFO approval
  - IT dept: CTO approval for > 5 days
  - Sales: Regional manager approval required

## Document Generation Rules

### 14. Template Snapshot Behavior

#### Case 14.1: Template Updated After Request
- **Scenario**: Admin updates template after document generated
- **Behavior**: 
  - Existing documents use snapshot (unchanged)
  - New requests use updated template
  - Version tracking maintained

#### Case 14.2: Field Mapping Changes
- **Scenario**: Admin changes field positions
- **Behavior**:
  - In-progress documents continue with old layout
  - Completed documents remain unchanged
  - Only new requests affected

### 15. Decision Checkboxes

Each role has two checkboxes in the document:
- **Approved ✓**: Green checkmark when approved
- **Rejected ✓**: Red checkmark when rejected

Only one can be checked per role.

## Notification Rules

### 16. Notification Triggers

1. **Request Submitted**: Manager notified
2. **Approval Required**: Next approver notified
3. **Request Approved**: Employee notified, next approver notified
4. **Request Rejected**: Employee notified immediately
5. **Document Complete**: All parties receive final document
6. **Escalation**: When approval escalated due to absence

## Special Organization Configurations

### 17. Flat Organizations

#### Case 17.1: No Middle Management
- **Structure**: Employees → Executive
- **Flow**: 
  1. Employee submits
  2. Executive approves
  3. HR processes
- **Configuration**: Set all employees' managerId = executiveId

### 18. Matrix Organizations

#### Case 18.1: Dual Reporting
- **Structure**: Employee has project manager + functional manager
- **Flow**:
  1. Employee submits
  2. Both managers must approve (parallel)
  3. Department director reviews
- **Configuration**: Custom workflow rule with multiple approvers

## Error Handling & Recovery

### 19. Incomplete Hierarchies

#### Case 19.1: Missing Manager
- **Detection**: System identifies orphaned employees
- **Handling**: Routes to HR with warning flag
- **Resolution**: Admin must fix hierarchy

#### Case 19.2: Circular Reporting
- **Detection**: A reports to B, B reports to A
- **Handling**: System prevents infinite loops
- **Resolution**: Escalates to system admin

### 20. System Constraints

1. **Maximum Approval Levels**: 5 (configurable)
2. **Signature Timeout**: None (requests remain pending)
3. **Document Retention**: Permanent (audit requirement)
4. **Resubmission**: Allowed after rejection
5. **Withdrawal**: Allowed before first approval

## Integration Points

### 21. External Systems

1. **Calendar Integration**: Approved leaves sync to calendar
2. **Payroll Integration**: Approved unpaid leaves flagged
3. **Email Notifications**: All parties notified at each step
4. **Mobile Approval**: Managers can approve via mobile
5. **Audit System**: All actions logged with timestamp

This comprehensive documentation covers all implemented workflow scenarios and edge cases in the leave management system.