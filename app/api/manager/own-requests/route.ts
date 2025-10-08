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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '3');
    const status = searchParams.get('status'); // optional filter

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
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        documents: {
          select: {
            id: true,
            fileName: true,
            uploadedAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    // Format the response
    const formattedRequests = requests.map(request => ({
      id: request.id,
      type: request.leaveType.name,
      typeCode: request.leaveType.code,
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason,
      status: request.status.toLowerCase(),
      totalDays: request.totalDays,
      createdAt: request.createdAt,
      approver: request.approver ? {
        id: request.approver.id,
        name: `${request.approver.firstName} ${request.approver.lastName}`,
        email: request.approver.email
      } : null,
      approverComments: request.approverComments,
      approvedAt: request.approvedAt,
      documents: request.documents.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        uploadedAt: doc.uploadedAt
      }))
    }));

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