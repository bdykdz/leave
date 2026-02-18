import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { WikiService } from '@/lib/services/wiki-service'
import { asyncHandler } from '@/lib/async-handler'

export const GET = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ slug: string; revisionId: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug, revisionId } = await params

  const page = await WikiService.getPageBySlug(slug)
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  const userRole = (session.user as any).role
  if (!WikiService.canUserViewPage(page, userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const revision = await WikiService.getRevision(revisionId)
  if (!revision || revision.pageId !== page.id) {
    return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
  }

  return NextResponse.json(revision)
})
