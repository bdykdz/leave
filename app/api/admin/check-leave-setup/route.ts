import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all leave types
    const leaveTypes = await prisma.leaveType.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        daysAllowed: true,
        isActive: true
      }
    })

    // Get user's leave balances
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: {
        userId: session.user.id,
        year: new Date().getFullYear()
      },
      include: {
        leaveType: true
      }
    })

    return NextResponse.json({
      currentUser: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role
      },
      leaveTypes,
      userLeaveBalances: leaveBalances.map(lb => ({
        leaveTypeName: lb.leaveType.name,
        leaveTypeCode: lb.leaveType.code,
        entitled: lb.entitled,
        used: lb.used,
        available: lb.available,
        year: lb.year
      })),
      currentYear: new Date().getFullYear()
    })
  } catch (error) {
    console.error('Error checking leave setup:', error)
    return NextResponse.json(
      { error: 'Failed to check leave setup' },
      { status: 500 }
    )
  }
}