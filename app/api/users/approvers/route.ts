import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/users/approvers - Get current user's approvers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with manager and department director info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            position: true,
          },
        },
        departmentDirector: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            position: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const approvers = {
      manager: user.manager ? {
        ...user.manager,
        name: `${user.manager.firstName} ${user.manager.lastName}`
      } : null,
      departmentHead: user.departmentDirector ? {
        ...user.departmentDirector,
        name: `${user.departmentDirector.firstName} ${user.departmentDirector.lastName}`
      } : null,
    };

    return NextResponse.json({ approvers });
  } catch (error) {
    console.error('Error fetching approvers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approvers' },
      { status: 500 }
    );
  }
}