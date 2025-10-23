import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET: List all employees for HR dashboard
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is HR, ADMIN, EXECUTIVE, or EMPLOYEE with HR department
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    });

    const isHREmployee = user?.role === 'EMPLOYEE' && user?.department?.toLowerCase().includes('hr');
    
    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all employees with relevant information for HR
    const employees = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        employeeId: true,
        position: true,
        role: true,
        isActive: true,
        joiningDate: true,
        department: true,
        managerId: true,
        departmentDirectorId: true,
        manager: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        departmentDirector: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        // Include current year leave balances
        leaveBalances: {
          where: {
            year: new Date().getFullYear()
          },
          include: {
            leaveType: {
              select: {
                name: true,
                code: true
              }
            }
          }
        }
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });

    // Format the response to match what the HR component expects
    const formattedEmployees = employees.map(emp => {
      // Calculate leave balance summary
      const leaveBalance = {
        annual: 0,
        sick: 0,
        personal: 0
      };

      emp.leaveBalances.forEach(balance => {
        const leaveTypeCode = balance.leaveType.code?.toUpperCase();
        if (leaveTypeCode === 'AL' || leaveTypeCode === 'NL') {
          leaveBalance.annual = balance.available || 0;
        } else if (leaveTypeCode === 'SL') {
          leaveBalance.sick = balance.used || 0;
        } else if (leaveTypeCode === 'PL') {
          leaveBalance.personal = balance.available || 0;
        }
      });

      return {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        employeeId: emp.employeeId,
        department: emp.department,
        position: emp.position,
        joiningDate: emp.joiningDate?.toISOString() || '',
        phoneNumber: emp.phoneNumber,
        role: emp.role,
        isActive: emp.isActive,
        leaveBalance
      };
    });

    return NextResponse.json({ employees: formattedEmployees });
  } catch (error) {
    console.error('Error fetching employees for HR:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}