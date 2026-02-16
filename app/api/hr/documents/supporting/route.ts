import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getFromMinio } from '@/lib/minio';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is HR, ADMIN, EXECUTIVE, or EMPLOYEE with HR department
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    });
    
    const isHREmployee = user?.role === 'EMPLOYEE' && (user?.department?.toLowerCase() === 'hr' || user?.department?.toLowerCase() === 'human resources');
    
    if (!['HR', 'ADMIN', 'EXECUTIVE'].includes(session.user?.role || '') && !isHREmployee) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get the document URL from query params
    const searchParams = request.nextUrl.searchParams;
    const documentUrl = searchParams.get('url');
    const fileName = searchParams.get('filename') || 'document';

    if (!documentUrl) {
      return NextResponse.json({ error: 'Document URL is required' }, { status: 400 });
    }

    // Read file from MinIO or filesystem
    let fileBuffer: Buffer;

    try {
      if (documentUrl.startsWith('minio://')) {
        // Parse MinIO URL (format: minio://bucket/path)
        const urlParts = documentUrl.replace('minio://', '').split('/');
        const bucketName = urlParts[0];
        const objectPath = urlParts.slice(1).join('/');

        fileBuffer = await getFromMinio(objectPath, bucketName);
      } else if (documentUrl.startsWith('http://') || documentUrl.startsWith('https://')) {
        // Block SSRF: only allow HTTPS and restrict to known domains
        if (documentUrl.startsWith('http://')) {
          return NextResponse.json({ error: 'Only HTTPS URLs are allowed' }, { status: 400 });
        }
        const parsedUrl = new URL(documentUrl);
        const allowedHosts = (process.env.MINIO_ENDPOINT || '').replace(/:\d+$/, '');
        const blockedPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '[::1]', 'metadata.google', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.'];
        if (blockedPatterns.some(pattern => parsedUrl.hostname.includes(pattern) || parsedUrl.hostname.startsWith(pattern))) {
          return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
        }
        const response = await fetch(documentUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }
        const arrayBuffer = await response.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else {
        // Legacy filesystem storage - block path traversal
        if (documentUrl.includes('..') || documentUrl.includes('\0')) {
          return NextResponse.json({ error: 'Invalid document path' }, { status: 400 });
        }
        const fs = await import('fs/promises');
        const path = await import('path');
        const publicDir = path.resolve(process.cwd(), 'public');
        const filePath = path.resolve(publicDir, documentUrl);
        // Ensure resolved path is still within public directory
        if (!filePath.startsWith(publicDir + path.sep)) {
          return NextResponse.json({ error: 'Invalid document path' }, { status: 400 });
        }
        fileBuffer = await fs.readFile(filePath);
      }
      
      // Determine content type from file extension
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      const contentTypes: { [key: string]: string } = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'txt': 'text/plain',
      };
      
      const contentType = contentTypes[extension] || 'application/octet-stream';
      
      // Return file for viewing (inline for PDFs and images, download for others)
      const disposition = ['pdf', 'jpg', 'jpeg', 'png', 'gif'].includes(extension) 
        ? `inline; filename="${fileName}"`
        : `attachment; filename="${fileName}"`;
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': disposition,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch (error) {
      console.error('File read error:', error);
      return NextResponse.json({ error: 'File not found or inaccessible' }, { status: 404 });
    }
  } catch (error) {
    console.error('Supporting document view error:', error);
    return NextResponse.json(
      { error: 'Failed to view supporting document' },
      { status: 500 }
    );
  }
}