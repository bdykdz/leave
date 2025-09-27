import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const departments = await prisma.department.findMany({
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    // For each department, get director and managers
    const departmentsWithDetails = await Promise.all(
      departments.map(async (dept) => {
        const director = await prisma.user.findFirst({
          where: {
            department: dept.name,
            role: 'DEPARTMENT_DIRECTOR'
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        })

        const managers = await prisma.user.findMany({
          where: {
            department: dept.name,
            role: 'MANAGER'
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        })

        const employeeCount = await prisma.user.count({
          where: {
            department: dept.name
          }
        })

        return {
          ...dept,
          _count: { users: employeeCount },
          director,
          managers
        }
      })
    )

    console.log(`Fetched ${departmentsWithDetails.length} departments with details`)
    return NextResponse.json(departmentsWithDetails)
  } catch (error) {
    console.error('Error fetching detailed departments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch departments: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}