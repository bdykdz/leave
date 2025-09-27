import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get('role')
    
    const where = roleFilter ? { role: roleFilter } : {}
    
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
        position: true,
        isActive: true,
        createdAt: true,
        employeeId: true,
        managerId: true,
        departmentDirectorId: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        departmentDirector: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        subordinates: {
          select: {
            id: true
          }
        },
        directsReports: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}