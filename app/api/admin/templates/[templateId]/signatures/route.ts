import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SignaturePlacement {
  signerRole: string;
  documentPosition: {
    x: number;
    y: number;
    page: number;
    width: number;
    height: number;
  };
  label: string;
  isRequired?: boolean;
  orderIndex: number;
}

// GET signature placements for a template
export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const signaturePlacements = await prisma.templateSignature.findMany({
      where: { templateId: params.templateId },
      orderBy: { orderIndex: 'asc' },
    });

    return NextResponse.json({ signaturePlacements });
  } catch (error) {
    console.error('Get signature placements error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signature placements' },
      { status: 500 }
    );
  }
}

// POST save signature placements for a template
export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { signatures }: { signatures: SignaturePlacement[] } = await request.json();

    // Validate template exists
    const template = await prisma.documentTemplate.findUnique({
      where: { id: params.templateId },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Delete existing signature placements
    await prisma.templateSignature.deleteMany({
      where: { templateId: params.templateId },
    });

    // Create new signature placements
    const signaturePlacements = await prisma.templateSignature.createMany({
      data: signatures.map((sig) => ({
        templateId: params.templateId,
        signerRole: sig.signerRole,
        documentPosition: sig.documentPosition,
        label: sig.label,
        isRequired: sig.isRequired !== false,
        orderIndex: sig.orderIndex,
      })),
    });

    return NextResponse.json({
      success: true,
      count: signaturePlacements.count,
    });
  } catch (error) {
    console.error('Save signature placements error:', error);
    return NextResponse.json(
      { error: 'Failed to save signature placements' },
      { status: 500 }
    );
  }
}

// DELETE remove a specific signature placement
export async function DELETE(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { signaturePlacementId } = await request.json();

    await prisma.templateSignature.delete({
      where: {
        id: signaturePlacementId,
        templateId: params.templateId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete signature placement error:', error);
    return NextResponse.json(
      { error: 'Failed to delete signature placement' },
      { status: 500 }
    );
  }
}