import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { emailService } from "@/lib/email-service"
import { format } from "date-fns"

export async function POST(
  request: Request,
  { params }: { params: { requestId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { comment } = await request.json()
    const requestId = params.requestId
    
    console.log('Deny request:', { requestId, comment, userId: session.user.id })

    // Get the leave request and verify manager has permission
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        approvals: {
          where: {
            approverId: session.user.id
          }
        }
      }
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    // Verify the current user is the manager of the requester
    if (leaveRequest.user.managerId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized to deny this request" }, { status: 403 })
    }

    // Verify there's a pending approval for this manager
    let pendingApproval = leaveRequest.approvals.find(a => a.status === 'PENDING')
    
    // If no approval record exists, create one
    if (!pendingApproval) {
      console.log(`Creating approval record for request ${requestId}`)
      pendingApproval = await prisma.approval.create({
        data: {
          leaveRequestId: requestId,
          approverId: session.user.id,
          level: 1, // Manager level
          status: 'PENDING'
        }
      })
    }

    // Update the approval
    await prisma.approval.update({
      where: { id: pendingApproval.id },
      data: {
        status: 'REJECTED',
        comments: comment,
        approvedAt: new Date()
      }
    })

    // Update leave request status to denied
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' }
    })

    // Restore leave balance (move from pending back to available)
    const currentYear = new Date().getFullYear()
    try {
      await prisma.leaveBalance.update({
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
      })
    } catch (balanceError) {
      console.error("Warning: Could not restore leave balance:", balanceError)
      // Continue with the denial even if balance update fails
    }

    // Send email notification to employee
    try {
      const updatedLeaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: requestId },
        include: {
          user: true,
          leaveType: true
        }
      });
      
      const approver = await prisma.user.findUnique({
        where: { id: session.user.id }
      });

      if (updatedLeaveRequest?.user?.email && approver) {
        await emailService.sendApprovalNotification(updatedLeaveRequest.user.email, {
          employeeName: `${updatedLeaveRequest.user.firstName} ${updatedLeaveRequest.user.lastName}`,
          leaveType: updatedLeaveRequest.leaveType.name,
          startDate: format(updatedLeaveRequest.startDate, 'dd MMMM yyyy'),
          endDate: format(updatedLeaveRequest.endDate, 'dd MMMM yyyy'),
          days: updatedLeaveRequest.totalDays,
          approverName: `${approver.firstName} ${approver.lastName}`,
          status: 'rejected',
          comments: comment || undefined,
          companyName: process.env.COMPANY_NAME || 'Company',
          requestId: requestId
        });
        console.log(`Rejection email sent to ${updatedLeaveRequest.user.email}`);
      }
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError);
      // Don't fail the denial if email fails
    }

    return NextResponse.json({ 
      success: true,
      message: "Request denied successfully"
    })
  } catch (error) {
    console.error("Error denying request:", error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}