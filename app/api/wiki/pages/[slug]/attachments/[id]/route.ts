import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { WikiService } from '@/lib/services/wiki-service'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { getFromMinio, deleteFromMinio } from '@/lib/minio'
import { asyncHandler } from '@/lib/async-handler'

export const GET = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug, id } = await params

  const page = await WikiService.getPageBySlug(slug)
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  const userRole = (session.user as any).role
  if (!WikiService.canUserViewPage(page, userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const attachment = await WikiService.getAttachment(id)
  if (!attachment || attachment.pageId !== page.id) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  const objectPath = attachment.fileUrl.replace(/^minio:\/\/[^/]+\//, '')
  const buffer = await getFromMinio(objectPath)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': attachment.contentType,
      'Content-Disposition': `attachment; filename="${attachment.fileName}"`,
      'Content-Length': String(buffer.length),
    },
  })
})

export const DELETE = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (!canEditWiki(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug, id } = await params

  const page = await WikiService.getPageBySlug(slug)
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  const attachment = await WikiService.getAttachment(id)
  if (!attachment || attachment.pageId !== page.id) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  const objectPath = attachment.fileUrl.replace(/^minio:\/\/[^/]+\//, '')
  await deleteFromMinio(objectPath).catch(() => {})
  await WikiService.deleteAttachment(id)

  return NextResponse.json({ success: true })
})
