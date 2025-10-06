import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { uploadToMinio } from '@/lib/minio';

const prisma = new PrismaClient();

// Allowed file types for templates
const ALLOWED_FILE_TYPES = ['application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const leaveTypeId = formData.get('leaveTypeId') as string;
    const category = formData.get('category') as string;
    const isWFHTemplate = formData.get('isWFHTemplate') === 'true';

    // Validate file
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only PDF files are allowed.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // Validate required fields
    if (!name || (!leaveTypeId && !isWFHTemplate)) {
      return NextResponse.json({ error: 'Name and template category are required' }, { status: 400 });
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;

    // Convert file to buffer and upload to Minio
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const fileUrl = await uploadToMinio(buffer, uniqueFilename, file.type);

    // Create database entry
    const templateData: any = {
      name,
      description: description || '',
      fileUrl: fileUrl,
      fileType: 'pdf',
      category: category || (isWFHTemplate ? 'wfh' : 'leave_request'),
      createdBy: session.user.id,
    };

    // Only add leaveTypeId if it's not a WFH template
    if (!isWFHTemplate && leaveTypeId) {
      templateData.leaveTypeId = leaveTypeId;
    }

    const template = await prisma.documentTemplate.create({
      data: templateData,
    });

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        fileUrl: template.fileUrl,
        fileType: template.fileType,
        category: template.category,
        version: template.version,
        createdAt: template.createdAt,
      },
    });
  } catch (error) {
    console.error('Template upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload template' },
      { status: 500 }
    );
  }
}