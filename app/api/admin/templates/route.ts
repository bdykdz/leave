import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET list all templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');

    const where: any = {};
    if (category) where.category = category;
    if (isActive !== null) where.isActive = isActive === 'true';

    const templates = await prisma.documentTemplate.findMany({
      where,
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            fieldMappings: true,
            signaturePlacements: true,
            generatedDocuments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// DELETE a template
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { templateId } = await request.json();

    // Check if template has generated documents
    const generatedDocs = await prisma.generatedDocument.findFirst({
      where: { templateId },
    });

    if (generatedDocs) {
      // Soft delete - just mark as inactive
      await prisma.documentTemplate.update({
        where: { id: templateId },
        data: { isActive: false },
      });
    } else {
      // Hard delete if no documents generated
      await prisma.documentTemplate.delete({
        where: { id: templateId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}