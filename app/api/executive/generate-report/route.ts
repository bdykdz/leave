import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow EXECUTIVE and HR roles
    if (!['EXECUTIVE', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { reportType, format, timeframe, data } = body;

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

    // For PDF format, we'll return CSV for now (PDF generation would require additional libraries)
    const responseFormat = format === 'pdf' ? 'csv' : format;
    
    // Create response with appropriate headers
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}-${new Date().toISOString().split('T')[0]}.${responseFormat}"`
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
      csv += `"${dept.department}",${dept.employees},${dept.onLeaveToday},${dept.remoteToday},${dept.pendingRequests}\n`;
    });
  }
  
  return csv;
}

function generateUtilizationReport(utilizationData: any[], companyMetrics: any): string {
  let csv = 'Metric,Value\n';
  csv += `Total Employees,${companyMetrics.totalEmployees}\n`;
  csv += `Leave Utilization Rate,${companyMetrics.leaveUtilizationRate}%\n`;
  csv += `Average Leave Days per Employee,${companyMetrics.averageLeaveDaysPerEmployee}\n`;
  csv += `Total Leave Days This Month,${companyMetrics.totalLeaveDaysThisMonth}\n`;
  csv += `Total Remote Days This Month,${companyMetrics.totalRemoteDaysThisMonth}\n`;
  csv += '\nDepartment Leave Utilization\n';
  csv += 'Department,Used Days,Remaining Days,Utilization %\n';
  
  if (utilizationData && utilizationData.length > 0) {
    utilizationData.forEach(dept => {
      csv += `"${dept.department}",${dept.used},${dept.remaining},${dept.utilization}%\n`;
    });
  }
  
  return csv;
}

function generateCapacityReport(capacityData: any[]): string {
  let csv = 'Department,Total Employees,Available Today,On Leave,Remote,Capacity %\n';
  
  if (capacityData && capacityData.length > 0) {
    capacityData.forEach(dept => {
      csv += `"${dept.department}",${dept.employees},${dept.availableToday},${dept.onLeaveToday},${dept.remoteToday},${dept.capacityPercentage}%\n`;
    });
  }
  
  return csv;
}

function generateManagerPerformanceReport(departmentStats: any[]): string {
  let csv = 'Department,Employees,Pending Requests,On Leave,Remote Workers\n';
  
  if (departmentStats && departmentStats.length > 0) {
    departmentStats.forEach(dept => {
      csv += `"${dept.department}",${dept.employees},${dept.pendingRequests},${dept.onLeaveToday},${dept.remoteToday}\n`;
    });
  }
  
  return csv;
}

function generateSummaryReport(companyMetrics: any): string {
  let csv = 'Executive Summary Report\n';
  csv += `Generated on,${new Date().toLocaleDateString()}\n\n`;
  csv += 'Metric,Value\n';
  csv += `Total Employees,${companyMetrics.totalEmployees}\n`;
  csv += `Employees on Leave Today,${companyMetrics.onLeaveToday}\n`;
  csv += `Employees Working Remote Today,${companyMetrics.workingRemoteToday}\n`;
  csv += `Employees in Office Today,${companyMetrics.inOfficeToday}\n`;
  csv += `Pending Executive Approvals,${companyMetrics.pendingApprovals}\n`;
  csv += `Total Leave Days This Month,${companyMetrics.totalLeaveDaysThisMonth}\n`;
  csv += `Total Remote Days This Month,${companyMetrics.totalRemoteDaysThisMonth}\n`;
  csv += `Average Leave Days per Employee,${companyMetrics.averageLeaveDaysPerEmployee}\n`;
  csv += `Leave Utilization Rate,${companyMetrics.leaveUtilizationRate}%\n`;
  
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
    csv += 'Month,Total Days,Vacation Days,Personal Days,Medical Days\n';
    data.monthlyPatterns.forEach((month: any) => {
      csv += `${month.month},${month.totalDays},${month.vacationDays},${month.personalDays},${month.medicalDays}\n`;
    });
  }
  
  // Remote Work Trends
  if (data.remoteTrends && data.remoteTrends.length > 0) {
    csv += '\nRemote Work Trends by Department\n';
    const departments = Object.keys(data.remoteTrends[0]).filter(k => k !== 'month');
    csv += 'Month,' + departments.join(',') + '\n';
    data.remoteTrends.forEach((month: any) => {
      csv += month.month;
      departments.forEach(dept => {
        csv += `,${month[dept]}%`;
      });
      csv += '\n';
    });
  }
  
  return csv;
}