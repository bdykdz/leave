import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { SmartDocumentGenerator } from "@/lib/smart-document-generator"

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
    const requestId = params.requestId
    
    console.log('Approve request:', { requestId, comment, userId: session.user.id })

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
      return NextResponse.json({ error: "Not authorized to approve this request" }, { status: 403 })
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
      where: { id: pendingApproval.id },
      data: {
        status: 'APPROVED',
        comments: cleanComment,
        signature: signature,
        approvedAt: new Date(),
        signedAt: signature ? new Date() : null
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

      // Update leave balance (move from pending to used)
      const currentYear = new Date().getFullYear()
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
          used: {
            increment: leaveRequest.totalDays
          }
        }
      })

      // Handle document signatures
      try {
        // Get the approver's details to determine signature role
        const approver = await prisma.user.findUnique({
          where: { id: session.user.id }
        })
        
        // Determine signature role based on approver's role and requester's role
        let signatureRole = 'manager' // default
        
        if (approver?.role === 'EXECUTIVE' || 
            (approver?.role === 'DEPARTMENT_DIRECTOR' && leaveRequest.user.role === 'MANAGER')) {
          signatureRole = 'department_manager'
        } else if (approver?.role === 'MANAGER' && leaveRequest.user.role === 'EMPLOYEE') {
          signatureRole = 'manager'
        }
        
        // Check if there's already a generated document
        const existingDoc = await prisma.generatedDocument.findUnique({
          where: { leaveRequestId: requestId }
        })
        
        if (existingDoc) {
          // Add appropriate signature to existing document
          const generator = new SmartDocumentGenerator()
          await generator.addSignature(
            existingDoc.id,
            session.user.id,
            signatureRole,
            signature || `APPROVED_BY_${approver?.role}`
          )
          console.log(`${signatureRole} signature added to document:`, existingDoc.id)
        } else {
          // Generate document if it doesn't exist (shouldn't happen in normal flow)
          const leaveType = await prisma.leaveType.findUnique({
            where: { id: leaveRequest.leaveTypeId },
            include: {
              documentTemplates: {
                where: { isActive: true },
                orderBy: { version: 'desc' },
                take: 1
              }
            }
          })
          
          if (leaveType?.documentTemplates.length > 0) {
            const generator = new SmartDocumentGenerator()
            const template = leaveType.documentTemplates[0]
            const documentId = await generator.generateDocument(requestId, template.id)
            
            // Add appropriate signature
            if (documentId) {
              await generator.addSignature(
                documentId,
                session.user.id,
                signatureRole,
                signature || `APPROVED_BY_${approver?.role}`
              )
            }
            
            console.log('Document generated and signed:', documentId)
          }
        }
      } catch (docError) {
        console.error("Error handling document signatures:", docError)
        // Don't fail the approval if document handling fails
      }

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
      details: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}