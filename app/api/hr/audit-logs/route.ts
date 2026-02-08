import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is HR, ADMIN, EXECUTIVE, or EMPLOYEE with HR department
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })

    const isHREmployee = user?.role === 'EMPLOYEE' && user?.department?.toLowerCase().includes('hr')
    
    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const action = searchParams.get('action')
    const entity = searchParams.get('entity')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    // Build where clause for HR-relevant audit logs
    const where: any = {
      OR: [
        // HR actions
        { action: { contains: 'LEAVE' } },
        { action: { contains: 'WFH' } },
        { action: { contains: 'DOCUMENT' } },
        { action: { contains: 'EMPLOYEE' } },
        { action: { contains: 'EXPORT' } },
        { entity: 'LEAVE_REQUEST' },
        { entity: 'WFH_REQUEST' },
        { entity: 'USER' },
        { entity: 'DOCUMENT' },
        { entity: 'HOLIDAY' },
        // Actions by HR users
        { 
          user: { 
            OR: [
              { role: 'HR' },
              { role: 'ADMIN' },
              { 
                role: 'EMPLOYEE',
                department: { contains: 'HR', mode: 'insensitive' }
              }
            ]
          }
        }
      ]
    }

    // Apply filters
    if (action && action !== 'all') {
      where.action = action
    }

    if (entity && entity !== 'all') {
      where.entity = entity
    }

    if (dateFrom || dateTo) {
      where.timestamp = {}
      if (dateFrom) where.timestamp.gte = new Date(dateFrom + 'T00:00:00.000Z')
      if (dateTo) where.timestamp.lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    if (search) {
      where.AND = [
        { OR: where.OR }, // Existing HR-related filters
        { 
          OR: [
            { user: { firstName: { contains: search, mode: 'insensitive' } } },
            { user: { lastName: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { action: { contains: search, mode: 'insensitive' } },
            { entity: { contains: search, mode: 'insensitive' } }
          ]
        }
      ]
      delete where.OR
    }

    // Get audit logs with pagination
    const [auditLogs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              role: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    // Get summary statistics for HR dashboard
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [todayCount, weekCount, monthCount] = await Promise.all([
      prisma.auditLog.count({
        where: {
          ...where,
          timestamp: { gte: startOfToday }
        }
      }),
      prisma.auditLog.count({
        where: {
          ...where,
          timestamp: { gte: startOfWeek }
        }
      }),
      prisma.auditLog.count({
        where: {
          ...where,
          timestamp: { gte: startOfMonth }
        }
      })
    ])

    // Get recent HR actions summary
    const recentActions = await prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        ...where,
        timestamp: { gte: startOfWeek }
      },
      _count: {
        action: true
      },
      orderBy: {
        _count: {
          action: 'desc'
        }
      },
      take: 10
    })

    return NextResponse.json({
      auditLogs: auditLogs.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        user: log.user,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        oldValues: log.oldValues,
        newValues: log.newValues,
        details: log.details
      })),
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      summary: {
        todayCount,
        weekCount,
        monthCount,
        recentActions: recentActions.map(action => ({
          action: action.action,
          count: action._count.action
        }))
      }
    })

  } catch (error) {
    console.error('Error fetching HR audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}