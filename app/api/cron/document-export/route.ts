import { NextRequest, NextResponse } from 'next/server'
import { syncDocumentsToLocal } from '@/lib/document-export-service'
import { verifyCronAuth } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] Document export sync triggered')
    const result = await syncDocumentsToLocal()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Document export error:', error)
    return NextResponse.json(
      { error: 'Failed to sync documents', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
