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

    const { templateId } = await request.json()

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
    }

    // Find and update any mapping that uses substitute.fullName to use substitutes.fullName
    const updated = await prisma.templateFieldMapping.updateMany({
      where: { 
        templateId,
        fieldKey: 'substitute.fullName'
      },
      data: {
        fieldKey: 'substitutes.fullName'
      }
    })

    return NextResponse.json({
      success: true,
      message: `Updated ${updated.count} field mappings from substitute.fullName to substitutes.fullName`
    })
  } catch (error) {
    console.error('Error updating field mappings:', error)
    return NextResponse.json({ 
      error: 'Failed to update field mappings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}