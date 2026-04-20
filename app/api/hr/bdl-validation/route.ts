import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET: List BDL (Blood Donation Leave) requests for HR validation.
// Returns:
//   - pending_hr: manager approved (level 1), HR level 2 still PENDING
//   - validated:  HR approved (hrDocumentVerified=true)
//   - all (default): both categories
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })

    const isHREmployee = user?.role === 'EMPLOYEE' && (
      user?.department?.toLowerCase() === 'hr' ||
      user?.department?.toLowerCase() === 'human resources'
    )

    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get('filter') || 'pending_hr' // 'pending_hr' | 'validated' | 'all'
    const search = searchParams.get('search') || ''

    const whereClause: any = {
      leaveType: { code: 'BDL' }
    }

    if (filter === 'pending_hr') {
      whereClause.status = 'PENDING'
      whereClause.approvals = {
        some: { level: 2, status: 'PENDING' }
      }
      // And level 1 manager approval must already be APPROVED
      whereClause.AND = [
        { approvals: { some: { level: 1, status: 'APPROVED' } } }
      ]
    } else if (filter === 'validated') {
      whereClause.hrDocumentVerified = true
    }
    // else filter === 'all' → no extra constraint

    if (search) {
      whereClause.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { requestNumber: { contains: search, mode: 'insensitive' } }
      ]
    }

    const requests = await prisma.leaveRequest.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true
          }
        },
        leaveType: {
          select: { id: true, code: true, name: true, documentTypes: true }
        },
        approvals: {
          orderBy: { level: 'asc' },
          include: {
            approver: {
              select: { id: true, firstName: true, lastName: true, role: true }
            }
          }
        }
      }
    })

    // Hydrate hrVerifiedBy display name (stored as plain String ID on LeaveRequest)
    const verifierIds = Array.from(new Set(
      requests.map(r => r.hrVerifiedBy).filter((id): id is string => Boolean(id))
    ))
    const verifierMap = verifierIds.length
      ? Object.fromEntries(
          (await prisma.user.findMany({
            where: { id: { in: verifierIds } },
            select: { id: true, firstName: true, lastName: true }
          })).map(u => [u.id, u])
        )
      : {}
    const requestsWithVerifier = requests.map(r => ({
      ...r,
      verifiedByUser: r.hrVerifiedBy ? verifierMap[r.hrVerifiedBy] || null : null
    }))

    // Counter for the tab badge — always reflects pending_hr scope
    const pendingCount = filter === 'pending_hr'
      ? requests.length
      : await prisma.leaveRequest.count({
          where: {
            leaveType: { code: 'BDL' },
            status: 'PENDING',
            approvals: {
              some: { level: 2, status: 'PENDING' }
            },
            AND: [
              { approvals: { some: { level: 1, status: 'APPROVED' } } }
            ]
          }
        })

    return NextResponse.json({
      requests: requestsWithVerifier,
      pendingCount,
      filter
    })
  } catch (error) {
    console.error('Error fetching BDL validation list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch BDL validation list' },
      { status: 500 }
    )
  }
}
