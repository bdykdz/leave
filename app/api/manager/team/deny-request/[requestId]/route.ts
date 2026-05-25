import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { emailService } from "@/lib/email-service"
import { format } from "date-fns"
import { WFHValidationService } from "@/lib/wfh-validation-service"
import { log } from "@/lib/logger"
import { sanitizeComment } from "@/lib/utils/sanitize"
import { DelegationService } from "@/lib/services/delegation-service"

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
    const rawComment = body.comment || ''
    // Strip signature data before sanitizing — sanitizeComment truncates to 1000 chars
    const commentForSanitize = rawComment.replace(/\[SIGNATURE:data:image\/[^\]]+\]/, '')
    const comment = sanitizeComment(commentForSanitize)
    const requestType = body.requestType || 'leave' // 'leave', 'wfh', or 'workTrip'
    const requestId = params.requestId

    console.log('Deny request:', { requestId, requestType, comment, userId: session.user.id })

    // Handle WFH requests separately
    if (requestType === 'wfh') {
      return handleWFHDenial(session, requestId, comment)
    }

    // Handle work trip requests separately
    if (requestType === 'workTrip') {
      return handleWorkTripDenial(session, requestId, comment)
    }

    // Get the leave request and verify manager has permission — fetch ALL approvals for chain integrity
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        approvals: {
          orderBy: { level: 'asc' }
        }
      }
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    // Status pre-check: only PENDING requests can be denied
    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: "Request is not in pending status" },
        { status: 400 }
      )
    }

    // Delegation: managers who delegated their approvals to me (active right now)
    const delegatorIds = await DelegationService.getActiveDelegatorIdsFor(session.user.id)

    // Verify the current user is the manager, department director, assigned approver,
    // or an active delegate of any of those
    const isManager = leaveRequest.user.managerId === session.user.id
    const isDepartmentDirector = leaveRequest.user.departmentDirectorId === session.user.id
    const isAssignedApprover = leaveRequest.approvals.some(
      a => a.approverId === session.user.id && a.status === 'PENDING'
    )
    const isDelegate =
      delegatorIds.includes(leaveRequest.user.managerId ?? '') ||
      delegatorIds.includes(leaveRequest.user.departmentDirectorId ?? '') ||
      leaveRequest.approvals.some(a => a.status === 'PENDING' && delegatorIds.includes(a.approverId))
    if (!isManager && !isDepartmentDirector && !isAssignedApprover && !isDelegate) {
      return NextResponse.json({ error: "Not authorized to deny this request" }, { status: 403 })
    }

    // Wrap all mutations in a transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Find the pending approval for this manager specifically
      let pendingApproval = leaveRequest.approvals.find(
        a => a.approverId === session.user.id && a.status === 'PENDING'
      ) || leaveRequest.approvals.find(
        a => a.approverId === session.user.id
      )

      // Acting as a delegate: take over a delegator's pending approval slot
      let actingOnBehalfOfId: string | null = null
      if (!pendingApproval) {
        const delegated = leaveRequest.approvals.find(
          a => a.status === 'PENDING' && delegatorIds.includes(a.approverId)
        )
        if (delegated) {
          pendingApproval = delegated
          actingOnBehalfOfId = delegated.approverId
        }
      }

      if (!pendingApproval) {
        // Fallback: find any pending approval this manager can act on
        pendingApproval = leaveRequest.approvals.find(a => a.status === 'PENDING')
      }

      if (!pendingApproval) {
        // Last resort: create approval record if none exists at all
        const existingApproval = leaveRequest.approvals[0]
        if (existingApproval) {
          pendingApproval = existingApproval
        } else {
          console.log(`Creating approval record for request ${requestId}`)
          pendingApproval = await tx.approval.create({
            data: {
              leaveRequestId: requestId,
              approverId: session.user.id,
              level: 1, // Manager level
              status: 'PENDING'
            }
          })
        }
      }

      // Update the approval (reassign to the real actor when denying as a delegate)
      await tx.approval.update({
        where: { id: pendingApproval.id },
        data: {
          status: 'REJECTED',
          approverId: session.user.id,
          comments: actingOnBehalfOfId ? `[Respins ca delegat] ${comment}`.trim() : comment,
          approvedAt: new Date()
        }
      })

      // Update leave request status to denied
      await tx.leaveRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' }
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'REQUEST_DENIED',
          entity: 'LEAVE_REQUEST',
          entityId: requestId,
          oldValues: { status: leaveRequest.status },
          newValues: { status: 'REJECTED', reason: comment }
        }
      })

      // Restore leave balance (move from pending back to available)
      // Use request's start date year — balance was deducted in that year at submission time
      const balanceYear = new Date(leaveRequest.startDate).getFullYear()
      try {
        await tx.leaveBalance.update({
          where: {
            userId_leaveTypeId_year: {
              userId: leaveRequest.userId,
              leaveTypeId: leaveRequest.leaveTypeId,
              year: balanceYear
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
        console.error("Failed to restore leave balance:", balanceError)
        throw balanceError // Abort transaction — balance must stay consistent with request status
      }
    })

    // Send email notification to employee (outside transaction — non-critical)
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
          companyName: process.env.COMPANY_NAME || 'TPF',
          requestId: requestId
        });
        console.log(`Rejection email sent to user ID: ${updatedLeaveRequest.user.id}`);
      }
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError);
      // Don't fail the denial if email fails
    }

    // Create in-app notification for the employee
    try {
      const leaveType = await prisma.leaveType.findUnique({
        where: { id: leaveRequest.leaveTypeId }
      })
      await prisma.notification.create({
        data: {
          userId: leaveRequest.userId,
          type: 'LEAVE_REJECTED',
          title: 'Leave Request Rejected',
          message: `Your ${leaveType?.name || 'leave'} request from ${format(leaveRequest.startDate, 'dd MMM yyyy')} to ${format(leaveRequest.endDate, 'dd MMM yyyy')} has been rejected.${comment ? ' Reason: ' + comment : ''}`,
          link: `/employee?tab=requests`
        }
      })
    } catch (notifError) {
      console.error('Warning: Failed to create rejection notification:', notifError)
    }

    return NextResponse.json({
      success: true,
      message: "Request denied successfully"
    })
  } catch (error) {
    console.error("Error denying request:", error)
    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 })
  }
}

