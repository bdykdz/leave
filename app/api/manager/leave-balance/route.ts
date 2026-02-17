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

    const currentYear = new Date().getFullYear()

    // Get user's leave balances for the current year
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: {
        userId: session.user.id,
        year: currentYear
      },
      include: {
        leaveType: true
      }
    })

    // Get used leave days
    const usedLeave = await prisma.leaveRequest.groupBy({
      by: ['leaveTypeId'],
      where: {
        userId: session.user.id,
        status: 'APPROVED',
        startDate: {
          gte: new Date(currentYear, 0, 1)
        },
        endDate: {
          lte: new Date(currentYear, 11, 31)
        }
      },
      _sum: {
        totalDays: true
      }
    })

    // Transform data to match frontend format
    const usedMap = new Map(usedLeave.map(ul => [ul.leaveTypeId, ul._sum.totalDays || 0]))

    // Find normal leave (NL or AL)
    const vacation = leaveBalances.find(lb => lb.leaveType.code === 'NL' || lb.leaveType.code === 'AL')

    // Sum all PERSONAL (collective contract) + PROVISIONAL category leave balances
    const collectiveBalances = leaveBalances.filter(lb =>
      lb.leaveType.category === 'PERSONAL' || lb.leaveType.category === 'PROVISIONAL'
    )
    const collectiveTotal = collectiveBalances.reduce((sum, lb) => sum + lb.entitled, 0)
    const collectiveUsed = collectiveBalances.reduce((sum, lb) => sum + (usedMap.get(lb.leaveTypeId) || 0), 0)

    // Medical leave (HR-managed)
    const medical = leaveBalances.find(lb => lb.leaveType.code === 'SL')

    return NextResponse.json({
      vacation: {
        used: vacation ? usedMap.get(vacation.leaveTypeId) || 0 : 0,
        total: vacation ? vacation.entitled : 21
      },
      collective: {
        used: collectiveUsed,
        total: collectiveTotal
      },
      medical: {
        used: medical ? usedMap.get(medical.leaveTypeId) || 0 : 0,
        total: medical ? medical.entitled : 180
      }
    })
  } catch (error) {
    console.error("Error fetching leave balance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}