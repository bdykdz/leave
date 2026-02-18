import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { WikiService } from '@/lib/services/wiki-service'
import { asyncHandler } from '@/lib/async-handler'

export const GET = asyncHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 })
  }

  const language = req.nextUrl.searchParams.get('language') || 'en'
  const userRole = (session.user as any).role

  const results = await WikiService.searchPages(q.trim(), language, userRole)
  return NextResponse.json(results)
})
