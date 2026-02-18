import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { WikiService } from '@/lib/services/wiki-service'
import { asyncHandler } from '@/lib/async-handler'
import { z } from 'zod'

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentId: z.string().optional(),
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

  const comments = await WikiService.listComments(page.id)
  return NextResponse.json(comments)
})

export const POST = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
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

  const body = await req.json()
  const parsed = createCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  // Fix 3: Validate parentId belongs to the same page
  if (parsed.data.parentId) {
    const parent = await WikiService.getComment(parsed.data.parentId)
    if (!parent || parent.pageId !== page.id) {
      return NextResponse.json({ error: 'Invalid parent comment' }, { status: 400 })
    }
  }

  const userId = (session.user as any).id
  const comment = await WikiService.createComment({
    pageId: page.id,
    userId,
    content: parsed.data.content,
    parentId: parsed.data.parentId,
  })

  return NextResponse.json(comment, { status: 201 })
})
