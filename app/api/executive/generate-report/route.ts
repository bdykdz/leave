import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// Prevent CSV formula injection: prefix dangerous characters
function escapeCSV(field: any): string {
  if (field === null || field === undefined) return '';
  let str = String(field);
  if (str.length > 0 && /^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fix #10: Allow EXECUTIVE and ADMIN (not HR — blocked by middleware anyway)
    if (!['EXECUTIVE', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { reportType, format: requestedFormat, timeframe, data } = body;

    // Fix #11: Validate format against allowlist to prevent header injection
    if (requestedFormat !== 'csv') {
      return NextResponse.json(
        { error: 'Invalid format. Only CSV format is supported.' },
        { status: 400 }
      );
    }

    // Fix #12: Validate request body
    const validReportTypes = ['department', 'utilization', 'capacity', 'manager-performance', 'full', 'summary'];
    if (reportType && !validReportTypes.includes(reportType)) {
      return NextResponse.json(
        { error: 'Invalid report type' },
        { status: 400 }
      );
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'Report data is required' },
        { status: 400 }
      );
    }

    // Generate CSV content based on report type
    let csvContent = '';
    let filename = '';

    switch (reportType) {
      case 'department':
        csvContent = generateDepartmentReport(data.departmentStats);
        filename = 'department-summary';
        break;
      
      case 'utilization':
        csvContent = generateUtilizationReport(data.leaveUtilization, data.companyMetrics);
        filename = 'leave-utilization';
        break;
      
      case 'capacity':
        csvContent = generateCapacityReport(data.capacityData);
        filename = 'capacity-planning';
        break;
      
      case 'manager-performance':
        csvContent = generateManagerPerformanceReport(data.departmentStats);
        filename = 'manager-performance';
        break;
      
      case 'full':
        csvContent = generateFullReport(data);
        filename = 'executive-analytics-full';
        break;
      
      default:
        csvContent = generateSummaryReport(data.companyMetrics);
        filename = 'executive-summary';
    }

    // Create response with appropriate headers (format already validated as 'csv')
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateDepartmentReport(departmentStats: any[]): string {
  let csv = 'Department,Total Employees,On Leave Today,Remote Today,Pending Requests\n';

  if (departmentStats && departmentStats.length > 0) {
    departmentStats.forEach(dept => {
      csv += `${escapeCSV(dept.department)},${escapeCSV(dept.employees)},${escapeCSV(dept.onLeaveToday)},${escapeCSV(dept.remoteToday)},${escapeCSV(dept.pendingRequests)}\n`;
    });
  }

  return csv;
}

function generateUtilizationReport(utilizationData: any[], companyMetrics: any): string {
  let csv = 'Metric,Value\n';
  csv += `Total Employees,${escapeCSV(companyMetrics.totalEmployees)}\n`;
  csv += `Leave Utilization Rate,${escapeCSV(companyMetrics.leaveUtilizationRate)}%\n`;
  csv += `Average Leave Days per Employee,${escapeCSV(companyMetrics.averageLeaveDaysPerEmployee)}\n`;
  csv += `Total Leave Days This Month,${escapeCSV(companyMetrics.totalLeaveDaysThisMonth)}\n`;
  csv += `Total Remote Days This Month,${escapeCSV(companyMetrics.totalRemoteDaysThisMonth)}\n`;
  csv += '\nDepartment Leave Utilization\n';
  csv += 'Department,Used Days,Remaining Days,Utilization %\n';

  if (utilizationData && utilizationData.length > 0) {
    utilizationData.forEach(dept => {
      csv += `${escapeCSV(dept.department)},${escapeCSV(dept.used)},${escapeCSV(dept.remaining)},${escapeCSV(dept.utilizationRate)}%\n`;
    });
  }

  return csv;
}

function generateCapacityReport(capacityData: any[]): string {
  let csv = 'Department,Total Employees,Available Today,On Leave,Remote,Capacity %\n';

  if (capacityData && capacityData.length > 0) {
    capacityData.forEach(dept => {
      csv += `${escapeCSV(dept.department)},${escapeCSV(dept.employees)},${escapeCSV(dept.availableToday)},${escapeCSV(dept.onLeaveToday)},${escapeCSV(dept.remoteToday)},${escapeCSV(dept.capacityPercentage)}%\n`;
    });
  }

  return csv;
}

function generateManagerPerformanceReport(departmentStats: any[]): string {
  let csv = 'Department,Employees,Pending Requests,On Leave,Remote Workers\n';

  if (departmentStats && departmentStats.length > 0) {
    departmentStats.forEach(dept => {
      csv += `${escapeCSV(dept.department)},${escapeCSV(dept.employees)},${escapeCSV(dept.pendingRequests)},${escapeCSV(dept.onLeaveToday)},${escapeCSV(dept.remoteToday)}\n`;
    });
  }

  return csv;
}

function generateSummaryReport(companyMetrics: any): string {
  let csv = 'Executive Summary Report\n';
  csv += `Generated on,${escapeCSV(new Date().toLocaleDateString())}\n\n`;
  csv += 'Metric,Value\n';
  csv += `Total Employees,${escapeCSV(companyMetrics.totalEmployees)}\n`;
  csv += `Employees on Leave Today,${escapeCSV(companyMetrics.onLeaveToday)}\n`;
  csv += `Employees Working Remote Today,${escapeCSV(companyMetrics.workingRemoteToday)}\n`;
  csv += `Employees in Office Today,${escapeCSV(companyMetrics.inOfficeToday)}\n`;
  csv += `Pending Executive Approvals,${escapeCSV(companyMetrics.pendingApprovals)}\n`;
  csv += `Total Leave Days This Month,${escapeCSV(companyMetrics.totalLeaveDaysThisMonth)}\n`;
  csv += `Total Remote Days This Month,${escapeCSV(companyMetrics.totalRemoteDaysThisMonth)}\n`;
  csv += `Average Leave Days per Employee,${escapeCSV(companyMetrics.averageLeaveDaysPerEmployee)}\n`;
  csv += `Leave Utilization Rate,${escapeCSV(companyMetrics.leaveUtilizationRate)}%\n`;

  return csv;
}

function generateFullReport(data: any): string {
  let csv = 'Complete Executive Analytics Report\n';
  csv += `Generated on,${new Date().toLocaleDateString()}\n\n`;
  
  // Company Overview
  csv += generateSummaryReport(data.companyMetrics);
  csv += '\n';
  
  // Department Statistics
  csv += '\nDepartment Statistics\n';
  csv += generateDepartmentReport(data.departmentStats);
  csv += '\n';
  
  // Capacity Analysis
  csv += '\nCapacity Analysis\n';
  csv += generateCapacityReport(data.capacityData);
  csv += '\n';
  
  // Monthly Patterns
  if (data.monthlyPatterns && data.monthlyPatterns.length > 0) {
    csv += '\nMonthly Leave Patterns\n';
    csv += 'Month,Leave Days,Remote Days\n';
    data.monthlyPatterns.forEach((month: any) => {
      csv += `${escapeCSV(month.month)},${escapeCSV(month.leave)},${escapeCSV(month.remote)}\n`;
    });
  }
  
  // Remote Work Trends
  if (data.remoteTrends && data.remoteTrends.length > 0) {
    csv += '\nRemote Work Trends by Department\n';
    const departments = Object.keys(data.remoteTrends[0]).filter(k => k !== 'month');
    csv += 'Month,' + departments.map(d => escapeCSV(d)).join(',') + '\n';
    data.remoteTrends.forEach((month: any) => {
      csv += escapeCSV(month.month);
      departments.forEach(dept => {
        csv += `,${escapeCSV(month[dept])}`;
      });
      csv += '\n';
    });
  }
  
  return csv;
}