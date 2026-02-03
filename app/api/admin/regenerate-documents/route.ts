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

    // Get all APPROVED/PENDING leave requests that need documents
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        status: {
          in: ['APPROVED', 'PENDING']
        }
      },
      include: {
        generatedDocument: {
          include: {
            template: true
          }
        },
        leaveType: {
          include: {
            documentTemplates: true
          }
        }
      }
    })

    console.log(`Found ${leaveRequests.length} APPROVED/PENDING leave requests to process for documents`)

    const generator = new SmartDocumentGenerator()
    let successCount = 0
    let errorCount = 0
    const errors: any[] = []

    for (const leaveRequest of leaveRequests) {
      try {
        console.log(`Processing document for leave request ${leaveRequest.requestNumber}`)
        
        let templateId: string | null = null
        
        // If there's already a generated document, use its template
        if (leaveRequest.generatedDocument?.template) {
          templateId = leaveRequest.generatedDocument.template.id
          console.log(`Found existing template ${templateId} for ${leaveRequest.requestNumber}`)
        }
        // Otherwise, try to find an appropriate template for the leave type
        else if (leaveRequest.leaveType.documentTemplates && leaveRequest.leaveType.documentTemplates.length > 0) {
          // Use the first active template for this leave type
          const activeTemplate = leaveRequest.leaveType.documentTemplates.find(t => t.isActive)
          if (activeTemplate) {
            templateId = activeTemplate.id
            console.log(`Found leave type template ${templateId} for ${leaveRequest.requestNumber}`)
          }
        }
        
        if (!templateId) {
          console.warn(`No template found for leave request ${leaveRequest.requestNumber}`)
          errorCount++
          errors.push({
            requestNumber: leaveRequest.requestNumber,
            error: 'No template found'
          })
          continue
        }

        // Generate/regenerate the document
        await generator.generateDocument(
          leaveRequest.id,
          templateId
        )
        
        successCount++
        console.log(`Successfully processed document for ${leaveRequest.requestNumber}`)
      } catch (error) {
        console.error(`Error processing document for ${leaveRequest.requestNumber}:`, error)
        errorCount++
        errors.push({
          requestNumber: leaveRequest.requestNumber,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Document processing complete`,
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