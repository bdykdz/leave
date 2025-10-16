import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { SmartDocumentGenerator } from "@/lib/smart-document-generator"
import { emailService } from "@/lib/email-service"
import { format } from "date-fns"
import { ValidationService } from "@/lib/validation-service"
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
    
    log.info('Processing approval request', { requestId, requestType, comment, userId: session.user.id })

    // Handle WFH requests separately
    if (requestType === 'wfh') {
      return handleWFHApproval(session, requestId, comment)
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

    // Check for self-approval
    const validationErrors = await ValidationService.validateApprovalPermission(
      session.user.id,
      leaveRequest.userId,
      requestId
    )
    
    if (validationErrors.length > 0) {
      log.warn('Approval validation failed', {
        approverId: session.user.id,
        requesterId: leaveRequest.userId,
        requestId,
        errors: validationErrors
      })
      
      return NextResponse.json(
        { 
          error: validationErrors[0].message,
          code: validationErrors[0].code
        },
        { status: 403 }
      )
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
        
        if (approver?.role === 'EXECUTIVE') {
          signatureRole = 'executive'
        } else if (approver?.role === 'DEPARTMENT_DIRECTOR' && leaveRequest.user.role === 'MANAGER') {
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
          console.log(`Approval email sent to user ID: ${updatedLeaveRequest.user.id}`);
        }
      } catch (emailError) {
        console.error('Error sending approval email:', emailError);
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
      details: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

// Helper function to handle WFH approvals
async function handleWFHApproval(session: any, requestId: string, comment: string) {
  // Extract signature from comment if present
  let signature = null
  let cleanComment = comment
  
  if (comment && comment.includes('[SIGNATURE:')) {
    const signatureMatch = comment.match(/\[SIGNATURE:(.*?)\]/);
    if (signatureMatch) {
      signature = signatureMatch[1];
      cleanComment = comment.replace(/\[SIGNATURE:.*?\]/, '').trim();
    }
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

    // Validate approval permission
    const validationErrors = await WFHValidationService.validateWFHApprovalPermission(
      session.user.id,
      wfhRequest.userId,
      requestId
    )
    
    if (validationErrors.length > 0) {
      log.warn('WFH approval validation failed', {
        approverId: session.user.id,
        requesterId: wfhRequest.userId,
        requestId,
        errors: validationErrors
      })
      
      return NextResponse.json(
        { 
          error: validationErrors[0].message,
          code: validationErrors[0].code
        },
        { status: 403 }
      )
    }

    // Get or create approval record for this specific approver
    let approval = wfhRequest.approvals.find(a => a.approverId === session.user.id)
    if (!approval) {
      approval = await prisma.wFHApproval.create({
        data: {
          wfhRequestId: requestId,
          approverId: session.user.id,
          status: 'PENDING'
        }
      })
    }

    // Update approval
    await prisma.wFHApproval.update({
      where: { id: approval.id },
      data: {
        status: 'APPROVED',
        comments: cleanComment,
        approvedAt: new Date()
      }
    })

    // Update WFH request status
    await prisma.workFromHomeRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED' }
    })

    // Send email to employee
    await emailService.sendWFHApprovalNotification(wfhRequest.user.email, {
      employeeName: `${wfhRequest.user.firstName} ${wfhRequest.user.lastName}`,
      startDate: format(wfhRequest.startDate, 'dd MMMM yyyy'),
      endDate: format(wfhRequest.endDate, 'dd MMMM yyyy'),
      days: wfhRequest.totalDays,
      location: wfhRequest.location,
      approved: true,
      managerName: `${session.user.firstName} ${session.user.lastName}`,
      comments: cleanComment
    })

    log.info('WFH request approved', { requestId })

    return NextResponse.json({
      success: true,
      message: "WFH request approved successfully"
    })
  } catch (error) {
    console.error("Error approving WFH request:", error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}