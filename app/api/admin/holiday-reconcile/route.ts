import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { SmartDocumentGenerator } from '@/lib/smart-document-generator'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const dryRun = body.dryRun === true

    // 1. Fetch all active holidays
    const holidays = await prisma.holiday.findMany({
      where: { isActive: true },
      select: { id: true, date: true, nameEn: true }
    })

    if (holidays.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active holidays found',
        affected: [],
        summary: { totalRequests: 0, totalDaysRestored: 0, dryRun }
      })
    }

    // Normalize holiday dates to YYYY-MM-DD strings for comparison
    const holidayDateStrings = new Set(
      holidays.map(h => h.date.toISOString().split('T')[0])
    )
    const holidayLookup = new Map(
      holidays.map(h => [h.date.toISOString().split('T')[0], h.nameEn])
    )

    // 2. Fetch all APPROVED/PENDING leave requests that have selectedDates
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        status: { in: ['APPROVED', 'PENDING'] },
        selectedDates: { isEmpty: false }
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        leaveType: {
          select: {
            id: true,
            name: true,
            documentTemplates: {
              where: { isActive: true },
              orderBy: { version: 'desc' as const },
              take: 1
            }
          }
        },
        generatedDocument: {
          include: { template: true, signatures: true }
        },
        approvals: {
          where: { status: 'APPROVED' },
          include: {
            approver: { select: { id: true, role: true, firstName: true, lastName: true } }
          }
        }
      }
    })

    // 3. Find affected requests — those with selectedDates matching a holiday
    const affected: Array<{
      requestId: string
      requestNumber: string
      userId: string
      userName: string
      leaveType: string
      status: string
      holidayDatesRemoved: string[]
      holidayNames: string[]
      oldTotalDays: number
      newTotalDays: number
      daysRestored: number
      oldStartDate: string
      oldEndDate: string
      newStartDate: string | null
      newEndDate: string | null
      willCancel: boolean
    }> = []

    for (const lr of leaveRequests) {
      const selectedDateStrings = lr.selectedDates.map(
        d => d.toISOString().split('T')[0]
      )

      const overlapping = selectedDateStrings.filter(d => holidayDateStrings.has(d))

      if (overlapping.length === 0) continue

      const remaining = selectedDateStrings.filter(d => !holidayDateStrings.has(d))
      const willCancel = remaining.length === 0
      const daysRestored = overlapping.length

      // Determine new start/end from remaining dates
      let newStartDate: string | null = null
      let newEndDate: string | null = null
      if (!willCancel) {
        const sorted = remaining.sort()
        newStartDate = sorted[0]
        newEndDate = sorted[sorted.length - 1]
      }

      affected.push({
        requestId: lr.id,
        requestNumber: lr.requestNumber,
        userId: lr.userId,
        userName: `${lr.user.firstName} ${lr.user.lastName}`,
        leaveType: lr.leaveType.name,
        status: lr.status,
        holidayDatesRemoved: overlapping,
        holidayNames: overlapping.map(d => holidayLookup.get(d) || 'Unknown'),
        oldTotalDays: lr.totalDays,
        newTotalDays: willCancel ? 0 : lr.totalDays - daysRestored,
        daysRestored,
        oldStartDate: lr.startDate.toISOString().split('T')[0],
        oldEndDate: lr.endDate.toISOString().split('T')[0],
        newStartDate,
        newEndDate,
        willCancel
      })
    }

    if (affected.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leave requests overlap with holidays — nothing to reconcile',
        affected: [],
        summary: { totalRequests: 0, totalDaysRestored: 0, dryRun }
      })
    }

    // 4. If dry run, return preview
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: `Dry run: ${affected.length} request(s) would be updated`,
        affected,
        summary: {
          totalRequests: affected.length,
          totalDaysRestored: affected.reduce((sum, a) => sum + a.daysRestored, 0),
          dryRun: true
        }
      })
    }

    // 5. Apply changes in a transaction
    const currentYear = new Date().getFullYear()
    const balanceWarnings: string[] = []

    await prisma.$transaction(async (tx) => {
      for (const item of affected) {
        const lr = leaveRequests.find(r => r.id === item.requestId)!

        if (item.willCancel) {
          // All selected dates are holidays — cancel the entire request
          await tx.leaveRequest.update({
            where: { id: item.requestId },
            data: {
              status: 'CANCELLED',
              selectedDates: [],
              totalDays: 0,
              approverComments: `Auto-cancelled: all selected dates are public holidays (${item.holidayNames.join(', ')})`
            }
          })
        } else {
          // Remove holiday dates, adjust totals
          const newSelectedDates = lr.selectedDates.filter(
            d => !holidayDateStrings.has(d.toISOString().split('T')[0])
          )

          await tx.leaveRequest.update({
            where: { id: item.requestId },
            data: {
              selectedDates: newSelectedDates,
              totalDays: item.newTotalDays,
              startDate: new Date(item.newStartDate!),
              endDate: new Date(item.newEndDate!)
            }
          })
        }

        // Restore balance
        const daysToRestore = item.daysRestored

        if (lr.status === 'APPROVED') {
          // Reverse FIFO: restore carried-forward days first
          const balance = await tx.leaveBalance.findUnique({
            where: {
              userId_leaveTypeId_year: {
                userId: item.userId,
                leaveTypeId: lr.leaveTypeId,
                year: currentYear
              }
            }
          })

          if (balance) {
            const cfRestore = Math.min(daysToRestore, balance.carriedForwardUsed)
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                used: balance.used - daysToRestore,
                carriedForwardUsed: balance.carriedForwardUsed - cfRestore,
                available: balance.entitled + balance.carriedForward
                  - (balance.used - daysToRestore)
                  - balance.pending
              }
            })
          } else {
            balanceWarnings.push(
              `No balance record for user ${item.userName} (${item.userId}), leave type ${lr.leaveTypeId}, year ${currentYear}`
            )
          }
        } else if (lr.status === 'PENDING') {
          const balance = await tx.leaveBalance.findUnique({
            where: {
              userId_leaveTypeId_year: {
                userId: item.userId,
                leaveTypeId: lr.leaveTypeId,
                year: currentYear
              }
            }
          })

          if (balance) {
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                pending: balance.pending - daysToRestore,
                available: balance.entitled + balance.carriedForward
                  - balance.used
                  - (balance.pending - daysToRestore)
              }
            })
          } else {
            balanceWarnings.push(
              `No balance record for user ${item.userName} (${item.userId}), leave type ${lr.leaveTypeId}, year ${currentYear}`
            )
          }
        }

        // Audit log
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'HOLIDAY_RECONCILIATION',
            entity: 'LEAVE_REQUEST',
            entityId: item.requestId,
            oldValues: {
              totalDays: item.oldTotalDays,
              startDate: item.oldStartDate,
              endDate: item.oldEndDate,
              selectedDatesCount: lr.selectedDates.length,
              status: lr.status
            },
            newValues: {
              totalDays: item.newTotalDays,
              startDate: item.newStartDate,
              endDate: item.newEndDate,
              selectedDatesCount: lr.selectedDates.length - item.daysRestored,
              status: item.willCancel ? 'CANCELLED' : lr.status,
              holidayDatesRemoved: item.holidayDatesRemoved,
              holidayNames: item.holidayNames,
              daysRestored: item.daysRestored
            }
          }
        })

        // Notification
        await tx.notification.create({
          data: {
            userId: item.userId,
            type: 'LEAVE_CANCELLED',
            title: 'Leave Request Updated — Holiday Reconciliation',
            message: item.willCancel
              ? `Your leave request ${item.requestNumber} was cancelled because all dates fall on public holidays (${item.holidayNames.join(', ')}). ${item.daysRestored} day(s) restored to your balance.`
              : `Your leave request ${item.requestNumber} was adjusted: ${item.holidayDatesRemoved.join(', ')} removed (public holiday: ${item.holidayNames.join(', ')}). ${item.daysRestored} day(s) restored to your balance.`,
            link: '/employee?tab=requests'
          }
        })
      }
    })

    // 6. Regenerate PDFs (outside transaction — failure shouldn't roll back data fixes)
    const regenResults: Array<{ requestId: string; requestNumber: string; success: boolean; error?: string }> = []

    for (const item of affected) {
      if (item.willCancel) {
        regenResults.push({ requestId: item.requestId, requestNumber: item.requestNumber, success: true, error: 'Skipped — request cancelled' })
        continue
      }

      try {
        const lr = leaveRequests.find(r => r.id === item.requestId)!

        // Find template
        let templateId: string | null = null
        if (lr.leaveType.documentTemplates?.length > 0) {
          templateId = lr.leaveType.documentTemplates[0].id
        } else if (lr.generatedDocument?.template) {
          templateId = lr.generatedDocument.template.id
        }

        if (!templateId) {
          regenResults.push({ requestId: item.requestId, requestNumber: item.requestNumber, success: false, error: 'No template found' })
          continue
        }

        const generator = new SmartDocumentGenerator()
        const documentId = await generator.generateDocument(item.requestId, templateId)

        if (!documentId) {
          regenResults.push({ requestId: item.requestId, requestNumber: item.requestNumber, success: false, error: 'Generation returned no ID' })
          continue
        }

        // Backfill signatures from approvals
        const doc = await prisma.generatedDocument.findUnique({
          where: { leaveRequestId: item.requestId },
          include: { signatures: true }
        })

        if (doc) {
          for (const approval of lr.approvals) {
            if (!approval.approver || !approval.signature) continue

            let sigRole = 'manager'
            if (lr.user.id && lr.user && approval.approver.id) {
              // Determine role from approval context
              if (approval.approver.role === 'EXECUTIVE') {
                sigRole = 'executive'
              } else if (approval.approver.role === 'DEPARTMENT_DIRECTOR') {
                sigRole = 'department_manager'
              }
            }

            const alreadyExists = doc.signatures.some(
              s => s.signerId === approval.approver!.id && s.signerRole === sigRole
            )

            if (!alreadyExists) {
              await generator.addSignature(doc.id, approval.approver.id, sigRole, approval.signature)
            }
          }
        }

        regenResults.push({ requestId: item.requestId, requestNumber: item.requestNumber, success: true })
      } catch (err) {
        console.error(`Failed to regenerate document for ${item.requestNumber}:`, err)
        regenResults.push({
          requestId: item.requestId,
          requestNumber: item.requestNumber,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reconciled ${affected.length} request(s), restored ${affected.reduce((s, a) => s + a.daysRestored, 0)} day(s)`,
      affected,
      documentRegeneration: regenResults,
      warnings: balanceWarnings.length > 0 ? balanceWarnings : undefined,
      summary: {
        totalRequests: affected.length,
        totalDaysRestored: affected.reduce((sum, a) => sum + a.daysRestored, 0),
        requestsCancelled: affected.filter(a => a.willCancel).length,
        requestsAdjusted: affected.filter(a => !a.willCancel).length,
        documentsRegenerated: regenResults.filter(r => r.success).length,
        documentsFailed: regenResults.filter(r => !r.success && r.error !== 'Skipped — request cancelled').length,
        dryRun: false
      }
    })
  } catch (error) {
    console.error('Holiday reconciliation error:', error)
    return NextResponse.json(
      {
        error: 'Holiday reconciliation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
