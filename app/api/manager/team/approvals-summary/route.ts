import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"

// Returns everything this manager has personally approved, grouped per team member,
// with a running day total and per-request detail lines.
// Query: ?range=year | 90d | all  (defaults to current calendar year).
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
    const range = searchParams.get("range") || "year"

    const now = new Date()
    let approvedFrom: Date | null = null
    if (range === "year") {
      approvedFrom = new Date(now.getFullYear(), 0, 1)
    } else if (range === "90d") {
      approvedFrom = new Date(now)
      approvedFrom.setDate(approvedFrom.getDate() - 90)
    } // "all" → no lower bound

    const approverFilter = {
      approverId: session.user.id,
      status: "APPROVED" as const,
      ...(approvedFrom ? { approvedAt: { gte: approvedFrom } } : {}),
    }

    const userSelect = {
      id: true,
      firstName: true,
      lastName: true,
      department: true,
      profileImage: true,
    }

    const [leaveRequests, wfhRequests, tripRequests] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { approvals: { some: approverFilter } },
        include: {
          user: { select: userSelect },
          leaveType: { select: { name: true } },
          substitute: { select: { firstName: true, lastName: true } },
          approvals: { where: approverFilter, select: { approvedAt: true } },
        },
      }),
      prisma.workFromHomeRequest.findMany({
        where: { approvals: { some: approverFilter } },
        include: {
          user: { select: userSelect },
          approvals: { where: approverFilter, select: { approvedAt: true } },
        },
      }),
      prisma.workTripRequest.findMany({
        where: { approvals: { some: approverFilter } },
        include: {
          user: { select: userSelect },
          approvals: { where: approverFilter, select: { approvedAt: true } },
        },
      }),
    ])

    const fmtRange = (s: Date | string, e: Date | string) =>
      `${format(new Date(s), "d MMM yyyy")} – ${format(new Date(e), "d MMM yyyy")}`

    type Item = {
      kind: "leave" | "wfh" | "trip"
      type: string
      days: number
      dates: string
      reason: string | null
      substitute: string | null
      approvedDate: string | null
      overallStatus: string
    }

    const groups = new Map<string, any>()

    const ensureGroup = (user: any) => {
      if (!groups.has(user.id)) {
        groups.set(user.id, {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim() || "Unknown",
          department: user.department || "",
          avatar: user.profileImage || "",
          totalDays: 0,
          leaveDays: 0,
          wfhDays: 0,
          tripDays: 0,
          count: 0,
          items: [] as Item[],
        })
      }
      return groups.get(user.id)
    }

    const addItem = (user: any, item: Item, bucket: "leaveDays" | "wfhDays" | "tripDays") => {
      const g = ensureGroup(user)
      g.items.push(item)
      g.totalDays += item.days || 0
      g[bucket] += item.days || 0
      g.count += 1
    }

    for (const req of leaveRequests) {
      if (!req.user) continue
      addItem(
        req.user,
        {
          kind: "leave",
          type: req.leaveType?.name || "Leave",
          days: req.totalDays,
          dates: fmtRange(req.startDate, req.endDate),
          reason: req.reason || null,
          substitute: req.substitute
            ? `${req.substitute.firstName} ${req.substitute.lastName}`.trim()
            : null,
          approvedDate: req.approvals[0]?.approvedAt?.toISOString() || null,
          overallStatus: req.status,
        },
        "leaveDays",
      )
    }

    for (const req of wfhRequests) {
      if (!req.user) continue
      addItem(
        req.user,
        {
          kind: "wfh",
          type: "Work From Home",
          days: req.totalDays,
          dates: fmtRange(req.startDate, req.endDate),
          reason: req.location || null,
          substitute: null,
          approvedDate: req.approvals[0]?.approvedAt?.toISOString() || null,
          overallStatus: req.status,
        },
        "wfhDays",
      )
    }

    for (const req of tripRequests) {
      if (!req.user) continue
      addItem(
        req.user,
        {
          kind: "trip",
          type: "Work Trip",
          days: req.totalDays,
          dates: fmtRange(req.startDate, req.endDate),
          reason: [req.destination, req.purpose].filter(Boolean).join(" — ") || null,
          substitute: null,
          approvedDate: req.approvals[0]?.approvedAt?.toISOString() || null,
          overallStatus: req.status,
        },
        "tripDays",
      )
    }

    const members = Array.from(groups.values())
    // Most recent approval first within each member
    for (const g of members) {
      g.items.sort((a: Item, b: Item) => {
        const ta = a.approvedDate ? new Date(a.approvedDate).getTime() : 0
        const tb = b.approvedDate ? new Date(b.approvedDate).getTime() : 0
        return tb - ta
      })
    }
    // Members with the most approved days first
    members.sort((a, b) => b.totalDays - a.totalDays)

    return NextResponse.json({
      range,
      members,
      totals: {
        members: members.length,
        days: members.reduce((sum, g) => sum + g.totalDays, 0),
        requests: members.reduce((sum, g) => sum + g.count, 0),
      },
    })
  } catch (error) {
    console.error("Error fetching approvals summary:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
