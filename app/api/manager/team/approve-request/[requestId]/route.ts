import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { isNoSubstituteUser } from "@/lib/no-substitute-user"
import { SmartDocumentGenerator } from "@/lib/smart-document-generator"
import { emailService } from "@/lib/email-service"
import { CacheService } from "@/lib/services/cache-service"
import { format } from "date-fns"
import { ValidationService } from "@/lib/validation-service"
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
        leaveType: { select: { code: true, name: true } },
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

    // Delegation: managers who delegated their approvals to me (active right now)
    const delegatorIds = await DelegationService.getActiveDelegatorIdsFor(session.user.id)

    // Check for self-approval (delegation-aware authorization)
    const validationErrors = await ValidationService.validateApprovalPermission(
      session.user.id,
      leaveRequest.userId,
      requestId,
      delegatorIds
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
    // Delegate: I cover for the manager/director, or for whoever holds the pending approval
    const isDelegate =
      delegatorIds.includes(leaveRequest.user.managerId ?? '') ||
      delegatorIds.includes(leaveRequest.user.departmentDirectorId ?? '') ||
      leaveRequest.approvals.some(a => a.status === 'PENDING' && delegatorIds.includes(a.approverId))
    if (!isManager && !isDepartmentDirector && !isAssignedApprover && !isDelegate) {
      return NextResponse.json({ error: "Not authorized to approve this request" }, { status: 403 })
    }

    // Find the pending approval for this manager
    let pendingApproval = leaveRequest.approvals.find(
      a => a.approverId === session.user.id && a.status === 'PENDING'
    )

    // Acting as a delegate: take over the delegator's pending approval slot
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
    const isBDLRequest = leaveRequest.leaveType?.code === 'BDL'
    const isBDLHRValidation = isBDLRequest && pendingApproval!.level === 2
    const { allApproved } = await prisma.$transaction(async (tx) => {
      // Update the approval. When acting as a delegate we reassign the slot to the
      // real actor (me) and flag it, so credit/audit reflect who actually approved.
      await tx.approval.update({
        where: { id: pendingApproval!.id },
        data: {
          status: 'APPROVED',
          approverId: session.user.id,
          comments: actingOnBehalfOfId ? `[Aprobat ca delegat] ${cleanComment}`.trim() : cleanComment,
          signature: signature,
          approvedAt: new Date(),
          signedAt: signature ? new Date() : null
        }
      })

      // For BDL: when HR (level 2) approves, also mark the donation certificate as validated
      if (isBDLHRValidation) {
        await tx.leaveRequest.update({
          where: { id: requestId },
          data: {
            hrDocumentVerified: true,
            hrVerifiedBy: session.user.id,
            hrVerifiedAt: new Date(),
            hrVerificationNotes: cleanComment || null
          }
        })
      }

      // Check if all approvals are complete (inside transaction)
      const allApprovals = await tx.approval.findMany({
        where: { leaveRequestId: requestId }
      })

      let isAllApproved = allApprovals.every(a => a.status === 'APPROVED')

      // Clean up escalation fallback approvals from old workflow (pre-9ec7382).
      // Old workflow created all levels upfront; new workflow creates only level 1.
      // Remaining PENDING levels above the current one are escalation fallbacks.
      // Exceptions (multi-level types needing sequential approval):
      //   - requiresHRVerification=true (HR → manager)
      //   - code='BDL' (manager → HR validates certificate)
      if (!isAllApproved) {
        const leaveTypeForCheck = await tx.leaveType.findUnique({
          where: { id: leaveRequest.leaveTypeId },
          select: { requiresHRVerification: true, code: true }
        })
        const isMultiLevelType = leaveTypeForCheck?.requiresHRVerification || leaveTypeForCheck?.code === 'BDL'
        if (!isMultiLevelType) {
          const currentLevel = pendingApproval!.level
          const remainingPending = allApprovals.filter(
            a => a.status === 'PENDING' && a.level > currentLevel
          )
          if (remainingPending.length > 0) {
            console.log('[approve-request] Cleaning up escalation fallback approvals:',
              remainingPending.map(a => ({ id: a.id, level: a.level, approverId: a.approverId }))
            )
            await tx.approval.deleteMany({
              where: { id: { in: remainingPending.map(a => a.id) } }
            })
            isAllApproved = true
          }
        }
      }

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
          newValues: { status: isAllApproved ? 'APPROVED' : 'PENDING', comment: cleanComment || null, ...(actingOnBehalfOfId ? { delegatedFrom: actingOnBehalfOfId } : {}) }
        }
      })

      return { allApproved: isAllApproved }
    })

    // Notify the next approver in the chain if not fully approved yet
    const isBDL = isBDLRequest
    if (!allApproved) {
      try {
        const allApprovals = await prisma.approval.findMany({
          where: { leaveRequestId: requestId },
          orderBy: { level: 'asc' },
          include: { approver: { select: { firstName: true, lastName: true, email: true } } }
        })
        const nextPending = allApprovals.find(a => a.status === 'PENDING')
        const employeeFullName = `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`
        const startDateFmt = format(leaveRequest.startDate, 'dd MMMM yyyy')

        if (isBDL) {
          // BDL — manager just approved (level 1). Notify: HR (validator), employee, manager.
          const bdlNotifications: Array<{ userId: string; type: 'APPROVAL_REQUIRED' | 'LEAVE_APPROVED'; title: string; message: string; link: string }> = []

          if (nextPending?.approverId) {
            bdlNotifications.push({
              userId: nextPending.approverId,
              type: 'APPROVAL_REQUIRED',
              title: 'Concediu Donare — validare document',
              message: `${employeeFullName} așteaptă validarea certificatului de donare pentru ${startDateFmt}. Vă rugăm să verificați documentul justificativ și să confirmați cererea.`,
              link: `/hr?tab=bdl-validation&request=${requestId}`
            })
          }

          bdlNotifications.push({
            userId: leaveRequest.userId,
            type: 'LEAVE_APPROVED',
            title: 'Concediu Donare aprobat de manager — transmiteți certificatul la HR',
            message: `Cererea dvs. de Concediu Donare pentru ${startDateFmt} a fost aprobată de manager. Pentru validarea finală, transmiteți certificatul de donare către HR.`,
            link: `/employee?tab=requests`
          })

          bdlNotifications.push({
            userId: session.user.id,
            type: 'LEAVE_APPROVED',
            title: 'Ați aprobat Concediu Donare',
            message: `Ați aprobat cererea de Concediu Donare pentru ${employeeFullName} (${startDateFmt}). HR va valida certificatul de donare pentru finalizarea cererii.`,
            link: `/manager?tab=team`
          })

          await prisma.notification.createMany({ data: bdlNotifications })

          // Email HR-ul atribuit ca level 2 validator (dacă există email)
          if (nextPending?.approver?.email) {
            try {
              await emailService.sendLeaveRequestNotification(nextPending.approver.email, {
                employeeName: employeeFullName,
                leaveType: 'Concediu Donare — validare certificat',
                startDate: format(leaveRequest.startDate, 'dd MMMM yyyy'),
                endDate: format(leaveRequest.endDate, 'dd MMMM yyyy'),
                days: leaveRequest.totalDays,
                managerName: `${nextPending.approver.firstName} ${nextPending.approver.lastName}`,
                companyName: process.env.COMPANY_NAME || 'TPF',
                requestId
              })
            } catch (e) {
              console.error('Warning: Failed to send BDL HR validation email:', e)
            }
          }

          // Email angajat — reminder doc către HR
          if (leaveRequest.user.email) {
            try {
              await emailService.sendApprovalNotification(leaveRequest.user.email, {
                employeeName: employeeFullName,
                leaveType: 'Concediu Donare (aprobare intermediară)',
                startDate: format(leaveRequest.startDate, 'dd MMMM yyyy'),
                endDate: format(leaveRequest.endDate, 'dd MMMM yyyy'),
                days: leaveRequest.totalDays,
                approverName: 'Manager',
                status: 'approved',
                comments: 'Cererea a fost aprobată de manager. Pentru validarea finală, vă rugăm să transmiteți certificatul de donare către HR.',
                companyName: process.env.COMPANY_NAME || 'TPF',
                requestId
              })
            } catch (e) {
              console.error('Warning: Failed to send BDL employee intermediate email:', e)
            }
          }
        } else if (nextPending?.approverId) {
          await prisma.notification.create({
            data: {
              userId: nextPending.approverId,
              type: 'APPROVAL_REQUIRED',
              title: 'Leave Request Pending Your Approval',
              message: `${employeeFullName}'s leave request has been approved at the previous level and now requires your approval.`,
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

      // Signature role — default 'manager'. For BDL's HR validation (level 2) use 'hr'.
      const signatureRole = isBDLHRValidation ? 'hr' : 'manager'

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

        if (leaveType && leaveType.documentTemplates.length > 0) {
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

          // Send substitute notification if a substitute is assigned (skip virtual user)
          if (updatedLeaveRequest.substituteId) {
            const substitute = await prisma.user.findUnique({
              where: { id: updatedLeaveRequest.substituteId },
              select: { email: true, firstName: true, lastName: true, employeeId: true }
            });

            if (substitute?.email && !isNoSubstituteUser(substitute.employeeId)) {
              await emailService.sendSubstituteAssignmentEmail(substitute.email, {
                substituteName: `${substitute.firstName} ${substitute.lastName}`,
                employeeName: `${updatedLeaveRequest.user.firstName} ${updatedLeaveRequest.user.lastName}`,
                leaveType: updatedLeaveRequest.leaveType.name,
                startDate: format(updatedLeaveRequest.startDate, 'dd MMMM yyyy'),
                endDate: format(updatedLeaveRequest.endDate, 'dd MMMM yyyy'),
                days: updatedLeaveRequest.totalDays,
                responsibilities: undefined, // LeaveRequest has no substituteNotes field; was always undefined at runtime
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

    // Create in-app notification for the employee when fully approved
    if (allApproved) {
      try {
        const leaveType = await prisma.leaveType.findUnique({
          where: { id: leaveRequest.leaveTypeId }
        })
        const employeeFullName = `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`
        const dateRange = `${format(leaveRequest.startDate, 'dd MMM yyyy')} - ${format(leaveRequest.endDate, 'dd MMM yyyy')}`

        if (isBDLRequest) {
          await prisma.notification.create({
            data: {
              userId: leaveRequest.userId,
              type: 'LEAVE_APPROVED',
              title: 'Concediu Donare validat complet',
              message: `Cererea dvs. de Concediu Donare (${dateRange}) a fost validată complet (manager + HR).`,
              link: `/employee?tab=requests`
            }
          })
          // Notify the manager (level 1 approver) that HR finished the validation
          const managerApproval = leaveRequest.approvals.find(a => a.level === 1)
          if (managerApproval?.approverId && managerApproval.approverId !== session.user.id) {
            await prisma.notification.create({
              data: {
                userId: managerApproval.approverId,
                type: 'LEAVE_APPROVED',
                title: 'BDL validat de HR',
                message: `HR a validat certificatul de donare pentru ${employeeFullName} (${dateRange}). Cererea este acum finalizată.`,
                link: `/manager?tab=team`
              }
            })
          }
        } else {
          await prisma.notification.create({
            data: {
              userId: leaveRequest.userId,
              type: 'LEAVE_APPROVED',
              title: 'Leave Request Approved',
              message: `Your ${leaveType?.name || 'leave'} request from ${format(leaveRequest.startDate, 'dd MMM yyyy')} to ${format(leaveRequest.endDate, 'dd MMM yyyy')} has been approved.`,
              link: `/employee?tab=requests`
            }
          })
        }
      } catch (notifError) {
        console.error('Warning: Failed to create approval notification:', notifError)
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

    // Validate approval permission (delegation-aware)
    const validationErrors = await WFHValidationService.validateWFHApprovalPermission(
      session.user.id,
      wfhRequest.userId,
      requestId,
      delegatorIds
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

    // Get or create approval record. Prefer my own slot; otherwise take over a
    // delegator's pending slot (acting as their delegate).
    let approval = wfhRequest.approvals.find(a => a.approverId === session.user.id)
    let actingOnBehalfOf = false
    if (!approval) {
      const delegated = wfhRequest.approvals.find(a => delegatorIds.includes(a.approverId))
      if (delegated) {
        approval = delegated
        actingOnBehalfOf = true
      }
    }
    if (!approval) {
      approval = await prisma.wFHApproval.create({
        data: {
          wfhRequestId: requestId,
          approverId: session.user.id,
          status: 'PENDING'
        }
      })
    }

    // Update approval (reassign to the real actor when acting as a delegate)
    await prisma.wFHApproval.update({
      where: { id: approval.id },
      data: {
        status: 'APPROVED',
        approverId: session.user.id,
        comments: actingOnBehalfOf ? `[Aprobat ca delegat] ${cleanComment}`.trim() : cleanComment,
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

    // Validate permission - must be manager of requester, an assigned pending approver,
    // or an active delegate of the manager / pending approver
    const isManager = workTripRequest.user.managerId === session.user.id
    const isAssignedApprover = workTripRequest.approvals.some(
      (a: any) => a.approverId === session.user.id && a.status === 'PENDING'
    )
    const isDelegate =
      delegatorIds.includes(workTripRequest.user.managerId ?? '') ||
      workTripRequest.approvals.some((a: any) => a.status === 'PENDING' && delegatorIds.includes(a.approverId))
    if (!isManager && !isAssignedApprover && !isDelegate) {
      return NextResponse.json({ error: "Not authorized to approve this request" }, { status: 403 })
    }

    if (workTripRequest.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot approve your own request" }, { status: 403 })
    }

    let approval = workTripRequest.approvals.find((a: any) => a.approverId === session.user.id)
    let actingOnBehalfOf = false
    if (!approval) {
      const delegated = workTripRequest.approvals.find((a: any) => delegatorIds.includes(a.approverId))
      if (delegated) {
        approval = delegated
        actingOnBehalfOf = true
      }
    }
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
        approverId: session.user.id,
        comments: actingOnBehalfOf ? `[Aprobat ca delegat] ${cleanComment}`.trim() : cleanComment,
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
