# Director Signature Scenarios

## When Director Signs After Escalation

### Scenario 1: Manager Didn't Respond → Escalated to Director

**What happens:**
1. Leave request created → Manager approval required
2. Manager doesn't act for 3 days
3. System escalates to Department Director
4. Director receives notification

**Director's signature requirements:**
- Director signs ONLY as Department Director
- Manager signature box remains empty (manager never signed)
- The original manager approval is marked as "escalated"
- Director does NOT need to sign twice

**Document state:**
- Employee signature: ✓ Signed
- Manager signature: ✗ Empty (escalated)
- Director signature: ✓ Signed by Director

### Scenario 2: Different People as Manager and Director

**Example:** 
- Employee: John
- Manager: Sarah
- Department Director: Mike

**Normal flow (no escalation):**
1. John submits request
2. Sarah (manager) approves and signs
3. Request is complete (director signature not required initially)

**If escalated:**
1. John submits request
2. Sarah doesn't respond for 3 days
3. Escalates to Mike (director)
4. Mike signs as director only
5. Sarah's signature remains empty

### Scenario 3: Same Person is Manager AND Director

**Example:**
- Employee: John  
- Manager: Mike (who is also Department Director)

**What the code does (line 182-188 in document-generator.ts):**
```javascript
} else if (user.role === 'DEPARTMENT_DIRECTOR') {
    // If they are the department director, they don't need to sign again
    // unless they have a higher department director
    if (user.departmentDirectorId && user.departmentDirectorId !== user.id) {
        requirement.signerId = user.departmentDirectorId;
    } else {
        requirement.required = false; // Already signing as manager
    }
}
```

**Result:**
- Mike signs ONCE as manager
- Director signature is marked as "not required" to avoid duplicate
- Document shows only one signature from Mike

## Key Points

### 1. **No Double Signing Required**
The system prevents the same person from signing twice:
- If someone is both manager and director, they sign once
- The second signature box is automatically marked as optional/not required

### 2. **Escalation Creates New Approval**
When escalated:
- Original approval remains but is marked as "escalated"
- NEW approval record created for the higher authority
- Higher authority signs in their role only

### 3. **Document Completion Rules**
Document is complete when:
- All REQUIRED signatures are collected
- System automatically adjusts requirements to avoid duplicates
- Escalated approvals replace the original requirement

## Testing Different Scenarios

```sql
-- Check who is manager and director for users
SELECT 
    u.id,
    u."firstName" || ' ' || u."lastName" as employee_name,
    u.role,
    m."firstName" || ' ' || m."lastName" as manager_name,
    d."firstName" || ' ' || d."lastName" as director_name,
    CASE 
        WHEN u."managerId" = u."departmentDirectorId" THEN 'Same Person'
        ELSE 'Different People'
    END as manager_director_relationship
FROM "User" u
LEFT JOIN "User" m ON u."managerId" = m.id
LEFT JOIN "User" d ON u."departmentDirectorId" = d.id
WHERE u."isActive" = true;

-- Check escalation scenarios
SELECT 
    a.id,
    a.level,
    a.status,
    a."escalatedToId",
    a."escalationReason",
    approver."firstName" || ' ' || approver."lastName" as original_approver,
    escalated."firstName" || ' ' || escalated."lastName" as escalated_to
FROM "Approval" a
LEFT JOIN "User" approver ON a."approverId" = approver.id
LEFT JOIN "User" escalated ON a."escalatedToId" = escalated.id
WHERE a."escalatedToId" IS NOT NULL;
```

## Summary

**No, the director does NOT need to sign as manager too.** The system handles this intelligently:

1. **Different people**: Each signs in their own role when required
2. **Same person**: Signs once, system marks other signature as not required
3. **After escalation**: Director signs only as director, manager signature can remain empty

This prevents confusion and duplicate signatures while maintaining a clear audit trail of who approved what and when.