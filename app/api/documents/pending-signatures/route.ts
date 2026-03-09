import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userRole = session.user.role

    // Find documents with PENDING_SIGNATURES status where the current user is a required signer
    const pendingDocuments = await prisma.generatedDocument.findMany({
      where: {
        status: 'PENDING_SIGNATURES',
      },
      include: {
        leaveRequest: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                managerId: true,
                departmentDirectorId: true,
              },
            },
            leaveType: {
              select: { name: true },
            },
          },
        },
        template: {
          include: {
            signaturePlacements: true,
          },
        },
        signatures: {
          select: { signerRole: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Filter to documents where this user needs to sign
    const documentsNeedingSignature = pendingDocuments.filter((doc) => {
      const requiredRoles = doc.template.signaturePlacements
        .filter((sp) => sp.isRequired)
        .map((sp) => sp.signerRole)

      const signedRoles = doc.signatures.map((s) => s.signerRole)
      const unsignedRoles = requiredRoles.filter((role) => !signedRoles.includes(role))

      // Check if user can sign any of the unsigned roles
      return unsignedRoles.some((role) => {
        switch (role) {
          case 'employee':
            return doc.leaveRequest.user.id === userId
          case 'manager':
            return doc.leaveRequest.user.managerId === userId
          case 'department_director':
            return doc.leaveRequest.user.departmentDirectorId === userId
          case 'hr':
            return userRole === 'HR'
          case 'executive':
            return userRole === 'EXECUTIVE'
          default:
            return false
        }
      })
    })

    const result = documentsNeedingSignature.map((doc) => ({
      id: doc.id,
      leaveRequestId: doc.leaveRequest.id,
      employeeName: `${doc.leaveRequest.user.firstName} ${doc.leaveRequest.user.lastName}`,
      leaveType: doc.leaveRequest.leaveType.name,
      startDate: doc.leaveRequest.startDate,
      endDate: doc.leaveRequest.endDate,
      templateName: doc.template.name,
      createdAt: doc.createdAt,
      isOwnDocument: doc.leaveRequest.user.id === userId,
    }))

    return NextResponse.json({ documents: result })
  } catch (error) {
    console.error('Error fetching pending signatures:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending signatures' },
      { status: 500 }
    )
  }
}
