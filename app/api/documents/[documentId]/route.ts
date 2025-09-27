import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET document details
export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const document = await prisma.generatedDocument.findUnique({
      where: { id: params.documentId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            fileType: true,
            category: true,
          }
        },
        leaveRequest: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              }
            },
            leaveType: true,
          }
        },
        signatures: {
          include: {
            signer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              }
            }
          },
          orderBy: { signedAt: 'asc' }
        }
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if user has permission to view this document
    const hasPermission = await checkDocumentPermission(session.user, document);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get signature requirements
    const signatureRequirements = await getSignatureRequirements(document);

    return NextResponse.json({
      document: {
        ...document,
        signatureRequirements,
      }
    });
  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

/**
 * Check if user has permission to view document
 */
async function checkDocumentPermission(user: any, document: any): boolean {
  // Document owner can always view
  if (document.leaveRequest.user.id === user.id) {
    return true;
  }

  // HR and ADMIN can view all documents
  if (['HR', 'ADMIN'].includes(user.role)) {
    return true;
  }

  // Managers can view documents of their subordinates
  if (user.role === 'MANAGER' || user.role === 'DEPARTMENT_DIRECTOR') {
    const subordinates = await prisma.user.findMany({
      where: {
        OR: [
          { managerId: user.id },
          { departmentDirectorId: user.id }
        ]
      },
      select: { id: true }
    });

    if (subordinates.some(sub => sub.id === document.leaveRequest.user.id)) {
      return true;
    }
  }

  // Check if user is a required signer
  const templateSignatures = await prisma.templateSignature.findMany({
    where: { templateId: document.template.id }
  });

  for (const sig of templateSignatures) {
    if (await isRequiredSigner(user.id, sig.signerRole, document.leaveRequest)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user is a required signer for a role
 */
async function isRequiredSigner(userId: string, signerRole: string, leaveRequest: any): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: leaveRequest.userId },
    include: {
      manager: true,
      departmentDirector: true,
    }
  });

  if (!user) return false;

  switch (signerRole) {
    case 'employee':
      return userId === user.id;
    case 'manager':
      return userId === user.managerId || (user.role === 'EXECUTIVE' && userId === user.id);
    case 'department_director':
      return userId === user.departmentDirectorId || 
             (user.role === 'EXECUTIVE' && userId === user.id) ||
             (user.role === 'DEPARTMENT_DIRECTOR' && userId === user.id);
    case 'hr':
      const hrUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      return hrUser?.role === 'HR';
    default:
      return false;
  }
}

/**
 * Get signature requirements for document
 */
async function getSignatureRequirements(document: any) {
  const templateSignatures = await prisma.templateSignature.findMany({
    where: { templateId: document.template.id },
    orderBy: { orderIndex: 'asc' }
  });

  const user = await prisma.user.findUnique({
    where: { id: document.leaveRequest.userId },
    include: {
      manager: true,
      departmentDirector: true,
    }
  });

  const requirements = [];

  for (const templateSig of templateSignatures) {
    const signed = document.signatures.find((s: any) => s.signerRole === templateSig.signerRole);
    let requiredSigner = null;
    let isRequired = templateSig.isRequired;

    switch (templateSig.signerRole) {
      case 'employee':
        requiredSigner = user;
        break;
      case 'manager':
        if (user?.managerId) {
          requiredSigner = user.manager;
        } else if (user?.role === 'EXECUTIVE') {
          requiredSigner = user; // Executive signs as own manager
        }
        break;
      case 'department_director':
        if (user?.departmentDirectorId) {
          requiredSigner = user.departmentDirector;
        } else if (user?.role === 'EXECUTIVE' || user?.role === 'DEPARTMENT_DIRECTOR') {
          requiredSigner = user; // Signs as own director
          if (user.role === 'DEPARTMENT_DIRECTOR' && templateSig.signerRole === 'manager') {
            isRequired = false; // Don't need double signature
          }
        }
        break;
    }

    requirements.push({
      role: templateSig.signerRole,
      label: templateSig.label,
      isRequired,
      requiredSigner: requiredSigner ? {
        id: requiredSigner.id,
        name: `${requiredSigner.firstName} ${requiredSigner.lastName}`,
        email: requiredSigner.email,
      } : null,
      isSigned: !!signed,
      signature: signed ? {
        signedBy: `${signed.signer.firstName} ${signed.signer.lastName}`,
        signedAt: signed.signedAt,
      } : null,
    });
  }

  return requirements;
}