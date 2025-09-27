import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// Define available fields that can be mapped to documents
const AVAILABLE_FIELDS = {
  employee: {
    category: 'Employee Information',
    fields: [
      { key: 'employee.firstName', label: 'First Name', type: 'text' },
      { key: 'employee.lastName', label: 'Last Name', type: 'text' },
      { key: 'employee.fullName', label: 'Full Name', type: 'text' },
      { key: 'employee.employeeId', label: 'Employee ID', type: 'text' },
      { key: 'employee.email', label: 'Email', type: 'text' },
      { key: 'employee.phoneNumber', label: 'Phone Number', type: 'text' },
      { key: 'employee.department', label: 'Department', type: 'text' },
      { key: 'employee.position', label: 'Position', type: 'text' },
      { key: 'employee.joiningDate', label: 'Joining Date', type: 'date' },
    ],
  },
  leave: {
    category: 'Leave Request Details',
    fields: [
      { key: 'leave.type', label: 'Leave Type', type: 'text' },
      { key: 'leave.startDate', label: 'Start Date', type: 'date' },
      { key: 'leave.endDate', label: 'End Date', type: 'date' },
      { key: 'leave.totalDays', label: 'Total Days', type: 'number' },
      { key: 'leave.reason', label: 'Reason', type: 'text' },
      { key: 'leave.requestNumber', label: 'Request Number', type: 'text' },
      { key: 'leave.status', label: 'Status', type: 'text' },
      { key: 'leave.requestedDate', label: 'Request Date', type: 'date' },
    ],
  },
  substitute: {
    category: 'Substitute Information',
    fields: [
      { key: 'substitute.fullName', label: 'Substitute Name', type: 'text' },
      { key: 'substitute.employeeId', label: 'Substitute Employee ID', type: 'text' },
      { key: 'substitute.department', label: 'Substitute Department', type: 'text' },
      { key: 'substitute.position', label: 'Substitute Position', type: 'text' },
    ],
  },
  manager: {
    category: 'Manager Information',
    fields: [
      { key: 'manager.fullName', label: 'Manager Name', type: 'text' },
      { key: 'manager.employeeId', label: 'Manager Employee ID', type: 'text' },
      { key: 'manager.department', label: 'Manager Department', type: 'text' },
      { key: 'manager.position', label: 'Manager Position', type: 'text' },
      { key: 'manager.email', label: 'Manager Email', type: 'text' },
    ],
  },
  balance: {
    category: 'Leave Balance',
    fields: [
      { key: 'balance.entitled', label: 'Entitled Days', type: 'number' },
      { key: 'balance.used', label: 'Used Days', type: 'number' },
      { key: 'balance.pending', label: 'Pending Days', type: 'number' },
      { key: 'balance.available', label: 'Available Days', type: 'number' },
      { key: 'balance.afterApproval', label: 'Balance After Approval', type: 'number' },
    ],
  },
  calculated: {
    category: 'Calculated Fields',
    fields: [
      { key: 'calculated.currentDate', label: 'Current Date', type: 'date' },
      { key: 'calculated.currentYear', label: 'Current Year', type: 'text' },
      { key: 'calculated.workingDays', label: 'Working Days', type: 'number' },
      { key: 'calculated.weekendDays', label: 'Weekend Days', type: 'number' },
    ],
  },
  decision: {
    category: 'Decision Fields',
    fields: [
      { key: 'decision.manager.approved', label: 'Manager - Approved ☑', type: 'checkbox' },
      { key: 'decision.manager.rejected', label: 'Manager - Rejected ☑', type: 'checkbox' },
      { key: 'decision.director.approved', label: 'Director - Approved ☑', type: 'checkbox' },
      { key: 'decision.director.rejected', label: 'Director - Rejected ☑', type: 'checkbox' },
      { key: 'decision.hr.approved', label: 'HR - Approved ☑', type: 'checkbox' },
      { key: 'decision.hr.rejected', label: 'HR - Rejected ☑', type: 'checkbox' },
      { key: 'decision.executive.approved', label: 'Executive - Approved ☑', type: 'checkbox' },
      { key: 'decision.executive.rejected', label: 'Executive - Rejected ☑', type: 'checkbox' },
      { key: 'decision.comments', label: 'Decision Comments', type: 'text' },
    ],
  },
};

// GET available fields for mapping
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ 
      fields: AVAILABLE_FIELDS,
      categories: Object.keys(AVAILABLE_FIELDS),
    });
  } catch (error) {
    console.error('Get available fields error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available fields' },
      { status: 500 }
    );
  }
}