import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-config'
import { getFromMinio } from '@/lib/minio'
import { asyncHandler } from '@/lib/async-handler'

export const GET = asyncHandler(async (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { path } = await params
  const objectPath = path.join('/')

  // Prevent path traversal attacks
  if (objectPath.includes('..') || objectPath.startsWith('/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  // Ensure path is under wiki/images/
  const fullPath = objectPath.startsWith('wiki/images/') ? objectPath : `wiki/images/${objectPath}`

  try {
    const buffer = await getFromMinio(fullPath)

    // Determine content type from extension
    const ext = objectPath.split('.').pop()?.toLowerCase()
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    }
    const contentType = contentTypes[ext || ''] || 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(buffer.length),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }
})
