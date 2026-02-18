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

const createPageSchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  categoryId: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  isPinned: z.boolean().optional(),
  sortOrder: z.number().optional(),
  visibleToRoles: z.array(z.enum(['EMPLOYEE', 'MANAGER', 'DEPARTMENT_DIRECTOR', 'HR', 'EXECUTIVE', 'ADMIN'])).optional(),
  translations: z.array(z.object({
    language: z.enum(['en', 'ro']),
    title: z.string().min(1).max(500),
    content: z.any(),
    excerpt: z.string().optional(),
  })).min(1),
  tagIds: z.array(z.string()).optional(),
})

export const GET = asyncHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const result = await WikiService.listPages({
    search: searchParams.get('search') || undefined,
    categoryId: searchParams.get('categoryId') || undefined,
    tagId: searchParams.get('tagId') || undefined,
    status: (searchParams.get('status') as WikiPageStatus) || 'PUBLISHED',
    language: searchParams.get('language') || 'en',
    userRole: (session.user as any).role,
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
    isPinned: searchParams.get('isPinned') === 'true' ? true : undefined,
  })

  return NextResponse.json(result)
})

export const POST = asyncHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (!canEditWiki(userRole)) {
    return NextResponse.json({ error: 'Forbidden: Only HR and ADMIN can create wiki pages' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createPageSchema.safeParse(body)
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
  const page = await WikiService.createPage({
    ...parsed.data,
    authorId: userId,
    status: parsed.data.status as WikiPageStatus,
  })

  await createAuditLog({
    userId,
    action: parsed.data.status === 'PUBLISHED' ? AuditAction.PUBLISH_WIKI_PAGE : AuditAction.CREATE_WIKI_PAGE,
    entity: 'WIKI_PAGE',
    entityId: page.id,
    newValues: { slug: parsed.data.slug, status: parsed.data.status },
  })

  return NextResponse.json(page, { status: 201 })
})
