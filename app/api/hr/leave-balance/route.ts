import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || !['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const leaveTypeId = searchParams.get('leaveTypeId')
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    if (!userId || !leaveTypeId) {
      return NextResponse.json({ error: 'userId and leaveTypeId are required' }, { status: 400 })
    }

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
    }

    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId,
          year,
        },
      },
      select: {
        entitled: true,
        used: true,
        pending: true,
        available: true,
        carriedForward: true,
      },
    })

    // If no explicit balance record, fall back to the leave type's daysAllowed
    if (!balance) {
      const leaveType = await prisma.leaveType.findUnique({
        where: { id: leaveTypeId },
        select: { daysAllowed: true, name: true },
      })

      if (leaveType) {
        return NextResponse.json({
          balance: {
            entitled: leaveType.daysAllowed,
            used: 0,
            pending: 0,
            available: leaveType.daysAllowed,
            carriedForward: 0,
          },
          isDefault: true,
        })
      }
    }

    return NextResponse.json({ balance: balance || null })
  } catch (error) {
    console.error('Error fetching leave balance:', error)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}
