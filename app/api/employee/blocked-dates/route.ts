import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { eachDayOfInterval, format } from 'date-fns'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all leave requests for the user that are not rejected or cancelled
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        status: {
          in: ['PENDING', 'APPROVED'] // Include both pending and approved
        }
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        selectedDates: true, // Include the selectedDates field
        supportingDocuments: true, // Also include supportingDocuments as fallback
        status: true,
        leaveType: {
          select: {
            name: true
          }
        }
      }
    })

    // Convert leave requests to an array of blocked dates
    const blockedDates: string[] = []
    const dateDetails: Record<string, { status: string; leaveType: string; requestId: string }> = {}

    leaveRequests.forEach(request => {
      let days: Date[] = []
      
      // First, check if selectedDates array exists and has values
      if (request.selectedDates && request.selectedDates.length > 0) {
        // Use the specific selected dates
        days = request.selectedDates.map(date => new Date(date))
      }
      // Second, check if selectedDates is in supportingDocuments (backward compatibility)
      else if (request.supportingDocuments && 
               typeof request.supportingDocuments === 'object' && 
               'selectedDates' in request.supportingDocuments) {
        const supportingDocs = request.supportingDocuments as any
        if (supportingDocs.selectedDates && Array.isArray(supportingDocs.selectedDates)) {
          days = supportingDocs.selectedDates.map((dateStr: string) => new Date(dateStr))
        }
      }
      
      // If no selectedDates found, fall back to date interval (for older requests)
      if (days.length === 0) {
        days = eachDayOfInterval({
          start: new Date(request.startDate),
          end: new Date(request.endDate)
        })
      }

      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        blockedDates.push(dateStr)
        dateDetails[dateStr] = {
          status: request.status,
          leaveType: request.leaveType.name,
          requestId: request.id
        }
      })
    })
    
    // Also fetch Work From Home requests that block dates
    const wfhRequests = await prisma.workFromHomeRequest.findMany({
      where: {
        userId: session.user.id,
        status: {
          in: ['PENDING', 'APPROVED']
        }
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        selectedDates: true, // Include selectedDates for WFH requests
        status: true,
        location: true
      }
    })
    
    // Process WFH requests
    wfhRequests.forEach(request => {
      let days: Date[] = []
      
      // Check if selectedDates array exists and has values
      if (request.selectedDates && Array.isArray(request.selectedDates) && request.selectedDates.length > 0) {
        // Handle both Date objects and string dates
        days = request.selectedDates.map(date => 
          typeof date === 'string' ? new Date(date) : new Date(date as any)
        )
      }
      
      // If no selectedDates found, fall back to date interval
      if (days.length === 0) {
        days = eachDayOfInterval({
          start: new Date(request.startDate),
          end: new Date(request.endDate)
        })
      }

      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        blockedDates.push(dateStr)
        dateDetails[dateStr] = {
          status: request.status,
          leaveType: `Work From Home - ${request.location}`,
          requestId: request.id
        }
      })
    })

    return NextResponse.json({
      blockedDates: [...new Set(blockedDates)], // Remove duplicates
      dateDetails,
      totalBlockedDays: blockedDates.length
    })
  } catch (error) {
    console.error('Error fetching blocked dates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blocked dates' },
      { status: 500 }
    )
  }
}