// Helper function to handle WFH denials
async function handleWFHDenial(session: any, requestId: string, comment: string) {
  // Signature data already stripped by caller before sanitization
  const cleanComment = comment
  try {
    // Delegation: managers who delegated their approvals to me (active right now)
    const delegatorIds = await DelegationService.getActiveDelegatorIdsFor(session.user.id)
    const actAsIds = [session.user.id, ...delegatorIds]

    // Get the WFH request
    const wfhRequest = await prisma.workFromHomeRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        approvals: {
          where: {
            approverId: { in: actAsIds }
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

    // Verify manager permission (or active delegate of the manager)
    const isManagerOrDelegate =
      wfhRequest.user.managerId === session.user.id ||
      delegatorIds.includes(wfhRequest.user.managerId ?? '')
    if (!isManagerOrDelegate) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }
    const actingOnBehalfOf = wfhRequest.user.managerId !== session.user.id

    // Update approval if exists
    const approval = wfhRequest.approvals[0]
    if (approval) {
      await prisma.wFHApproval.update({
        where: { id: approval.id },
        data: {
          status: 'REJECTED',
          approverId: session.user.id,
          comments: actingOnBehalfOf ? `[Respins ca delegat] ${cleanComment}`.trim() : cleanComment,
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REQUEST_DENIED',
        entity: 'WFH_REQUEST',
        entityId: requestId,
        oldValues: { status: wfhRequest.status },
        newValues: { status: 'REJECTED', reason: cleanComment }
      }
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

// Helper function to handle Work Trip denials
async function handleWorkTripDenial(session: any, requestId: string, comment: string) {
  const cleanComment = comment
  try {
    // Delegation: managers who delegated their approvals to me (active right now)
    const delegatorIds = await DelegationService.getActiveDelegatorIdsFor(session.user.id)
    const actAsIds = [session.user.id, ...delegatorIds]

    const workTripRequest = await prisma.workTripRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        approvals: {
          where: {
            approverId: { in: actAsIds }
          }
        }
      }
    })

    if (!workTripRequest) {
      return NextResponse.json({ error: "Work trip request not found" }, { status: 404 })
    }

    if (workTripRequest.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot deny your own request" }, { status: 403 })
    }

    const isManagerOrDelegate =
      workTripRequest.user.managerId === session.user.id ||
      delegatorIds.includes(workTripRequest.user.managerId ?? '')
    if (!isManagerOrDelegate) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }
    const actingOnBehalfOf = workTripRequest.user.managerId !== session.user.id

    const approval = workTripRequest.approvals[0]
    if (approval) {
      await prisma.workTripApproval.update({
        where: { id: approval.id },
        data: {
          status: 'REJECTED',
          approverId: session.user.id,
          comments: actingOnBehalfOf ? `[Respins ca delegat] ${cleanComment}`.trim() : cleanComment,
          approvedAt: new Date()
        }
      })
    } else {
      await prisma.workTripApproval.create({
        data: {
          workTripRequestId: requestId,
          approverId: session.user.id,
          status: 'REJECTED',
          comments: cleanComment,
          approvedAt: new Date()
        }
      })
    }

    await prisma.workTripRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' }
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REQUEST_DENIED',
        entity: 'WORK_TRIP_REQUEST',
        entityId: requestId,
        oldValues: { status: workTripRequest.status },
        newValues: { status: 'REJECTED', reason: cleanComment }
      }
    })

    // Send email to employee
    try {
      await emailService.sendWorkTripApprovalNotification(workTripRequest.user.email, {
        employeeName: `${workTripRequest.user.firstName} ${workTripRequest.user.lastName}`,
        startDate: format(workTripRequest.startDate, 'dd MMMM yyyy'),
        endDate: format(workTripRequest.endDate, 'dd MMMM yyyy'),
        days: workTripRequest.totalDays,
        destination: workTripRequest.destination,
        purpose: workTripRequest.purpose,
        approved: false,
        managerName: `${session.user.firstName} ${session.user.lastName}`,
        comments: cleanComment
      })
    } catch (emailError) {
      console.error('Error sending work trip rejection email:', emailError)
    }

    log.info('Work trip request rejected', { requestId })

    return NextResponse.json({
      success: true,
      message: "Work trip request rejected"
    })
  } catch (error) {
    console.error("Error rejecting work trip request:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
