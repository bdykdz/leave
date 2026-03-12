import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET /api/users/substitutes - Get eligible substitutes (team members)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user to find their department and direct superior
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { department: true, managerId: true, departmentDirectorId: true }
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Direct superior: managerId or departmentDirectorId
    const superiorId = currentUser.managerId || currentUser.departmentDirectorId;

    // Get eligible substitutes (same department OR direct superior)
    const substitutes = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: session.user.id } },
          { isActive: true },
          {
            OR: [
              { department: currentUser.department },
              ...(superiorId ? [{ id: superiorId }] : []),
            ]
          },
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        position: true,
        department: true,
        profileImage: true,
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });

    // Format the response
    const formattedSubstitutes = substitutes.map(user => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      avatar: user.profileImage || `${(user.firstName || 'U')[0]}${(user.lastName || '')[0]}`,
      department: user.department,
      role: user.position,
    }));

    return NextResponse.json({ substitutes: formattedSubstitutes });
  } catch (error) {
    console.error('Error fetching substitutes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch substitutes' },
      { status: 500 }
    );
  }
}