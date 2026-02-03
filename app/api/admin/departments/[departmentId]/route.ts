import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET: Fetch single department details
export async function GET(
  request: NextRequest,
  { params }: { params: { departmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const department = await prisma.department.findUnique({
      where: { id: params.departmentId },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true
          }
        },
        director: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true
          }
        },
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
            role: true,
            isActive: true
          },
          orderBy: {
            lastName: 'asc'
          }
        },
        parentDepartment: {
          select: {
            id: true,
            name: true
          }
        },
        childDepartments: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                users: true
              }
            }
          }
        }
      }
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    return NextResponse.json(
      { error: 'Failed to fetch department' },
      { status: 500 }
    );
  }
}

// PATCH: Update department details
export async function PATCH(
  request: NextRequest,
  { params }: { params: { departmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin/HR
    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!adminUser || !['ADMIN', 'HR', 'EXECUTIVE'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const data = await request.json();

    // Check if department exists
    const existingDept = await prisma.department.findUnique({
      where: { id: params.departmentId }
    });

    if (!existingDept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // If name is being changed, check for duplicates
    if (data.name && data.name !== existingDept.name) {
      const duplicate = await prisma.department.findFirst({
        where: {
          name: {
            equals: data.name,
            mode: 'insensitive'
          },
          id: { not: params.departmentId }
        }
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Department with this name already exists' },
          { status: 400 }
        );
      }
    }

    // Prevent circular parent relationships
    if (data.parentDepartmentId) {
      if (data.parentDepartmentId === params.departmentId) {
        return NextResponse.json(
          { error: 'Department cannot be its own parent' },
          { status: 400 }
        );
      }

      // Check if the new parent is a child of this department
      const isCircular = await checkCircularDependency(
        params.departmentId,
        data.parentDepartmentId
      );

      if (isCircular) {
        return NextResponse.json(
          { error: 'This would create a circular department hierarchy' },
          { status: 400 }
        );
      }
    }

    // Update department
    const updatedDepartment = await prisma.department.update({
      where: { id: params.departmentId },
      data: {
        name: data.name || undefined,
        description: data.description,
        code: data.code,
        managerId: data.managerId === '' ? null : data.managerId,
        directorId: data.directorId === '' ? null : data.directorId,
        parentDepartmentId: data.parentDepartmentId === '' ? null : data.parentDepartmentId,
        isActive: data.isActive !== undefined ? data.isActive : undefined
      },
      include: {
        manager: true,
        director: true,
        parentDepartment: true
      }
    });

    // Update manager's role if changed
    if (data.managerId && data.managerId !== existingDept.managerId) {
      await prisma.user.update({
        where: { id: data.managerId },
        data: { role: 'MANAGER' }
      });
    }

    // Update director's role if changed
    if (data.directorId && data.directorId !== existingDept.directorId) {
      await prisma.user.update({
        where: { id: data.directorId },
        data: { role: 'MANAGER' }
      });
    }

    return NextResponse.json({
      message: 'Department updated successfully',
      department: updatedDepartment
    });
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json(
      { error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

// DELETE: Delete or deactivate department
export async function DELETE(
  request: NextRequest,
  { params }: { params: { departmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin/HR
    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!adminUser || !['ADMIN', 'HR', 'EXECUTIVE'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Check if department has users
    const userCount = await prisma.user.count({
      where: { departmentId: params.departmentId }
    });

    if (userCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete department with ${userCount} active users. Please reassign users first.` },
        { status: 400 }
      );
    }

    // Check if department has child departments
    const childCount = await prisma.department.count({
      where: { parentDepartmentId: params.departmentId }
    });

    if (childCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete department with ${childCount} sub-departments. Please reorganize first.` },
        { status: 400 }
      );
    }

    // Soft delete (deactivate) the department
    const updatedDepartment = await prisma.department.update({
      where: { id: params.departmentId },
      data: {
        isActive: false,
        managerId: null,
        directorId: null
      }
    });

    return NextResponse.json({
      message: 'Department deactivated successfully',
      department: updatedDepartment
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { error: 'Failed to delete department' },
      { status: 500 }
    );
  }
}

// Helper function to check for circular dependencies
async function checkCircularDependency(
  departmentId: string,
  potentialParentId: string
): Promise<boolean> {
  const children = await prisma.department.findMany({
    where: { parentDepartmentId: departmentId },
    select: { id: true }
  });

  for (const child of children) {
    if (child.id === potentialParentId) {
      return true;
    }
    
    const hasCircular = await checkCircularDependency(child.id, potentialParentId);
    if (hasCircular) {
      return true;
    }
  }

  return false;
}