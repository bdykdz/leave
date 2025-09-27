import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { SmartDocumentGenerator } from '@/lib/smart-document-generator';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leaveRequestId } = await request.json();

    if (!leaveRequestId) {
      return NextResponse.json({ error: 'Leave request ID is required' }, { status: 400 });
    }

    const generator = new SmartDocumentGenerator();
    
    // Get the active template for this leave request
    const { prisma } = await import('@/lib/prisma');
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: {
        leaveType: {
          include: {
            documentTemplates: {
              where: { isActive: true },
              orderBy: { version: 'desc' },
              take: 1
            }
          }
        }
      }
    });
    
    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }
    
    if (!leaveRequest.leaveType.documentTemplates.length) {
      return NextResponse.json({ error: 'No active template found for this leave type' }, { status: 404 });
    }
    
    const template = leaveRequest.leaveType.documentTemplates[0];
    
    // Only use smart document generator
    const documentId = await generator.generateDocument(leaveRequestId, template.id);

    return NextResponse.json({
      success: true,
      documentId,
    });
  } catch (error) {
    console.error('Document generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate document' },
      { status: 500 }
    );
  }
}