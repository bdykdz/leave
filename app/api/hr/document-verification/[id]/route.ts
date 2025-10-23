import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is HR, ADMIN, EXECUTIVE, or EMPLOYEE with HR department
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })
    
    const isHREmployee = user?.role === 'EMPLOYEE' && user?.department?.toLowerCase().includes('hr')
    
    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { approved, notes } = body

    // Get the leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        leaveType: true,
        user: true,
      },
    })

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      )
    }

    if (!leaveRequest.leaveType.requiresHRVerification) {
      return NextResponse.json(
        { error: 'This leave type does not require HR verification' },
        { status: 400 }
      )
    }

    // Update the leave request with verification status
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: params.id },
      data: {
        hrDocumentVerified: approved,
        hrVerifiedBy: session.user.id,
        hrVerifiedAt: new Date(),
        hrVerificationNotes: notes,
        // If rejected, update status
        status: approved ? 'PENDING' : 'REJECTED',
      },
    })

    // Create notification for the employee
    await prisma.notification.create({
      data: {
        userId: leaveRequest.userId,
        type: approved ? 'LEAVE_REQUESTED' : 'LEAVE_REJECTED',
        title: approved 
          ? 'Documents Verified' 
          : 'Documents Rejected',
        message: approved
          ? `Your supporting documents for ${leaveRequest.leaveType.name} have been verified. Your request is now pending manager approval.`
          : `Your supporting documents for ${leaveRequest.leaveType.name} were not approved. ${notes ? 'Reason: ' + notes : 'Please contact HR for more information.'}`,
        link: `/leave-requests/${leaveRequest.id}`,
      },
    })

    // If approved, notify the manager
    if (approved && leaveRequest.user.managerId) {
      await prisma.notification.create({
        data: {
          userId: leaveRequest.user.managerId,
          type: 'APPROVAL_REQUIRED',
          title: 'Leave Request Pending Approval',
          message: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName} has submitted a ${leaveRequest.leaveType.name} request (HR verified).`,
          link: `/leave-requests/${leaveRequest.id}`,
        },
      })
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: approved ? 'HR_DOCUMENT_APPROVED' : 'HR_DOCUMENT_REJECTED',
        entity: 'LeaveRequest',
        entityId: leaveRequest.id,
        newValues: {
          hrDocumentVerified: approved,
          hrVerificationNotes: notes,
        },
      },
    })

    return NextResponse.json({ 
      success: true,
      request: updatedRequest,
    })
  } catch (error) {
    console.error('Failed to process verification:', error)
    return NextResponse.json(
      { error: 'Failed to process verification' },
      { status: 500 }
    )
  }
}