import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'EXECUTIVE' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Get escalated leave requests that require executive approval
    // OR requests where this executive is a pending approver
    const [requests, totalCount] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { requiresExecutiveApproval: true },
            {
              approvals: {
                some: {
                  approverId: session.user.id,
                  status: 'PENDING'
                }
              }
            }
          ]
        },
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
          leaveType: true,
          approvals: {
            include: {
              approver: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true
                }
              }
            },
            orderBy: { createdAt: 'asc' }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.leaveRequest.count({
        where: {
          status: 'PENDING',
          OR: [
            { requiresExecutiveApproval: true },
            {
              approvals: {
                some: {
                  approverId: session.user.id,
                  status: 'PENDING'
                }
              }
            }
          ]
        }
      })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      requests,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending approvals' },
      { status: 500 }
    );
  }
}
