import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LeaveRolloverService } from '@/lib/services/leave-rollover-service'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    leaveBalance: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    leaveType: { findUnique: vi.fn(), findFirst: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/services/audit-service', () => ({
  AuditService: { log: vi.fn().mockResolvedValue(undefined) },
}))

const mockFindMany = prisma.leaveBalance.findMany as unknown as ReturnType<typeof vi.fn>

function balance(over: Record<string, unknown> = {}, typeOver: Record<string, unknown> = {}, active = true) {
  return {
    id: 'bal1',
    userId: 'u1',
    leaveTypeId: 'lt1',
    year: 2025,
    entitled: 21,
    used: 0,
    pending: 0,
    carriedForward: 0,
    leaveType: {
      id: 'lt1',
      name: 'Normal Leave',
      code: 'NL',
      carryForward: true,
      maxCarryForward: 5,
      daysAllowed: 21,
      ...typeOver,
    },
    user: {
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pop',
      employeeId: 'E001',
      isActive: active,
    },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LeaveRolloverService.calculateYearEndRollover', () => {
  it('caps carry-forward at maxCarryForward and reports the excess as lost', async () => {
    mockFindMany.mockResolvedValue([balance({ used: 10 })])

    const results = await LeaveRolloverService.calculateYearEndRollover(2025)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      unused: 11, // 21 - 10
      carriedForward: 5,
      lost: 6,
      reason: 'Exceeded maximum carry forward limit of 5 days',
    })
  })

  it('carries the full unused balance when it is under the cap', async () => {
    mockFindMany.mockResolvedValue([balance({ used: 18 })])

    const results = await LeaveRolloverService.calculateYearEndRollover(2025)

    expect(results[0]).toMatchObject({
      unused: 3,
      carriedForward: 3,
      lost: 0,
      reason: 'Full unused balance carried forward',
    })
  })

  it('reserves pending days: they are not available for carry-forward', async () => {
    mockFindMany.mockResolvedValue([balance({ used: 10, pending: 8 })])

    const results = await LeaveRolloverService.calculateYearEndRollover(2025)

    // unused = max(0, 21 + 0 - 10 - 8) = 3
    expect(results[0].unused).toBe(3)
    expect(results[0].carriedForward).toBe(3)
  })

  it('includes prior carried-forward days in the unused pool before capping', async () => {
    mockFindMany.mockResolvedValue([balance({ used: 5, carriedForward: 4 })])

    const results = await LeaveRolloverService.calculateYearEndRollover(2025)

    // unused = 21 + 4 - 5 = 20 -> capped at 5, lost 15
    expect(results[0]).toMatchObject({ unused: 20, carriedForward: 5, lost: 15 })
  })

  it('never produces a negative carry-forward when used exceeds entitlement', async () => {
    mockFindMany.mockResolvedValue([balance({ used: 25 })])

    const results = await LeaveRolloverService.calculateYearEndRollover(2025)

    expect(results[0]).toMatchObject({ unused: 0, carriedForward: 0, lost: 0 })
  })

  it('treats maxCarryForward = 0 as unlimited', async () => {
    mockFindMany.mockResolvedValue([balance({ used: 3 }, { maxCarryForward: 0 })])

    const results = await LeaveRolloverService.calculateYearEndRollover(2025)

    expect(results[0]).toMatchObject({ unused: 18, carriedForward: 18, lost: 0 })
  })

  it('treats maxCarryForward = null as unlimited (config falls back to 0)', async () => {
    mockFindMany.mockResolvedValue([balance({ used: 1 }, { maxCarryForward: null })])

    const results = await LeaveRolloverService.calculateYearEndRollover(2025)

    expect(results[0]).toMatchObject({ unused: 20, carriedForward: 20, lost: 0 })
  })

  it('skips inactive users', async () => {
    mockFindMany.mockResolvedValue([balance({}, {}, false)])

    const results = await LeaveRolloverService.calculateYearEndRollover(2025)

    expect(results).toHaveLength(0)
  })

  it('skips leave types that do not allow carry-forward', async () => {
    mockFindMany.mockResolvedValue([balance({ used: 0 }, { carryForward: false })])

    const results = await LeaveRolloverService.calculateYearEndRollover(2025)

    expect(results).toHaveLength(0)
  })
})

describe('LeaveRolloverService.getRolloverPreview', () => {
  it('aggregates carried-forward and lost days and rounds the average to 2 decimals', async () => {
    mockFindMany.mockResolvedValue([
      balance({ id: 'b1', userId: 'u1', used: 10 }),               // carry 5, lost 6
      balance({ id: 'b2', userId: 'u2', used: 18 }),               // carry 3, lost 0
      balance({ id: 'b3', userId: 'u3', used: 19, entitled: 21 }), // carry 2, lost 0
    ])

    const preview = await LeaveRolloverService.getRolloverPreview(2025)

    expect(preview.summary).toEqual({
      totalUsers: 3,
      totalDaysCarriedForward: 10,
      totalDaysLost: 6,
      avgCarryForward: 3.33, // 10/3 rounded to 2dp
    })
    expect(preview.details).toHaveLength(3)
  })

  it('returns a zeroed summary when there are no balances', async () => {
    mockFindMany.mockResolvedValue([])

    const preview = await LeaveRolloverService.getRolloverPreview(2025)

    expect(preview.summary).toEqual({
      totalUsers: 0,
      totalDaysCarriedForward: 0,
      totalDaysLost: 0,
      avgCarryForward: 0,
    })
  })
})
