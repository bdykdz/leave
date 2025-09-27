# Testing Document Signatures with New Escalation Workflow

## Scenario: Template with Manager + Director signatures, but only Manager approval required

### Current Configuration:
- **Approval Workflow**: Only requires Manager approval initially
- **Document Template**: Has signature boxes for both Manager and Department Director
- **Escalation**: After 3 days, escalates to Department Director

### Test Steps:

1. **Create a Leave Request**
   - Employee submits leave request
   - System generates document with both Manager and Director signature boxes
   - Only Manager approval is created in the approval workflow

2. **Initial State**
   - Manager signature box: Required (waiting for signature)
   - Director signature box: Shows as "Optional" or empty (depending on template settings)
   - Document status: PENDING_SIGNATURES

3. **Manager Approves**
   - Manager signs the document
   - Manager signature box: Shows signature with timestamp
   - Director signature box: Still shows as "Optional" or empty
   - Document status: Could be COMPLETED if director signature is optional

4. **If Escalation Occurs** (after 3 days)
   - New approval record created for Department Director
   - Director signature box: Changes from "Optional" to "Required"
   - Document status: Remains PENDING_SIGNATURES
   - Director can now sign the document

### Expected Behavior:

Based on the code analysis, the system will:

1. **Check Signature Requirements** (`determineSignatureRequirements()`)
   - Looks at user hierarchy
   - If user has both manager and director, both signatures may be required
   - If director signature is marked as `isRequired: false` in template, it remains optional

2. **Render Empty Signature Boxes**
   - Director signature box will be rendered but empty
   - May show "(Optional)" label if not required
   - Box remains clickable only if user has permission

3. **Document Completion**
   - If director signature is optional: Document completes after manager signs
   - If director signature is required: Document waits for escalation or manual director approval

### Testing Commands:

```bash
# 1. Check current workflow rules
docker exec -it leave-management-db psql -U postgres -d leavemanagement -c "SELECT name, conditions, approvalLevels FROM \"WorkflowRule\" WHERE isActive = true ORDER BY priority DESC;"

# 2. Check template signature requirements
docker exec -it leave-management-db psql -U postgres -d leavemanagement -c "SELECT id, signerRole, isRequired, label FROM \"TemplateSignature\" ORDER BY orderIndex;"

# 3. After creating a leave request, check approvals
docker exec -it leave-management-db psql -U postgres -d leavemanagement -c "SELECT lr.requestNumber, a.level, u.firstName, u.lastName, a.status FROM \"Approval\" a JOIN \"LeaveRequest\" lr ON a.leaveRequestId = lr.id JOIN \"User\" u ON a.approverId = u.id ORDER BY lr.createdAt DESC LIMIT 5;"

# 4. Check document signature status
docker exec -it leave-management-db psql -U postgres -d leavemanagement -c "SELECT ds.signerRole, ds.signedAt, u.firstName, u.lastName FROM \"DocumentSignature\" ds JOIN \"User\" u ON ds.signerId = u.id JOIN \"GeneratedDocument\" gd ON ds.documentId = gd.id ORDER BY gd.createdAt DESC LIMIT 5;"
```

### Configuration Options:

To adjust behavior, you can:

1. **Make Director Signature Always Optional**
   ```sql
   UPDATE "TemplateSignature" 
   SET "isRequired" = false 
   WHERE "signerRole" = 'department_director';
   ```

2. **Update Workflow to Include Director Initially**
   ```sql
   UPDATE "WorkflowRule" 
   SET "approvalLevels" = '[{"role": "employee", "required": true}, {"role": "manager", "required": true}, {"role": "department_director", "required": false}]'
   WHERE "name" = 'Standard Employee Leave';
   ```

3. **Remove Director Signature from Template**
   - Use the template designer to remove the director signature box entirely