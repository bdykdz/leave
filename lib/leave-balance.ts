import { prisma } from '@/lib/prisma'

export async function updateLeaveBalanceOnApproval(
  userId: string,
  leaveTypeId: string,
  leaveTypeCode: string,
  days: number,
  year: number
) {
  // Only update balance for Normal Leave (NL)
  // Other leave types are just tracked, not deducted from a balance
  if (leaveTypeCode !== 'NL') {
    return
  }

  // Find or create the leave balance
  const existingBalance = await prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId,
        leaveTypeId,
        year
      }
    }
  })

  if (existingBalance) {
    // Update existing balance
    const newUsed = existingBalance.used + days
    const newAvailable = existingBalance.entitled + existingBalance.carriedForward - newUsed - existingBalance.pending

    await prisma.leaveBalance.update({
      where: { id: existingBalance.id },
      data: {
        used: newUsed,
        available: newAvailable
      }
    })

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'BALANCE_DEDUCTED',
        entity: 'LEAVE_BALANCE',
        entityType: 'LEAVE_BALANCE',
        entityId: existingBalance.id,
        details: { days, newUsed, newAvailable, year, trigger: 'APPROVAL' }
      }
    })
  }
}

export async function updateLeaveBalanceOnPending(
  userId: string,
  leaveTypeId: string,
  leaveTypeCode: string,
  days: number,
  year: number
) {
  // Only update balance for Normal Leave (NL)
  if (leaveTypeCode !== 'NL') {
    return
  }

  const existingBalance = await prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId,
        leaveTypeId,
        year
      }
    }
  })

  if (existingBalance) {
    // Update pending
    const newPending = existingBalance.pending + days
    const newAvailable = existingBalance.entitled + existingBalance.carriedForward - existingBalance.used - newPending

    await prisma.leaveBalance.update({
      where: { id: existingBalance.id },
      data: {
        pending: newPending,
        available: newAvailable
      }
    })

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'BALANCE_PENDING',
        entity: 'LEAVE_BALANCE',
        entityType: 'LEAVE_BALANCE',
        entityId: existingBalance.id,
        details: { days, newPending, newAvailable, year, trigger: 'PENDING_REQUEST' }
      }
    })
  }
}

export async function updateLeaveBalanceOnRejection(
  userId: string,
  leaveTypeId: string,
  leaveTypeCode: string,
  days: number,
  year: number
) {
  // Only update balance for Normal Leave (NL)
  if (leaveTypeCode !== 'NL') {
    return
  }

  const existingBalance = await prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId,
        leaveTypeId,
        year
      }
    }
  })

  if (existingBalance) {
    // Remove from pending
    const newPending = Math.max(0, existingBalance.pending - days)
    const newAvailable = existingBalance.entitled + existingBalance.carriedForward - existingBalance.used - newPending

    await prisma.leaveBalance.update({
      where: { id: existingBalance.id },
      data: {
        pending: newPending,
        available: newAvailable
      }
    })

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'BALANCE_RESTORED',
        entity: 'LEAVE_BALANCE',
        entityType: 'LEAVE_BALANCE',
        entityId: existingBalance.id,
        details: { days, newPending, newAvailable, year, trigger: 'REJECTION' }
      }
    })
  }
}