# Approval Delegation — Bug Diagnosis & Fix Plan

> **Status:** ✅ ADDITIVE behavior IMPLEMENTED 2026-05-25 (commit on
> `feature/ralph-comprehensive-update`). Type-clean. Not yet manually tested / deployed.
> **Decision:** when A delegates to B, B also sees A's pending approvals, can
> approve/deny them, and is notified. A keeps full access. (Not a reroute.)
>
> ## What was implemented
> - `lib/services/delegation-service.ts` — active-window helper (null-aware endDate):
>   `getActiveDelegatorIdsFor`, `getActiveDelegateIdsFor`, `isActiveDelegateOf`.
> - `validation-service.ts` + `wfh-validation-service.ts` — optional `delegatorIds`
>   param; a delegate counts as in the approval chain / authorized.
> - `pending-approvals/route.ts` — queries widened to `approverId/managerId IN [me + active delegators]`;
>   each item gets `onBehalfOf` (delegator name) when surfaced via delegation.
> - `approve-request` + `deny-request` (leave, WFH, work-trip) — delegate auth added;
>   delegate **takes over the delegator's pending approval slot**, reassigns it to the
>   real actor, and tags the comment `[Aprobat/Respins ca delegat]`.
> - New-request notifications (`leave-requests`, `wfh-requests`, `work-trip-requests`)
>   now ALSO notify active delegates (additive).
> - `escalation-service.findDelegate` — open-ended (`endDate: null`) delegations fixed.
> - Manager dashboard pending lists — purple "for {name}" badge (`onBehalfOf`); new
>   `delegation` i18n namespace (EN/RO).
>
> ## Remaining (lower priority, NOT done)
> - Dead duplicate route `app/api/manager/delegation/` (singular) — unused by the UI
>   (confirmed zero client refs) and has its own pre-existing TS errors. Safe to delete;
>   left in place pending an explicit ok.
> - `PUT /api/manager/delegations/[id]` still lacks the overlap check that POST has.
> - `DelegationManager.tsx` date "picker" buttons still set canned dates (cosmetic).
> - Executive approval route (`app/api/executive/...`) not made delegation-aware (out of scope).

## 1. TL;DR — why it "doesn't really work"

