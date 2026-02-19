import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })

    const isHREmployee = user?.role === 'EMPLOYEE' && (user?.department?.toLowerCase() === 'hr' || user?.department?.toLowerCase() === 'human resources')

    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        daysAllowed: true,
        requiresDocument: true,
        isHROnly: true,
        category: true,
        isSpecialLeave: true,
      }
    })

    return NextResponse.json({ leaveTypes })
  } catch (error) {
    console.error('Error fetching leave types:', error)
    return NextResponse.json({ error: 'Failed to fetch leave types' }, { status: 500 })
  }
}
