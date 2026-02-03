import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// POST: Cancel a leave request (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { reason } = await request.json();

    // Fetch the leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        leaveType: true
      }
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    // Check if request can be cancelled
    if (leaveRequest.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Request is already cancelled' }, { status: 400 });
    }

    if (leaveRequest.status === 'APPROVED') {
      // If approved and has started, cannot cancel
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (leaveRequest.startDate <= today) {
        return NextResponse.json({ error: 'Cannot cancel an approved request that has already started' }, { status: 400 });
      }
    }

    // Perform all database operations in a transaction for data consistency
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Cancel the request
      const cancelledRequest = await tx.leaveRequest.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED',
          approverComments: reason || 'Cancelled by administrator'
        }
      });

      // Restore leave balance based on request status
      if (leaveRequest.leaveTypeId && leaveRequest.totalDays > 0) {
        const currentYear = new Date().getFullYear();
        
        try {
          if (leaveRequest.status === 'APPROVED') {
            // For approved requests, restore from used back to available
            await tx.leaveBalance.update({
              where: {
                userId_leaveTypeId_year: {
                  userId: leaveRequest.userId,
                  leaveTypeId: leaveRequest.leaveTypeId,
                  year: currentYear
                }
              },
              data: {
                used: {
                  decrement: leaveRequest.totalDays
                },
                available: {
                  increment: leaveRequest.totalDays
                }
              }
            });
          } else if (leaveRequest.status === 'PENDING') {
            // For pending requests, restore from pending back to available
            await tx.leaveBalance.update({
              where: {
                userId_leaveTypeId_year: {
                  userId: leaveRequest.userId,
                  leaveTypeId: leaveRequest.leaveTypeId,
                  year: currentYear
                }
              },
              data: {
                pending: {
                  decrement: leaveRequest.totalDays
                },
                available: {
                  increment: leaveRequest.totalDays
                }
              }
            });
          }
        } catch (balanceError) {
          console.error('Warning: Could not restore leave balance:', balanceError);
          // Continue with cancellation even if balance update fails
        }
      }

      return cancelledRequest;
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REQUEST_CANCELLED',
        entity: 'LEAVE_REQUEST',
        entityId: params.id,
        oldValues: { status: leaveRequest.status },
        newValues: { 
          status: 'CANCELLED', 
          reason: reason || 'Cancelled by administrator',
          cancelledBy: session.user.email
        }
      }
    });

    return NextResponse.json({ 
      message: 'Leave request cancelled successfully',
      request: updatedRequest 
    });
  } catch (error) {
    console.error('Error cancelling leave request:', error);
    return NextResponse.json(
      { error: 'Failed to cancel leave request' },
      { status: 500 }
    );
  }
}