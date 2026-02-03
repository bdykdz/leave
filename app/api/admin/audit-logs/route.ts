import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// GET: Fetch audit logs with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user || !['ADMIN', 'HR', 'EXECUTIVE'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {};

    if (action && action !== 'all') {
      where.action = action;
    }

    if (entityType && entityType !== 'all') {
      where.entityType = entityType;
    }

    if (userId) {
      // Search by user email
      const searchUser = await prisma.user.findFirst({
        where: {
          email: {
            contains: userId,
            mode: 'insensitive'
          }
        }
      });
      if (searchUser) {
        where.userId = searchUser.id;
      }
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    if (search) {
      where.OR = [
        {
          action: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          entityType: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          entityId: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          user: {
            OR: [
              {
                email: {
                  contains: search,
                  mode: 'insensitive'
                }
              },
              {
                firstName: {
                  contains: search,
                  mode: 'insensitive'
                }
              },
              {
                lastName: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            ]
          }
        }
      ];
    }

    // Get total count
    const totalLogs = await prisma.auditLog.count({ where });
    const totalPages = Math.ceil(totalLogs / limit);

    // Fetch logs with pagination
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    return NextResponse.json({
      logs,
      totalLogs,
      totalPages,
      currentPage: page,
      logsPerPage: limit
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}