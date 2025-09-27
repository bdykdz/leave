import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current retention settings
    const settings = await prisma.companySetting.findUnique({
      where: { key: 'document_retention_policy' },
    })

    const defaultPolicy = {
      retentionDays: 90,
      autoDelete: false,
      deleteAfterApproval: false,
      deleteAfterApprovalDays: 60,
      enableAnonymization: false,
      anonymizeAfterDays: 365,
    }

    return NextResponse.json({
      policy: settings ? settings.value : defaultPolicy,
    })
  } catch (error) {
    console.error('Failed to fetch retention policy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch retention policy' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { retentionDays, autoDelete, deleteAfterApproval, deleteAfterApprovalDays, enableAnonymization, anonymizeAfterDays } = body

    const policy = {
      retentionDays: retentionDays || 90,
      autoDelete: autoDelete || false,
      deleteAfterApproval: deleteAfterApproval || false,
      deleteAfterApprovalDays: deleteAfterApprovalDays || 60,
      enableAnonymization: enableAnonymization || false,
      anonymizeAfterDays: anonymizeAfterDays || 365,
    }

    await prisma.companySetting.upsert({
      where: { key: 'document_retention_policy' },
      update: { 
        value: policy,
        updatedBy: session.user.id,
      },
      create: {
        key: 'document_retention_policy',
        value: policy,
        category: 'document_management',
        description: 'Document retention and privacy policy settings',
      },
    })

    // Log the change
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_RETENTION_POLICY',
        entity: 'CompanySetting',
        entityId: 'document_retention_policy',
        newValues: policy,
      },
    })

    return NextResponse.json({ success: true, policy })
  } catch (error) {
    console.error('Failed to update retention policy:', error)
    return NextResponse.json(
      { error: 'Failed to update retention policy' },
      { status: 500 }
    )
  }
}