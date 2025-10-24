import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getFromMinio, MINIO_BUCKET } from '@/lib/minio'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has access to documents (HR, ADMIN, EXECUTIVE, or HR employee)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })

    const isHREmployee = user?.role === 'EMPLOYEE' && user?.department?.toLowerCase().includes('hr')
    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Reconstruct and sanitize the file path
    const rawPath = params.path.join('/')
    
    // Sanitize path components to prevent directory traversal
    const sanitizedComponents = params.path.map(component => {
      // Remove dangerous characters and sequences
      return component
        .replace(/\.\./g, '') // Remove .. sequences
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe characters
        .substring(0, 100) // Limit component length
    }).filter(component => component.length > 0)
    
    if (sanitizedComponents.length === 0) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    
    const filePath = sanitizedComponents.join('/')
    
    // Ensure it's a supporting document path for security
    if (!filePath.startsWith('documents/supporting/')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    
    // Additional validation: check path doesn't contain traversal after normalization
    if (filePath.includes('..') || filePath.includes('//')) {
      return NextResponse.json({ error: 'Invalid path detected' }, { status: 400 })
    }

    // Get file from MinIO
    const fileBuffer = await getFromMinio(filePath, MINIO_BUCKET)
    
    // Determine content type based on file extension
    const extension = filePath.split('.').pop()?.toLowerCase()
    let contentType = 'application/octet-stream'
    
    switch (extension) {
      case 'pdf':
        contentType = 'application/pdf'
        break
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg'
        break
      case 'png':
        contentType = 'image/png'
        break
    }

    // Sanitize filename for Content-Disposition header
    const filename = filePath.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document'
    
    // Return the file with security headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600, no-cache',
        'X-Content-Type-Options': 'nosniff', // Prevent MIME sniffing
        'X-Frame-Options': 'DENY', // Prevent embedding
        'Content-Security-Policy': "default-src 'none'", // Strict CSP for documents
        'X-Download-Options': 'noopen' // IE security
      }
    })
  } catch (error) {
    console.error('Error serving document:', error)
    return NextResponse.json(
      { error: 'Document not found' },
      { status: 404 }
    )
  }
}