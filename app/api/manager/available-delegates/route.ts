import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET: Fetch available managers for delegation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a manager
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    });

    if (!user || !['MANAGER', 'ADMIN', 'HR', 'EXECUTIVE'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Fetch managers who can receive delegations
    // Exclude the current user
    const managers = await prisma.user.findMany({
      where: {
        id: {
          not: session.user.id
        },
        role: {
          in: ['MANAGER', 'ADMIN', 'HR', 'EXECUTIVE']
        },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        position: true,
        role: true
      },
      orderBy: [
        { department: 'asc' },
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });

    // Prioritize managers from the same department
    const sortedManagers = managers.sort((a, b) => {
      // Same department comes first
      if (a.department === user.department && b.department !== user.department) return -1;
      if (a.department !== user.department && b.department === user.department) return 1;
      
      // Then sort by name
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({ managers: sortedManagers });
  } catch (error) {
    console.error('Error fetching available delegates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available delegates' },
      { status: 500 }
    );
  }
}