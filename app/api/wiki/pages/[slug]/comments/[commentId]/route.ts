import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { WikiService } from '@/lib/services/wiki-service'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { asyncHandler } from '@/lib/async-handler'
import { z } from 'zod'

const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
})

export const PUT = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ slug: string; commentId: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { commentId } = await params
  const userId = (session.user as any).id

  const comment = await WikiService.getComment(commentId)
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }
  if (comment.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden: Can only edit own comments' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await WikiService.updateComment(commentId, parsed.data.content)
  return NextResponse.json(updated)
})

export const DELETE = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ slug: string; commentId: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { commentId } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role

  const comment = await WikiService.getComment(commentId)
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  if (comment.userId !== userId && !canEditWiki(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await WikiService.deleteComment(commentId)
  return NextResponse.json({ success: true })
})
