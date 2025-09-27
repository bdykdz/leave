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
    
    console.log('Executive deny request:', { requestId, comment, userId: session.user.id })

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

    // Update the approval
    await prisma.approval.update({
      where: { id: executiveApproval.id },
      data: {
        status: 'REJECTED',
        comments: comment,
        approvedAt: new Date(),
        approverId: session.user.id // Update approver in case it was created without one
      }
    })

    // Update leave request status to denied
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' }
    })

    // TODO: Send notification to employee

    return NextResponse.json({ 
      success: true,
      message: "Request denied"
    })
  } catch (error) {
    console.error("Error denying request:", error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}