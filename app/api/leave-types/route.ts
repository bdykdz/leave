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

    // Exclude HR-only leave types from employee self-service
    const leaveTypes = await prisma.leaveType.findMany({
      where: {
        isActive: true,
        isHROnly: false,
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        requiresDocument: true,
        maxDaysPerRequest: true,
        daysAllowed: true,
        category: true,
        dateRestriction: true,
        sortOrder: true,
      },
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    // Get user's leave balances for the current year
    const currentYear = new Date().getFullYear();
    let leaveBalances = await prisma.leaveBalance.findMany({
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

    // Auto-create missing balances for this user/year (lazy initialization)
    const existingTypeIds = new Set(leaveBalances.map(b => b.leaveTypeId));
    const missingTypes = leaveTypes.filter(lt => !existingTypeIds.has(lt.id));

    if (missingTypes.length > 0) {
      await prisma.leaveBalance.createMany({
        data: missingTypes.map(lt => ({
          userId: session.user.id,
          leaveTypeId: lt.id,
          year: currentYear,
          entitled: lt.daysAllowed,
          used: 0,
          pending: 0,
          available: lt.daysAllowed,
          carriedForward: 0,
        })),
        skipDuplicates: true,
      });
      // Re-fetch to include newly created balances
      leaveBalances = await prisma.leaveBalance.findMany({
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
    }

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