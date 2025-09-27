import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { format } from 'date-fns'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        user: {
          include: {
            manager: true
          }
        },
        leaveType: true,
        substitute: true,
        substitutes: {
          include: {
            user: true
          }
        },
        generatedDocument: {
          include: {
            signatures: {
              include: {
                signer: true
              }
            }
          }
        },
        approvals: {
          include: {
            approver: true
          }
        }
      }
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    // Process approvals to get decision data
    const decisions = {
      manager: { approved: '', rejected: '' },
      director: { approved: '', rejected: '' },
      hr: { approved: '', rejected: '' },
      executive: { approved: '', rejected: '' },
      comments: ''
    }
    
    if (leaveRequest.approvals) {
      for (const approval of leaveRequest.approvals) {
        if (approval.approver) {
          const approverRole = approval.approver.role?.toLowerCase()
          let decisionRole = 'manager'
          
          if (approverRole === 'executive') {
            decisionRole = 'executive'
          } else if (approverRole === 'department_director') {
            decisionRole = 'director'
          } else if (approverRole === 'hr') {
            decisionRole = 'hr'
          }
          
          if (approval.status === 'APPROVED') {
            decisions[decisionRole].approved = '✓'
            decisions[decisionRole].rejected = ''
          } else if (approval.status === 'REJECTED') {
            decisions[decisionRole].approved = ''
            decisions[decisionRole].rejected = '✓'
          }
          
          if (approval.comments) {
            if (decisions.comments) {
              decisions.comments += '\n' + approval.comments
            } else {
              decisions.comments = approval.comments
            }
          }
        }
      }
    }

    // Get substitutes data
    const substitutesData = {
      single: null,
      multiple: [],
      formatted: ''
    }

    if (leaveRequest.substitute) {
      substitutesData.single = {
        id: leaveRequest.substitute.id,
        name: `${leaveRequest.substitute.firstName || ''} ${leaveRequest.substitute.lastName || ''}`.trim(),
        email: leaveRequest.substitute.email
      }
    }

    if (leaveRequest.substitutes && leaveRequest.substitutes.length > 0) {
      substitutesData.multiple = leaveRequest.substitutes.map(sub => ({
        id: sub.id,
        userId: sub.userId,
        name: `${sub.user.firstName || ''} ${sub.user.lastName || ''}`.trim(),
        email: sub.user.email
      }))
      substitutesData.formatted = substitutesData.multiple.map(s => s.name).join(', ')
    }

    // Get signature data
    const signatures = {}
    if (leaveRequest.generatedDocument?.signatures) {
      for (const sig of leaveRequest.generatedDocument.signatures) {
        signatures[sig.signerRole.toLowerCase()] = {
          signerId: sig.signerId,
          signerName: sig.signer ? `${sig.signer.firstName} ${sig.signer.lastName}` : 'Unknown',
          signedAt: sig.signedAt,
          hasImageData: !!sig.signatureData && sig.signatureData.startsWith('data:image')
        }
      }
    }

    const debugData = {
      requestId: leaveRequest.id,
      requestNumber: leaveRequest.requestNumber,
      status: leaveRequest.status,
      employee: {
        name: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
        role: leaveRequest.user.role,
        managerId: leaveRequest.user.managerId,
        managerName: leaveRequest.user.manager ? 
          `${leaveRequest.user.manager.firstName} ${leaveRequest.user.manager.lastName}` : null
      },
      approvals: leaveRequest.approvals.map(a => ({
        id: a.id,
        status: a.status,
        approverName: a.approver ? 
          `${a.approver.firstName} ${a.approver.lastName}` : 'Unknown',
        approverRole: a.approver?.role,
        comments: a.comments,
        level: a.level
      })),
      decisions,
      substitutes: substitutesData,
      signatures,
      documentStatus: leaveRequest.generatedDocument?.status || 'No document',
      signatureCount: leaveRequest.generatedDocument?.signatures?.length || 0
    }

    return NextResponse.json(debugData, { status: 200 })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ 
      error: 'Failed to get debug data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}