import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LeaveBalanceService } from '@/lib/services/leave-balance-service'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    leaveBalance: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    leaveType: { findMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

const mock = {
  balanceFindUnique: prisma.leaveBalance.findUnique as unknown as ReturnType<typeof vi.fn>,
  balanceFindMany: prisma.leaveBalance.findMany as unknown as ReturnType<typeof vi.fn>,
  balanceUpdate: prisma.leaveBalance.update as unknown as ReturnType<typeof vi.fn>,
  balanceCreate: prisma.leaveBalance.create as unknown as ReturnType<typeof vi.fn>,
  auditCreate: prisma.auditLog.create as unknown as ReturnType<typeof vi.fn>,
}

const service = LeaveBalanceService.getInstance()

beforeEach(() => {
  vi.clearAllMocks()
  mock.auditCreate.mockResolvedValue({})
  mock.balanceUpdate.mockResolvedValue({})
  mock.balanceCreate.mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('LeaveBalanceService.calculateProRatedBalance', () => {
  it('gives full entitlement when joining before the current year', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 5, 1))

    const days = await service.calculateProRatedBalance('u1', new Date(2024, 4, 10), 'lt1', 21)
    expect(days).toBe(21)
  })

  it('gives full entitlement when joining exactly on Jan 1 of the current year', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 5, 1))

    const days = await service.calculateProRatedBalance('u1', new Date(2025, 0, 1), 'lt1', 21)
    expect(days).toBe(21)
  })

  it('pro-rates a Jul 1 joiner (rounding up with Math.ceil)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 5, 1))

    // 184 remaining days / 365 * 21 = 10.586 -> ceil = 11
    const days = await service.calculateProRatedBalance('u1', new Date(2025, 6, 1), 'lt1', 21)
    expect(days).toBe(11)
  })

  it('pro-rates someone starting mid-month on the 15th', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 5, 1))

    // Jun 15 -> Dec 31 = 200 days incl.; 200/365 * 25 = 13.699 -> ceil = 14
    const days = await service.calculateProRatedBalance('u1', new Date(2025, 5, 15), 'lt1', 25)
    expect(days).toBe(14)
  })

  it('uses 366 days for a leap year (Mar 1, 2024 joiner)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 1, 1))

    // Mar 1 -> Dec 31 2024 = 306 days incl.; 306/366 * 25 = 20.90 -> ceil = 21
    const days = await service.calculateProRatedBalance('u1', new Date(2024, 2, 1), 'lt1', 25)
    expect(days).toBe(21)
  })

  it('handles a Feb 29 joining date', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 1, 1))

    // Feb 29 -> Dec 31 2024 = 307 days incl.; 307/366 * 21 = 17.61 -> ceil = 18
    const days = await service.calculateProRatedBalance('u1', new Date(2024, 1, 29), 'lt1', 21)
    expect(days).toBe(18)
  })

  it('gives 1 day to someone joining on Dec 31', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 5, 1))

    // 1 remaining day / 365 * 21 = 0.058 -> ceil = 1
    const days = await service.calculateProRatedBalance('u1', new Date(2025, 11, 31), 'lt1', 21)
    expect(days).toBe(1)
  })

  it('never returns a negative balance for a joining date after year end', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 5, 1))

    const days = await service.calculateProRatedBalance('u1', new Date(2026, 0, 15), 'lt1', 21)
    expect(days).toBe(0)
  })
})

describe('LeaveBalanceService.adjustBalance', () => {
  const baseBalance = {
    id: 'bal1',
    userId: 'u1',
    leaveTypeId: 'lt1',
    entitled: 21,
    carriedForward: 2,
    used: 5,
    pending: 3,
    available: 15,
  }

  it('DEDUCT increases used and recomputes available from entitled + CF - used - pending', async () => {
    mock.balanceFindUnique.mockResolvedValue(baseBalance)

    await service.adjustBalance('u1', 'lt1', 2, 'DEDUCT')

    expect(mock.balanceUpdate).toHaveBeenCalledWith({
      where: { id: 'bal1' },
      data: { used: 7, available: 21 + 2 - 7 - 3 }, // 13
    })
  })

  it('RESTORE decreases used and clamps it at zero (no negative used)', async () => {
    mock.balanceFindUnique.mockResolvedValue({ ...baseBalance, used: 1 })

    await service.adjustBalance('u1', 'lt1', 5, 'RESTORE')

    expect(mock.balanceUpdate).toHaveBeenCalledWith({
      where: { id: 'bal1' },
      data: { used: 0, available: 21 + 2 - 0 - 3 }, // 20
    })
  })

  it('throws when no balance row exists', async () => {
    mock.balanceFindUnique.mockResolvedValue(null)

    await expect(service.adjustBalance('u1', 'lt1', 1, 'DEDUCT'))
      .rejects.toThrow('Leave balance not found')
  })
})

