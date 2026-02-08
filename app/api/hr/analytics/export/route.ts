import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { logDataExport } from '@/lib/utils/audit-log'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is HR, ADMIN, EXECUTIVE, or EMPLOYEE with HR department
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })

    const isHREmployee = user?.role === 'EMPLOYEE' && user?.department?.toLowerCase().includes('hr')
    
    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const format_type = searchParams.get('format') || 'pdf'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    
    // Set date range - use provided dates or default to current month
    const currentDate = new Date()
    let rangeStart: Date
    let rangeEnd: Date
    
    if (startDateParam && endDateParam) {
      rangeStart = new Date(startDateParam)
      rangeEnd = new Date(endDateParam)
    } else {
      rangeStart = startOfMonth(currentDate)
      rangeEnd = endOfMonth(currentDate)
    }

    // Fetch analytics data for the specified period
    const [
      leaveRequests,
      wfhRequests,
      departmentStats,
      holidays
    ] = await Promise.all([
      // Leave requests in period
      prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { gte: rangeStart, lte: rangeEnd }
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
              position: true
            }
          },
          leaveType: {
            select: {
              name: true,
              code: true
            }
          }
        },
        orderBy: {
          startDate: 'asc'
        }
      }),

      // WFH requests in period
      prisma.workFromHomeRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { gte: rangeStart, lte: rangeEnd }
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
              position: true
            }
          }
        },
        orderBy: {
          startDate: 'asc'
        }
      }),

      // Department employee counts
      prisma.user.groupBy({
        by: ['department'],
        _count: { id: true },
        where: {
          isActive: true,
          department: { not: null }
        }
      }),

      // Holidays in period
      prisma.holiday.findMany({
        where: {
          date: { gte: rangeStart, lte: rangeEnd },
          isActive: true
        },
        orderBy: {
          date: 'asc'
        }
      })
    ])

    if (format_type === 'pdf') {
      // For PDF, we'll create a simple HTML structure that can be converted to PDF
      // This is a basic implementation - you might want to use a proper PDF library
      
      const totalLeaveDays = leaveRequests.reduce((sum, req) => sum + req.totalDays, 0)
      const totalWFHDays = wfhRequests.reduce((sum, req) => sum + req.totalDays, 0)
      
      // Department breakdown
      const departmentBreakdown = departmentStats.map(dept => {
        const deptLeaves = leaveRequests.filter(req => req.user.department === dept.department)
        const deptWFH = wfhRequests.filter(req => req.user.department === dept.department)
        
        return {
          department: dept.department || 'Unknown',
          employeeCount: dept._count.id,
          leaveDays: deptLeaves.reduce((sum, req) => sum + req.totalDays, 0),
          wfhDays: deptWFH.reduce((sum, req) => sum + req.totalDays, 0)
        }
      }).sort((a, b) => b.leaveDays - a.leaveDays)

      const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Analytics Report - ${format(rangeStart, 'MMM dd, yyyy')} to ${format(rangeEnd, 'MMM dd, yyyy')}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
        .period { color: #666; font-size: 18px; margin-top: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; }
        .stat-value { font-size: 32px; font-weight: bold; color: #3b82f6; }
        .stat-label { color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
        th { background-color: #f8fafc; font-weight: 600; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .section { margin: 40px 0; }
        .section h2 { color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
        .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Leave Management Analytics Report</h1>
        <div class="period">${format(rangeStart, 'MMMM dd, yyyy')} - ${format(rangeEnd, 'MMMM dd, yyyy')}</div>
    </div>

    <div class="summary">
        <div class="stat-card">
            <div class="stat-value">${totalLeaveDays}</div>
            <div class="stat-label">Total Leave Days</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalWFHDays}</div>
            <div class="stat-label">Total WFH Days</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${leaveRequests.length}</div>
            <div class="stat-label">Leave Requests</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${wfhRequests.length}</div>
            <div class="stat-label">WFH Requests</div>
        </div>
    </div>

    <div class="section">
        <h2>Department Breakdown</h2>
        <table>
            <thead>
                <tr>
                    <th>Department</th>
                    <th>Employees</th>
                    <th>Leave Days</th>
                    <th>WFH Days</th>
                    <th>Avg Leave/Employee</th>
                </tr>
            </thead>
            <tbody>
                ${departmentBreakdown.map(dept => `
                    <tr>
                        <td>${dept.department}</td>
                        <td>${dept.employeeCount}</td>
                        <td>${dept.leaveDays}</td>
                        <td>${dept.wfhDays}</td>
                        <td>${dept.employeeCount > 0 ? (dept.leaveDays / dept.employeeCount).toFixed(1) : '0'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    ${holidays.length > 0 ? `
    <div class="section">
        <h2>Holidays in Period</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Holiday</th>
                </tr>
            </thead>
            <tbody>
                ${holidays.map(holiday => `
                    <tr>
                        <td>${format(holiday.date, 'MMM dd, yyyy')}</td>
                        <td>${holiday.nameEn}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="section">
        <h2>Leave Requests Details</h2>
        <table>
            <thead>
                <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Leave Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Days</th>
                </tr>
            </thead>
            <tbody>
                ${leaveRequests.slice(0, 50).map(req => `
                    <tr>
                        <td>${req.user.firstName} ${req.user.lastName} (${req.user.employeeId})</td>
                        <td>${req.user.department || 'N/A'}</td>
                        <td>${req.leaveType.name}</td>
                        <td>${format(req.startDate, 'MMM dd, yyyy')}</td>
                        <td>${format(req.endDate, 'MMM dd, yyyy')}</td>
                        <td>${req.totalDays}</td>
                    </tr>
                `).join('')}
                ${leaveRequests.length > 50 ? `
                    <tr>
                        <td colspan="6" style="text-align: center; color: #666; font-style: italic;">
                            ... and ${leaveRequests.length - 50} more requests
                        </td>
                    </tr>
                ` : ''}
            </tbody>
        </table>
    </div>

    <div class="footer">
        <p>Generated on ${format(new Date(), 'MMMM dd, yyyy \'at\' HH:mm')} by ${session.user.email}</p>
        <p>Leave Management System - Analytics Report</p>
    </div>
</body>
</html>
      `

      // Log the export action
      await logDataExport(session.user.id, 'PDF', leaveRequests.length + wfhRequests.length)

      // Return HTML that can be converted to PDF by the frontend
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="analytics_report_${format(rangeStart, 'yyyy-MM-dd')}_to_${format(rangeEnd, 'yyyy-MM-dd')}.html"`
        }
      })
    }

    // Default to JSON export if format not recognized
    return NextResponse.json({
      period: {
        start: format(rangeStart, 'yyyy-MM-dd'),
        end: format(rangeEnd, 'yyyy-MM-dd')
      },
      summary: {
        totalLeaveDays: leaveRequests.reduce((sum, req) => sum + req.totalDays, 0),
        totalWFHDays: wfhRequests.reduce((sum, req) => sum + req.totalDays, 0),
        leaveRequestCount: leaveRequests.length,
        wfhRequestCount: wfhRequests.length
      },
      leaveRequests: leaveRequests.slice(0, 100), // Limit for performance
      wfhRequests: wfhRequests.slice(0, 100),
      holidays
    })

  } catch (error) {
    console.error('Error exporting analytics:', error)
    return NextResponse.json(
      { error: 'Failed to export analytics data' },
      { status: 500 }
    )
  }
}