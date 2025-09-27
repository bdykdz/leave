import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { DocumentGenerator } from '@/lib/services/document-generator';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { signatureData, signerRole, approved = true, comments } = await request.json();

    if (!signatureData || !signerRole) {
      return NextResponse.json(
        { error: 'Signature data and signer role are required' },
        { status: 400 }
      );
    }

    // Get document details
    const document = await prisma.generatedDocument.findUnique({
      where: { id: params.documentId },
      include: {
        leaveRequest: {
          include: {
            user: {
              include: {
                manager: true,
                departmentDirector: true,
              }
            }
          }
        },
        template: {
          include: {
            signaturePlacements: true,
          }
        }
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Validate signer permission
    const canSign = await validateSignerPermission(
      session.user.id,
      signerRole,
      document.leaveRequest
    );

    if (!canSign) {
      return NextResponse.json(
        { error: 'You do not have permission to sign as this role' },
        { status: 403 }
      );
    }

    // Get request headers for audit
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Add signature with decision
    const generator = new DocumentGenerator();
    await generator.addSignature(
      params.documentId,
      session.user.id,
      signerRole,
      signatureData,
      approved,
      comments,
      ipAddress,
      userAgent
    );

    // Get updated document
    const updatedDocument = await prisma.generatedDocument.findUnique({
      where: { id: params.documentId },
      include: {
        signatures: {
          include: {
            signer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      document: updatedDocument,
    });
  } catch (error) {
    console.error('Document signing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sign document' },
      { status: 500 }
    );
  }
}

/**
 * Validate if user can sign with specific role
 */
async function validateSignerPermission(
  userId: string,
  signerRole: string,
  leaveRequest: any
): Promise<boolean> {
  const user = leaveRequest.user;

  switch (signerRole) {
    case 'employee':
      // Only the employee can sign as employee
      return userId === user.id;

    case 'manager':
      // Manager can sign, or executive signing as their own manager
      if (user.managerId === userId) {
        return true;
      }
      // Executive signing as their own manager
      if (user.role === 'EXECUTIVE' && user.id === userId && !user.managerId) {
        return true;
      }
      return false;

    case 'department_director':
      // Department director can sign
      if (user.departmentDirectorId === userId) {
        return true;
      }
      // Executive signing as their own department director
      if (user.role === 'EXECUTIVE' && user.id === userId && !user.departmentDirectorId) {
        return true;
      }
      // Department director signing for their department members
      if (user.role === 'DEPARTMENT_DIRECTOR' && user.id === userId) {
        return true;
      }
      return false;

    case 'hr':
      // Only HR role can sign as HR
      const signer = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      return signer?.role === 'HR';

    case 'executive':
      // Only executives can sign as executive
      const execSigner = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      return execSigner?.role === 'EXECUTIVE';

    default:
      return false;
  }
}