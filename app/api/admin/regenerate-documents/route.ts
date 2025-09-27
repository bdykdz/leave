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

    // Get all leave requests with generated documents
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        generatedDocument: {
          isNot: null
        }
      },
      include: {
        generatedDocument: {
          include: {
            template: true
          }
        }
      }
    })

    console.log(`Found ${leaveRequests.length} leave requests with documents to regenerate`)

    const generator = new SmartDocumentGenerator()
    let successCount = 0
    let errorCount = 0
    const errors: any[] = []

    for (const leaveRequest of leaveRequests) {
      try {
        console.log(`Regenerating document for leave request ${leaveRequest.requestNumber}`)
        
        if (!leaveRequest.generatedDocument?.template) {
          console.warn(`No template found for leave request ${leaveRequest.requestNumber}`)
          errorCount++
          errors.push({
            requestNumber: leaveRequest.requestNumber,
            error: 'No template found'
          })
          continue
        }

        // Regenerate the document
        await generator.generateDocument(
          leaveRequest.id,
          leaveRequest.generatedDocument.template.id
        )
        
        successCount++
        console.log(`Successfully regenerated document for ${leaveRequest.requestNumber}`)
      } catch (error) {
        console.error(`Error regenerating document for ${leaveRequest.requestNumber}:`, error)
        errorCount++
        errors.push({
          requestNumber: leaveRequest.requestNumber,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Document regeneration complete`,
      stats: {
        total: leaveRequests.length,
        successful: successCount,
        failed: errorCount
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