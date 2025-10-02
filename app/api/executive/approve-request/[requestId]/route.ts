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

    // Check if user is an executive
    if (!["EXECUTIVE", "HR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const body = await request.json()
    const comment = body.comment || ''
    const requestId = params.requestId
    
    console.log('Executive approve request:', { requestId, comment, userId: session.user.id })

    // Get the leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        approvals: true
      }
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    // Find the executive approval record
    let executiveApproval = leaveRequest.approvals.find(a => a.level === 2 && a.status === 'PENDING')
    
    // If no approval record exists, create one
    if (!executiveApproval) {
      console.log(`Creating executive approval record for request ${requestId}`)
      executiveApproval = await prisma.approval.create({
        data: {
          leaveRequestId: requestId,
          approverId: session.user.id,
          level: 2, // Executive level
          status: 'PENDING'
        }
      })
    }

    // Extract signature from comment if present
    let signature = null
    let cleanComment = comment
    
    if (comment && comment.includes('[SIGNATURE:')) {
      const signatureMatch = comment.match(/\[SIGNATURE:(.*?)\]/)
      if (signatureMatch) {
        signature = signatureMatch[1]
        cleanComment = comment.replace(/\[SIGNATURE:.*?\]/, '').trim()
      }
    }

    // Update the approval
    await prisma.approval.update({
      where: { id: executiveApproval.id },
      data: {
        status: 'APPROVED',
        comments: cleanComment,
        signature: signature,
        approvedAt: new Date(),
        signedAt: signature ? new Date() : null,
        approverId: session.user.id // Update approver in case it was created without one
      }
    })

    // Check if all approvals are complete
    const allApprovals = await prisma.approval.findMany({
      where: { leaveRequestId: requestId }
    })

    const allApproved = allApprovals.every(a => a.status === 'APPROVED')

    // Update leave request status if all approvals are done
    if (allApproved) {
      await prisma.leaveRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED' }
      })

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
            status: 'approved',
            comments: cleanComment || undefined,
            companyName: process.env.COMPANY_NAME || 'Company',
            requestId: requestId
          });
          console.log(`Executive approval email sent to ${updatedLeaveRequest.user.email}`);
        }
      } catch (emailError) {
        console.error('Error sending executive approval email:', emailError);
        // Don't fail the approval if email fails
      }
    }

    return NextResponse.json({ 
      success: true,
      message: "Request approved successfully",
      allApproved 
    })
  } catch (error) {
    console.error("Error approving request:", error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}