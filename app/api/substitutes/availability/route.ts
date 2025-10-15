import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, isWithinInterval, format } from "date-fns"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { startDate, endDate, selectedDates, excludeRequestId } = body

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Start date and end date are required" }, { status: 400 })
    }

    const requestStartDate = startOfDay(new Date(startDate))
    const requestEndDate = endOfDay(new Date(endDate))
    
    // Parse selected dates if provided (for sporadic leave)
    const specificDates = selectedDates ? selectedDates.map((date: string) => new Date(date)) : null

    // Get all potential substitutes (users who can be substitutes)
    const potentialSubstitutes = await prisma.user.findMany({
      where: {
        id: { not: session.user.id }, // Exclude the requester
        status: 'ACTIVE' // Only active users
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        role: true,
        image: true
      }
    })

    // Check availability for each potential substitute
    const substitutesWithAvailability = await Promise.all(
      potentialSubstitutes.map(async (substitute) => {
        const conflicts: Array<{
          type: 'leave' | 'wfh' | 'substitute'
          dates: string
          details: string
          conflictingDates?: string[]
        }> = []

        // Check for existing leave requests
        const leaveConflicts = await prisma.leaveRequest.findMany({
          where: {
            userId: substitute.id,
            ...(excludeRequestId && { id: { not: excludeRequestId } }),
            status: { in: ['PENDING', 'APPROVED'] },
            OR: [
              {
                startDate: { lte: requestEndDate },
                endDate: { gte: requestStartDate }
              }
            ]
          },
          include: {
            leaveType: { select: { name: true } }
          }
        })

        // Check for WFH requests that might affect availability
        const wfhConflicts = await prisma.workFromHomeRequest.findMany({
          where: {
            userId: substitute.id,
            status: { in: ['PENDING', 'APPROVED'] },
            OR: [
              {
                startDate: { lte: requestEndDate },
                endDate: { gte: requestStartDate }
              }
            ]
          }
        })

        // Check for existing substitute duties
        const substituteConflicts = await prisma.leaveRequestSubstitute.findMany({
          where: {
            userId: substitute.id,
            leaveRequest: {
              status: { in: ['PENDING', 'APPROVED'] },
              OR: [
                {
                  startDate: { lte: requestEndDate },
                  endDate: { gte: requestStartDate }
                }
              ]
            }
          },
          include: {
            leaveRequest: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                leaveType: { select: { name: true } }
              }
            }
          }
        })

        // Process leave conflicts
        for (const leave of leaveConflicts) {
          let conflictingDates: string[] = []
          
          if (specificDates) {
            // For sporadic dates, check which specific dates conflict
            conflictingDates = specificDates
              .filter(date => 
                isWithinInterval(date, { 
                  start: startOfDay(leave.startDate), 
                  end: endOfDay(leave.endDate) 
                })
              )
              .map(date => format(date, 'MMM d'))
          }
          
          conflicts.push({
            type: 'leave',
            dates: `${format(leave.startDate, 'MMM d')} - ${format(leave.endDate, 'MMM d')}`,
            details: `${leave.leaveType.name}`,
            conflictingDates: conflictingDates.length > 0 ? conflictingDates : undefined
          })
        }

        // Process WFH conflicts
        for (const wfh of wfhConflicts) {
          let conflictingDates: string[] = []
          
          if (specificDates) {
            conflictingDates = specificDates
              .filter(date => 
                isWithinInterval(date, { 
                  start: startOfDay(wfh.startDate), 
                  end: endOfDay(wfh.endDate) 
                })
              )
              .map(date => format(date, 'MMM d'))
          }
          
          conflicts.push({
            type: 'wfh',
            dates: `${format(wfh.startDate, 'MMM d')} - ${format(wfh.endDate, 'MMM d')}`,
            details: `Working from ${wfh.location}`,
            conflictingDates: conflictingDates.length > 0 ? conflictingDates : undefined
          })
        }

        // Process substitute duty conflicts
        for (const substDuty of substituteConflicts) {
          let conflictingDates: string[] = []
          
          if (specificDates) {
            conflictingDates = specificDates
              .filter(date => 
                isWithinInterval(date, { 
                  start: startOfDay(substDuty.leaveRequest.startDate), 
                  end: endOfDay(substDuty.leaveRequest.endDate) 
                })
              )
              .map(date => format(date, 'MMM d'))
          }
          
          conflicts.push({
            type: 'substitute',
            dates: `${format(substDuty.leaveRequest.startDate, 'MMM d')} - ${format(substDuty.leaveRequest.endDate, 'MMM d')}`,
            details: `Substituting for ${substDuty.leaveRequest.user.firstName} ${substDuty.leaveRequest.user.lastName}`,
            conflictingDates: conflictingDates.length > 0 ? conflictingDates : undefined
          })
        }

        // Determine availability status
        const isFullyAvailable = conflicts.length === 0
        const hasPartialConflicts = specificDates && conflicts.some(c => c.conflictingDates && c.conflictingDates.length > 0)
        const hasFullConflicts = conflicts.some(c => !c.conflictingDates)

        let availabilityStatus: 'available' | 'partial' | 'unavailable'
        if (isFullyAvailable) {
          availabilityStatus = 'available'
        } else if (hasPartialConflicts && !hasFullConflicts) {
          availabilityStatus = 'partial'
        } else {
          availabilityStatus = 'unavailable'
        }

        return {
          ...substitute,
          name: `${substitute.firstName} ${substitute.lastName}`,
          conflicts,
          availabilityStatus,
          isRecommended: isFullyAvailable
        }
      })
    )

    // Sort by availability: available first, then partial, then unavailable
    const sortedSubstitutes = substitutesWithAvailability.sort((a, b) => {
      const order = { available: 0, partial: 1, unavailable: 2 }
      return order[a.availabilityStatus] - order[b.availabilityStatus]
    })

    return NextResponse.json({
      substitutes: sortedSubstitutes,
      totalCount: sortedSubstitutes.length,
      availableCount: sortedSubstitutes.filter(s => s.availabilityStatus === 'available').length,
      partialCount: sortedSubstitutes.filter(s => s.availabilityStatus === 'partial').length,
      unavailableCount: sortedSubstitutes.filter(s => s.availabilityStatus === 'unavailable').length
    })

  } catch (error) {
    console.error("Error checking substitute availability:", error)
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}