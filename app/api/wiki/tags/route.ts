import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { WikiService } from '@/lib/services/wiki-service'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { asyncHandler } from '@/lib/async-handler'
import { z } from 'zod'

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  nameEn: z.string().min(1).max(50),
  nameRo: z.string().min(1).max(50),
})

export const GET = asyncHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tags = await WikiService.listTags()
  return NextResponse.json(tags)
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
  const parsed = createTagSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const tag = await WikiService.createTag(parsed.data)
  return NextResponse.json(tag, { status: 201 })
})
