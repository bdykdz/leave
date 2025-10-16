import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { emailService } from "@/lib/email-service"
import { format } from "date-fns"
import { WFHValidationService } from "@/lib/wfh-validation-service"
import { log } from "@/lib/logger"

export async function POST(
  request: Request,
  { params }: { params: { requestId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const comment = body.comment || ''
    const requestType = body.requestType || 'leave' // 'leave' or 'wfh'
    const requestId = params.requestId
    
    console.log('Deny request:', { requestId, requestType, comment, userId: session.user.id })

    // Handle WFH requests separately
    if (requestType === 'wfh') {
      return handleWFHDenial(session, requestId, comment)
    }

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
        console.log(`Rejection email sent to user ID: ${updatedLeaveRequest.user.id}`);
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

// Helper function to handle WFH denials
async function handleWFHDenial(session: any, requestId: string, comment: string) {
  // Extract signature from comment if present (though usually not needed for denials)
  let cleanComment = comment
  
  if (comment && comment.includes('[SIGNATURE:')) {
    cleanComment = comment.replace(/\[SIGNATURE:.*?\]/, '').trim();
  }
  try {
    // Get the WFH request
    const wfhRequest = await prisma.workFromHomeRequest.findUnique({
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

    if (!wfhRequest) {
      return NextResponse.json({ error: "WFH request not found" }, { status: 404 })
    }

    // Validate permission (check for self-denial which shouldn't happen but check anyway)
    if (wfhRequest.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot deny your own request" }, { status: 403 })
    }

    // Verify manager permission
    if (wfhRequest.user.managerId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Update approval if exists
    const approval = wfhRequest.approvals[0]
    if (approval) {
      await prisma.wFHApproval.update({
        where: { id: approval.id },
        data: {
          status: 'REJECTED',
          comments: cleanComment,
          approvedAt: new Date()
        }
      })
    } else {
      // Create rejection approval record
      await prisma.wFHApproval.create({
        data: {
          wfhRequestId: requestId,
          approverId: session.user.id,
          status: 'REJECTED',
          comments: cleanComment,
          approvedAt: new Date()
        }
      })
    }

    // Update WFH request status
    await prisma.workFromHomeRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' }
    })

    // Send email to employee
    await emailService.sendWFHApprovalNotification(wfhRequest.user.email, {
      employeeName: `${wfhRequest.user.firstName} ${wfhRequest.user.lastName}`,
      startDate: format(wfhRequest.startDate, 'dd MMMM yyyy'),
      endDate: format(wfhRequest.endDate, 'dd MMMM yyyy'),
      days: wfhRequest.totalDays,
      location: wfhRequest.location,
      approved: false,
      managerName: `${session.user.firstName} ${session.user.lastName}`,
      comments: cleanComment
    })

    log.info('WFH request rejected', { requestId })

    return NextResponse.json({
      success: true,
      message: "WFH request rejected"
    })
  } catch (error) {
    console.error("Error rejecting WFH request:", error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}