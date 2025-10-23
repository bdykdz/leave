import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET: List all employees for HR dashboard with pagination and filtering
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

    // Get query parameters for pagination and filtering
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department');
    const role = searchParams.get('role');
    
    // Build where clause for filtering
    const whereClause: any = {};
    
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (department) {
      whereClause.department = department;
    }
    
    if (role) {
      whereClause.role = role;
    }

    // Get total count for pagination
    const totalCount = await prisma.user.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / pageSize);
    const skip = (page - 1) * pageSize;

    // Get paginated employees with relevant information for HR
    const employees = await prisma.user.findMany({
      where: whereClause,
      skip,
      take: pageSize,
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

    return NextResponse.json({ 
      employees: formattedEmployees,
      totalCount,
      totalPages,
      page,
      pageSize
    });
  } catch (error) {
    console.error('Error fetching employees for HR:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}