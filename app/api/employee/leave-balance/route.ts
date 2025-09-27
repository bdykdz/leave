import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const currentYear = new Date().getFullYear()

    // Get all leave types
    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { name: 'asc' }
    })

    // Get user's leave balances for current year
    const balances = await prisma.leaveBalance.findMany({
      where: {
        userId: session.user.id,
        year: currentYear
      },
      include: {
        leaveType: true
      }
    })

    // Get leave usage for sick and special leaves
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        status: 'APPROVED',
        startDate: {
          gte: new Date(currentYear, 0, 1)
        },
        endDate: {
          lte: new Date(currentYear, 11, 31)
        }
      },
      include: {
        leaveType: true
      }
    })

    // Calculate usage for each leave type
    const usageMap = new Map<string, number>()
    leaveRequests.forEach(request => {
      const current = usageMap.get(request.leaveTypeId) || 0
      usageMap.set(request.leaveTypeId, current + request.totalDays)
    })

    // Combine data
    const leaveBalances = leaveTypes.map(type => {
      const balance = balances.find(b => b.leaveTypeId === type.id)
      const used = usageMap.get(type.id) || 0
      
      if (type.code === 'NL' || type.code === 'AL') {
        // Normal/Annual Leave - has a balance
        return {
          leaveTypeId: type.id,
          leaveTypeName: type.name,
          leaveTypeCode: type.code,
          description: type.description,
          year: currentYear,
          entitled: balance?.entitled || 0,
          used: balance?.used || 0,
          pending: balance?.pending || 0,
          available: balance?.available || 0,
          hasBalance: true
        }
      } else {
        // Sick and Special leaves - no balance, just track usage
        return {
          leaveTypeId: type.id,
          leaveTypeName: type.name,
          leaveTypeCode: type.code,
          description: type.description,
          year: currentYear,
          used: used,
          hasBalance: false
        }
      }
    })

    return NextResponse.json({ leaveBalances })
  } catch (error) {
    console.error('Error fetching leave balances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave balances' },
      { status: 500 }
    )
  }
}