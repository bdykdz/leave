#!/bin/bash

echo "=== Testing Document Generation with Current Signature Configuration ==="
echo ""

# First, let's get a leave request ID
echo "1. Finding existing leave request..."
LEAVE_REQUEST_ID=$(docker exec leave-management-db psql -U postgres -d leavemanagement -t -c "SELECT id FROM \"LeaveRequest\" ORDER BY \"createdAt\" DESC LIMIT 1;" | tr -d ' ')

if [ -z "$LEAVE_REQUEST_ID" ]; then
    echo "No leave request found. Please create one through the UI first."
    exit 1
fi

echo "Found leave request ID: $LEAVE_REQUEST_ID"
echo ""

# Check if document already exists
echo "2. Checking if document already exists..."
DOC_EXISTS=$(docker exec leave-management-db psql -U postgres -d leavemanagement -t -c "SELECT COUNT(*) FROM \"GeneratedDocument\" WHERE \"leaveRequestId\" = '$LEAVE_REQUEST_ID';" | tr -d ' ')

if [ "$DOC_EXISTS" -gt "0" ]; then
    echo "Document already exists for this leave request."
    DOCUMENT_ID=$(docker exec leave-management-db psql -U postgres -d leavemanagement -t -c "SELECT id FROM \"GeneratedDocument\" WHERE \"leaveRequestId\" = '$LEAVE_REQUEST_ID';" | tr -d ' ')
    echo "Document ID: $DOCUMENT_ID"
else
    echo "No document exists. Generating one..."
    echo ""
    
    # Generate document via API
    echo "3. Calling document generation API..."
    
    # We need to get a session token first. For testing, let's check who created the leave request
    USER_EMAIL=$(docker exec leave-management-db psql -U postgres -d leavemanagement -t -c "SELECT u.email FROM \"LeaveRequest\" lr JOIN \"User\" u ON lr.\"userId\" = u.id WHERE lr.id = '$LEAVE_REQUEST_ID';" | tr -d ' ')
    
    echo "Leave request created by: $USER_EMAIL"
    echo ""
    echo "To generate the document, you'll need to:"
    echo "1. Log in to http://localhost:3000 as $USER_EMAIL"
    echo "2. Use the browser's developer tools to get your session token from cookies"
    echo "3. Run this curl command with your session token:"
    echo ""
    echo "curl -X POST http://localhost:3000/api/documents/generate \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -H 'Cookie: next-auth.session-token=YOUR_SESSION_TOKEN' \\"
    echo "  -d '{\"leaveRequestId\": \"$LEAVE_REQUEST_ID\"}'"
    echo ""
fi

# Show current signature requirements
echo "4. Checking signature requirements..."
echo ""
docker exec leave-management-db psql -U postgres -d leavemanagement -c "
SELECT 
    ts.\"signerRole\" as role,
    ts.\"isRequired\" as required_by_template,
    ts.label,
    CASE 
        WHEN ds.id IS NOT NULL THEN 'Signed by ' || u.\"firstName\" || ' ' || u.\"lastName\"
        ELSE 'Not signed'
    END as status
FROM \"TemplateSignature\" ts
LEFT JOIN \"GeneratedDocument\" gd ON gd.\"leaveRequestId\" = '$LEAVE_REQUEST_ID'
LEFT JOIN \"DocumentSignature\" ds ON ds.\"documentId\" = gd.id AND ds.\"signerRole\" = ts.\"signerRole\"
LEFT JOIN \"User\" u ON ds.\"signerId\" = u.id
JOIN \"DocumentTemplate\" dt ON ts.\"templateId\" = dt.id
WHERE dt.\"isActive\" = true
ORDER BY ts.\"orderIndex\";
"

echo ""
echo "5. Checking approval workflow status..."
docker exec leave-management-db psql -U postgres -d leavemanagement -c "
SELECT 
    a.level,
    u.\"firstName\" || ' ' || u.\"lastName\" as approver,
    u.role as approver_role,
    a.status,
    a.\"escalatedToId\" IS NOT NULL as was_escalated,
    a.\"createdAt\"
FROM \"Approval\" a
JOIN \"User\" u ON a.\"approverId\" = u.id
WHERE a.\"leaveRequestId\" = '$LEAVE_REQUEST_ID'
ORDER BY a.level;
"