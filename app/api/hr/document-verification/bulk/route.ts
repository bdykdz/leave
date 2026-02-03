import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { createAuditLog, AuditAction } from '@/lib/utils/audit-log'

interface BulkVerificationRequest {
  requestIds: string[]
  action: 'approve' | 'reject'
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is HR, ADMIN, EXECUTIVE, or EMPLOYEE with HR department
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })

    const isHREmployee = user?.role === 'EMPLOYEE' && user?.department?.toLowerCase().includes('hr')
    
    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { requestIds, action, notes }: BulkVerificationRequest = await request.json()

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ error: 'Request IDs are required' }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Validate that all requests exist and are pending verification
    const existingRequests = await prisma.leaveRequest.findMany({
      where: {
        id: { in: requestIds },
        status: 'PENDING',
        leaveType: {
          requiresHRVerification: true
        }
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        leaveType: {
          select: {
            name: true
          }
        }
      }
    })

    if (existingRequests.length !== requestIds.length) {
      const foundIds = existingRequests.map(r => r.id)
      const missingIds = requestIds.filter(id => !foundIds.includes(id))
      return NextResponse.json({ 
        error: `Some requests not found or not eligible for verification: ${missingIds.join(', ')}` 
      }, { status: 400 })
    }

    const approved = action === 'approve'
    const results = []

    // Use transaction to ensure all operations succeed or fail together
    try {
      await prisma.$transaction(async (tx) => {
        // Process each request within the transaction
        for (const request of existingRequests) {
          // Update the leave request
          const updated = await tx.leaveRequest.update({
          where: { id: request.id },
          data: {
            hrDocumentVerified: approved,
            hrVerifiedBy: session.user.id,
            hrVerifiedAt: new Date(),
            hrVerificationNotes: notes || (approved ? 'Bulk approved by HR' : 'Bulk rejected by HR'),
            ...(approved ? {} : { 
              status: 'REJECTED',
              rejectedAt: new Date(),
              rejectedBy: session.user.id,
              rejectionReason: `Document verification failed: ${notes || 'Documents did not meet requirements'}`
            })
          }
        })

          // Create audit log
          await createAuditLog({
            userId: session.user.id,
            action: approved ? AuditAction.VERIFY_DOCUMENT : AuditAction.REJECT_DOCUMENT,
            entity: 'LEAVE_REQUEST',
            entityId: request.id,
            oldValues: { 
              hrDocumentVerified: request.hrDocumentVerified,
              status: request.status 
            },
            newValues: { 
              hrDocumentVerified: approved,
              status: approved ? request.status : 'REJECTED'
            },
            metadata: {
              reason: notes || (approved ? 'Bulk document verification - approved' : 'Bulk document verification - rejected'),
              affectedUserId: request.userId,
              bulkOperation: true
            }
          })

          // Create notification for the employee
          await tx.notification.create({
          data: {
            userId: request.userId,
            type: 'LEAVE',
            title: approved ? 'Documents Verified' : 'Documents Rejected',
            message: approved 
              ? `Your documents for ${request.leaveType.name} leave have been verified by HR and your request is being processed.`
              : `Your documents for ${request.leaveType.name} leave have been rejected by HR. Reason: ${notes || 'Documents did not meet requirements'}. Please resubmit with proper documentation.`,
            relatedEntityType: 'LEAVE_REQUEST',
            relatedEntityId: request.id
          }
        })

          results.push({
            id: request.id,
            requestNumber: request.requestNumber,
            employeeName: `${request.user.firstName} ${request.user.lastName}`,
            status: 'success',
            action: approved ? 'approved' : 'rejected'
          })
        }
      })

    } catch (error) {
      console.error('Bulk verification transaction failed:', error)
      return NextResponse.json(
        { error: 'Failed to process bulk verification - transaction rolled back' },
        { status: 500 }
      )
    }

    const successCount = results.length
    const errorCount = 0

    return NextResponse.json({
      success: true,
      message: `Bulk verification completed. ${successCount} successful, ${errorCount} errors.`,
      results,
      summary: {
        total: requestIds.length,
        successful: successCount,
        errors: errorCount,
        action: approved ? 'approved' : 'rejected'
      }
    })

  } catch (error) {
    console.error('Bulk verification error:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk verification' },
      { status: 500 }
    )
  }
}

// GET: Get bulk verification history/summary
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is HR, ADMIN, EXECUTIVE, or EMPLOYEE with HR department
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })

    const isHREmployee = user?.role === 'EMPLOYEE' && user?.department?.toLowerCase().includes('hr')
    
    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get recent bulk verification audit logs
    const bulkOperations = await prisma.auditLog.findMany({
      where: {
        entity: 'LEAVE_REQUEST',
        action: {
          in: ['VERIFY_DOCUMENT', 'REJECT_DOCUMENT']
        },
        details: {
          path: ['bulkOperation'],
          equals: true
        }
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 20
    })

    return NextResponse.json({
      recentBulkOperations: bulkOperations.map(op => ({
        id: op.id,
        timestamp: op.timestamp,
        action: op.action,
        performedBy: {
          name: `${op.user.firstName} ${op.user.lastName}`,
          email: op.user.email
        },
        entityId: op.entityId,
        reason: (op.details as any)?.reason || 'No reason provided'
      }))
    })

  } catch (error) {
    console.error('Error fetching bulk verification history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bulk verification history' },
      { status: 500 }
    )
  }
}