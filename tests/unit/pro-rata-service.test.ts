import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProRataService } from '@/lib/services/pro-rata-service'
import { prisma } from '@/lib/prisma'
import { WorkingPattern } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    leaveType: { findUnique: vi.fn() },
  },
}))

const mockUserFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>
const mockLeaveTypeFindUnique = prisma.leaveType.findUnique as unknown as ReturnType<typeof vi.fn>

function stubUser(overrides: Partial<{
  workingPattern: WorkingPattern
  workingDaysPerWeek: number
  workingHoursPerWeek: number
}> = {}) {
  mockUserFindUnique.mockResolvedValue({
    workingPattern: WorkingPattern.FULL_TIME,
    workingDaysPerWeek: 5,
    workingHoursPerWeek: 40,
    contractType: 'PERMANENT',
    joiningDate: new Date(2020, 0, 1),
    ...overrides,
  })
}

function stubLeaveType(daysAllowed: number, code = 'NL', name = 'Normal Leave') {
  mockLeaveTypeFindUnique.mockResolvedValue({ daysAllowed, name, code })
}

describe('ProRataService.calculateProRataEntitlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gives a full-time employee the full entitlement for a full year', async () => {
    stubUser()
    stubLeaveType(21)

    const result = await ProRataService.calculateProRataEntitlement('u1', 'lt1', 2025)

    expect(result.proRataEntitlement).toBe(21)
    expect(result.fullTimeEquivalent).toBe(1)
    expect(result.baseEntitlement).toBe(21)
    expect(result.adjustmentReason).toBe('Pro-rata calculation: 5 days/week (100% FTE)')
    expect(result.effectiveFrom).toEqual(new Date(2025, 0, 1))
    expect(result.effectiveTo).toEqual(new Date(2025, 11, 31))
  })

  it('halves entitlement for a 2.5 days/week job-share (0.5 FTE)', async () => {
    stubUser({ workingPattern: WorkingPattern.JOB_SHARE, workingDaysPerWeek: 2.5 })
    stubLeaveType(21)

    const result = await ProRataService.calculateProRataEntitlement('u1', 'lt1', 2025)

    expect(result.fullTimeEquivalent).toBe(0.5)
    expect(result.proRataEntitlement).toBe(10.5) // 21 * 0.5, quarter-day precision keeps .5
  })

  it('rounds part-time entitlement to quarter-day precision', async () => {
    stubUser({ workingPattern: WorkingPattern.PART_TIME, workingDaysPerWeek: 3 })
    stubLeaveType(22)

    const result = await ProRataService.calculateProRataEntitlement('u1', 'lt1', 2025)

    // 22 * 0.6 = 13.2 -> rounded to nearest 0.25 = 13.25
    expect(result.proRataEntitlement).toBe(13.25)
  })

  it('pro-rates a mid-year start (Jul 1) for a full-timer and rounds to whole days', async () => {
    stubUser()
    stubLeaveType(21)

    const result = await ProRataService.calculateProRataEntitlement(
      'u1', 'lt1', 2025, new Date(2025, 6, 1)
    )

    // NOTE: possible bug: totalDaysInYear = ceil((Dec31 - Jan1)/day) = 364, not 365
    // (the span Jan 1 -> Dec 31 misses one calendar day). Slightly inflates the fraction.
    // 21 * (183/364) = 10.5577 -> FULL_TIME rounds to whole day = 11
    expect(result.proRataEntitlement).toBe(11)
    expect(result.adjustmentReason).toContain('Mid-year start from')
    expect(result.effectiveFrom).toEqual(new Date(2025, 6, 1))
  })

  it('handles a leap-year mid-year start (Mar 1, 2024)', async () => {
    stubUser()
    stubLeaveType(20)

    const result = await ProRataService.calculateProRataEntitlement(
      'u1', 'lt1', 2024, new Date(2024, 2, 1)
    )

    // Leap year: Jan 1 -> Dec 31 2024 spans 365 ms-days (ceil), Mar 1 -> Dec 31 = 305.
    // 20 * 305/365 = 16.712 -> rounds to 17
    expect(result.proRataEntitlement).toBe(17)
  })

  it('treats effectiveFrom of Jan 1 as a full year (no mid-year fraction)', async () => {
    stubUser()
    stubLeaveType(21)

    const result = await ProRataService.calculateProRataEntitlement(
      'u1', 'lt1', 2025, new Date(2025, 0, 1)
    )

    expect(result.proRataEntitlement).toBe(21)
    expect(result.adjustmentReason).not.toContain('Mid-year')
  })

  it('floors ANNUAL leave at the full-time statutory minimum even for a late-year start', async () => {
    stubUser()
    stubLeaveType(25, 'ANNUAL', 'Annual Leave')

    const result = await ProRataService.calculateProRataEntitlement(
      'u1', 'lt1', 2025, new Date(2025, 9, 1) // Oct 1
    )

    // NOTE: possible bug: getMinimumEntitlement('ANNUAL', fte=1) = max(20*1, 4) = 20 and the
    // minimum is NOT scaled by the year fraction, so an October joiner's pro-rata of
    // 25 * 91/364 = 6.25 days gets bumped to the full 20-day minimum. Mid-year pro-rating
    // for ANNUAL is effectively neutralised for any start date.
    expect(result.proRataEntitlement).toBe(20)
  })

  it('applies the absolute 4-day floor for very low FTE on ANNUAL leave', async () => {
    stubUser({ workingPattern: WorkingPattern.PART_TIME, workingDaysPerWeek: 1 })
    stubLeaveType(15, 'ANNUAL', 'Annual Leave')

    const result = await ProRataService.calculateProRataEntitlement('u1', 'lt1', 2025)

    // 15 * 0.2 = 3 < max(20*0.2, 4) = 4 -> floored to 4
    expect(result.proRataEntitlement).toBe(4)
    expect(result.adjustmentReason).toContain('minimum legal requirement of 4 days')
  })

  it('grants full entitlement to compressed-hours staff working >= 35h/week', async () => {
    stubUser({
      workingPattern: WorkingPattern.COMPRESSED_HOURS,
      workingDaysPerWeek: 4,
      workingHoursPerWeek: 37.5,
    })
    stubLeaveType(21)

    const result = await ProRataService.calculateProRataEntitlement('u1', 'lt1', 2025)

    expect(result.proRataEntitlement).toBe(21) // ignores 0.8 FTE because hours are near full-time
    expect(result.adjustmentReason).toBe('Compressed hours with full-time allocation')
  })

  it('pro-rates compressed-hours staff working < 35h/week by FTE with half-day rounding', async () => {
    stubUser({
      workingPattern: WorkingPattern.COMPRESSED_HOURS,
      workingDaysPerWeek: 4,
      workingHoursPerWeek: 30,
    })
    stubLeaveType(21)

    const result = await ProRataService.calculateProRataEntitlement('u1', 'lt1', 2025)

    // 21 * 0.8 = 16.8 -> half-day rounding = 17
    expect(result.proRataEntitlement).toBe(17)
  })

  it('returns 0 for a non-ANNUAL leave type when workingDaysPerWeek is 0', async () => {
    stubUser({ workingPattern: WorkingPattern.PART_TIME, workingDaysPerWeek: 0 })
    stubLeaveType(10)

    const result = await ProRataService.calculateProRataEntitlement('u1', 'lt1', 2025)

    expect(result.proRataEntitlement).toBe(0)
    expect(result.fullTimeEquivalent).toBe(0)
  })

  it('throws when the user does not exist', async () => {
    mockUserFindUnique.mockResolvedValue(null)
    stubLeaveType(21)

    await expect(
      ProRataService.calculateProRataEntitlement('missing', 'lt1', 2025)
    ).rejects.toThrow('User not found')
  })

  it('throws when the leave type does not exist', async () => {
    stubUser()
    mockLeaveTypeFindUnique.mockResolvedValue(null)

    await expect(
      ProRataService.calculateProRataEntitlement('u1', 'missing', 2025)
    ).rejects.toThrow('Leave type not found')
  })
})
