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
import { sanitizeComment } from "@/lib/utils/sanitize"

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
    const requestType = body.requestType || 'leave' // 'leave', 'wfh', or 'workTrip'
    const requestId = params.requestId

    // Prefer signature as a separate field (new pattern)
    let signature: string | null = body.signature || null

    // Backward compat: extract from comment if clients still embed [SIGNATURE:...] (deprecated)
    let commentForSanitize = rawComment
    if (!signature && rawComment.includes('[SIGNATURE:')) {
      const signatureMatch = rawComment.match(/\[SIGNATURE:(data:image\/[^\]]+)\]/)
      if (signatureMatch) {
        signature = signatureMatch[1]
        commentForSanitize = rawComment.replace(/\[SIGNATURE:data:image\/[^\]]+\]/, '')
        console.warn('[DEPRECATED] Signature embedded in comment — clients should send body.signature instead')
      }
    }

    // Validate signature size (max 50KB)
    if (signature && signature.length > 50000) {
      return NextResponse.json(
        { error: 'Signature data exceeds maximum allowed size' },
        { status: 400 }
      )
    }

    const comment = sanitizeComment(commentForSanitize)

    log.info('Processing approval request', { requestId, requestType, comment, userId: session.user.id })

    // Handle WFH requests separately
    if (requestType === 'wfh') {
      return handleWFHApproval(session, requestId, comment, signature)
    }

    // Handle work trip requests separately
    if (requestType === 'workTrip') {
      return handleWorkTripApproval(session, requestId, comment, signature)
    }

    // Get the leave request and verify manager has permission — fetch ALL approvals for sequential check
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

    // Status pre-check: only PENDING requests can be approved
    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: "Request is not in pending status" },
        { status: 400 }
      )
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

    // Verify the current user is the manager, department director, or assigned approver of the requester
    const isManager = leaveRequest.user.managerId === session.user.id
    const isDepartmentDirector = leaveRequest.user.departmentDirectorId === session.user.id
    const isAssignedApprover = leaveRequest.approvals.some(
      a => a.approverId === session.user.id && a.status === 'PENDING'
    )
    if (!isManager && !isDepartmentDirector && !isAssignedApprover) {
      return NextResponse.json({ error: "Not authorized to approve this request" }, { status: 403 })
    }

    // Find the pending approval for this manager
    let pendingApproval = leaveRequest.approvals.find(
      a => a.approverId === session.user.id && a.status === 'PENDING'
    )

    // Check if this user already approved — if so, don't create a duplicate.
    // This can happen when HR document verification updates the approval record.
    if (!pendingApproval) {
      const existingApproved = leaveRequest.approvals.find(
        a => a.approverId === session.user.id && a.status === 'APPROVED'
      )
      if (existingApproved) {
        // Already approved by this user — check if request status needs fixing
        const allApprovals = await prisma.approval.findMany({
          where: { leaveRequestId: requestId }
        })
        const isAllApproved = allApprovals.every(a => a.status === 'APPROVED')
        if (isAllApproved && leaveRequest.status === 'PENDING') {
          // Fix stuck request: all approvals done but request still PENDING
          const balanceYear = new Date(leaveRequest.startDate).getFullYear()
          await prisma.$transaction(async (tx) => {
            await tx.leaveRequest.update({
              where: { id: requestId },
              data: { status: 'APPROVED' }
            })
            const balance = await tx.leaveBalance.findUnique({
              where: {
                userId_leaveTypeId_year: {
                  userId: leaveRequest.userId,
                  leaveTypeId: leaveRequest.leaveTypeId,
                  year: balanceYear
                }
              }
            })
            if (balance) {
              const totalDays = leaveRequest.totalDays
              const remainingCF = Math.max(0, balance.carriedForward - balance.carriedForwardUsed)
              const cfDeduction = Math.min(totalDays, remainingCF)
              await tx.leaveBalance.update({
                where: { id: balance.id },
                data: {
                  pending: balance.pending - totalDays,
                  used: balance.used + totalDays,
                  carriedForwardUsed: balance.carriedForwardUsed + cfDeduction,
                  available: balance.entitled + balance.carriedForward - (balance.used + totalDays) - (balance.pending - totalDays)
                }
              })
            }
            await tx.auditLog.create({
              data: {
                userId: session.user.id,
                action: 'REQUEST_APPROVED',
                entity: 'LEAVE_REQUEST',
                entityId: requestId,
                oldValues: { status: 'PENDING' },
                newValues: { status: 'APPROVED', comment: comment || null, note: 'Fixed stuck request — approval already existed' }
              }
            })
          })
        }
        return NextResponse.json({
          success: true,
          message: "Request approved successfully",
          allApproved: isAllApproved
        })
      }

      // No existing approval at all — create one
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

    // Sequential approval order check: all lower-level approvals must be APPROVED first
    const lowerLevelApprovals = leaveRequest.approvals.filter(
      a => a.level < pendingApproval!.level && a.id !== pendingApproval!.id
    )
    const hasUnapprovedPrior = lowerLevelApprovals.some(a => a.status !== 'APPROVED')
    if (hasUnapprovedPrior) {
      return NextResponse.json(
        { error: "Previous approval levels must be completed first" },
        { status: 400 }
      )
    }

    // comment is already sanitized, signature already extracted above
    const cleanComment = comment

    // Wrap approval update + status check + balance update in a transaction
    const { allApproved } = await prisma.$transaction(async (tx) => {
      // Update the approval
      await tx.approval.update({
        where: { id: pendingApproval!.id },
        data: {
          status: 'APPROVED',
          comments: cleanComment,
          signature: signature,
          approvedAt: new Date(),
          signedAt: signature ? new Date() : null
        }
      })

      // Check if all approvals are complete (inside transaction)
      const allApprovals = await tx.approval.findMany({
        where: { leaveRequestId: requestId }
      })

      const isAllApproved = allApprovals.every(a => a.status === 'APPROVED')

      // Update leave request status if all approvals are done
      if (isAllApproved) {
        await tx.leaveRequest.update({
          where: { id: requestId },
          data: { status: 'APPROVED' }
        })

        // Update leave balance (move from pending to used) with FIFO carry-forward deduction
        // Use request's start date year — balance was deducted in that year at submission time
        const balanceYear = new Date(leaveRequest.startDate).getFullYear()
        try {
          const balance = await tx.leaveBalance.findUnique({
            where: {
              userId_leaveTypeId_year: {
                userId: leaveRequest.userId,
                leaveTypeId: leaveRequest.leaveTypeId,
                year: balanceYear
              }
            }
          })
          if (!balance) {
            throw new Error(`No leave balance record found for user ${leaveRequest.userId}, leaveType ${leaveRequest.leaveTypeId}, year ${balanceYear}. Cannot approve without a balance record.`)
          }
          const totalDays = leaveRequest.totalDays
          const remainingCF = Math.max(0, balance.carriedForward - balance.carriedForwardUsed)
          const cfDeduction = Math.min(totalDays, remainingCF)
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pending: balance.pending - totalDays,
              used: balance.used + totalDays,
              carriedForwardUsed: balance.carriedForwardUsed + cfDeduction,
              available: balance.entitled + balance.carriedForward - (balance.used + totalDays) - (balance.pending - totalDays)
            }
          })
        } catch (balanceError) {
          console.error('Failed to update leave balance:', balanceError)
          throw balanceError // Abort transaction — balance must stay consistent with request status
        }
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'REQUEST_APPROVED',
          entity: 'LEAVE_REQUEST',
          entityId: requestId,
          oldValues: { status: 'PENDING' },
          newValues: { status: isAllApproved ? 'APPROVED' : 'PENDING', comment: cleanComment || null }
        }
      })

      return { allApproved: isAllApproved }
    })

    // Notify the next approver in the chain if not fully approved yet
    if (!allApproved) {
      try {
        const allApprovals = await prisma.approval.findMany({
          where: { leaveRequestId: requestId },
          orderBy: { level: 'asc' },
          include: { approver: { select: { firstName: true, lastName: true } } }
        })
        const nextPending = allApprovals.find(a => a.status === 'PENDING')
        if (nextPending?.approverId) {
          await prisma.notification.create({
            data: {
              userId: nextPending.approverId,
              type: 'APPROVAL_REQUIRED',
              title: 'Leave Request Pending Your Approval',
              message: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}'s leave request has been approved at the previous level and now requires your approval.`,
              link: `/leave-requests/${requestId}`,
            },
          })
        }
      } catch (notifError) {
        console.error('Warning: Failed to notify next approver:', notifError)
      }
    }

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

    // When fully approved, regenerate document and send emails
    if (allApproved) {
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
      error: "Internal server error"
    }, { status: 500 })
  }
}

