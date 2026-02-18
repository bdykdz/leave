import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { WikiService } from '@/lib/services/wiki-service'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { createAuditLog, AuditAction } from '@/lib/utils/audit-log'
import { asyncHandler } from '@/lib/async-handler'
import { WikiPageStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updatePageSchema = z.object({
  categoryId: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  isPinned: z.boolean().optional(),
  sortOrder: z.number().optional(),
  visibleToRoles: z.array(z.enum(['EMPLOYEE', 'MANAGER', 'DEPARTMENT_DIRECTOR', 'HR', 'EXECUTIVE', 'ADMIN'])).optional(),
  translations: z.array(z.object({
    language: z.enum(['en', 'ro']),
    title: z.string().min(1).max(500),
    content: z.any(),
    excerpt: z.string().optional(),
  })).optional(),
  tagIds: z.array(z.string()).optional(),
  changeNote: z.string().optional(),
})

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

  // Increment view count (fire and forget)
  WikiService.incrementViewCount(slug).catch(() => {})

  return NextResponse.json(page)
})

export const PUT = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (!canEditWiki(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params
  const body = await req.json()
  const parsed = updatePageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  // Validate category exists
  if (parsed.data.categoryId) {
    const cat = await prisma.wikiCategory.findUnique({ where: { id: parsed.data.categoryId } })
    if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 400 })
  }

  // Validate all tag IDs exist
  if (parsed.data.tagIds?.length) {
    const count = await prisma.wikiTag.count({ where: { id: { in: parsed.data.tagIds } } })
    if (count !== parsed.data.tagIds.length) return NextResponse.json({ error: 'Invalid tag IDs' }, { status: 400 })
  }

  const userId = (session.user as any).id
  const page = await WikiService.updatePage(slug, userId, {
    ...parsed.data,
    status: parsed.data.status as WikiPageStatus | undefined,
  })

  const action = parsed.data.status === 'PUBLISHED' ? AuditAction.PUBLISH_WIKI_PAGE : AuditAction.UPDATE_WIKI_PAGE
  await createAuditLog({
    userId,
    action,
    entity: 'WIKI_PAGE',
    entityId: page.id,
    newValues: { slug, status: parsed.data.status },
  })

  return NextResponse.json(page)
})

export const DELETE = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (!canEditWiki(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params
  const page = await WikiService.deletePage(slug)

  await createAuditLog({
    userId: (session.user as any).id,
    action: AuditAction.ARCHIVE_WIKI_PAGE,
    entity: 'WIKI_PAGE',
    entityId: page.id,
    newValues: { slug, status: 'ARCHIVED' },
  })

  return NextResponse.json({ success: true })
})
