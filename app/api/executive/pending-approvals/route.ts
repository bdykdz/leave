import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
    // Fix #9: Clamp pagination to prevent DoS and NaN edge cases
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10') || 10, 1), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1);
    const skip = (page - 1) * limit;

    // Fix #14: Only show requests this executive can actually act on:
    // 1. Requests where this executive has a PENDING approval record (assigned approver)
    // 2. Requests from direct reports (managerId = this user)
    const whereClause: Prisma.LeaveRequestWhereInput = {
      status: 'PENDING' as const,
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
          // Requests from direct reports
          user: {
            managerId: session.user.id
          }
        }
      ]
    };

    const [requests, totalCount] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: whereClause,
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
        where: whereClause
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
