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
    
    if (isNaN(page) || page < 1 || page > 1000) {
      return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 })
    }
    
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

    // Get total count
    const totalRequests = await prisma.leaveRequest.count({ where });

    // Fetch paginated requests
    const requests = await prisma.leaveRequest.findMany({
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
      },
      skip: (page - 1) * limit,
      take: limit
    });

    // Format the response
    const formattedRequests = requests.map(request => {
      // Get the first approver (primary approver)
      const primaryApproval = request.approvals?.[0];
      
      return {
        id: request.id,
        type: request.leaveType.name,
        typeCode: request.leaveType.code,
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

    return NextResponse.json({
      requests: formattedRequests,
      pagination: {
        page,
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