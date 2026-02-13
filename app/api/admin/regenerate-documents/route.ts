import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { SmartDocumentGenerator } from '@/lib/smart-document-generator'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all APPROVED leave requests
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        status: {
          in: ['APPROVED', 'PENDING']
        }
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
    let signaturesAdded = 0
    const errors: any[] = []

    for (const lr of leaveRequests) {
      try {
        console.log(`Processing ${lr.requestNumber}`)

        // Determine template
        let templateId: string | null = null
        if (lr.generatedDocument?.template) {
          templateId = lr.generatedDocument.template.id
        } else if (lr.leaveType.documentTemplates?.length > 0) {
          templateId = lr.leaveType.documentTemplates[0].id
        }

        if (!templateId) {
          console.warn(`No template for ${lr.requestNumber}`)
          errorCount++
          errors.push({ requestNumber: lr.requestNumber, error: 'No template found' })
          continue
        }

        // Generate/regenerate the document
        const documentId = await generator.generateDocument(lr.id, templateId)

        if (!documentId) {
          errorCount++
          errors.push({ requestNumber: lr.requestNumber, error: 'Document generation returned no ID' })
          continue
        }

        // Get the document (might be newly created or existing)
        const doc = await prisma.generatedDocument.findUnique({
          where: { leaveRequestId: lr.id },
          include: { signatures: true }
        })

        if (!doc) {
          errorCount++
          errors.push({ requestNumber: lr.requestNumber, error: 'Document not found after generation' })
          continue
        }

        // Backfill missing signatures from approval records
        for (const approval of lr.approvals) {
          if (!approval.approver || !approval.signature) continue

          // Determine what signature role this approver should have
          // If they approved via the manager endpoint (they are the user's managerId), role = 'manager'
          // Otherwise, based on their system role
          let sigRole = 'manager'
          if (lr.user.managerId === approval.approver.id) {
            sigRole = 'manager'
          } else if (approval.approver.role === 'EXECUTIVE') {
            sigRole = 'executive'
          } else if (approval.approver.role === 'DEPARTMENT_DIRECTOR') {
            sigRole = 'department_manager'
          }

          // Check if this signature already exists on the document
          const alreadyExists = doc.signatures.some(
            s => s.signerId === approval.approver.id && s.signerRole === sigRole
          )

          if (!alreadyExists) {
            await generator.addSignature(
              doc.id,
              approval.approver.id,
              sigRole,
              approval.signature
            )
            signaturesAdded++
            console.log(`Added ${sigRole} signature from ${approval.approver.firstName} ${approval.approver.lastName} to ${lr.requestNumber}`)
          }
        }

        successCount++
        console.log(`Successfully processed ${lr.requestNumber}`)
      } catch (error) {
        console.error(`Error processing ${lr.requestNumber}:`, error)
        errorCount++
        errors.push({
          requestNumber: lr.requestNumber,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Document regeneration complete',
      stats: {
        total: leaveRequests.length,
        successful: successCount,
        failed: errorCount,
        signaturesBackfilled: signaturesAdded
      },
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Error regenerating documents:', error)
    return NextResponse.json({
      error: 'Failed to regenerate documents',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
