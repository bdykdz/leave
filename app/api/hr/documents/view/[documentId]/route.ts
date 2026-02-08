import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getFromMinio, MINIO_BUCKET } from '@/lib/minio';

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
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
    
    const isHREmployee = user?.role === 'EMPLOYEE' && user?.department?.toLowerCase().includes('hr');
    
    if (!['HR', 'ADMIN', 'EXECUTIVE'].includes(session.user?.role || '') && !isHREmployee) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get document
    const document = await prisma.generatedDocument.findUnique({
      where: { id: params.documentId },
      include: {
        leaveRequest: {
          include: {
            user: true,
            leaveType: true,
          }
        }
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Read file from MinIO or filesystem
    let fileBuffer: Buffer;
    
    try {
      if (document.fileUrl.startsWith('minio://')) {
        // Parse MinIO URL (format: minio://bucket/path)
        const urlParts = document.fileUrl.replace('minio://', '').split('/');
        const bucketName = urlParts[0];
        const objectPath = urlParts.slice(1).join('/');
        
        fileBuffer = await getFromMinio(objectPath, bucketName);
      } else {
        // Legacy filesystem storage
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'public', document.fileUrl);
        fileBuffer = await fs.readFile(filePath);
      }
      
      // Generate filename
      const fileName = `${document.leaveRequest.requestNumber}_${document.leaveRequest.user.lastName}_${document.leaveRequest.leaveType.code}.pdf`;
      
      // Return file for viewing (inline, not download)
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch (error) {
      console.error('File read error:', error);
      return NextResponse.json({ error: 'File not found or inaccessible' }, { status: 404 });
    }
  } catch (error) {
    console.error('Document view error:', error);
    return NextResponse.json(
      { error: 'Failed to view document' },
      { status: 500 }
    );
  }
}