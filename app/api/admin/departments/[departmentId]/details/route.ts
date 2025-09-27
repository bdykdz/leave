import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ departmentId: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { departmentId } = await params

    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    })

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    // Get director
    const director = await prisma.user.findFirst({
      where: {
        department: department.name,
        role: 'DEPARTMENT_DIRECTOR'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        position: true
      }
    })

    // Get managers
    const managers = await prisma.user.findMany({
      where: {
        department: department.name,
        role: 'MANAGER'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        position: true
      },
      orderBy: { lastName: 'asc' }
    })

    // Get all employees
    const employees = await prisma.user.findMany({
      where: {
        department: department.name
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        position: true,
        role: true
      },
      orderBy: [
        { role: 'asc' },
        { lastName: 'asc' }
      ]
    })

    return NextResponse.json({
      ...department,
      director,
      managers,
      employees
    })
  } catch (error) {
    console.error('Error fetching department details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch department details' },
      { status: 500 }
    )
  }
}