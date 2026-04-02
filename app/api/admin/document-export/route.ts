import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getExportStats, syncDocumentsToLocal } from '@/lib/document-export-service'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['ADMIN', 'HR', 'EXECUTIVE'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stats = await getExportStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Export stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get export stats' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 })
    }

    console.log(`[EXPORT] Manual sync triggered by ${session.user.email}`)
    const result = await syncDocumentsToLocal()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Export sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync documents' },
      { status: 500 }
    )
  }
}
