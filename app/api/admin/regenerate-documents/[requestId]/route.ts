import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { SmartDocumentGenerator } from '@/lib/smart-document-generator'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requestId } = await params

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
    }

    // Support both cuid (e.g. clxyz123abc) and request number (e.g. LR-2025-001)
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
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    // Determine template
    let templateId: string | null = null
    if (leaveRequest.leaveType.documentTemplates?.length > 0) {
      templateId = leaveRequest.leaveType.documentTemplates[0].id
    } else if (leaveRequest.generatedDocument?.template) {
      templateId = leaveRequest.generatedDocument.template.id
    }

    if (!templateId) {
      return NextResponse.json({
        error: 'No template found',
        requestNumber: leaveRequest.requestNumber
      }, { status: 400 })
    }

    const generator = new SmartDocumentGenerator()
    let signaturesAdded = 0

    // Generate/regenerate the document
    const documentId = await generator.generateDocument(leaveRequest.id, templateId)

    if (!documentId) {
      return NextResponse.json({
        error: 'Document generation returned no ID',
        requestNumber: leaveRequest.requestNumber
      }, { status: 500 })
    }

    // Get the freshly generated document
    const doc = await prisma.generatedDocument.findUnique({
      where: { leaveRequestId: leaveRequest.id },
      include: { signatures: true }
    })

    if (!doc) {
      return NextResponse.json({
        error: 'Document not found after generation',
        requestNumber: leaveRequest.requestNumber
      }, { status: 500 })
    }

    // Backfill missing signatures from approval records
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
        await generator.addSignature(
          doc.id,
          approval.approver.id,
          sigRole,
          approval.signature
        )
        signaturesAdded++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Document regenerated for ${leaveRequest.requestNumber}`,
      documentId: doc.id,
      requestNumber: leaveRequest.requestNumber,
      stats: {
        signaturesBackfilled: signaturesAdded
      }
    })
  } catch (error) {
    console.error('Error regenerating document:', error)
    return NextResponse.json({
      error: 'Failed to regenerate document',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
