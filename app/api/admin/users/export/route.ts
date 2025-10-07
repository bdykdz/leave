import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin/HR
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !['HR', 'EXECUTIVE'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Fetch all users with related data
    const users = await prisma.user.findMany({
      include: {
        department: {
          select: {
            name: true
          }
        },
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
        leaveBalances: {
          where: {
            year: new Date().getFullYear()
          },
          include: {
            leaveType: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: [
        { department: { name: 'asc' } },
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });

    // Transform data for Excel
    const excelData = users.map(user => ({
      'Employee ID': user.employeeId || 'N/A',
      'First Name': user.firstName,
      'Last Name': user.lastName,
      'Email': user.email,
      'Phone': user.phone || 'N/A',
      'Department': user.department?.name || 'N/A',
      'Job Title': user.jobTitle || 'N/A',
      'Role': user.role,
      'Status': user.isActive ? 'Active' : 'Inactive',
      'Join Date': user.joinDate ? new Date(user.joinDate).toLocaleDateString() : 'N/A',
      'Manager': user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : 'N/A',
      'Manager Email': user.manager?.email || 'N/A',
      'Department Director': user.departmentDirector ? `${user.departmentDirector.firstName} ${user.departmentDirector.lastName}` : 'N/A',
      'Director Email': user.departmentDirector?.email || 'N/A',
      'Annual Leave Balance': user.leaveBalances.find(b => b.leaveType.name === 'Annual Leave')?.available || 0,
      'Sick Leave Balance': user.leaveBalances.find(b => b.leaveType.name === 'Sick Leave')?.available || 0,
      'Personal Leave Balance': user.leaveBalances.find(b => b.leaveType.name === 'Personal Leave')?.available || 0,
      'Created At': new Date(user.createdAt).toLocaleDateString(),
      'Last Updated': new Date(user.updatedAt).toLocaleDateString()
    }));

    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Add main users sheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const columnWidths = [
      { wch: 12 }, // Employee ID
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 30 }, // Email
      { wch: 15 }, // Phone
      { wch: 20 }, // Department
      { wch: 25 }, // Job Title
      { wch: 10 }, // Role
      { wch: 10 }, // Status
      { wch: 12 }, // Join Date
      { wch: 20 }, // Manager
      { wch: 30 }, // Manager Email
      { wch: 20 }, // Department Director
      { wch: 30 }, // Director Email
      { wch: 15 }, // Annual Leave
      { wch: 15 }, // Sick Leave
      { wch: 15 }, // Personal Leave
      { wch: 12 }, // Created At
      { wch: 12 }, // Last Updated
    ];
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    // Create summary sheet
    const summaryData = [
      { 'Metric': 'Total Users', 'Value': users.length },
      { 'Metric': 'Active Users', 'Value': users.filter(u => u.isActive).length },
      { 'Metric': 'Inactive Users', 'Value': users.filter(u => !u.isActive).length },
      { 'Metric': '', 'Value': '' },
      { 'Metric': 'By Role:', 'Value': '' },
      { 'Metric': 'Employees', 'Value': users.filter(u => u.role === 'EMPLOYEE').length },
      { 'Metric': 'Managers', 'Value': users.filter(u => u.role === 'MANAGER').length },
      { 'Metric': 'HR', 'Value': users.filter(u => u.role === 'HR').length },
      { 'Metric': 'Executives', 'Value': users.filter(u => u.role === 'EXECUTIVE').length },
      { 'Metric': '', 'Value': '' },
      { 'Metric': 'By Department:', 'Value': '' }
    ];

    // Count by department
    const departmentCounts = users.reduce((acc, user) => {
      const deptName = user.department?.name || 'Unassigned';
      acc[deptName] = (acc[deptName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(departmentCounts).forEach(([dept, count]) => {
      summaryData.push({ 'Metric': dept, 'Value': count });
    });

    summaryData.push({ 'Metric': '', 'Value': '' });
    summaryData.push({ 'Metric': 'Export Date', 'Value': new Date().toLocaleString() });
    summaryData.push({ 'Metric': 'Exported By', 'Value': `${session.user.firstName} ${session.user.lastName}` });

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return file
    const fileName = `users_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

  } catch (error) {
    console.error('Error exporting users:', error);
    return NextResponse.json(
      { error: 'Failed to export users' },
      { status: 500 }
    );
  }
}