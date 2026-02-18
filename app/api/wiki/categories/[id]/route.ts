import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { WikiService } from '@/lib/services/wiki-service'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { asyncHandler } from '@/lib/async-handler'
import { z } from 'zod'

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameEn: z.string().min(1).max(100).optional(),
  nameRo: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
})

export const PUT = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (!canEditWiki(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const category = await WikiService.updateCategory(id, parsed.data)
  return NextResponse.json(category)
})

export const DELETE = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (!canEditWiki(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  try {
    await WikiService.deleteCategory(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message?.includes('Cannot delete category with pages')) {
      return NextResponse.json({ error: 'Cannot delete category that has pages' }, { status: 400 })
    }
    throw error
  }
})
