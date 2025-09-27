# Leave Request Escalation Setup

## Overview

The leave management system now supports automatic escalation of pending approvals. When a leave request remains unapproved for a configurable number of days, it automatically escalates to the next level of authority.

## Escalation Flow

1. **Employee** submits leave request → Goes to **Direct Manager**
2. If manager doesn't act within X days → Escalates to **Department Director**
3. If director doesn't act within X days → Escalates to **Executive**

## Configuration

The escalation feature is controlled by three settings in the database:

### Company Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `escalationDaysBeforeAutoApproval` | 3 | Number of days before escalating to next level |
| `escalationEnabled` | true | Enable/disable automatic escalation |
| `requireSignatureForDenial` | false | Whether denials require digital signature |

### Updating Settings

To update these settings, use the database directly or create an admin interface:

```sql
-- Update escalation days
UPDATE "CompanySetting" 
SET value = 5 
WHERE key = 'escalationDaysBeforeAutoApproval';

-- Disable escalation
UPDATE "CompanySetting" 
SET value = false 
WHERE key = 'escalationEnabled';
```

## Setting Up Automatic Escalation

The system provides a cron endpoint that should be called daily to check for pending approvals that need escalation.

### 1. Environment Variable

Add a secret to your `.env` file to secure the cron endpoint:

```env
CRON_SECRET=your-secure-random-string-here
```

### 2. Cron Job Setup Options

#### Option A: Using Vercel Cron (Recommended for Vercel deployments)

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/escalation",
    "schedule": "0 0 * * *"
  }]
}
```

#### Option B: Using External Cron Service

Use services like:
- **Cron-job.org** (free)
- **EasyCron**
- **Cronitor**
- **AWS CloudWatch Events**

Configure them to call:
```
GET https://yourdomain.com/api/cron/escalation
Headers: Authorization: Bearer your-secure-random-string-here
```

#### Option C: Using System Cron (Self-hosted)

Add to crontab:
```bash
# Run daily at midnight
0 0 * * * curl -H "Authorization: Bearer your-secure-random-string-here" https://yourdomain.com/api/cron/escalation
```

#### Option D: Manual Trigger (for testing)

HR/Admin users can manually trigger escalation check:
```
POST /api/escalation/check
```

## Testing Escalation

1. Create a test leave request
2. Wait for the configured number of days OR manually update the `createdAt` field in the database
3. Run the escalation check
4. Verify the approval has been escalated

## Monitoring

The escalation service logs:
- Number of approvals found for escalation
- Success/failure of each escalation
- Reasons why escalation might fail (no higher authority, etc.)

Check application logs for escalation activity.

## Notifications

When escalation occurs:
1. The new approver receives a notification
2. The employee is notified that their request has been escalated
3. The original approval record is updated with escalation information

## Database Changes

The following fields track escalation:

```prisma
model Approval {
  // ... existing fields ...
  
  // Escalation tracking
  escalatedToId     String?   // User ID it was escalated to
  escalatedTo       User?     // User relation
  escalatedAt       DateTime? // When it was escalated
  escalationReason  String?   // Why it was escalated
}
```

## Troubleshooting

### Escalation not working?

1. Check if `escalationEnabled` is true in company settings
2. Verify the cron job is running (check logs)
3. Ensure users have proper hierarchy (manager → department director → executive)
4. Check that the approval is old enough (meets `escalationDaysBeforeAutoApproval`)

### No one to escalate to?

- Ensure department directors are assigned to users
- Ensure at least one active EXECUTIVE role user exists
- Check that users have proper `departmentDirectorId` set

### Manual escalation

Admin users can manually update approvals in the database if needed:

```sql
-- Manually escalate an approval
UPDATE "Approval" 
SET 
  "escalatedToId" = 'new-approver-user-id',
  "escalatedAt" = NOW(),
  "escalationReason" = 'Manually escalated by admin'
WHERE id = 'approval-id';
```