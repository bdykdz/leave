import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FieldMapping {
  fieldKey: string;
  fieldLabel: string;
  documentPosition: {
    x: number;
    y: number;
    page: number;
    width?: number;
    height?: number;
  };
  fieldStyle?: {
    fontSize?: number;
    fontFamily?: string;
    align?: string;
    color?: string;
  };
  isRequired?: boolean;
}

// GET field mappings for a template
export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fieldMappings = await prisma.templateFieldMapping.findMany({
      where: { templateId: params.templateId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ fieldMappings });
  } catch (error) {
    console.error('Get field mappings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch field mappings' },
      { status: 500 }
    );
  }
}

// POST save field mappings for a template
export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fields }: { fields: FieldMapping[] } = await request.json();

    // Validate template exists
    const template = await prisma.documentTemplate.findUnique({
      where: { id: params.templateId },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Delete existing field mappings
    await prisma.templateFieldMapping.deleteMany({
      where: { templateId: params.templateId },
    });

    // Create new field mappings
    const fieldMappings = await prisma.templateFieldMapping.createMany({
      data: fields.map((field) => ({
        templateId: params.templateId,
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        documentPosition: field.documentPosition,
        fieldStyle: field.fieldStyle || {},
        isRequired: field.isRequired !== false,
      })),
    });

    return NextResponse.json({
      success: true,
      count: fieldMappings.count,
    });
  } catch (error) {
    console.error('Save field mappings error:', error);
    return NextResponse.json(
      { error: 'Failed to save field mappings' },
      { status: 500 }
    );
  }
}

// DELETE remove a specific field mapping
export async function DELETE(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fieldMappingId } = await request.json();

    await prisma.templateFieldMapping.delete({
      where: {
        id: fieldMappingId,
        templateId: params.templateId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete field mapping error:', error);
    return NextResponse.json(
      { error: 'Failed to delete field mapping' },
      { status: 500 }
    );
  }
}