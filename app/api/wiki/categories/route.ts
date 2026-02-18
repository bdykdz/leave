import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { WikiService } from '@/lib/services/wiki-service'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { asyncHandler } from '@/lib/async-handler'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  nameEn: z.string().min(1).max(100),
  nameRo: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().optional(),
  parentId: z.string().optional(),
})

export const GET = asyncHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const categories = await WikiService.listCategories()
  return NextResponse.json(categories)
})

export const POST = asyncHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (!canEditWiki(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  // Validate parent category exists
  if (parsed.data.parentId) {
    const parent = await prisma.wikiCategory.findUnique({ where: { id: parsed.data.parentId } })
    if (!parent) return NextResponse.json({ error: 'Parent category not found' }, { status: 400 })
  }

  const category = await WikiService.createCategory(parsed.data)
  return NextResponse.json(category, { status: 201 })
})
