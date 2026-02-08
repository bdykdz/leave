import { prisma } from '@/lib/prisma'
import { format, isSameDay, parseISO } from 'date-fns'

export interface DateOverlapCheck {
  hasOverlap: boolean
  conflictingDates: string[]
  conflictingRequestId?: string
  message?: string
}

/**
 * Check if selected dates overlap with existing leave or WFH requests
 */
export async function checkSelectedDatesOverlap(
  userId: string,
  selectedDates: string[] | Date[],
  excludeRequestId?: string
): Promise<DateOverlapCheck> {
  if (!selectedDates || selectedDates.length === 0) {
    return { hasOverlap: false, conflictingDates: [] }
  }

  // Normalize dates to Date objects
  const datesToCheck = selectedDates.map(d => 
    typeof d === 'string' ? parseISO(d) : new Date(d)
  )

  // Get all existing leave requests for the user (excluding current if editing)
  const whereClause: any = {
    userId,
    status: { in: ['APPROVED', 'PENDING'] }
  }
  
  if (excludeRequestId) {
    whereClause.id = { not: excludeRequestId }
  }

  const [existingLeaveRequests, existingWFHRequests] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: whereClause,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        selectedDates: true,
        requestNumber: true
      }
    }),
    prisma.workFromHomeRequest.findMany({
      where: whereClause,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        selectedDates: true,
        requestNumber: true
      }
    })
  ])

  const conflictingDates: Set<string> = new Set()
  let conflictingRequestId: string | undefined
  
  // Check each date against existing requests
  for (const dateToCheck of datesToCheck) {
    // Check leave requests
    for (const request of existingLeaveRequests) {
      let hasConflict = false
      
      // If request has selectedDates, check exact matches
      if (request.selectedDates && request.selectedDates.length > 0) {
        hasConflict = request.selectedDates.some(existingDate => 
          isSameDay(new Date(existingDate), dateToCheck)
        )
      } else {
        // Otherwise check if date falls within the range
        hasConflict = dateToCheck >= request.startDate && dateToCheck <= request.endDate
      }
      
      if (hasConflict) {
        conflictingDates.add(format(dateToCheck, 'yyyy-MM-dd'))
        conflictingRequestId = request.id
      }
    }
    
    // Check WFH requests
    for (const request of existingWFHRequests) {
      let hasConflict = false
      
      // If request has selectedDates, check exact matches
      if (request.selectedDates && Array.isArray(request.selectedDates)) {
        const wfhDates = request.selectedDates as any[]
        hasConflict = wfhDates.some(existingDate => 
          isSameDay(typeof existingDate === 'string' ? parseISO(existingDate) : new Date(existingDate), dateToCheck)
        )
      } else {
        // Otherwise check if date falls within the range
        hasConflict = dateToCheck >= request.startDate && dateToCheck <= request.endDate
      }
      
      if (hasConflict) {
        conflictingDates.add(format(dateToCheck, 'yyyy-MM-dd'))
        conflictingRequestId = request.id
      }
    }
  }

  if (conflictingDates.size > 0) {
    const datesList = Array.from(conflictingDates)
    const formattedDates = datesList.slice(0, 3).map(d => 
      format(parseISO(d), 'MMM dd, yyyy')
    ).join(', ')
    
    const message = datesList.length > 3
      ? `Dates conflict with existing requests: ${formattedDates} and ${datesList.length - 3} more dates`
      : `Dates conflict with existing requests: ${formattedDates}`
    
    return {
      hasOverlap: true,
      conflictingDates: datesList,
      conflictingRequestId,
      message
    }
  }

  return { hasOverlap: false, conflictingDates: [] }
}

/**
 * Validate selected dates against holidays
 */
export async function checkHolidayConflicts(
  selectedDates: string[] | Date[]
): Promise<{ hasConflict: boolean; blockedDates: string[]; message?: string }> {
  if (!selectedDates || selectedDates.length === 0) {
    return { hasConflict: false, blockedDates: [] }
  }

  const datesToCheck = selectedDates.map(d => 
    typeof d === 'string' ? parseISO(d) : new Date(d)
  )

  // Get all blocked holidays
  const blockedHolidays = await prisma.holiday.findMany({
    where: {
      isActive: true,
      isBlocked: true
    },
    select: {
      date: true,
      nameEn: true
    }
  })

  const blockedDates: string[] = []
  const blockedHolidayNames: string[] = []

  for (const dateToCheck of datesToCheck) {
    const blockedHoliday = blockedHolidays.find(h => 
      isSameDay(h.date, dateToCheck)
    )
    
    if (blockedHoliday) {
      blockedDates.push(format(dateToCheck, 'yyyy-MM-dd'))
      if (!blockedHolidayNames.includes(blockedHoliday.nameEn)) {
        blockedHolidayNames.push(blockedHoliday.nameEn)
      }
    }
  }

  if (blockedDates.length > 0) {
    const message = `Cannot request leave on mandatory work days: ${blockedHolidayNames.join(', ')}`
    return {
      hasConflict: true,
      blockedDates,
      message
    }
  }

  return { hasConflict: false, blockedDates: [] }
}