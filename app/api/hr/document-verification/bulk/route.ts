import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

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

    const isHREmployee = user?.role === 'EMPLOYEE' && (user?.department?.toLowerCase() === 'hr' || user?.department?.toLowerCase() === 'human resources')
    
    if (!user || (!['HR', 'ADMIN'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { requestIds, action, notes }: BulkVerificationRequest = await request.json()

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ error: 'Request IDs are required' }, { status: 400 })
    }

    if (requestIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 requests per bulk operation' }, { status: 400 })
    }

    if (notes && notes.length > 1000) {
      return NextResponse.json({ error: 'Notes must be 1000 characters or less' }, { status: 400 })
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
        },
        approvals: {
          orderBy: { level: 'asc' as const }
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
              status: 'REJECTED'
            })
          }
        })

          // Update the HR Approval record
          const hrApproval = request.approvals.find(
            (a: any) => a.approverId === session.user.id && a.status === 'PENDING'
          ) || request.approvals.find(
            (a: any) => a.level === 1 && a.status === 'PENDING'
          )

          if (hrApproval) {
            await tx.approval.update({
              where: { id: hrApproval.id },
              data: {
                status: approved ? 'APPROVED' : 'REJECTED',
                comments: notes || null,
                approvedAt: new Date(),
              },
            })
          }

          // If rejected, restore leave balance (pending → available)
          if (!approved && request.leaveTypeId && request.totalDays > 0) {
            const balanceYear = new Date(request.startDate).getFullYear()
            try {
              await tx.leaveBalance.update({
                where: {
                  userId_leaveTypeId_year: {
                    userId: request.userId,
                    leaveTypeId: request.leaveTypeId,
                    year: balanceYear
                  }
                },
                data: {
                  pending: {
                    decrement: request.totalDays
                  },
                  available: {
                    increment: request.totalDays
                  }
                }
              })
            } catch (balanceError) {
              console.error('Failed to restore leave balance on bulk HR rejection:', balanceError)
              throw balanceError // Abort transaction — balance must stay consistent with request status
            }
          }

          // Create audit log (inside transaction so it rolls back if tx fails)
          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              action: approved ? 'HR_DOCUMENT_APPROVED' : 'HR_DOCUMENT_REJECTED',
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
              details: {
                reason: notes || (approved ? 'Bulk document verification - approved' : 'Bulk document verification - rejected'),
                affectedUserId: request.userId,
                bulkOperation: true
              }
            }
          })

          // Create notification for the employee
          await tx.notification.create({
          data: {
            userId: request.userId,
            type: approved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
            title: approved ? 'Documents Verified' : 'Documents Rejected',
            message: approved
              ? `Your documents for ${request.leaveType.name} leave have been verified by HR and your request is being processed.`
              : `Your documents for ${request.leaveType.name} leave have been rejected by HR. Reason: ${notes || 'Documents did not meet requirements'}. Please resubmit with proper documentation.`,
            link: `/employee?tab=requests`
          }
        })

          results.push({
            id: request.id,
            requestNumber: request.requestNumber,
            employeeName: `${request.user?.firstName || ''} ${request.user?.lastName || ''}`.trim() || 'Unknown',
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

    const isHREmployee = user?.role === 'EMPLOYEE' && (user?.department?.toLowerCase() === 'hr' || user?.department?.toLowerCase() === 'human resources')
    
    if (!user || (!['HR', 'ADMIN'].includes(user.role) && !isHREmployee)) {
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
        createdAt: 'desc'
      },
      take: 20
    })

    return NextResponse.json({
      recentBulkOperations: bulkOperations.map(op => ({
        id: op.id,
        timestamp: op.createdAt,
        action: op.action,
        performedBy: {
          name: `${op.user?.firstName || ''} ${op.user?.lastName || ''}`.trim() || 'Unknown',
          email: op.user?.email || ''
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