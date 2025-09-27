import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId } = await params
    const currentYear = new Date().getFullYear()

    // Get user with all relations
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true
          }
        },
        departmentDirector: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true
          }
        },
        subordinates: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true
          }
        },
        directsReports: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all leave types
    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { name: 'asc' }
    })

    // Get user's leave balances
    const balances = await prisma.leaveBalance.findMany({
      where: {
        userId,
        year: currentYear
      },
      include: {
        leaveType: true
      }
    })

    // Get approved leave usage for sick and special leaves
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        userId,
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

    // Create balance map
    const balanceMap = new Map(
      balances.map(b => [b.leaveTypeId, b])
    )

    // Combine leave information
    const leaveBalances = leaveTypes.map(type => {
      const balance = balanceMap.get(type.id)
      const used = usageMap.get(type.id) || 0
      
      if (type.code === 'NL') {
        // Normal Leave - has a balance
        return {
          leaveTypeId: type.id,
          leaveTypeName: type.name,
          leaveTypeCode: type.code,
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
          year: currentYear,
          used: used,
          hasBalance: false
        }
      }
    })

    // Return combined data
    return NextResponse.json({
      ...user,
      leaveBalances
    })
  } catch (error) {
    console.error('Error fetching user info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user information' },
      { status: 500 }
    )
  }
}