# Document Signature Behavior with Current Configuration

## Current Setup Analysis

### Template Configuration
The template "CERERE CO" has 3 signature boxes:
1. **Employee Signature** - Required (always)
2. **Manager Signature** - Required 
3. **Department Manager Signature** - Required (but this will be adjusted by the system)

### Approval Workflow
With our new configuration:
- Only **Manager approval** is required initially
- After 3 days, escalates to **Department Director**

## What Happens in Practice

### 1. When Document is Generated

The `determineSignatureRequirements()` method adjusts the template requirements based on the actual user hierarchy:

```
For a regular employee:
- Employee signature: Required = true, signerId = employee's ID
- Manager signature: Required = true (if employee has a manager), signerId = manager's ID  
- Department Director signature: Required = true (if employee has a department director), signerId = director's ID
```

**BUT** - The system is smart about duplicate signatures. If the manager and department director are the same person, it will mark the department director signature as `required = false` to avoid double signing.

### 2. Initial State (Before Any Approvals)

When the leave request is created:
- Document shows 3 signature boxes
- Employee can sign immediately
- Manager signature box is empty (waiting)
- Department Director signature box is empty (may show as "Optional" if not in current workflow)

### 3. After Manager Approves

When the manager approves and signs:
- Manager signature box shows the signature with timestamp
- Department Director box remains empty
- Document status depends on whether director signature is marked as required

**Key Point**: The template has `isRequired = true` for department_director, but the system can override this based on:
- Whether the user actually has a department director
- Whether it would create a duplicate signature
- Whether the director is part of the current approval workflow

### 4. After Escalation (3 days later)

When escalation occurs:
- New approval record created for Department Director
- Director can now access and sign the document
- The previously "optional" director signature becomes active
- Document completes only after director signs

## Testing the Behavior

To see this in action:

```bash
# 1. Create a test leave request through the UI
# Note which signatures are shown and their status

# 2. Check the generated document status
docker exec leave-management-db psql -U postgres -d leavemanagement -c "SELECT gd.status, gd.\"createdAt\" FROM \"GeneratedDocument\" gd ORDER BY gd.\"createdAt\" DESC LIMIT 1;"

# 3. Simulate an old approval to trigger escalation
docker exec leave-management-db psql -U postgres -d leavemanagement -c "UPDATE \"Approval\" SET \"createdAt\" = NOW() - INTERVAL '4 days' WHERE status = 'PENDING' LIMIT 1;"

# 4. Run escalation
docker exec leave-management-app /app/scripts/escalation-cron.sh

# 5. Check for new approval record
docker exec leave-management-db psql -U postgres -d leavemanagement -c "SELECT * FROM \"Approval\" WHERE \"escalatedToId\" IS NOT NULL;"
```

## Configuration Options

### Option 1: Make Director Signature Always Optional
```sql
UPDATE "TemplateSignature" 
SET "isRequired" = false 
WHERE "signerRole" = 'department_manager';
```

### Option 2: Remove Director from Template
Use the template designer to remove the department director signature box entirely if you never want it shown.

### Option 3: Keep Current Setup
The current setup is actually flexible:
- Shows all possible signers on the document
- Only requires signatures from those in the active workflow
- Automatically handles escalation cases

## Summary

The system intelligently handles the mismatch between template signatures and workflow requirements:
1. Templates can have more signature boxes than required approvals
2. The system marks signatures as optional/required based on actual workflow
3. Escalation can activate previously optional signatures
4. No document breaks if workflow has fewer approvers than template expects

This design allows one template to work for multiple scenarios without modification.