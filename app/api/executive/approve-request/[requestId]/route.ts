import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

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

      // TODO: Send notification to employee
      // TODO: Update calendar/integration systems
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