import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { WikiService } from '@/lib/services/wiki-service'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { uploadToMinio } from '@/lib/minio'
import { asyncHandler } from '@/lib/async-handler'

export const GET = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const page = await WikiService.getPageBySlug(slug)
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  const userRole = (session.user as any).role
  if (!WikiService.canUserViewPage(page, userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const attachments = await WikiService.listAttachments(page.id)
  return NextResponse.json(attachments)
})

export const POST = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (!canEditWiki(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params
  const page = await WikiService.getPageBySlug(slug)
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  if (!WikiService.canUserViewPage(page, userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Block dangerous file types
  const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'scr', 'vbs', 'jar', 'msi', 'dll']
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const timestamp = Date.now()
  const fileName = `${timestamp}-${file.name}`
  const fileUrl = await uploadToMinio(buffer, fileName, file.type, undefined, 'wiki/attachments')

  const userId = (session.user as any).id
  const attachment = await WikiService.createAttachment({
    pageId: page.id,
    fileName: file.name,
    fileUrl,
    contentType: file.type,
    fileSize: file.size,
    uploadedBy: userId,
  })

  return NextResponse.json(attachment, { status: 201 })
})
