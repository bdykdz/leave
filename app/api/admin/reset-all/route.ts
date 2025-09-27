import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST() {
  try {
    // For development - remove this check in production
    // const session = await getServerSession(authOptions)
    // if (!session || session.user.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    // }

    console.log('Starting complete system reset...')

    // Delete all document-related data
    await prisma.documentSignature.deleteMany({})
    console.log('✓ Deleted all document signatures')
    
    await prisma.generatedDocument.deleteMany({})
    console.log('✓ Deleted all generated documents')
    
    await prisma.templateSignature.deleteMany({})
    console.log('✓ Deleted all template signatures')
    
    await prisma.templateFieldMapping.deleteMany({})
    console.log('✓ Deleted all field mappings')
    
    await prisma.documentTemplate.deleteMany({})
    console.log('✓ Deleted all document templates')

    // Delete all comments
    await prisma.comment.deleteMany({})
    console.log('✓ Deleted all comments')

    // Delete all approvals
    await prisma.approval.deleteMany({})
    console.log('✓ Deleted all approvals')
    
    // Delete all leave requests
    await prisma.leaveRequest.deleteMany({})
    console.log('✓ Deleted all leave requests')

    // Reset leave balances to original entitled amounts
    await prisma.leaveBalance.updateMany({
      data: {
        used: 0,
        pending: 0,
        available: 0
      }
    })
    
    // Update available to match entitled
    const balances = await prisma.leaveBalance.findMany()
    for (const balance of balances) {
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          available: balance.entitled
        }
      })
    }
    console.log('✓ Reset all leave balances')

    // Delete all notifications
    await prisma.notification.deleteMany({})
    console.log('✓ Deleted all notifications')

    // Delete workflow rules
    await prisma.workflowRule.deleteMany({})
    console.log('✓ Deleted all workflow rules')

    // Create default workflow rule (simple manager approval only)
    await prisma.workflowRule.create({
      data: {
        name: 'Default Approval Workflow',
        description: 'Simple manager approval for all leave requests',
        conditions: {},
        approvalLevels: [
          { role: 'DIRECT_MANAGER', required: true }
        ],
        skipDuplicateSignatures: true,
        priority: 1,
        isActive: true
      }
    })
    console.log('✓ Created default workflow rule')

    return NextResponse.json({
      success: true,
      message: 'System has been completely reset. All templates, documents, and leave requests have been removed.'
    })
  } catch (error) {
    console.error('Error resetting system:', error)
    return NextResponse.json({ 
      error: 'Failed to reset system',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}