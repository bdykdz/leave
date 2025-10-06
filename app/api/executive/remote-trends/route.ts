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

    // Get data for the last 6 months
    const today = new Date()
    const sixMonthsAgo = new Date(today)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)

    const months = []
    const currentDate = new Date(sixMonthsAgo)
    
    while (currentDate <= today) {
      months.push({
        month: currentDate.toLocaleDateString('en-US', { month: 'short' }),
        year: currentDate.getFullYear(),
        startDate: new Date(currentDate),
        endDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      })
      currentDate.setMonth(currentDate.getMonth() + 1)
    }

    // Get all departments
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

    // Initialize data structure
    const trendData = months.map(({ month }) => {
      const data: any = { month }
      departments.forEach(dept => {
        data[dept.department] = 0
      })
      return data
    })

    // Get remote work data for each month and department
    for (let i = 0; i < months.length; i++) {
      const { startDate, endDate } = months[i]
      
      for (const dept of departments) {
        // Get approved WFH requests for this department in this month
        const wfhRequests = await prisma.workFromHomeRequest.findMany({
          where: {
            status: 'APPROVED',
            startDate: { lte: endDate },
            endDate: { gte: startDate },
            user: {
              department: dept.department
            }
          }
        })

        // Count total WFH days
        const wfhDays = wfhRequests.reduce((total, wfh) => {
          const start = wfh.startDate > startDate ? wfh.startDate : startDate
          const end = wfh.endDate < endDate ? wfh.endDate : endDate
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
          return total + days
        }, 0)

        // Calculate percentage (WFH days / (employees * working days in month))
        // Assuming ~22 working days per month
        const workingDays = 22
        const percentage = dept._count.id > 0 
          ? Math.round((wfhDays / (dept._count.id * workingDays)) * 100)
          : 0

        trendData[i][dept.department] = percentage
      }
    }

    return NextResponse.json(trendData)
  } catch (error) {
    console.error("Error fetching remote trends:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}