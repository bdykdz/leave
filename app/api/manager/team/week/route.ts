import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { startOfWeek, addDays, format, isSameDay, parseISO } from "date-fns"

// Returns the weekly schedule (leave / WFH / work trip) for a manager's team.
// Query: ?start=YYYY-MM-DD (any day in the target week; defaults to current week).
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["MANAGER", "DEPARTMENT_DIRECTOR", "EXECUTIVE", "HR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get("start")

    // Monday of the requested week → Friday (working days only)
    const base = startParam ? parseISO(startParam) : new Date()
    const weekStart = startOfWeek(base, { weekStartsOn: 1 })
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = addDays(weekStart, 4)
    weekEnd.setHours(23, 59, 59, 999)

    const days = Array.from({ length: 5 }, (_, i) => {
      const d = addDays(weekStart, i)
      return { key: format(d, "yyyy-MM-dd"), date: d }
    })

    // Team members: direct reports + people this user directs as department director
    const members = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { managerId: session.user.id },
          { departmentDirectorId: session.user.id },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: true,
        profileImage: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    })

    const memberIds = members.map((m) => m.id)
    const emptyResponse = {
      weekStart: format(weekStart, "yyyy-MM-dd"),
      weekEnd: format(weekEnd, "yyyy-MM-dd"),
      days: days.map((d) => d.key),
      members: [] as any[],
    }

    if (memberIds.length === 0) {
      return NextResponse.json(emptyResponse)
    }

    const overlapWhere = {
      userId: { in: memberIds },
      status: "APPROVED" as const,
      startDate: { lte: weekEnd },
      endDate: { gte: weekStart },
    }

    const [leaveRequests, wfhRequests, tripRequests] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: overlapWhere,
        include: {
          leaveType: { select: { name: true } },
          substitute: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.workFromHomeRequest.findMany({ where: overlapWhere }),
      prisma.workTripRequest.findMany({ where: overlapWhere }),
    ])

    // Does a request cover the given day? Honours selectedDates when present.
    const covers = (req: any, day: Date) => {
      const selected = req.selectedDates as any[] | null
      if (selected && selected.length > 0) {
        return selected.some((d) => isSameDay(new Date(d), day))
      }
      return new Date(req.startDate) <= day && new Date(req.endDate) >= day
    }

    const fmtRange = (s: Date | string, e: Date | string) =>
      `${format(new Date(s), "d MMM yyyy")} – ${format(new Date(e), "d MMM yyyy")}`

    const memberMap = new Map<string, any>()
    for (const m of members) {
      memberMap.set(m.id, {
        id: m.id,
        name: `${m.firstName} ${m.lastName}`.trim(),
        department: m.department || "",
        avatar: m.profileImage || "",
        cells: {} as Record<string, any>,
      })
    }

    // Precedence when a member has multiple records on one day: leave > trip > wfh
    for (const req of leaveRequests) {
      const entry = memberMap.get(req.userId)
      if (!entry) continue
      for (const d of days) {
        if (covers(req, d.date)) {
          entry.cells[d.key] = {
            status: "leave",
            type: req.leaveType?.name || "Leave",
            reason: req.reason || null,
            dates: fmtRange(req.startDate, req.endDate),
            days: req.totalDays,
            substitute: req.substitute
              ? `${req.substitute.firstName} ${req.substitute.lastName}`.trim()
              : null,
            requestId: req.id,
          }
        }
      }
    }

    for (const req of tripRequests) {
      const entry = memberMap.get(req.userId)
      if (!entry) continue
      for (const d of days) {
        if (!entry.cells[d.key] && covers(req, d.date)) {
          entry.cells[d.key] = {
            status: "trip",
            type: "Work Trip",
            destination: req.destination || null,
            reason: req.purpose || null,
            dates: fmtRange(req.startDate, req.endDate),
            days: req.totalDays,
            requestId: req.id,
          }
        }
      }
    }

    for (const req of wfhRequests) {
      const entry = memberMap.get(req.userId)
      if (!entry) continue
      for (const d of days) {
        if (!entry.cells[d.key] && covers(req, d.date)) {
          entry.cells[d.key] = {
            status: "wfh",
            type: "Work From Home",
            location: req.location || null,
            dates: fmtRange(req.startDate, req.endDate),
            days: req.totalDays,
            requestId: req.id,
          }
        }
      }
    }

    return NextResponse.json({
      weekStart: format(weekStart, "yyyy-MM-dd"),
      weekEnd: format(weekEnd, "yyyy-MM-dd"),
      days: days.map((d) => d.key),
      members: Array.from(memberMap.values()),
    })
  } catch (error) {
    console.error("Error fetching team week:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
