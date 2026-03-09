import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET: Fetch manager's own leave/WFH requests
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const pageParam = searchParams.get('page') || '1'
    const limitParam = searchParams.get('limit') || '3'
    const status = searchParams.get('status'); // optional filter
    
    // Validate pagination parameters
    const page = parseInt(pageParam)
    const limit = parseInt(limitParam)
    
    if (isNaN(page) || page > 1000) {
      return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 })
    }
    const safePage = Math.max(1, page)
    
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 })
    }

    // Build where clause
    const where: any = {
      userId: session.user.id
    };

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    // Fetch both leave and WFH requests in parallel.
    // Note: merges two tables in-memory then paginates. Acceptable since this is
    // scoped to a single user's own requests (bounded volume).
    const [totalLeave, leaveRequests, totalWfh, wfhRequests] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        include: {
          leaveType: true,
          approvals: {
            include: {
              approver: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            },
            orderBy: {
              level: 'asc'
            }
          },
          generatedDocument: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.workFromHomeRequest.count({ where }),
      prisma.workFromHomeRequest.findMany({
        where,
        include: {
          approvals: {
            include: {
              approver: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            },
            orderBy: {
              createdAt: 'asc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    // Format leave requests
    const formattedLeave = leaveRequests.map(request => {
      const primaryApproval = request.approvals?.[0];
      return {
        id: request.id,
        type: request.leaveType.name,
        typeCode: request.leaveType.code,
        requestType: 'leave',
        startDate: request.startDate,
        endDate: request.endDate,
        reason: request.reason,
        status: request.status.toLowerCase(),
        totalDays: request.totalDays,
        createdAt: request.createdAt,
        approver: primaryApproval?.approver ? {
          id: primaryApproval.approver.id,
          name: `${primaryApproval.approver.firstName} ${primaryApproval.approver.lastName}`,
          email: primaryApproval.approver.email
        } : null,
        approvals: request.approvals,
        approverComments: primaryApproval?.comments,
        approvedAt: primaryApproval?.approvedAt,
        documents: request.generatedDocument ? [{
          id: request.generatedDocument.id,
          fileName: 'Leave Request Document',
          uploadedAt: request.generatedDocument.createdAt
        }] : []
      };
    });

    // Format WFH requests
    const formattedWfh = wfhRequests.map(request => {
      const primaryApproval = request.approvals?.[0];
      return {
        id: request.id,
        type: 'Work from Home',
        requestType: 'wfh',
        startDate: request.startDate,
        endDate: request.endDate,
        reason: request.location,
        status: request.status.toLowerCase(),
        totalDays: request.totalDays,
        createdAt: request.createdAt,
        approver: primaryApproval?.approver ? {
          id: primaryApproval.approver.id,
          name: `${primaryApproval.approver.firstName} ${primaryApproval.approver.lastName}`,
          email: primaryApproval.approver.email
        } : null,
        approvals: request.approvals,
        approverComments: primaryApproval?.comments,
        approvedAt: primaryApproval?.approvedAt,
        documents: []
      };
    });

    // Merge, sort by createdAt desc, then paginate
    const allRequests = [...formattedLeave, ...formattedWfh]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalRequests = totalLeave + totalWfh;
    const paginatedRequests = allRequests.slice((safePage - 1) * limit, safePage * limit);

    return NextResponse.json({
      requests: paginatedRequests,
      pagination: {
        page: safePage,
        limit,
        total: totalRequests,
        totalPages: Math.ceil(totalRequests / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching manager own requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}