describe('LeaveBalanceService.processUserYearEndBalance', () => {
  const leaveType = (over: Record<string, unknown> = {}) => ({
    id: 'lt1',
    name: 'Normal Leave',
    daysAllowed: 21,
    carryForward: true,
    maxCarryForward: 5,
    ...over,
  })

  it('caps carry-forward at the leave type maxCarryForward and creates next-year balance', async () => {
    mock.balanceFindMany.mockResolvedValue([{
      id: 'bal1', userId: 'u1', leaveTypeId: 'lt1', year: 2025,
      entitled: 21, used: 10, pending: 0, carriedForward: 0,
      leaveType: leaveType(),
    }])
    mock.balanceFindUnique.mockResolvedValue(null) // no next-year balance yet

    await service.processUserYearEndBalance('u1', 2025, 2026)

    // unused = 21 + 0 - 10 = 11, capped at 5
    expect(mock.balanceCreate).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        leaveTypeId: 'lt1',
        year: 2026,
        entitled: 21,
        available: 26, // 21 + 5
        used: 0,
        carriedForward: 5,
      },
    })
  })

  it('carries nothing when the leave type disallows carry-forward', async () => {
    mock.balanceFindMany.mockResolvedValue([{
      id: 'bal1', userId: 'u1', leaveTypeId: 'lt1', year: 2025,
      entitled: 21, used: 0, pending: 0, carriedForward: 0,
      leaveType: leaveType({ carryForward: false }),
    }])
    mock.balanceFindUnique.mockResolvedValue(null)

    await service.processUserYearEndBalance('u1', 2025, 2026)

    expect(mock.balanceCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ carriedForward: 0, available: 21 }) })
    )
  })

  it('treats maxCarryForward = 0 as unlimited and ignores pending when computing unused', async () => {
    mock.balanceFindMany.mockResolvedValue([{
      id: 'bal1', userId: 'u1', leaveTypeId: 'lt1', year: 2025,
      entitled: 21, used: 10, pending: 5, carriedForward: 0,
      leaveType: leaveType({ maxCarryForward: 0 }),
    }])
    mock.balanceFindUnique.mockResolvedValue(null)

    await service.processUserYearEndBalance('u1', 2025, 2026)

    // NOTE: possible bug: unusedBalance = entitled + carriedForward - used does NOT subtract
    // pending, unlike LeaveRolloverService.calculateYearEndRollover which reserves pending days.
    // 5 pending days are carried forward here even though they may still be approved.
    expect(mock.balanceCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ carriedForward: 11, available: 32 }) })
    )
  })

  it('never carries a negative amount when used exceeds entitlement', async () => {
    mock.balanceFindMany.mockResolvedValue([{
      id: 'bal1', userId: 'u1', leaveTypeId: 'lt1', year: 2025,
      entitled: 21, used: 25, pending: 0, carriedForward: 0,
      leaveType: leaveType(),
    }])
    mock.balanceFindUnique.mockResolvedValue(null)

    await service.processUserYearEndBalance('u1', 2025, 2026)

    expect(mock.balanceCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ carriedForward: 0 }) })
    )
  })

  it('updates an existing next-year balance preserving its used/pending', async () => {
    mock.balanceFindMany.mockResolvedValue([{
      id: 'bal1', userId: 'u1', leaveTypeId: 'lt1', year: 2025,
      entitled: 21, used: 18, pending: 0, carriedForward: 0,
      leaveType: leaveType(),
    }])
    mock.balanceFindUnique.mockResolvedValue({
      id: 'bal2', entitled: 22, used: 2, pending: 1,
    })

    await service.processUserYearEndBalance('u1', 2025, 2026)

    // carry = min(21 - 18, 5) = 3; available = 22 + 3 - 2 - 1 = 22
    expect(mock.balanceUpdate).toHaveBeenCalledWith({
      where: { userId_leaveTypeId_year: { userId: 'u1', leaveTypeId: 'lt1', year: 2026 } },
      data: { carriedForward: 3, available: 22 },
    })
  })
})

describe('LeaveBalanceService.expireCarryForwardBalances', () => {
  it('does nothing before the expiry date (Apr 1 with 3-month config)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 1, 15)) // Feb 15, before Apr 1

    await service.expireCarryForwardBalances()

    expect(mock.balanceFindMany).not.toHaveBeenCalled()
  })

  it('strips unused carry-forward after expiry and recomputes available without CF', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 5, 1)) // Jun 1, after Apr 1

    mock.balanceFindMany.mockResolvedValue([{
      id: 'bal1', userId: 'u1',
      entitled: 21, used: 8, pending: 1,
      carriedForward: 5, carriedForwardUsed: 2,
    }])

    await service.expireCarryForwardBalances()

    expect(mock.balanceUpdate).toHaveBeenCalledWith({
      where: { id: 'bal1' },
      data: {
        available: 12, // max(0, 21 - 8 - 1), CF removed entirely
        carriedForward: 0,
        carriedForwardUsed: 0,
      },
    })
  })

  it('floors available at zero when used exceeds base entitlement after expiry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 5, 1))

    mock.balanceFindMany.mockResolvedValue([{
      id: 'bal1', userId: 'u1',
      entitled: 21, used: 24, pending: 0, // 3 of the CF days were consumed
      carriedForward: 5, carriedForwardUsed: 3,
    }])

    await service.expireCarryForwardBalances()

    expect(mock.balanceUpdate).toHaveBeenCalledWith({
      where: { id: 'bal1' },
      data: { available: 0, carriedForward: 0, carriedForwardUsed: 0 },
    })
  })
})