Delegation records are **created/managed by the UI but never consulted in the normal
approval path.** When A delegates to B:
- the request still goes to A only,
- only A sees it in their pending list,
- only A is notified,
- **B literally cannot approve it** (authorization doesn't recognize delegation).

The **only** code that reads `ApprovalDelegate` is `escalation-service.findDelegate()`,
and it only fires in an edge case (approver is *absent* **and** the request already
stalled ~3 days). Even then it has a bug (see §4).

## 2. Data model

`prisma/schema.prisma` (~lines 327–342):

```prisma
model ApprovalDelegate {
  id          String    @id @default(cuid())
  delegatorId String              // the manager handing off duties (A)
  delegateId  String              // the person receiving duties (B)
  startDate   DateTime
  endDate     DateTime?           // null = indefinite
  reason      String?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  delegator   User @relation("DelegatorRelation", fields: [delegatorId], references: [id], onDelete: Cascade)
  delegate    User @relation("DelegateRelation",  fields: [delegateId],  references: [id], onDelete: Cascade)
  @@unique([delegatorId, delegateId, startDate])
}
```
User back-relations: `delegatorRelations` / `delegateRelations` (~schema lines 75–76).

**"Active" means:** `isActive == true && startDate <= now && (endDate == null || endDate >= now)`.
No schema change is required for the fix.

## 3. File inventory

**UI**
- `components/manager/DelegationManager.tsx` — rendered in Manager dashboard "Delegation" tab.
  Fetches `GET /api/manager/delegations` and `GET /api/manager/available-delegates`.
  Create → `POST /api/manager/delegations` (body `{ delegateToId, startDate, endDate|null, reason? }`),
  Edit → `PUT /api/manager/delegations/[id]`, Toggle → `POST /api/manager/delegations/[id]/toggle`,
  Delete → `DELETE /api/manager/delegations/[id]`.
  Minor UI bugs: the "calendar" buttons just set fixed dates (tomorrow/next week) instead of opening a real date picker.

**API (current/new — used by UI)**
- `app/api/manager/delegations/route.ts` — GET (all delegations for delegator, no date filter), POST (has overlap check for active dates).
- `app/api/manager/delegations/[delegationId]/route.ts` — PUT (no overlap check), DELETE (hard delete).
- `app/api/manager/delegations/[delegationId]/toggle/route.ts` — POST (flips isActive; when activating, deactivates other active ones for that delegator).
- `app/api/manager/available-delegates/route.ts` — GET eligible delegates (MANAGER/HR/EXECUTIVE/ADMIN, active, same-dept first).

**API (OLD — duplicate, NOT used by current UI; consolidate/remove)**
- `app/api/manager/delegation/route.ts` — older variant: GET filters `endDate >= now`, POST validates `start<end & start>=today`, DELETE soft-deletes (`isActive=false`). Divergent logic from the new route.

**Approval path that must START honoring delegation (currently does NOT — grep for "delegat" returns nothing here):**
- `app/api/manager/team/pending-approvals/route.ts`
- `app/api/manager/team/approve-request/[requestId]/route.ts`
- `app/api/manager/team/deny-request/[requestId]/route.ts`

**Only existing consumer**
- `lib/services/escalation-service.ts` → `findDelegate()` (~lines 393–443), called by
  `getNextAvailableApprover()` (~496) and `processNewLeaveRequest()` (~805).

## 4. Concrete bugs

1. **Delegation ignored in normal flow** (the big one): `pending-approvals`, `approve-request`,
   `deny-request` only consider `approverId == me` or `managerId == me`. No delegation awareness.
2. **Open-ended delegations broken in escalation** — `escalation-service.ts:399`
   `endDate: { gte: new Date() }` excludes `endDate: null`. Fix to
   `OR: [{ endDate: null }, { endDate: { gte: new Date() } }]`.
3. **Two competing route trees** — `/api/manager/delegation` (old) vs `/api/manager/delegations` (new).
4. **PUT has no overlap check** while POST does → editing can create overlapping active delegations.
5. **No server-side "is it active now" gating** — `GET /delegations` returns all records; "active" is
   only computed client-side in the dashboard.
6. **Date-picker UI is fake** — buttons set canned dates instead of letting the user choose.

## 5. Implementation plan (ADDITIVE behavior: "B also sees + can approve")

### 5.1 New shared helper — `lib/services/delegation-service.ts`
```ts
// "active" = isActive && startDate <= now && (endDate == null || endDate >= now)
getActiveDelegatorIdsFor(delegateId): Promise<string[]>   // whose duties can I act on right now?
getActiveDelegateIdsFor(delegatorId): Promise<string[]>   // who is covering for me right now?
isActiveDelegateOf(delegateId, delegatorId): Promise<boolean>
```
Use the OR-null endDate predicate everywhere (fixes bug #2 by construction).

### 5.2 `pending-approvals/route.ts`
- Compute `actAsIds = [me, ...getActiveDelegatorIdsFor(me)]`.
- Change the `approverId: me` filters → `approverId: { in: actAsIds }`.
- Change the direct-report fallback `user.managerId: me` → `user.managerId: { in: actAsIds }`.
- In the response item, add `onBehalfOf` (delegator name) when the approver != me, so the UI can badge "for A".

### 5.3 `approve-request/[requestId]/route.ts` and `deny-request/[requestId]/route.ts`
- Current auth (approve-request ~lines 116–123) allows manager/director/assigned approver.
- Add: also authorized if `isActiveDelegateOf(me, <pendingApproverId>)` **or**
  `isActiveDelegateOf(me, requestOwner.managerId)`.
- When recording the approval, keep `approverId = me` but set `comments`/audit note like
  "approved on behalf of A (delegation)". Check the Approval model for an existing field; if none,
  prepend to `comments` and write an `AuditLog` entry.

### 5.4 Notifications
- Wherever a new pending-approval notification is sent to the approver (check
  `escalation-service.processNewLeaveRequest` and any notification on request submit / WFH / work-trip),
  also notify `getActiveDelegateIdsFor(approverId)`. Additive — notify BOTH A and B.

### 5.5 Escalation fix
- `escalation-service.ts:findDelegate()` — replace `endDate: { gte: new Date() }` with the
  null-aware OR predicate (use the helper).

### 5.6 Route consolidation
- Make `/api/manager/delegations` authoritative. Either delete `app/api/manager/delegation/`
  or have it re-export/redirect. Add the missing overlap check to PUT. Consider switching DELETE to
  soft-delete (isActive=false) for audit consistency, or keep hard delete — pick one and document.

### 5.7 (Optional, lower priority) UI polish
- Replace the fake date buttons in `DelegationManager.tsx` with the real `Calendar`/`Popover`
  date picker (`components/ui/calendar.tsx` exists).
- Badge delegated requests in the pending list using the new `onBehalfOf` field.

### 5.8 Apply to WFH & Work Trip too
- The same three concerns (pending list, approve/deny auth, notify) exist for WFH
  (`wfh-pending`, WFH approve/deny) and work-trip endpoints. Mirror the leave changes there.

## 6. Test checklist
- A delegates to B (active window incl. an open-ended one). Employee of A submits leave.
  - [ ] B sees it in pending (badged "for A"); A still sees it.
  - [ ] B can approve; approval recorded with on-behalf note; balances update correctly.
  - [ ] B can deny (mandatory comment path still enforced).
  - [ ] Both A and B receive the notification.
- Delegation expired / isActive=false → B no longer sees or can act.
- Open-ended delegation (endDate null) is treated as active (regression test for bug #2).
- WFH + Work Trip behave the same.
- Old `/api/manager/delegation` no longer diverges (or is gone).

## 7. Deploy note
Production = `docker-compose.production.yml`, service `app-production`
(container `leave-management-app-production`, behind reverse proxy on 127.0.0.1:8083).
Redeploy **app only, no DB/Redis/MinIO**:
```bash
docker compose -f docker-compose.production.yml up -d --build --no-deps app-production
```
`--no-deps` is essential — it prevents recreating db/redis/minio.
