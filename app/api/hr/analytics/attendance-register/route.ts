import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { logDataExport } from '@/lib/utils/audit-log'
import { format, eachDayOfInterval, isWeekend, getDay } from 'date-fns'
import * as XLSX from 'xlsx'

const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Auth: HR, ADMIN, EXECUTIVE, or HR-department employee
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })

    const isHREmployee = currentUser?.role === 'EMPLOYEE' && currentUser?.department?.toLowerCase().includes('hr')
    if (!currentUser || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(currentUser.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const departmentParam = searchParams.get('department')

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    const rangeStart = new Date(startDateParam)
    const rangeEnd = new Date(endDateParam)

    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const diffDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 366) {
      return NextResponse.json({ error: 'Date range must not exceed 366 days' }, { status: 400 })
    }
    if (diffDays < 0) {
      return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 })
    }

    // Build employee filter
    const employeeWhere: any = { isActive: true }
    if (departmentParam && departmentParam !== 'all') {
      employeeWhere.department = departmentParam
    }

    // Parallel queries
    const [employees, leaveRequests, wfhRequests, holidays, leaveTypes] = await Promise.all([
      prisma.user.findMany({
        where: employeeWhere,
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          department: true,
          position: true,
          joiningDate: true,
        },
        orderBy: [{ department: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          OR: [
            { startDate: { lte: rangeEnd }, endDate: { gte: rangeStart } },
          ],
        },
        select: {
          userId: true,
          startDate: true,
          endDate: true,
          selectedDates: true,
          leaveType: { select: { code: true, name: true } },
        },
      }),
      prisma.workFromHomeRequest.findMany({
        where: {
          status: 'APPROVED',
          OR: [
            { startDate: { lte: rangeEnd }, endDate: { gte: rangeStart } },
          ],
        },
        select: {
          userId: true,
          startDate: true,
          endDate: true,
          selectedDates: true,
        },
      }),
      prisma.holiday.findMany({
        where: {
          date: { gte: rangeStart, lte: rangeEnd },
          isActive: true,
        },
      }),
      prisma.leaveType.findMany({
        where: { isActive: true },
        select: { code: true, name: true },
        orderBy: { code: 'asc' },
      }),
    ])

    // Build holiday date set
    const holidayDates = new Set<string>()
    for (const h of holidays) {
      holidayDates.add(format(h.date, 'yyyy-MM-dd'))
    }

    // Build leave lookup: userId -> dateKey -> leaveTypeCode
    const leaveMap = new Map<string, Map<string, string>>()
    for (const lr of leaveRequests) {
      if (!leaveMap.has(lr.userId)) leaveMap.set(lr.userId, new Map())
      const userLeaves = leaveMap.get(lr.userId)!

      // Use selectedDates if available, otherwise generate from range
      const dates = lr.selectedDates && lr.selectedDates.length > 0
        ? lr.selectedDates.map((d: Date) => format(d, 'yyyy-MM-dd'))
        : eachDayOfInterval({ start: lr.startDate, end: lr.endDate })
            .filter(d => !isWeekend(d))
            .map(d => format(d, 'yyyy-MM-dd'))

      for (const dateKey of dates) {
        userLeaves.set(dateKey, lr.leaveType.code)
      }
    }

    // Build WFH lookup: userId -> Set<dateKey>
    const wfhMap = new Map<string, Set<string>>()
    for (const wr of wfhRequests) {
      if (!wfhMap.has(wr.userId)) wfhMap.set(wr.userId, new Set())
      const userWfh = wfhMap.get(wr.userId)!

      let dates: string[]
      if (wr.selectedDates) {
        // selectedDates is stored as JSON
        const parsed = Array.isArray(wr.selectedDates) ? wr.selectedDates : JSON.parse(wr.selectedDates as string)
        dates = parsed.map((d: string | Date) => format(new Date(d), 'yyyy-MM-dd'))
      } else {
        dates = eachDayOfInterval({ start: wr.startDate, end: wr.endDate })
          .filter(d => !isWeekend(d))
          .map(d => format(d, 'yyyy-MM-dd'))
      }

      for (const dateKey of dates) {
        userWfh.add(dateKey)
      }
    }

    // Generate all days in range
    const allDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd })

    // Employee ID set for filtering
    const employeeIds = new Set(employees.map(e => e.id))

    // Build attendance rows
    const rows: any[][] = []
    // Header row
    const headerRow = ['Employee ID', 'Name', 'Department', 'Position']
    for (const day of allDays) {
      const dayNum = format(day, 'dd')
      const dayAbbrev = DAY_ABBREVS[getDay(day)]
      headerRow.push(`${dayNum} ${dayAbbrev}`)
    }
    headerRow.push('Present', 'Leave', 'WFH', 'Holidays', 'Weekends', 'Not Joined')
    rows.push(headerRow)

    // Data rows
    for (const emp of employees) {
      if (!employeeIds.has(emp.id)) continue

      const row: any[] = [
        emp.employeeId,
        `${emp.lastName}, ${emp.firstName}`,
        emp.department,
        emp.position,
      ]

      let presentCount = 0
      let leaveCount = 0
      let wfhCount = 0
      let holidayCount = 0
      let weekendCount = 0
      let notJoinedCount = 0

      const joiningDate = emp.joiningDate ? format(emp.joiningDate, 'yyyy-MM-dd') : null

      for (const day of allDays) {
        const dateKey = format(day, 'yyyy-MM-dd')

        // Not yet joined
        if (joiningDate && dateKey < joiningDate) {
          row.push('-')
          notJoinedCount++
          continue
        }

        // Weekend
        if (isWeekend(day)) {
          row.push('W')
          weekendCount++
          continue
        }

        // Holiday
        if (holidayDates.has(dateKey)) {
          row.push('H')
          holidayCount++
          continue
        }

        // Leave
        const leaveCode = leaveMap.get(emp.id)?.get(dateKey)
        if (leaveCode) {
          row.push(leaveCode)
          leaveCount++
          continue
        }

        // WFH
        if (wfhMap.get(emp.id)?.has(dateKey)) {
          row.push('WFH')
          wfhCount++
          continue
        }

        // Present
        row.push('P')
        presentCount++
      }

      row.push(presentCount, leaveCount, wfhCount, holidayCount, weekendCount, notJoinedCount)
      rows.push(row)
    }

    const formatParam = searchParams.get('format') || 'xlsx'
    const workingDays = allDays.filter(d => !isWeekend(d) && !holidayDates.has(format(d, 'yyyy-MM-dd'))).length

    if (formatParam === 'pdf') {
      // Generate HTML attendance register for PDF
      const statusColor = (code: string) => {
        if (code === 'P') return '#16a34a'   // green
        if (code === 'WFH') return '#2563eb'  // blue
        if (code === 'H') return '#d97706'    // amber
        if (code === 'W') return '#9ca3af'    // gray
        if (code === '-') return '#d1d5db'    // light gray
        return '#dc2626'                       // red for leave codes
      }

      const legendRows = leaveTypes.map(lt =>
        `<tr><td style="padding:4px 12px;font-weight:600;color:#dc2626">${lt.code}</td><td style="padding:4px 12px">${lt.name}</td></tr>`
      ).join('')

      const dateHeaders = allDays.map(day => {
        const bg = isWeekend(day) ? '#f3f4f6' : '#ffffff'
        return `<th style="padding:4px 2px;font-size:10px;text-align:center;min-width:32px;background:${bg};border:1px solid #e5e7eb">${format(day, 'dd')}<br/><span style="font-weight:400;font-size:9px">${DAY_ABBREVS[getDay(day)]}</span></th>`
      }).join('')

      const employeeRows = rows.slice(1).map(row => {
        const empCells = `<td style="padding:4px 8px;border:1px solid #e5e7eb;white-space:nowrap;font-size:11px">${row[0]}</td>` +
          `<td style="padding:4px 8px;border:1px solid #e5e7eb;white-space:nowrap;font-size:11px;font-weight:500">${row[1]}</td>` +
          `<td style="padding:4px 8px;border:1px solid #e5e7eb;white-space:nowrap;font-size:11px">${row[2]}</td>` +
          `<td style="padding:4px 8px;border:1px solid #e5e7eb;white-space:nowrap;font-size:11px">${row[3]}</td>`

        const dayCells = allDays.map((_, i) => {
          const val = row[4 + i]
          const color = statusColor(val)
          const bg = val === 'W' ? '#f9fafb' : val === '-' ? '#f9fafb' : '#ffffff'
          return `<td style="padding:2px;text-align:center;font-size:10px;font-weight:600;color:${color};background:${bg};border:1px solid #e5e7eb">${val}</td>`
        }).join('')

        const summaryStart = 4 + allDays.length
        const summaryCells = [
          `<td style="padding:4px 6px;text-align:center;font-weight:600;color:#16a34a;border:1px solid #e5e7eb;font-size:11px">${row[summaryStart]}</td>`,
          `<td style="padding:4px 6px;text-align:center;font-weight:600;color:#dc2626;border:1px solid #e5e7eb;font-size:11px">${row[summaryStart + 1]}</td>`,
          `<td style="padding:4px 6px;text-align:center;font-weight:600;color:#2563eb;border:1px solid #e5e7eb;font-size:11px">${row[summaryStart + 2]}</td>`,
          `<td style="padding:4px 6px;text-align:center;color:#d97706;border:1px solid #e5e7eb;font-size:11px">${row[summaryStart + 3]}</td>`,
          `<td style="padding:4px 6px;text-align:center;color:#9ca3af;border:1px solid #e5e7eb;font-size:11px">${row[summaryStart + 4]}</td>`,
          `<td style="padding:4px 6px;text-align:center;color:#d1d5db;border:1px solid #e5e7eb;font-size:11px">${row[summaryStart + 5]}</td>`,
        ].join('')

        return `<tr>${empCells}${dayCells}${summaryCells}</tr>`
      }).join('')

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Attendance Register</title>
<style>
  @page { size: landscape; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 20px; color: #1f2937; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #3b82f6;padding-bottom:15px">
    <h1 style="margin:0;font-size:22px;color:#1e3a5f">Attendance Register</h1>
    <p style="margin:6px 0 0;color:#6b7280;font-size:14px">${format(rangeStart, 'MMMM dd, yyyy')} &mdash; ${format(rangeEnd, 'MMMM dd, yyyy')}</p>
    <p style="margin:4px 0 0;color:#6b7280;font-size:13px">${departmentParam && departmentParam !== 'all' ? departmentParam : 'All Departments'} &bull; ${employees.length} employees &bull; ${workingDays} working days</p>
  </div>

  <div style="overflow-x:auto">
    <table style="border-collapse:collapse;width:100%">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;font-size:11px">ID</th>
          <th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;font-size:11px">Name</th>
          <th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;font-size:11px">Department</th>
          <th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;font-size:11px">Position</th>
          ${dateHeaders}
          <th style="padding:4px 6px;text-align:center;border:1px solid #e5e7eb;font-size:10px;background:#f0fdf4">P</th>
          <th style="padding:4px 6px;text-align:center;border:1px solid #e5e7eb;font-size:10px;background:#fef2f2">Leave</th>
          <th style="padding:4px 6px;text-align:center;border:1px solid #e5e7eb;font-size:10px;background:#eff6ff">WFH</th>
          <th style="padding:4px 6px;text-align:center;border:1px solid #e5e7eb;font-size:10px;background:#fffbeb">H</th>
          <th style="padding:4px 6px;text-align:center;border:1px solid #e5e7eb;font-size:10px;background:#f9fafb">W</th>
          <th style="padding:4px 6px;text-align:center;border:1px solid #e5e7eb;font-size:10px;background:#f9fafb">N/J</th>
        </tr>
      </thead>
      <tbody>
        ${employeeRows}
      </tbody>
    </table>
  </div>

  <div style="margin-top:30px;display:flex;gap:40px;flex-wrap:wrap">
    <div>
      <h3 style="font-size:13px;margin:0 0 8px;color:#374151">Legend</h3>
      <table style="border-collapse:collapse;font-size:12px">
        <tr><td style="padding:3px 12px;font-weight:600;color:#16a34a">P</td><td style="padding:3px 12px">Present</td></tr>
        <tr><td style="padding:3px 12px;font-weight:600;color:#2563eb">WFH</td><td style="padding:3px 12px">Work From Home</td></tr>
        <tr><td style="padding:3px 12px;font-weight:600;color:#d97706">H</td><td style="padding:3px 12px">Holiday</td></tr>
        <tr><td style="padding:3px 12px;font-weight:600;color:#9ca3af">W</td><td style="padding:3px 12px">Weekend</td></tr>
        <tr><td style="padding:3px 12px;font-weight:600;color:#d1d5db">-</td><td style="padding:3px 12px">Not Yet Joined</td></tr>
        ${legendRows}
      </table>
    </div>
    <div style="font-size:11px;color:#6b7280;align-self:flex-end">
      <p style="margin:2px 0">Generated: ${format(new Date(), "MMM dd, yyyy 'at' HH:mm")}</p>
      <p style="margin:2px 0">By: ${session.user.email}</p>
    </div>
  </div>
</body>
</html>`

      await logDataExport(session.user.id, 'PDF', employees.length)

      const filename = `attendance_register_${format(rangeStart, 'yyyy-MM-dd')}_to_${format(rangeEnd, 'yyyy-MM-dd')}.html`

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // Default: Excel format
    const wb = XLSX.utils.book_new()

    // Sheet 1: Attendance Register
    const ws = XLSX.utils.aoa_to_sheet(rows)

    // Set column widths
    const colWidths: XLSX.ColInfo[] = [
      { wch: 12 }, // Employee ID
      { wch: 22 }, // Name
      { wch: 18 }, // Department
      { wch: 18 }, // Position
    ]
    for (let i = 0; i < allDays.length; i++) {
      colWidths.push({ wch: 7 })
    }
    // Summary columns
    colWidths.push({ wch: 8 }, { wch: 7 }, { wch: 7 }, { wch: 9 }, { wch: 9 }, { wch: 10 })
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Register')

    // Sheet 2: Summary
    const summaryData = [
      ['Attendance Register - Summary'],
      [],
      ['Report Period', `${format(rangeStart, 'MMM dd, yyyy')} - ${format(rangeEnd, 'MMM dd, yyyy')}`],
      ['Department', departmentParam && departmentParam !== 'all' ? departmentParam : 'All Departments'],
      ['Total Employees', employees.length],
      ['Total Calendar Days', allDays.length],
      ['Working Days', workingDays],
      ['Holidays in Period', holidayDates.size],
      [],
      ['Legend - Leave Type Codes:'],
      ['Code', 'Leave Type'],
      ...leaveTypes.map(lt => [lt.code, lt.name]),
      [],
      ['Other Codes:'],
      ['P', 'Present'],
      ['WFH', 'Work From Home'],
      ['H', 'Holiday'],
      ['W', 'Weekend'],
      ['-', 'Not Yet Joined'],
      [],
      ['Generated', format(new Date(), "MMM dd, yyyy 'at' HH:mm")],
      ['Generated By', session.user.email],
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData)
    ws2['!cols'] = [{ wch: 20 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary')

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Audit log
    await logDataExport(session.user.id, 'EXCEL', employees.length)

    const filename = `attendance_register_${format(rangeStart, 'yyyy-MM-dd')}_to_${format(rangeEnd, 'yyyy-MM-dd')}.xlsx`

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generating attendance register:', error)
    return NextResponse.json(
      { error: 'Failed to generate attendance register' },
      { status: 500 }
    )
  }
}
