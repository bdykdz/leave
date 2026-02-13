import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { departmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!adminUser || !['ADMIN', 'HR', 'EXECUTIVE'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get department name from ID
    const dept = await prisma.department.findUnique({
      where: { id: params.departmentId },
      select: { name: true }
    });

    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // Find users in this department (department is stored as string on User)
    const members = await prisma.user.findMany({
      where: { department: dept.name },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: { lastName: 'asc' }
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching department members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch department members' },
      { status: 500 }
    );
  }
}
