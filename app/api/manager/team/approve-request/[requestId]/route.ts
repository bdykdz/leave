import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { SmartDocumentGenerator } from "@/lib/smart-document-generator"
import { emailService } from "@/lib/email-service"
import { CacheService } from "@/lib/services/cache-service"
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

    // Add current approver's signature to document immediately (before checking allApproved)
    try {
      const approver = await prisma.user.findUnique({
        where: { id: session.user.id }
      })

      // This endpoint only allows the direct manager to approve,
      // so the signature role is always 'manager' regardless of the approver's system role
      const signatureRole = 'manager'

      // Check if there's already a generated document
      let existingDoc = await prisma.generatedDocument.findUnique({
        where: { leaveRequestId: requestId }
      })

      if (existingDoc) {
        const generator = new SmartDocumentGenerator()
        await generator.addSignature(
          existingDoc.id,
          session.user.id,
          signatureRole,
          signature || `APPROVED_BY_${approver?.role}`
        )
        console.log(`${signatureRole} signature added to document:`, existingDoc.id)
      } else {
        // Generate document if it doesn't exist
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
      console.error("Error handling document signature:", docError)
      // Don't fail the approval if document handling fails
    }

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

      // Regenerate document with all signatures included
      try {
        const existingDoc = await prisma.generatedDocument.findUnique({
          where: { leaveRequestId: requestId },
          include: { template: true }
        })
        if (existingDoc?.template) {
          const generator = new SmartDocumentGenerator()
          await generator.generateDocument(requestId, existingDoc.template.id)
          console.log('Document regenerated with all signatures')
        }
      } catch (docError) {
        console.error("Error regenerating document:", docError)
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
            companyName: process.env.COMPANY_NAME || 'TPF',
            requestId: requestId
          });
          console.log(`Approval email sent to user ID: ${updatedLeaveRequest.user.id}`);

          // Send substitute notification if a substitute is assigned
          if (updatedLeaveRequest.substituteId) {
            const substitute = await prisma.user.findUnique({
              where: { id: updatedLeaveRequest.substituteId }
            });

            if (substitute?.email) {
              await emailService.sendSubstituteAssignmentEmail(substitute.email, {
                substituteName: `${substitute.firstName} ${substitute.lastName}`,
                employeeName: `${updatedLeaveRequest.user.firstName} ${updatedLeaveRequest.user.lastName}`,
                leaveType: updatedLeaveRequest.leaveType.name,
                startDate: format(updatedLeaveRequest.startDate, 'dd MMMM yyyy'),
                endDate: format(updatedLeaveRequest.endDate, 'dd MMMM yyyy'),
                days: updatedLeaveRequest.totalDays,
                responsibilities: updatedLeaveRequest.substituteNotes || undefined,
                contactInfo: updatedLeaveRequest.user.email || undefined,
                companyName: process.env.COMPANY_NAME || 'TPF'
              });
              console.log(`Substitute assignment email sent to: ${substitute.email}`);
            }
          }
        }
      } catch (emailError) {
        console.error('Error sending approval email:', emailError);
        // Don't fail the approval if email fails
      }
    }

    // Invalidate related caches after approval
    try {
      await CacheService.invalidateTeamCache(session.user.id)
      // Also invalidate the requester's manager cache if different
      if (leaveRequest.user.managerId && leaveRequest.user.managerId !== session.user.id) {
        await CacheService.invalidateTeamCache(leaveRequest.user.managerId)
      }
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError)
      // Don't fail approval if cache invalidation fails
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
    try {
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
    } catch (emailError) {
      console.error('Error sending WFH approval email:', emailError)
      // Don't fail the approval if email fails
    }

    // Invalidate related caches after WFH approval
    try {
      await CacheService.invalidateTeamCache(session.user.id)
      if (wfhRequest.user.managerId && wfhRequest.user.managerId !== session.user.id) {
        await CacheService.invalidateTeamCache(wfhRequest.user.managerId)
      }
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError)
      // Don't fail approval if cache invalidation fails
    }

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