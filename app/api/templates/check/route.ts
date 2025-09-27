import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const templates = await prisma.documentTemplate.findMany({
      where: { isActive: true },
      include: {
        fieldMappings: {
          select: {
            id: true
          }
        }
      }
    })
    
    const hasConfiguredTemplates = templates.some(t => t.fieldMappings.length > 0)
    
    return NextResponse.json({
      hasTemplates: templates.length > 0,
      hasConfiguredTemplates,
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        isConfigured: t.fieldMappings.length > 0,
        fieldMappingsCount: t.fieldMappings.length
      }))
    })
  } catch (error) {
    console.error('Error checking templates:', error)
    return NextResponse.json({ 
      error: 'Failed to check templates',
      hasTemplates: false,
      hasConfiguredTemplates: false
    }, { status: 500 })
  }
}