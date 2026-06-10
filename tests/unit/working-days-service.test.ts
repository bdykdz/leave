import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkingDaysService } from '@/lib/services/working-days-service'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    holiday: { findMany: vi.fn() },
  },
}))

const mockHolidayFindMany = prisma.holiday.findMany as unknown as ReturnType<typeof vi.fn>

const service = WorkingDaysService.getInstance()

// 2025 facts used below: Jan 6 = Monday, Jan 10 = Friday, Jan 11/12 = weekend,
// Dec 31 2025 = Wednesday, Jan 1 2026 = Thursday.

beforeEach(() => {
  vi.clearAllMocks()
  // Reset the singleton's private holiday cache between tests
  ;(service as any).holidaysCache = new Map()
  ;(service as any).cacheExpiry = new Date(0)
  mockHolidayFindMany.mockResolvedValue([])
})

describe('WorkingDaysService.calculateWorkingDays', () => {
  it('counts a full Monday-Friday week as 5 working days', async () => {
    const days = await service.calculateWorkingDays(new Date(2025, 0, 6), new Date(2025, 0, 10))
    expect(days).toBe(5)
  })

  it('excludes weekend days from a Monday-Sunday range', async () => {
    const days = await service.calculateWorkingDays(new Date(2025, 0, 6), new Date(2025, 0, 12))
    expect(days).toBe(5)
  })

  it('counts Monday to next Monday as 6 working days', async () => {
    const days = await service.calculateWorkingDays(new Date(2025, 0, 6), new Date(2025, 0, 13))
    expect(days).toBe(6)
  })

  it('swaps the dates when start is after end', async () => {
    const days = await service.calculateWorkingDays(new Date(2025, 0, 10), new Date(2025, 0, 6))
    expect(days).toBe(5)
  })

  it('excludes the end date when includeEndDate = false', async () => {
    const days = await service.calculateWorkingDays(
      new Date(2025, 0, 6), new Date(2025, 0, 10), false
    )
    expect(days).toBe(4)
  })

  it('counts a single weekday as 1', async () => {
    const days = await service.calculateWorkingDays(new Date(2025, 0, 8), new Date(2025, 0, 8))
    expect(days).toBe(1)
  })

  it('excludes public holidays falling on weekdays', async () => {
    mockHolidayFindMany.mockResolvedValue([{ date: new Date(2025, 0, 8) }]) // Wed
    const days = await service.calculateWorkingDays(new Date(2025, 0, 6), new Date(2025, 0, 10))
    expect(days).toBe(4)
  })

  it('does not double-subtract a holiday that falls on a weekend', async () => {
    mockHolidayFindMany.mockResolvedValue([{ date: new Date(2025, 0, 11) }]) // Sat
    const days = await service.calculateWorkingDays(new Date(2025, 0, 6), new Date(2025, 0, 12))
    expect(days).toBe(5)
  })

  it('handles ranges crossing a year boundary', async () => {
    mockHolidayFindMany.mockResolvedValue([{ date: new Date(2026, 0, 1) }]) // New Year's Day
    // Wed Dec 31 2025 -> Fri Jan 2 2026: 3 weekdays, minus the Jan 1 holiday
    const days = await service.calculateWorkingDays(new Date(2025, 11, 31), new Date(2026, 0, 2))
    expect(days).toBe(2)
  })
})

describe('WorkingDaysService.isWorkingDay', () => {
  it('returns false on a Saturday without querying holidays', async () => {
    expect(await service.isWorkingDay(new Date(2025, 0, 11))).toBe(false)
    expect(mockHolidayFindMany).not.toHaveBeenCalled()
  })

  it('returns true on a plain weekday', async () => {
    expect(await service.isWorkingDay(new Date(2025, 0, 7))).toBe(true)
  })

  it('returns false on a weekday public holiday', async () => {
    mockHolidayFindMany.mockResolvedValue([{ date: new Date(2025, 0, 7) }])
    expect(await service.isWorkingDay(new Date(2025, 0, 7))).toBe(false)
  })
})

describe('WorkingDaysService.calculateLeaveDays', () => {
  it('returns 0.5 for a half-day on a working day', async () => {
    const days = await service.calculateLeaveDays(
      new Date(2025, 0, 8), new Date(2025, 0, 8), true, 'MORNING'
    )
    expect(days).toBe(0.5)
  })

  it('returns 0 for a half-day requested on a weekend', async () => {
    const days = await service.calculateLeaveDays(
      new Date(2025, 0, 11), new Date(2025, 0, 11), true
    )
    expect(days).toBe(0)
  })

  it('rejects half-day requests spanning more than one day', async () => {
    await expect(
      service.calculateLeaveDays(new Date(2025, 0, 8), new Date(2025, 0, 9), true)
    ).rejects.toThrow('Half day leave can only be for a single day')
  })

  it('falls back to full working-day counting for non-half-day requests', async () => {
    const days = await service.calculateLeaveDays(new Date(2025, 0, 6), new Date(2025, 0, 12))
    expect(days).toBe(5)
  })
})

describe('WorkingDaysService.calculateEndDate', () => {
  it('returns the start date for zero requested days', async () => {
    const start = new Date(2025, 0, 6)
    expect(await service.calculateEndDate(start, 0)).toEqual(start)
  })

  it('ends a 5-working-day leave starting Monday on Friday', async () => {
    const end = await service.calculateEndDate(new Date(2025, 0, 6), 5)
    expect(end).toEqual(new Date(2025, 0, 10))
  })

  it('shifts a weekend start to the next working day', async () => {
    const end = await service.calculateEndDate(new Date(2025, 0, 4), 1) // Saturday
    expect(end).toEqual(new Date(2025, 0, 6)) // Monday
  })

  it('skips holidays when counting forward', async () => {
    mockHolidayFindMany.mockResolvedValue([{ date: new Date(2025, 0, 7) }]) // Tue holiday
    const end = await service.calculateEndDate(new Date(2025, 0, 6), 3)
    // Mon counts, Tue skipped, Wed + Thu count -> Thu Jan 9
    expect(end).toEqual(new Date(2025, 0, 9))
  })
})

describe('WorkingDaysService.getWorkingDaysBreakdown', () => {
  it('classifies days into working / weekend / holiday buckets', async () => {
    mockHolidayFindMany.mockResolvedValue([{ date: new Date(2025, 0, 8) }])

    const breakdown = await service.getWorkingDaysBreakdown(
      new Date(2025, 0, 6), new Date(2025, 0, 12)
    )

    expect(breakdown).toEqual({
      totalDays: 7,
      workingDays: 4,
      weekends: 2,
      holidays: 1,
      holidayDates: [new Date(2025, 0, 8)],
    })
  })
})
