import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { templateId, mappings } = await request.json()

    if (!templateId || !mappings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Delete existing mappings for this template
    await prisma.templateFieldMapping.deleteMany({
      where: { templateId }
    })

    // Create new mappings
    const createdMappings = []
    for (const mapping of mappings) {
      if (mapping.dataField) { // Only create mapping if a data field is selected
        const created = await prisma.templateFieldMapping.create({
          data: {
            templateId,
            fieldKey: mapping.dataField, // The data path (e.g., 'employee.fullName')
            fieldLabel: mapping.pdfField, // The PDF form field name
            documentPosition: {
              formFieldName: mapping.pdfField, // Store the PDF field name
              type: mapping.type || 'text'
            },
            fieldStyle: {
              fontSize: 12,
              fontFamily: 'Helvetica',
              align: 'left'
            },
            isRequired: mapping.required || false
          }
        })
        createdMappings.push(created)
      }
    }

    return NextResponse.json({
      success: true,
      mappingsCreated: createdMappings.length,
      message: `Successfully saved ${createdMappings.length} field mappings`
    })
  } catch (error) {
    console.error('Error saving field mappings:', error)
    return NextResponse.json({ 
      error: 'Failed to save field mappings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to retrieve existing mappings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
    }

    const mappings = await prisma.templateFieldMapping.findMany({
      where: { templateId },
      orderBy: { createdAt: 'asc' }
    })

    // Transform mappings to the format expected by the UI
    const formattedMappings = mappings.map(mapping => ({
      pdfField: mapping.fieldLabel, // PDF field name
      dataField: mapping.fieldKey,  // Data path
      type: (mapping.documentPosition as any)?.type || 'text',
      required: mapping.isRequired
    }))

    return NextResponse.json({
      mappings: formattedMappings
    })
  } catch (error) {
    console.error('Error fetching field mappings:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch field mappings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}