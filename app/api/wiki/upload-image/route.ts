import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { uploadToMinio } from '@/lib/minio'
import { asyncHandler } from '@/lib/async-handler'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

export const POST = asyncHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (!canEditWiki(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP' }, { status: 400 })
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const timestamp = Date.now()
  const fileName = `${timestamp}-${file.name}`

  await uploadToMinio(buffer, fileName, file.type, undefined, 'wiki/images')

  const url = `/api/wiki/images/wiki/images/${fileName}`

  return NextResponse.json({ url })
})
