import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a manager
    if (!['MANAGER', 'HR', 'ADMIN', 'EXECUTIVE'].includes(session.user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get team members who report to this manager
    const teamMembers = await prisma.user.findMany({
      where: {
        managerId: session.user.id,
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        role: true,
        leaveRequests: {
          where: {
            status: 'PENDING'
          },
          select: {
            id: true,
            status: true
          }
        },
        leaveBalances: {
          include: {
            leaveType: true
          }
        }
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    });

    // Format the response
    const formattedTeamMembers = teamMembers.map(member => ({
      id: member.id,
      name: `${member.firstName} ${member.lastName}`,
      email: member.email,
      department: member.department || 'No Department',
      role: member.role,
      pendingRequests: member.leaveRequests.length,
      leaveBalances: member.leaveBalances.map(balance => ({
        leaveType: balance.leaveType.name,
        entitled: balance.entitled,
        used: balance.used,
        available: balance.available
      }))
    }));

    return NextResponse.json(formattedTeamMembers);
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}