// Helper function to handle WFH approvals
async function handleWFHApproval(session: any, requestId: string, comment: string, signature: string | null = null) {
  // Signature is already extracted before sanitization by the caller
  const cleanComment = comment
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

// Helper function to handle Work Trip approvals
async function handleWorkTripApproval(session: any, requestId: string, comment: string, signature: string | null = null) {
  const cleanComment = comment
  try {
    const workTripRequest = await prisma.workTripRequest.findUnique({
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

    if (!workTripRequest) {
      return NextResponse.json({ error: "Work trip request not found" }, { status: 404 })
    }

    // Validate permission - must be manager of requester or assigned as a pending approver
    const isManager = workTripRequest.user.managerId === session.user.id
    const isAssignedApprover = workTripRequest.approvals.some(
      (a: any) => a.approverId === session.user.id && a.status === 'PENDING'
    )
    if (!isManager && !isAssignedApprover) {
      return NextResponse.json({ error: "Not authorized to approve this request" }, { status: 403 })
    }

    if (workTripRequest.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot approve your own request" }, { status: 403 })
    }

    let approval = workTripRequest.approvals.find((a: any) => a.approverId === session.user.id)
    if (!approval) {
      approval = await prisma.workTripApproval.create({
        data: {
          workTripRequestId: requestId,
          approverId: session.user.id,
          status: 'PENDING'
        }
      })
    }

    await prisma.workTripApproval.update({
      where: { id: approval.id },
      data: {
        status: 'APPROVED',
        comments: cleanComment,
        approvedAt: new Date()
      }
    })

    await prisma.workTripRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED' }
    })

    // Send email to employee
    try {
      await emailService.sendWorkTripApprovalNotification(workTripRequest.user.email, {
        employeeName: `${workTripRequest.user.firstName || ''} ${workTripRequest.user.lastName || ''}`.trim(),
        startDate: format(workTripRequest.startDate, 'dd MMMM yyyy'),
        endDate: format(workTripRequest.endDate, 'dd MMMM yyyy'),
        days: workTripRequest.totalDays,
        destination: workTripRequest.destination,
        purpose: workTripRequest.purpose,
        approved: true,
        managerName: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim(),
        comments: cleanComment
      })
    } catch (emailError) {
      console.error('Error sending work trip approval email:', emailError)
    }

    // Invalidate related caches
    try {
      await CacheService.invalidateTeamCache(session.user.id)
      if (workTripRequest.user.managerId && workTripRequest.user.managerId !== session.user.id) {
        await CacheService.invalidateTeamCache(workTripRequest.user.managerId)
      }
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError)
    }

    log.info('Work trip request approved', { requestId })

    return NextResponse.json({
      success: true,
      message: "Work trip request approved successfully"
    })
  } catch (error) {
    console.error("Error approving work trip request:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
