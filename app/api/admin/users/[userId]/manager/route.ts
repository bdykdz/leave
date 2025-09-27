import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId } = await params
    const { managerId, departmentDirectorId } = await request.json()

    // Validate that the managers exist and have appropriate roles
    if (managerId) {
      const manager = await prisma.user.findUnique({
        where: { id: managerId },
        select: { role: true }
      })

      if (!manager) {
        return NextResponse.json(
          { error: 'Manager not found' },
          { status: 400 }
        )
      }

      if (!['MANAGER', 'DEPARTMENT_DIRECTOR', 'EXECUTIVE'].includes(manager.role)) {
        return NextResponse.json(
          { error: 'Selected user cannot be a manager' },
          { status: 400 }
        )
      }
    }

    if (departmentDirectorId) {
      const director = await prisma.user.findUnique({
        where: { id: departmentDirectorId },
        select: { role: true }
      })

      if (!director) {
        return NextResponse.json(
          { error: 'Department Director not found' },
          { status: 400 }
        )
      }

      if (!['DEPARTMENT_DIRECTOR', 'EXECUTIVE'].includes(director.role)) {
        return NextResponse.json(
          { error: 'Selected user cannot be a department director' },
          { status: 400 }
        )
      }
    }

    // Prevent circular references
    if (managerId === userId || departmentDirectorId === userId) {
      return NextResponse.json(
        { error: 'A user cannot be their own manager or director' },
        { status: 400 }
      )
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        managerId: managerId || null,
        departmentDirectorId: departmentDirectorId || null
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
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
        }
      }
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Error updating user manager:', error)
    return NextResponse.json(
      { error: 'Failed to update user manager' },
      { status: 500 }
    )
  }
}