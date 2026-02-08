import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET /api/leave-types - Get all active leave types
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leaveTypes = await prisma.leaveType.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        requiresDocument: true,
        maxDaysPerRequest: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Get user's leave balances for the current year
    const currentYear = new Date().getFullYear();
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: {
        userId: session.user.id,
        year: currentYear,
      },
      select: {
        leaveTypeId: true,
        entitled: true,
        used: true,
        pending: true,
        available: true,
      },
    });

    // Combine leave types with balances
    const leaveTypesWithBalances = leaveTypes.map(type => {
      const balance = leaveBalances.find(b => b.leaveTypeId === type.id);
      return {
        ...type,
        balance: balance || {
          entitled: 0,
          used: 0,
          pending: 0,
          available: 0,
        },
      };
    });

    return NextResponse.json({ leaveTypes: leaveTypesWithBalances });
  } catch (error) {
    console.error('Error fetching leave types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave types' },
      { status: 500 }
    );
  }
}