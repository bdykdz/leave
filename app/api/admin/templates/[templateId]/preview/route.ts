import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sample data for preview
const SAMPLE_DATA = {
  employee: {
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    employeeId: 'EMP001',
    email: 'john.doe@company.com',
    phoneNumber: '+1234567890',
    department: 'Engineering',
    position: 'Senior Developer',
    joiningDate: new Date('2020-01-15'),
    manager: 'Jane Smith',
    managerEmail: 'jane.smith@company.com',
  },
  leave: {
    type: 'Annual Leave',
    dates: '1-5 July 2024',
    startDate: new Date('2024-07-01'),
    endDate: new Date('2024-07-05'),
    totalDays: 5,
    reason: 'Family vacation',
    requestNumber: 'LR-2024-001',
    status: 'Pending',
    requestedDate: new Date(),
  },
  substitute: {
    fullName: 'Jane Smith, Bob Johnson',
  },
  manager: {
    fullName: 'Mike Johnson',
    employeeId: 'MGR001',
    department: 'Engineering',
    position: 'Engineering Manager',
    email: 'mike.johnson@company.com',
  },
  balance: {
    entitled: 21,
    used: 10,
    pending: 5,
    available: 6,
    afterApproval: 1,
  },
  calculated: {
    currentDate: new Date(),
    currentYear: new Date().getFullYear().toString(),
    workingDays: 3,
    weekendDays: 2,
  },
};

// Helper function to resolve field value from sample data
function resolveFieldValue(fieldKey: string, data: any): string {
  const keys = fieldKey.split('.');
  let value = data;
  
  for (const key of keys) {
    if (value && typeof value === 'object') {
      value = value[key];
    } else {
      return '';
    }
  }
  
  // Format dates
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  
  return value?.toString() || '';
}

// POST generate preview with sample or custom data
export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customData } = await request.json();
    const data = customData || SAMPLE_DATA;

    // Get template with field mappings
    const template = await prisma.documentTemplate.findUnique({
      where: { id: params.templateId },
      include: {
        fieldMappings: true,
        signaturePlacements: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Generate preview data
    const previewData = {
      template: {
        id: template.id,
        name: template.name,
        fileUrl: template.fileUrl,
        fileType: template.fileType,
      },
      fields: template.fieldMappings.map((mapping) => ({
        id: mapping.id,
        fieldKey: mapping.fieldKey,
        fieldLabel: mapping.fieldLabel,
        value: resolveFieldValue(mapping.fieldKey, data),
        position: mapping.documentPosition,
        style: mapping.fieldStyle,
      })),
      signatures: template.signaturePlacements.map((sig) => ({
        id: sig.id,
        signerRole: sig.signerRole,
        label: sig.label,
        position: sig.documentPosition,
        orderIndex: sig.orderIndex,
      })),
      sampleData: SAMPLE_DATA,
    };

    return NextResponse.json({ preview: previewData });
  } catch (error) {
    console.error('Template preview error:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}