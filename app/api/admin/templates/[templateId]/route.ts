import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET template details
export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await prisma.documentTemplate.findUnique({
      where: { id: params.templateId },
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        fieldMappings: true,
        signaturePlacements: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: {
            generatedDocuments: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Get template details error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template details' },
      { status: 500 }
    );
  }
}

// PATCH update template details
export async function PATCH(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { name, description, category, isActive, leaveTypeId } = data;

    const template = await prisma.documentTemplate.update({
      where: { id: params.templateId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(isActive !== undefined && { isActive }),
        ...(leaveTypeId !== undefined && { leaveTypeId: leaveTypeId || null }),
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Update template error:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}