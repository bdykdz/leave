import { prisma } from "@/lib/prisma"

/**
 * Approval delegation helper.
 *
 * A delegation is "active right now" when:
 *   isActive === true && startDate <= now && (endDate == null || endDate >= now)
 *
 * The null-aware endDate predicate is intentional — open-ended delegations
 * (endDate == null) must count as active. (This was the long-standing bug in
 * escalation-service.findDelegate, which used `endDate: { gte: now }` and
 * silently dropped indefinite delegations.)
 */
function activeWindow() {
  const now = new Date()
  return {
    isActive: true,
    startDate: { lte: now },
    OR: [{ endDate: null }, { endDate: { gte: now } }],
  }
}

export class DelegationService {
  /** Delegators whose approval duties `delegateId` is allowed to act on right now. */
  static async getActiveDelegatorIdsFor(delegateId: string): Promise<string[]> {
    if (!delegateId) return []
    const rows = await prisma.approvalDelegate.findMany({
      where: { delegateId, ...activeWindow() },
      select: { delegatorId: true },
    })
    return Array.from(new Set(rows.map((r) => r.delegatorId)))
  }

  /** People currently covering for `delegatorId` (i.e. the delegator's active delegates). */
  static async getActiveDelegateIdsFor(delegatorId: string): Promise<string[]> {
    if (!delegatorId) return []
    const rows = await prisma.approvalDelegate.findMany({
      where: { delegatorId, ...activeWindow() },
      select: { delegateId: true },
    })
    return Array.from(new Set(rows.map((r) => r.delegateId)))
  }

  /** Is `delegateId` an active delegate of `delegatorId` right now? */
  static async isActiveDelegateOf(
    delegateId: string,
    delegatorId: string | null | undefined,
  ): Promise<boolean> {
    if (!delegateId || !delegatorId) return false
    const row = await prisma.approvalDelegate.findFirst({
      where: { delegateId, delegatorId, ...activeWindow() },
      select: { id: true },
    })
    return !!row
  }
}
