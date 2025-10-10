import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a manager
    if (!['MANAGER', 'HR', 'ADMIN', 'EXECUTIVE'].includes(currentUser.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get team members who report to this manager
    const teamMembers = await prisma.user.findMany({
      where: {
        reporterId: currentUser.id,
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: {
          select: {
            id: true,
            name: true
          }
        },
        role: true,
        availableLeaveTypes: {
          include: {
            leaveType: true
          }
        },
        leaveRequests: {
          where: {
            status: 'PENDING'
          },
          select: {
            id: true,
            status: true
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
      department: member.department?.name || 'No Department',
      role: member.role,
      pendingRequests: member.leaveRequests.length,
      leaveBalances: member.availableLeaveTypes.map(alt => ({
        leaveType: alt.leaveType.name,
        balance: alt.balance,
        used: alt.used
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