import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ leaveTypes })
  } catch (error) {
    console.error('Failed to fetch leave types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave types' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      code,
      daysAllowed,
      carryForward,
      maxCarryForward,
      requiresApproval,
      requiresDocument,
      description,
      isSpecialLeave,
      requiresHRVerification,
      documentTypes,
      maxDaysPerRequest,
    } = body

    // Validate required fields
    if (!name || !code || daysAllowed === undefined) {
      return NextResponse.json(
        { error: 'Name, code, and days allowed are required' },
        { status: 400 }
      )
    }

    // Check for existing leave type with same code
    const existing = await prisma.leaveType.findUnique({
      where: { code },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Leave type with this code already exists' },
        { status: 400 }
      )
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        name,
        code,
        daysAllowed,
        carryForward: carryForward || false,
        maxCarryForward: carryForward ? maxCarryForward : null,
        requiresApproval: requiresApproval ?? true,
        requiresDocument: requiresDocument || false,
        description,
        isSpecialLeave: isSpecialLeave || false,
        requiresHRVerification: isSpecialLeave ? true : (requiresHRVerification || false),
        documentTypes: documentTypes || [],
        isActive: true,
        maxDaysPerRequest: maxDaysPerRequest || null,
      },
    })

    // Create leave balances for all active users
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    })

    const currentYear = new Date().getFullYear()
    
    await prisma.leaveBalance.createMany({
      data: users.map(user => ({
        userId: user.id,
        leaveTypeId: leaveType.id,
        year: currentYear,
        entitled: leaveType.daysAllowed,
        used: 0,
        pending: 0,
        available: leaveType.daysAllowed,
        carriedForward: 0,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({ leaveType })
  } catch (error) {
    console.error('Failed to create leave type:', error)
    return NextResponse.json(
      { error: 'Failed to create leave type' },
      { status: 500 }
    )
  }
}