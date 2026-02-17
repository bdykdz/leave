import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/admin/templates/copy-fields
 * Copy field mappings from one source template to one or more target templates.
 * Body: { sourceTemplateId: string, targetTemplateIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sourceTemplateId, targetTemplateIds } = await request.json();

    if (!sourceTemplateId || !Array.isArray(targetTemplateIds) || targetTemplateIds.length === 0) {
      return NextResponse.json(
        { error: 'sourceTemplateId and targetTemplateIds[] are required' },
        { status: 400 }
      );
    }

    // Load source field mappings
    const sourceMappings = await prisma.templateFieldMapping.findMany({
      where: { templateId: sourceTemplateId },
    });

    if (sourceMappings.length === 0) {
      return NextResponse.json(
        { error: 'Source template has no field mappings to copy' },
        { status: 400 }
      );
    }

    // Validate all target templates exist
    const targets = await prisma.documentTemplate.findMany({
      where: { id: { in: targetTemplateIds } },
      select: { id: true },
    });

    if (targets.length !== targetTemplateIds.length) {
      return NextResponse.json({ error: 'One or more target templates not found' }, { status: 404 });
    }

    // For each target: delete existing mappings, copy from source
    let totalCopied = 0;
    for (const targetId of targetTemplateIds) {
      if (targetId === sourceTemplateId) continue;

      await prisma.templateFieldMapping.deleteMany({ where: { templateId: targetId } });

      await prisma.templateFieldMapping.createMany({
        data: sourceMappings.map((m) => ({
          templateId: targetId,
          fieldKey: m.fieldKey,
          fieldLabel: m.fieldLabel,
          documentPosition: m.documentPosition as any,
          fieldStyle: m.fieldStyle as any,
          isRequired: m.isRequired,
        })),
      });

      totalCopied++;
    }

    return NextResponse.json({
      success: true,
      message: `Copied ${sourceMappings.length} field mappings to ${totalCopied} template(s).`,
      fieldsCopied: sourceMappings.length,
      templatesCopied: totalCopied,
    });
  } catch (error) {
    console.error('Copy fields error:', error);
    return NextResponse.json({ error: 'Failed to copy field mappings' }, { status: 500 });
  }
}
