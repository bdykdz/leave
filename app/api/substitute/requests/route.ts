import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET: Fetch substitute requests for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current user from the database
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get pending substitute requests
    const pendingRequests = await prisma.substituteRequest.findMany({
      where: {
        substituteId: currentUser.id,
        status: 'PENDING'
      },
      include: {
        leaveRequest: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: {
                  select: {
                    name: true
                  }
                }
              }
            },
            leaveType: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get accepted substitute requests
    const acceptedRequests = await prisma.substituteRequest.findMany({
      where: {
        substituteId: currentUser.id,
        status: 'ACCEPTED'
      },
      include: {
        leaveRequest: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            leaveType: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    // Get declined substitute requests (recent)
    const declinedRequests = await prisma.substituteRequest.findMany({
      where: {
        substituteId: currentUser.id,
        status: 'DECLINED',
        updatedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      include: {
        leaveRequest: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json({
      pending: pendingRequests,
      accepted: acceptedRequests,
      declined: declinedRequests
    });
  } catch (error) {
    console.error('Error fetching substitute requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch substitute requests' },
      { status: 500 }
    );
  }
}

// POST: Accept or decline a substitute request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current user from the database
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, firstName: true, lastName: true }
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { requestId, action, reason } = await request.json();

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use accept or decline' },
        { status: 400 }
      );
    }

    // Find the substitute request
    const substituteRequest = await prisma.substituteRequest.findUnique({
      where: { id: requestId },
      include: {
        leaveRequest: {
          include: {
            user: true
          }
        }
      }
    });

    if (!substituteRequest) {
      return NextResponse.json(
        { error: 'Substitute request not found' },
        { status: 404 }
      );
    }

    if (substituteRequest.substituteId !== currentUser.id) {
      return NextResponse.json(
        { error: 'Not authorized to respond to this request' },
        { status: 403 }
      );
    }

    if (substituteRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Request already ${substituteRequest.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Check if substitute is available (not on leave themselves)
    if (action === 'accept') {
      const conflictingLeave = await prisma.leaveRequest.findFirst({
        where: {
          userId: currentUser.id,
          status: { in: ['APPROVED', 'PENDING'] },
          startDate: { lte: substituteRequest.leaveRequest.endDate },
          endDate: { gte: substituteRequest.leaveRequest.startDate }
        }
      });

      if (conflictingLeave) {
        return NextResponse.json(
          { error: 'You have conflicting leave during this period' },
          { status: 400 }
        );
      }
    }

    // Update the substitute request
    const updatedRequest = await prisma.substituteRequest.update({
      where: { id: requestId },
      data: {
        status: action === 'accept' ? 'ACCEPTED' : 'DECLINED',
        responseDate: new Date(),
        responseReason: reason || null
      }
    });

    // Create notification for the requester
    await prisma.notification.create({
      data: {
        userId: substituteRequest.leaveRequest.userId,
        type: 'GENERAL',
        title: action === 'accept' 
          ? 'Substitute Request Accepted' 
          : 'Substitute Request Declined',
        message: action === 'accept'
          ? `${currentUser.firstName} ${currentUser.lastName} has accepted to be your substitute`
          : `${currentUser.firstName} ${currentUser.lastName} has declined to be your substitute${reason ? ': ' + reason : ''}`,
        link: `/leave/${substituteRequest.leaveRequestId}`
      }
    });

    // If this was the last pending substitute and it was declined, notify user to select another
    if (action === 'decline') {
      const otherPendingSubstitutes = await prisma.substituteRequest.count({
        where: {
          leaveRequestId: substituteRequest.leaveRequestId,
          id: { not: requestId },
          status: 'PENDING'
        }
      });

      if (otherPendingSubstitutes === 0) {
        const acceptedSubstitutes = await prisma.substituteRequest.count({
          where: {
            leaveRequestId: substituteRequest.leaveRequestId,
            status: 'ACCEPTED'
          }
        });

        if (acceptedSubstitutes === 0) {
          await prisma.notification.create({
            data: {
              userId: substituteRequest.leaveRequest.userId,
              type: 'ACTION_REQUIRED',
              title: 'No Substitute Available',
              message: 'All substitute requests have been declined. Please select new substitutes for your leave request.',
              link: `/leave/${substituteRequest.leaveRequestId}/edit`
            }
          });
        }
      }
    }

    return NextResponse.json({
      message: `Substitute request ${action}ed successfully`,
      request: updatedRequest
    });
  } catch (error) {
    console.error('Error responding to substitute request:', error);
    return NextResponse.json(
      { error: 'Failed to respond to substitute request' },
      { status: 500 }
    );
  }
}