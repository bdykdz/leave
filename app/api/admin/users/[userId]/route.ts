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
    const body = await request.json()
    
    // Get current user data to check for role changes
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, department: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Extract fields that can be updated
    const updateData: any = {}
    if (body.role !== undefined) updateData.role = body.role
    if (body.firstName !== undefined) updateData.firstName = body.firstName
    if (body.lastName !== undefined) updateData.lastName = body.lastName
    if (body.email !== undefined) updateData.email = body.email
    if (body.department !== undefined) updateData.department = body.department
    if (body.position !== undefined) updateData.position = body.position
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    // Update the user
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData
    })

    // If role changed to DEPARTMENT_DIRECTOR, update all employees in the same department
    if (body.role === 'DEPARTMENT_DIRECTOR' && currentUser.role !== 'DEPARTMENT_DIRECTOR') {
      const userDepartment = body.department || currentUser.department

      // First, remove this user as department director from any previous department
      await prisma.user.updateMany({
        where: {
          departmentDirectorId: userId,
          department: { not: userDepartment }
        },
        data: { departmentDirectorId: null }
      })

      // Then, set this user as department director for all employees in their department
      await prisma.user.updateMany({
        where: {
          department: userDepartment,
          id: { not: userId }, // Exclude the director themselves
          role: { in: ['EMPLOYEE', 'MANAGER'] } // Only update employees and managers
        },
        data: { departmentDirectorId: userId }
      })

      // Check if there was a previous director for this department and remove them
      const previousDirector = await prisma.user.findFirst({
        where: {
          department: userDepartment,
          role: 'DEPARTMENT_DIRECTOR',
          id: { not: userId }
        }
      })

      if (previousDirector) {
        // Change previous director's role to MANAGER
        await prisma.user.update({
          where: { id: previousDirector.id },
          data: { role: 'MANAGER' }
        })
      }
    }

    // If role changed FROM DEPARTMENT_DIRECTOR to something else, remove as director
    if (currentUser.role === 'DEPARTMENT_DIRECTOR' && body.role && body.role !== 'DEPARTMENT_DIRECTOR') {
      await prisma.user.updateMany({
        where: { departmentDirectorId: userId },
        data: { departmentDirectorId: null }
      })
    }

    // If department changed for a DEPARTMENT_DIRECTOR, update their subordinates
    if (user.role === 'DEPARTMENT_DIRECTOR' && body.department && body.department !== currentUser.department) {
      // Remove as director from old department
      await prisma.user.updateMany({
        where: {
          departmentDirectorId: userId,
          department: currentUser.department
        },
        data: { departmentDirectorId: null }
      })

      // Add as director to new department
      await prisma.user.updateMany({
        where: {
          department: body.department,
          id: { not: userId },
          role: { in: ['EMPLOYEE', 'MANAGER'] }
        },
        data: { departmentDirectorId: userId }
      })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId } = await params

    // Prevent admin from deleting themselves
    if (session.user.id === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Check if this is the last admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        role: true,
        firstName: true,
        lastName: true
      }
    })

    if (user?.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' }
      })
      
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin' },
          { status: 400 }
        )
      }
    }

    // Check for subordinates (both as manager and department director)
    const subordinates = await prisma.user.findMany({
      where: {
        OR: [
          { managerId: userId },
          { departmentDirectorId: userId }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        managerId: true,
        departmentDirectorId: true
      }
    })

    if (subordinates.length > 0) {
      const managedUsers = subordinates.filter(s => s.managerId === userId)
      const directedUsers = subordinates.filter(s => s.departmentDirectorId === userId)
      
      let errorMessage = `Cannot delete ${user?.firstName} ${user?.lastName}. `
      
      if (managedUsers.length > 0) {
        errorMessage += `They manage ${managedUsers.length} user(s). `
      }
      
      if (directedUsers.length > 0) {
        errorMessage += `They are department director for ${directedUsers.length} user(s). `
      }
      
      errorMessage += 'Please reassign these users first.'

      return NextResponse.json(
        { 
          error: errorMessage,
          subordinates: subordinates.map(s => ({
            id: s.id,
            name: `${s.firstName} ${s.lastName}`,
            email: s.email,
            isManaged: s.managerId === userId,
            isDirected: s.departmentDirectorId === userId
          }))
        },
        { status: 400 }
      )
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: userId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}