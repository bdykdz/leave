-- Test: Document Signatures with New Escalation Workflow
-- Scenario: Template has Manager + Director signatures, but only Manager approval required initially

-- 1. Check current template signatures
SELECT 
    ts.id,
    ts."signerRole",
    ts."isRequired",
    ts.label,
    dt.name as template_name
FROM "TemplateSignature" ts
JOIN "DocumentTemplate" dt ON ts."templateId" = dt.id
ORDER BY ts."orderIndex";

-- 2. Check existing leave request and approvals
SELECT 
    lr."requestNumber",
    lr.status as request_status,
    a.level,
    a.status as approval_status,
    a."escalatedToId",
    a."escalatedAt",
    u."firstName" || ' ' || u."lastName" as approver_name,
    u.role as approver_role
FROM "LeaveRequest" lr
LEFT JOIN "Approval" a ON lr.id = a."leaveRequestId"
LEFT JOIN "User" u ON a."approverId" = u.id
ORDER BY lr."createdAt" DESC, a.level;

-- 3. Check if any documents were generated
SELECT 
    gd.id as document_id,
    gd.status as document_status,
    dt.name as template_name,
    lr."requestNumber"
FROM "GeneratedDocument" gd
JOIN "DocumentTemplate" dt ON gd."templateId" = dt.id
JOIN "LeaveRequest" lr ON gd."leaveRequestId" = lr.id;

-- 4. Simulate what happens with current setup:
-- Based on the code analysis:
-- - Employee signature: Always required (requirement.required = true)
-- - Manager signature: Required if user has a manager (requirement.required = !!user.managerId)
-- - Department Director signature: 
--   * For regular employees: Required if they have a department director
--   * BUT can be marked as optional (requirement.required = false) if the same person is signing as manager
--   * After escalation: Would become required when new approval is created

-- 5. Test case: Update a template signature to be optional
-- UPDATE "TemplateSignature" 
-- SET "isRequired" = false 
-- WHERE "signerRole" = 'department_manager';

-- 6. Check company settings for escalation
SELECT key, value, description 
FROM "CompanySetting" 
WHERE category IN ('escalation', 'approval');

-- 7. Simulate an old approval to test escalation
-- UPDATE "Approval" 
-- SET "createdAt" = NOW() - INTERVAL '4 days'
-- WHERE status = 'PENDING' 
-- AND "leaveRequestId" = (SELECT id FROM "LeaveRequest" ORDER BY "createdAt" DESC LIMIT 1);

-- Then run: docker exec leave-management-app /app/scripts/escalation-cron.sh