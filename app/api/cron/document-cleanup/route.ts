import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import { Prisma } from '@prisma/client'

// This endpoint should be called by a cron job
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from the cron service (you'd implement proper auth)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get retention policy
    const policySettings = await prisma.companySetting.findUnique({
      where: { key: 'document_retention_policy' },
    })

    const policy = policySettings?.value as any || {
      retentionDays: 90,
      autoDelete: false,
      deleteAfterApproval: false,
      deleteAfterApprovalDays: 60,
      enableAnonymization: false,
      anonymizeAfterDays: 365,
    }

    let deletedCount = 0
    let anonymizedCount = 0

    // Delete documents after approval if policy allows
    if (policy.deleteAfterApproval && policy.deleteAfterApprovalDays > 0) {
      const cutoffDate = subDays(new Date(), policy.deleteAfterApprovalDays)
      const approvedRequests = await prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          supportingDocuments: { not: Prisma.JsonNull },
          updatedAt: { lt: cutoffDate },
        },
        select: { id: true, supportingDocuments: true },
      })

      for (const request of approvedRequests) {
        // In a real system, you'd delete files from storage here
        // For now, we just clear the references
        // Preserve existing HR notes when deleting documents
        const existingNotes = (await prisma.leaveRequest.findUnique({
          where: { id: request.id },
          select: { hrVerificationNotes: true },
        }))?.hrVerificationNotes || ''
        
        await prisma.leaveRequest.update({
          where: { id: request.id },
          data: { 
            supportingDocuments: Prisma.JsonNull,
            hrVerificationNotes: existingNotes 
              ? `${existingNotes}\n[Documents removed per retention policy on ${new Date().toISOString().split('T')[0]}]`
              : `[Documents removed per retention policy on ${new Date().toISOString().split('T')[0]}]`,
          },
        })
        deletedCount++
      }
    }

    // Delete old documents based on retention days
    if (policy.autoDelete && policy.retentionDays > 0) {
      const cutoffDate = subDays(new Date(), policy.retentionDays)
      
      const oldRequests = await prisma.leaveRequest.findMany({
        where: {
          supportingDocuments: { not: Prisma.JsonNull },
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, supportingDocuments: true },
      })

      for (const request of oldRequests) {
        // Preserve existing HR notes when deleting documents
        const existingNotes = (await prisma.leaveRequest.findUnique({
          where: { id: request.id },
          select: { hrVerificationNotes: true },
        }))?.hrVerificationNotes || ''
        
        await prisma.leaveRequest.update({
          where: { id: request.id },
          data: { 
            supportingDocuments: Prisma.JsonNull,
            hrVerificationNotes: existingNotes 
              ? `${existingNotes}\n[Documents removed per retention policy on ${new Date().toISOString().split('T')[0]}]`
              : `[Documents removed per retention policy on ${new Date().toISOString().split('T')[0]}]`,
          },
        })
        deletedCount++
      }
    }

    // Anonymize very old records if enabled
    if (policy.enableAnonymization && policy.anonymizeAfterDays > 0) {
      const anonymizeCutoff = subDays(new Date(), policy.anonymizeAfterDays)
      
      const veryOldRequests = await prisma.leaveRequest.findMany({
        where: {
          createdAt: { lt: anonymizeCutoff },
          hrVerificationNotes: { 
            not: { 
              contains: '[Anonymized]' 
            } 
          },
        },
        select: { id: true },
      })

      for (const request of veryOldRequests) {
        await prisma.leaveRequest.update({
          where: { id: request.id },
          data: {
            reason: '[Anonymized]',
            hrVerificationNotes: '[Anonymized]',
            supportingDocuments: Prisma.JsonNull,
          },
        })
        anonymizedCount++
      }
    }

    // Log the cleanup
    await prisma.auditLog.create({
      data: {
        action: 'DOCUMENT_CLEANUP',
        entity: 'LeaveRequest',
        newValues: {
          deletedCount,
          anonymizedCount,
          policy,
        },
      },
    })

    return NextResponse.json({
      success: true,
      deletedCount,
      anonymizedCount,
    })
  } catch (error) {
    console.error('Document cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup documents' },
      { status: 500 }
    )
  }
}