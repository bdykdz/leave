import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { emailService } from "@/lib/email-service"
import { format } from "date-fns"
import { log } from "@/lib/logger"
import { sanitizeComment } from "@/lib/utils/sanitize"
import { DelegationService } from "@/lib/services/delegation-service"
import { NotificationService } from "@/lib/services/notification-service"

// POST: Revoke a WFH approval the manager already gave.
// Cancels the request (before it starts) and notifies the employee.
export async function POST(
  request: Request,
  { params }: { params: { requestId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let reason = ""
    try {
      const body = await request.json()
      reason = sanitizeComment(body?.reason || "")
    } catch {
      // reason is optional
    }

    const requestId = params.requestId

    // Delegation: managers who delegated their approvals to me (active right now)
    const delegatorIds = await DelegationService.getActiveDelegatorIdsFor(session.user.id)
    const actAsIds = [session.user.id, ...delegatorIds]

    const wfhRequest = await prisma.workFromHomeRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        approvals: true
      }
    })

    if (!wfhRequest) {
      return NextResponse.json({ error: "WFH request not found" }, { status: 404 })
    }

    if (wfhRequest.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot revoke your own request" }, { status: 403 })
    }

    // Verify manager permission (or active delegate of the manager)
    const isManagerOrDelegate =
      wfhRequest.user.managerId === session.user.id ||
      delegatorIds.includes(wfhRequest.user.managerId ?? '')
    if (!isManagerOrDelegate) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Revoking only makes sense while the request is live
    if (!['APPROVED', 'PENDING'].includes(wfhRequest.status)) {
      return NextResponse.json({ error: "Request is not approved or pending" }, { status: 400 })
    }

    // There must be an approval this user (or a delegator) actually gave
    const givenApproval = wfhRequest.approvals.find(
      a => actAsIds.includes(a.approverId) && a.status === 'APPROVED'
    )
    if (!givenApproval) {
      return NextResponse.json({ error: "No approval given by you on this request" }, { status: 400 })
    }

    // Cannot revoke once the WFH period has started
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (wfhRequest.startDate <= today) {
      return NextResponse.json(
        { error: "Cannot revoke a request that has already started" },
        { status: 400 }
      )
    }

    const actingOnBehalfOf = givenApproval.approverId !== session.user.id
    const revokeNote = `[Aprobare revocată${actingOnBehalfOf ? ' ca delegat' : ''}]${reason ? ' ' + reason : ''}`

    await prisma.$transaction(async (tx) => {
      // Cancel the request
      await tx.workFromHomeRequest.update({
        where: { id: requestId },
        data: { status: 'CANCELLED' }
      })

      // Withdraw the approval that was given
      await tx.wFHApproval.update({
        where: { id: givenApproval.id },
        data: {
          status: 'REJECTED',
          approverId: session.user.id,
          comments: revokeNote,
          approvedAt: new Date()
        }
      })

      // Reject any other approvals still pending on the request
      await tx.wFHApproval.updateMany({
        where: {
          wfhRequestId: requestId,
          status: 'PENDING'
        },
        data: {
          status: 'REJECTED',
          comments: 'Cerere anulată: aprobarea managerului a fost revocată',
          approvedAt: new Date()
        }
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'WFH_APPROVAL_REVOKED',
          entity: 'WFH_REQUEST',
          entityId: requestId,
          oldValues: { status: wfhRequest.status, approvalStatus: 'APPROVED' },
          newValues: { status: 'CANCELLED', reason: reason || 'No reason provided' }
        }
      })
    })

    // Notify the employee (outside transaction — non-critical)
    try {
      await NotificationService.createNotification({
        userId: wfhRequest.userId,
        type: 'WFH_CANCELLED',
        title: 'Aprobare WFH revocată',
        message: `Aprobarea cererii dvs. de lucru de acasă (${format(wfhRequest.startDate, 'dd.MM.yyyy')} - ${format(wfhRequest.endDate, 'dd.MM.yyyy')}) a fost revocată, iar cererea a fost anulată.${reason ? ' Motiv: ' + reason : ''}`,
        link: `/employee?request=${requestId}`
      })

      await emailService.sendWFHApprovalNotification(wfhRequest.user.email, {
        employeeName: `${wfhRequest.user.firstName} ${wfhRequest.user.lastName}`,
        startDate: format(wfhRequest.startDate, 'dd MMMM yyyy'),
        endDate: format(wfhRequest.endDate, 'dd MMMM yyyy'),
        days: wfhRequest.totalDays,
        location: wfhRequest.location,
        approved: false,
        managerName: `${session.user.firstName} ${session.user.lastName}`,
        comments: `Aprobarea a fost revocată, iar cererea a fost anulată.${reason ? ' Motiv: ' + reason : ''}`
      })
    } catch (notifyError) {
      console.error('Error sending revocation notifications:', notifyError)
    }

    log.info('WFH approval revoked', { requestId })

    return NextResponse.json({
      success: true,
      message: "WFH approval revoked and request cancelled"
    })
  } catch (error) {
    console.error("Error revoking WFH approval:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
