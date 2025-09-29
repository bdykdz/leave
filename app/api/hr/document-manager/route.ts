import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all leave requests that have supporting documents OR generated documents
    // This includes requests where documents have been deleted
    const documents = await prisma.leaveRequest.findMany({
      where: {
        OR: [
          { supportingDocuments: { not: Prisma.JsonNull } },
          { hrVerificationNotes: { contains: '[Documents removed' } },
          { hrDocumentVerified: true },
          { generatedDocument: { isNot: null } },
        ],
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true,
          },
        },
        leaveType: {
          select: {
            name: true,
            code: true,
          },
        },
        generatedDocument: {
          include: {
            template: {
              select: {
                name: true,
                category: true,
              },
            },
            signatures: {
              include: {
                signer: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        approvals: {
          where: {
            approver: {
              role: 'HR',
            },
          },
          include: {
            approver: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            approvedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transform the data to include HR verifier info
    const transformedDocuments = documents.map(doc => {
      const hrApproval = doc.approvals[0]
      return {
        id: doc.id,
        requestNumber: doc.requestNumber,
        user: doc.user,
        leaveType: doc.leaveType,
        startDate: doc.startDate,
        endDate: doc.endDate,
        totalDays: doc.totalDays,
        status: doc.status,
        supportingDocuments: doc.supportingDocuments as string[] | null,
        hrDocumentVerified: doc.hrDocumentVerified,
        hrVerifiedBy: doc.hrVerifiedBy ? {
          firstName: hrApproval?.approver.firstName || 'HR',
          lastName: hrApproval?.approver.lastName || 'User',
        } : null,
        hrVerifiedAt: doc.hrVerifiedAt,
        hrVerificationNotes: doc.hrVerificationNotes,
        generatedDocument: doc.generatedDocument ? {
          id: doc.generatedDocument.id,
          fileUrl: doc.generatedDocument.fileUrl,
          status: doc.generatedDocument.status,
          templateName: doc.generatedDocument.template?.name || 'Unknown Template',
          templateCategory: doc.generatedDocument.template?.category || 'general',
          createdAt: doc.generatedDocument.createdAt,
          completedAt: doc.generatedDocument.completedAt,
          signatureCount: doc.generatedDocument.signatures.length,
          signatures: doc.generatedDocument.signatures.map(sig => ({
            signerName: `${sig.signer.firstName} ${sig.signer.lastName}`,
            signerRole: sig.signerRole,
            signedAt: sig.signedAt,
          })),
        } : null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }
    })

    return NextResponse.json({ documents: transformedDocuments })
  } catch (error) {
    console.error('Failed to fetch documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}