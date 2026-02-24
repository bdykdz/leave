/**
 * Document Regeneration CLI Script
 *
 * Regenerates leave request documents outside the web server context.
 *
 * Usage:
 *   # Regenerate ALL documents
 *   npx tsx -r tsconfig-paths/register scripts/regenerate-documents.ts
 *
 *   # Regenerate a single document by request number or ID
 *   npx tsx -r tsconfig-paths/register scripts/regenerate-documents.ts --request LR-2025-001
 *   npx tsx -r tsconfig-paths/register scripts/regenerate-documents.ts --request clxyz123abc
 *
 *   # Or via the convenience npm script:
 *   pnpm doc:regenerate
 *   pnpm doc:regenerate -- --request LR-2025-001
 */

import { PrismaClient } from '@prisma/client'
import { SmartDocumentGenerator } from '@/lib/smart-document-generator'

const prisma = new PrismaClient()

function parseArgs(): { requestId?: string } {
  const args = process.argv.slice(2)
  const idx = args.indexOf('--request')
  if (idx !== -1 && args[idx + 1]) {
    return { requestId: args[idx + 1] }
  }
  return {}
}

async function regenerateSingle(requestId: string) {
  const isRequestNumber = requestId.includes('-') && requestId.startsWith('LR')

  const leaveRequest = await prisma.leaveRequest.findFirst({
    where: isRequestNumber
      ? { requestNumber: requestId }
      : { id: requestId },
    include: {
      user: true,
      generatedDocument: {
        include: {
          template: true,
          signatures: true
        }
      },
      approvals: {
        where: { status: 'APPROVED' },
        include: {
          approver: { select: { id: true, role: true, firstName: true, lastName: true } }
        }
      },
      leaveType: {
        include: {
          documentTemplates: {
            where: { isActive: true },
            orderBy: { version: 'desc' as const },
            take: 1
          }
        }
      }
    }
  })

  if (!leaveRequest) {
    console.error(`Leave request not found: ${requestId}`)
    process.exit(1)
  }

  console.log(`Found request: ${leaveRequest.requestNumber} (status: ${leaveRequest.status})`)

  let templateId: string | null = null
  if (leaveRequest.leaveType.documentTemplates?.length > 0) {
    templateId = leaveRequest.leaveType.documentTemplates[0].id
  } else if (leaveRequest.generatedDocument?.template) {
    templateId = leaveRequest.generatedDocument.template.id
  }

  if (!templateId) {
    console.error(`No template found for ${leaveRequest.requestNumber}`)
    process.exit(1)
  }

  const generator = new SmartDocumentGenerator()
  const documentId = await generator.generateDocument(leaveRequest.id, templateId)

  if (!documentId) {
    console.error(`Document generation returned no ID for ${leaveRequest.requestNumber}`)
    process.exit(1)
  }

  // Backfill missing signatures
  const doc = await prisma.generatedDocument.findUnique({
    where: { leaveRequestId: leaveRequest.id },
    include: { signatures: true }
  })

  let signaturesAdded = 0
  if (doc) {
    for (const approval of leaveRequest.approvals) {
      if (!approval.approver || !approval.signature) continue

      let sigRole = 'manager'
      if (leaveRequest.user.managerId === approval.approver.id) {
        sigRole = 'manager'
      } else if (approval.approver.role === 'EXECUTIVE') {
        sigRole = 'executive'
      } else if (approval.approver.role === 'DEPARTMENT_DIRECTOR') {
        sigRole = 'department_manager'
      }

      const alreadyExists = doc.signatures.some(
        s => s.signerId === approval.approver!.id && s.signerRole === sigRole
      )

      if (!alreadyExists) {
        await generator.addSignature(doc.id, approval.approver.id, sigRole, approval.signature)
        signaturesAdded++
        console.log(`  Added ${sigRole} signature from ${approval.approver.firstName} ${approval.approver.lastName}`)
      }
    }
  }

  console.log(`Done: ${leaveRequest.requestNumber} — document ${documentId}, ${signaturesAdded} signatures backfilled`)
}

async function regenerateAll() {
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      status: { in: ['APPROVED', 'PENDING'] }
    },
    include: {
      user: true,
      generatedDocument: {
        include: {
          template: true,
          signatures: true
        }
      },
      approvals: {
        where: { status: 'APPROVED' },
        include: {
          approver: { select: { id: true, role: true, firstName: true, lastName: true } }
        }
      },
      leaveType: {
        include: {
          documentTemplates: {
            where: { isActive: true },
            orderBy: { version: 'desc' as const },
            take: 1
          }
        }
      }
    }
  })

  console.log(`Found ${leaveRequests.length} leave requests to process`)

  const generator = new SmartDocumentGenerator()
  let successCount = 0
  let errorCount = 0
  let totalSignaturesAdded = 0

  for (const lr of leaveRequests) {
    try {
      let templateId: string | null = null
      if (lr.leaveType.documentTemplates?.length > 0) {
        templateId = lr.leaveType.documentTemplates[0].id
      } else if (lr.generatedDocument?.template) {
        templateId = lr.generatedDocument.template.id
      }

      if (!templateId) {
        console.warn(`  SKIP ${lr.requestNumber} — no template`)
        errorCount++
        continue
      }

      const documentId = await generator.generateDocument(lr.id, templateId)

      if (!documentId) {
        console.error(`  FAIL ${lr.requestNumber} — generation returned no ID`)
        errorCount++
        continue
      }

      const doc = await prisma.generatedDocument.findUnique({
        where: { leaveRequestId: lr.id },
        include: { signatures: true }
      })

      if (doc) {
        for (const approval of lr.approvals) {
          if (!approval.approver || !approval.signature) continue

          let sigRole = 'manager'
          if (lr.user.managerId === approval.approver.id) {
            sigRole = 'manager'
          } else if (approval.approver.role === 'EXECUTIVE') {
            sigRole = 'executive'
          } else if (approval.approver.role === 'DEPARTMENT_DIRECTOR') {
            sigRole = 'department_manager'
          }

          const alreadyExists = doc.signatures.some(
            s => s.signerId === approval.approver!.id && s.signerRole === sigRole
          )

          if (!alreadyExists) {
            await generator.addSignature(doc.id, approval.approver.id, sigRole, approval.signature)
            totalSignaturesAdded++
          }
        }
      }

      successCount++
      console.log(`  OK   ${lr.requestNumber}`)
    } catch (error) {
      console.error(`  FAIL ${lr.requestNumber} — ${error instanceof Error ? error.message : 'Unknown error'}`)
      errorCount++
    }
  }

  console.log(`\nComplete: ${successCount} succeeded, ${errorCount} failed, ${totalSignaturesAdded} signatures backfilled`)
}

async function main() {
  const { requestId } = parseArgs()

  if (requestId) {
    console.log(`Regenerating document for: ${requestId}`)
    await regenerateSingle(requestId)
  } else {
    console.log('Regenerating ALL documents...')
    await regenerateAll()
  }
}

main()
  .catch((e) => {
    console.error('Document regeneration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
