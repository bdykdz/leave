import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET: List all WFH requests for HR panel with pagination and filtering
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const status = searchParams.get('status')
    const search = searchParams.get('search') || ''
    const year = searchParams.get('year')
    const department = searchParams.get('department')

    const whereClause: any = {}

    if (status && status !== 'ALL') {
      whereClause.status = status
    }

    if (year && year !== 'all') {
      const yearNum = parseInt(year)
      whereClause.startDate = {
        gte: new Date(`${yearNum}-01-01`),
        lt: new Date(`${yearNum + 1}-01-01`),
      }
    }

    if (department) {
      whereClause.user = { ...whereClause.user, department }
    }

    if (search) {
      whereClause.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { requestNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    const totalCount = await prisma.workFromHomeRequest.count({ where: whereClause })
    const totalPages = Math.ceil(totalCount / pageSize)
    const skip = (page - 1) * pageSize

    const requests = await prisma.workFromHomeRequest.findMany({
      where: whereClause,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            role: true,
          }
        },
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              }
            }
          },
        },
      },
    })

    return NextResponse.json({
      requests,
      totalCount,
      page,
      pageSize,
      totalPages,
    })
  } catch (error) {
    console.error('Error fetching WFH requests for HR:', error)
    return NextResponse.json(
      { error: 'Failed to fetch WFH requests' },
      { status: 500 }
    )
  }
}
