import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET: everyone who reports to this user (as manager and/or department director),
// with counts of PENDING approvals still sitting with this user for each report.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId } = await params

    const manager = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true }
    })

    if (!manager) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const reports = await prisma.user.findMany({
      where: {
        OR: [{ managerId: userId }, { departmentDirectorId: userId }]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        position: true,
        role: true,
        isActive: true,
        managerId: true,
        departmentDirectorId: true
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })

    const reportIds = reports.map(r => r.id)

    const [leaveApprovals, wfhApprovals, workTripApprovals] = await Promise.all([
      prisma.approval.findMany({
        where: {
          approverId: userId,
          status: 'PENDING',
          escalatedToId: null,
          leaveRequest: { status: 'PENDING', userId: { in: reportIds } }
        },
        select: { leaveRequest: { select: { userId: true } } }
      }),
      prisma.wFHApproval.findMany({
        where: {
          approverId: userId,
          status: 'PENDING',
          wfhRequest: { status: 'PENDING', userId: { in: reportIds } }
        },
        select: { wfhRequest: { select: { userId: true } } }
      }),
      prisma.workTripApproval.findMany({
        where: {
          approverId: userId,
          status: 'PENDING',
          workTripRequest: { status: 'PENDING', userId: { in: reportIds } }
        },
        select: { workTripRequest: { select: { userId: true } } }
      })
    ])

    const pendingByUser = new Map<string, { leave: number; wfh: number; workTrip: number }>()
    const bump = (uid: string, key: 'leave' | 'wfh' | 'workTrip') => {
      const entry = pendingByUser.get(uid) || { leave: 0, wfh: 0, workTrip: 0 }
      entry[key]++
      pendingByUser.set(uid, entry)
    }
    leaveApprovals.forEach(a => bump(a.leaveRequest.userId, 'leave'))
    wfhApprovals.forEach(a => bump(a.wfhRequest.userId, 'wfh'))
    workTripApprovals.forEach(a => bump(a.workTripRequest.userId, 'workTrip'))

    return NextResponse.json({
      manager,
      reports: reports.map(r => ({
        ...r,
        isDirectReport: r.managerId === userId,
        isDirectorReport: r.departmentDirectorId === userId,
        pendingApprovals: pendingByUser.get(r.id) || { leave: 0, wfh: 0, workTrip: 0 }
      }))
    })
  } catch (error) {
    console.error('Error fetching team:', error)
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 })
  }
}
