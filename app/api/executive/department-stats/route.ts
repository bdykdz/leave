import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is an executive
    if (!["EXECUTIVE", "HR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get all departments with employee counts
    const departments = await prisma.user.groupBy({
      by: ['department'],
      where: {
        isActive: true,
        department: {
          not: 'Unassigned'
        }
      },
      _count: {
        id: true
      }
    })

    // For each department, get additional stats
    const departmentStats = await Promise.all(
      departments.map(async (dept) => {
        // Get employees on leave today
        const onLeaveToday = await prisma.leaveRequest.count({
          where: {
            status: 'APPROVED',
            startDate: { lte: tomorrow },
            endDate: { gte: today },
            user: {
              department: dept.department
            }
          }
        })

        // Get employees working remote today
        const remoteToday = await prisma.workFromHomeRequest.count({
          where: {
            status: 'APPROVED',
            startDate: { lte: tomorrow },
            endDate: { gte: today },
            user: {
              department: dept.department
            }
          }
        })

        // Get pending requests for this department
        const pendingRequests = await prisma.leaveRequest.count({
          where: {
            status: 'PENDING',
            user: {
              department: dept.department
            }
          }
        })

        return {
          department: dept.department,
          employees: dept._count.id,
          onLeaveToday,
          remoteToday,
          pendingRequests
        }
      })
    )

    // Sort by number of employees (largest departments first)
    departmentStats.sort((a, b) => b.employees - a.employees)

    return NextResponse.json(departmentStats)
  } catch (error) {
    console.error("Error fetching department stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}