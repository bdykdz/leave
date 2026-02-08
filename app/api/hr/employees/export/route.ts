import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { logDataExport } from '@/lib/utils/audit-log';

// Helper function to escape CSV fields
function escapeCSV(field: any): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'csv';
    
    // Fetch all employees
    const employees = await prisma.user.findMany({
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        department: true,
        position: true,
        role: true,
        isActive: true,
        joiningDate: true,
        manager: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
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
        { department: 'asc' },
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });

    if (format === 'csv') {
      // Create CSV content
      const headers = [
        'Employee ID',
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Department',
        'Position',
        'Role',
        'Status',
        'Joining Date',
        'Manager',
        'Annual Leave Balance',
        'Sick Leave Used',
        'Personal Leave Balance'
      ];

      const rows = employees.map(emp => {
        // Calculate leave balances
        let annualLeave = 0;
        let sickLeave = 0;
        let personalLeave = 0;

        emp.leaveBalances.forEach(balance => {
          const code = balance.leaveType.code?.toUpperCase();
          if (code === 'AL' || code === 'NL') {
            annualLeave = balance.available || 0;
          } else if (code === 'SL') {
            sickLeave = balance.used || 0;
          } else if (code === 'PL') {
            personalLeave = balance.available || 0;
          }
        });

        return [
          escapeCSV(emp.employeeId),
          escapeCSV(emp.firstName),
          escapeCSV(emp.lastName),
          escapeCSV(emp.email),
          escapeCSV(emp.phoneNumber),
          escapeCSV(emp.department),
          escapeCSV(emp.position),
          escapeCSV(emp.role),
          escapeCSV(emp.isActive ? 'Active' : 'Inactive'),
          escapeCSV(emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : ''),
          escapeCSV(emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : ''),
          escapeCSV(annualLeave),
          escapeCSV(sickLeave),
          escapeCSV(personalLeave)
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      
      // Log the export action
      await logDataExport(session.user.id, 'CSV', employees.length);
      
      // Return CSV file
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="employees_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Default to JSON if format is not recognized
    return NextResponse.json({ employees });
    
  } catch (error) {
    console.error('Error exporting employees:', error);
    return NextResponse.json(
      { error: 'Failed to export employees' },
      { status: 500 }
    );
  }
}