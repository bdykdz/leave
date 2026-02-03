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

    // Get leave requests that require this executive's attention:
    // 1. Requests where this executive is assigned as approver
    // 2. Requests from other executives (peer approval)
    // 3. Escalated requests from managers who report to this executive
    // 4. High-level requests from managers/directors
    const [requests, totalCount] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: {
          status: 'PENDING',
          // Exclude the executive's own requests (cannot approve own request)
          userId: { not: session.user.id },
          OR: [
            {
              // Has pending approval for this executive
              approvals: {
                some: {
                  approverId: session.user.id,
                  status: 'PENDING'
                }
              }
            },
            {
              // Requests from other executives (peer executive approval)
              user: {
                role: 'EXECUTIVE',
                id: { not: session.user.id }
              }
            },
            {
              // Escalated requests from managers who report to this executive
              user: {
                role: 'MANAGER',
                managerId: session.user.id
              }
            },
            {
              // High-level requests that might need executive approval
              AND: [
                { totalDays: { gte: 10 } }, // Requests >= 10 days typically need executive approval
                {
                  user: {
                    OR: [
                      { role: 'MANAGER' },
                      { role: 'DEPARTMENT_DIRECTOR' }
                    ]
                  }
                }
              ]
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
          userId: { not: session.user.id },
          OR: [
            {
              approvals: {
                some: {
                  approverId: session.user.id,
                  status: 'PENDING'
                }
              }
            },
            {
              user: {
                role: 'EXECUTIVE',
                id: { not: session.user.id }
              }
            },
            {
              user: {
                role: 'MANAGER',
                managerId: session.user.id
              }
            },
            {
              AND: [
                { totalDays: { gte: 10 } },
                {
                  user: {
                    OR: [
                      { role: 'MANAGER' },
                      { role: 'DEPARTMENT_DIRECTOR' }
                    ]
                  }
                }
              ]
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
