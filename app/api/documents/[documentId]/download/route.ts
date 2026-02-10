import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { getFromMinio } from '@/lib/minio';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get document
    const document = await prisma.generatedDocument.findUnique({
      where: { id: params.documentId },
      include: {
        leaveRequest: {
          include: {
            user: true,
          }
        }
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check permission
    const hasPermission = await checkDownloadPermission(session.user, document);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Read file
    // Get file from Minio or filesystem
    let fileBuffer: Buffer
    
    try {
      if (document.fileUrl.startsWith('minio://')) {
        // Get from Minio
        const minioPath = document.fileUrl.replace('minio://', '')
        const bucketName = minioPath.split('/')[0]
        const objectPath = minioPath.substring(bucketName.length + 1)
        fileBuffer = await getFromMinio(objectPath, bucketName)
      } else {
        // Legacy filesystem storage
        const fs = await import('fs/promises')
        const path = await import('path')
        const filePath = path.join(process.cwd(), 'public', document.fileUrl)
        fileBuffer = await fs.readFile(filePath)
      }
      
      // Generate filename
      const fileName = `leave-request-${document.leaveRequest.requestNumber}.pdf`;
      
      // Return file
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    } catch (error) {
      console.error('File read error:', error);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Document download error:', error);
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}

async function checkDownloadPermission(user: any, document: any): boolean {
  // Document owner can download
  if (document.leaveRequest.user.id === user.id) {
    return true;
  }

  // HR and ADMIN can download all
  if (['HR', 'ADMIN'].includes(user.role)) {
    return true;
  }

  // Managers can download subordinate documents
  if (['MANAGER', 'DEPARTMENT_DIRECTOR', 'EXECUTIVE'].includes(user.role)) {
    const subordinates = await prisma.user.findMany({
      where: {
        OR: [
          { managerId: user.id },
          { departmentDirectorId: user.id }
        ]
      },
      select: { id: true }
    });

    if (subordinates.some(sub => sub.id === document.leaveRequest.userId)) {
      return true;
    }
  }

  return false;
}