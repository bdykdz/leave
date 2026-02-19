import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET: List cancellable approved leaves (NL + WFH, future only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'all'; // 'leave' | 'wfh' | 'all'
    const department = searchParams.get('department') || '';

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const userFilter: any = {
      isActive: true,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(department && department !== 'all' && { department })
    };

    let leaveRequests: any[] = [];
    let wfhRequests: any[] = [];
    let leaveCount = 0;
    let wfhCount = 0;

    // Fetch approved NL leave requests (future only)
    if (type === 'leave' || type === 'all') {
      const leaveWhere = {
        status: 'APPROVED' as const,
        startDate: { gt: today },
        leaveType: { code: 'NL' },
        user: userFilter
      };

      [leaveRequests, leaveCount] = await Promise.all([
        prisma.leaveRequest.findMany({
          where: leaveWhere,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
                role: true
              }
            },
            leaveType: {
              select: { name: true, code: true }
            }
          },
          orderBy: { startDate: 'asc' },
          skip: type === 'leave' ? (page - 1) * limit : 0,
          take: type === 'leave' ? limit : 1000 // If mixed, fetch all then paginate
        }),
        prisma.leaveRequest.count({ where: leaveWhere })
      ]);
    }

    // Fetch approved WFH requests (future only)
    if (type === 'wfh' || type === 'all') {
      const wfhWhere = {
        status: 'APPROVED' as const,
        startDate: { gt: today },
        user: userFilter
      };

      [wfhRequests, wfhCount] = await Promise.all([
        prisma.workFromHomeRequest.findMany({
          where: wfhWhere,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
                role: true
              }
            }
          },
          orderBy: { startDate: 'asc' },
          skip: type === 'wfh' ? (page - 1) * limit : 0,
          take: type === 'wfh' ? limit : 1000
        }),
        prisma.workFromHomeRequest.count({ where: wfhWhere })
      ]);
    }

    // Normalize and combine results
    const normalizedLeave = leaveRequests.map((r: any) => ({
      id: r.id,
      requestType: 'leave' as const,
      employee: {
        name: `${r.user.firstName} ${r.user.lastName}`,
        department: r.user.department,
        email: r.user.email
      },
      type: r.leaveType?.name || 'Normal Leave',
      startDate: r.startDate,
      endDate: r.endDate,
      totalDays: r.totalDays,
      reason: r.reason,
      approvedDate: r.updatedAt
    }));

    const normalizedWfh = wfhRequests.map((r: any) => ({
      id: r.id,
      requestType: 'wfh' as const,
      employee: {
        name: `${r.user.firstName} ${r.user.lastName}`,
        department: r.user.department,
        email: r.user.email
      },
      type: 'Work From Home',
      startDate: r.startDate,
      endDate: r.endDate,
      totalDays: r.totalDays,
      reason: null,
      approvedDate: r.updatedAt
    }));

    let allRequests = [...normalizedLeave, ...normalizedWfh];

    // Sort combined by startDate ascending
    allRequests.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    const totalCount = type === 'all' ? leaveCount + wfhCount
      : type === 'leave' ? leaveCount
      : wfhCount;

    // Apply pagination for combined results
    if (type === 'all') {
      const start = (page - 1) * limit;
      allRequests = allRequests.slice(start, start + limit);
    }

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      requests: allRequests,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching approved leaves:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approved leaves' },
      { status: 500 }
    );
  }
}
