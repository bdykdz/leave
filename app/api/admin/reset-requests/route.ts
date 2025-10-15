import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { deleteFromMinio } from "@/lib/minio"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only allow ADMIN role to reset requests
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { confirmationText, resetType } = body

    // Require confirmation text to prevent accidental deletions
    const expectedText = resetType === 'BALANCE_ONLY' ? 'RESET BALANCES' : 'DELETE ALL REQUESTS'
    if (confirmationText !== expectedText) {
      return NextResponse.json({ 
        error: `Invalid confirmation text. Please type '${expectedText}' to confirm.` 
      }, { status: 400 })
    }

    let deletionStats = {
      leaveRequests: 0,
      wfhRequests: 0,
      approvals: 0,
      wfhApprovals: 0,
      substituteLinks: 0,
      documents: 0,
      documentSignatures: 0,
      filesDeleted: 0,
      filesFailedToDelete: []
    }

    console.log(`🗑️ Starting ${resetType || 'FULL'} requests reset by admin: ${session.user.email}`)

    // Step 1: Get all documents before deleting them to clean up files
    const documentsToDelete = await prisma.generatedDocument.findMany({
      select: {
        id: true,
        fileUrl: true
      }
    })

    // Step 2: Delete files from MinIO storage
    for (const doc of documentsToDelete) {
      try {
        if (doc.fileUrl) {
          // Extract the MinIO object key from the fileUrl
          // FileUrl format: "minio://bucket/object-path" or just object path
          const objectKey = doc.fileUrl.replace(/^minio:\/\/[^\/]+\//, '')
          await deleteFromMinio(objectKey)
          deletionStats.filesDeleted++
        }
      } catch (error) {
        console.error(`Failed to delete file for document ${doc.id}:`, error)
        deletionStats.filesFailedToDelete.push(doc.id)
      }
    }

    // Step 3: Delete database records in correct order (due to foreign key constraints)
    await prisma.$transaction(async (tx) => {
      // Delete document signatures first
      const deletedSignatures = await tx.documentSignature.deleteMany({})
      deletionStats.documentSignatures = deletedSignatures.count

      // Delete generated documents
      const deletedDocs = await tx.generatedDocument.deleteMany({})
      deletionStats.documents = deletedDocs.count

      // Delete leave request substitute links
      const deletedSubstituteLinks = await tx.leaveRequestSubstitute.deleteMany({})
      deletionStats.substituteLinks = deletedSubstituteLinks.count

      // Delete leave approvals
      const deletedApprovals = await tx.approval.deleteMany({})
      deletionStats.approvals = deletedApprovals.count

      // Delete WFH approvals
      const deletedWfhApprovals = await tx.wFHApproval.deleteMany({})
      deletionStats.wfhApprovals = deletedWfhApprovals.count

      if (resetType === 'LEAVE_ONLY') {
        // Delete only leave requests
        const deletedLeaveRequests = await tx.leaveRequest.deleteMany({})
        deletionStats.leaveRequests = deletedLeaveRequests.count
        
        // Reset leave balances for leave requests based on leave type
        // Annual Leave: Reset to 30 days
        await tx.leaveBalance.updateMany({
          where: {
            leaveType: { code: 'AL' }
          },
          data: {
            entitled: 30,
            used: 0,
            pending: 0,
            available: 30
          }
        })

        // Personal Leave: Reset to 5 days (drawer system)
        await tx.leaveBalance.updateMany({
          where: {
            leaveType: { code: 'PL' }
          },
          data: {
            entitled: 5,
            used: 0,
            pending: 0,
            available: 5
          }
        })

        // Sick Leave: Set to unlimited (999 days as proxy for unlimited)
        await tx.leaveBalance.updateMany({
          where: {
            leaveType: { code: 'SL' }
          },
          data: {
            entitled: 999,
            used: 0,
            pending: 0,
            available: 999
          }
        })
      } else if (resetType === 'WFH_ONLY') {
        // Delete only WFH requests
        const deletedWfhRequests = await tx.workFromHomeRequest.deleteMany({})
        deletionStats.wfhRequests = deletedWfhRequests.count
      } else if (resetType === 'BALANCE_ONLY') {
        // Reset only leave balances without deleting requests based on leave type
        // Annual Leave: Reset to 30 days
        await tx.leaveBalance.updateMany({
          where: {
            leaveType: { code: 'AL' }
          },
          data: {
            entitled: 30,
            used: 0,
            pending: 0,
            available: 30
          }
        })

        // Personal Leave: Reset to 5 days (drawer system)
        await tx.leaveBalance.updateMany({
          where: {
            leaveType: { code: 'PL' }
          },
          data: {
            entitled: 5,
            used: 0,
            pending: 0,
            available: 5
          }
        })

        // Sick Leave: Set to unlimited (999 days as proxy for unlimited)
        await tx.leaveBalance.updateMany({
          where: {
            leaveType: { code: 'SL' }
          },
          data: {
            entitled: 999,
            used: 0,
            pending: 0,
            available: 999
          }
        })
      } else {
        // Delete all requests (default)
        const deletedLeaveRequests = await tx.leaveRequest.deleteMany({})
        deletionStats.leaveRequests = deletedLeaveRequests.count

        const deletedWfhRequests = await tx.workFromHomeRequest.deleteMany({})
        deletionStats.wfhRequests = deletedWfhRequests.count
        
        // Reset leave balances for all requests based on leave type
        // Annual Leave: Reset to 30 days
        await tx.leaveBalance.updateMany({
          where: {
            leaveType: { code: 'AL' }
          },
          data: {
            entitled: 30,
            used: 0,
            pending: 0,
            available: 30
          }
        })

        // Personal Leave: Reset to 5 days (drawer system)
        await tx.leaveBalance.updateMany({
          where: {
            leaveType: { code: 'PL' }
          },
          data: {
            entitled: 5,
            used: 0,
            pending: 0,
            available: 5
          }
        })

        // Sick Leave: Set to unlimited (999 days as proxy for unlimited)
        await tx.leaveBalance.updateMany({
          where: {
            leaveType: { code: 'SL' }
          },
          data: {
            entitled: 999,
            used: 0,
            pending: 0,
            available: 999
          }
        })
      }

      console.log('✅ Database cleanup completed:', deletionStats)
    })

    // Step 4: Log the action for audit purposes
    console.log(`🔒 Admin ${session.user.email} performed ${resetType || 'FULL'} requests reset:`, deletionStats)

    return NextResponse.json({
      success: true,
      message: "All requests and associated data have been successfully deleted",
      statistics: deletionStats,
      resetType: resetType || 'FULL',
      performedBy: session.user.email,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error resetting requests:", error)
    return NextResponse.json(
      { 
        error: "Internal server error during reset", 
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}

// GET endpoint to check what would be deleted (dry run)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Count what would be deleted
    const counts = {
      leaveRequests: await prisma.leaveRequest.count(),
      wfhRequests: await prisma.workFromHomeRequest.count(),
      approvals: await prisma.approval.count(),
      wfhApprovals: await prisma.wFHApproval.count(),
      substituteLinks: await prisma.leaveRequestSubstitute.count(),
      documents: await prisma.generatedDocument.count(),
      documentSignatures: await prisma.documentSignature.count()
    }

    return NextResponse.json({
      message: "Dry run - these items would be deleted",
      counts,
      warning: "This action cannot be undone. All request data and documents will be permanently deleted."
    })

  } catch (error) {
    console.error("Error in reset dry run:", error)
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    )
  }
}