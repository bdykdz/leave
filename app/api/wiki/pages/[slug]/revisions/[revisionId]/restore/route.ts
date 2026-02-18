import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { WikiService } from '@/lib/services/wiki-service'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { createAuditLog, AuditAction } from '@/lib/utils/audit-log'
import { asyncHandler } from '@/lib/async-handler'

export const POST = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ slug: string; revisionId: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (!canEditWiki(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug, revisionId } = await params

  // Verify the page exists and the revision belongs to it
  const existingPage = await WikiService.getPageBySlug(slug)
  if (!existingPage) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  const revision = await WikiService.getRevision(revisionId)
  if (!revision || revision.pageId !== existingPage.id) {
    return NextResponse.json({ error: 'Revision not found for this page' }, { status: 404 })
  }

  const userId = (session.user as any).id
  const page = await WikiService.restoreRevision(revisionId, userId)

  await createAuditLog({
    userId,
    action: AuditAction.RESTORE_WIKI_REVISION,
    entity: 'WIKI_PAGE',
    entityId: page.id,
    newValues: { slug, restoredRevisionId: revisionId },
  })

  return NextResponse.json(page)
})
