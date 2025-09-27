import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    // Delete all document-related data
    await prisma.documentSignature.deleteMany({})
    console.log('Deleted all document signatures')
    
    await prisma.generatedDocument.deleteMany({})
    console.log('Deleted all generated documents')
    
    await prisma.templateSignature.deleteMany({})
    console.log('Deleted all template signatures')
    
    await prisma.templateFieldMapping.deleteMany({})
    console.log('Deleted all field mappings')
    
    await prisma.documentTemplate.deleteMany({})
    console.log('Deleted all document templates')
    
    // Reset leave requests to remove document references
    await prisma.leaveRequest.updateMany({
      data: {
        documentUrl: null,
        supportingDocuments: null,
        hrDocumentVerified: false,
        hrVerifiedBy: null,
        hrVerifiedAt: null,
        hrVerificationNotes: null
      }
    })
    console.log('Reset all leave requests')
    
    return NextResponse.json({
      success: true,
      message: 'All templates and documents have been reset'
    })
  } catch (error) {
    console.error('Error resetting templates:', error)
    return NextResponse.json({ 
      error: 'Failed to reset templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}