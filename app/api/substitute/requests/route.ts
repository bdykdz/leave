import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// GET: Fetch substitute requests for the current user
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get leave requests where current user is assigned as substitute
    const substituteAssignments = await prisma.leaveRequestSubstitute.findMany({
      where: {
        userId: currentUser.id
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
                department: true
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

    // Separate by status of the leave request
    const pending = substituteAssignments.filter(sub => sub.leaveRequest.status === 'PENDING');
    const accepted = substituteAssignments.filter(sub => sub.leaveRequest.status === 'APPROVED');
    const declined = substituteAssignments.filter(sub => sub.leaveRequest.status === 'REJECTED');

    return NextResponse.json({
      pending,
      accepted,
      declined
    });
  } catch (error) {
    console.error('Error fetching substitute requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch substitute requests' },
      { status: 500 }
    );
  }
}

// POST: Not implemented for this schema model
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Substitute request actions not implemented' },
    { status: 501 }
  );
}