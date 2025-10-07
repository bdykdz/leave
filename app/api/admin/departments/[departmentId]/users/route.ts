import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// POST: Assign users to department
export async function POST(
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

    const { userIds, action = 'add' } = await request.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs array is required' },
        { status: 400 }
      );
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: params.departmentId }
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    if (action === 'add') {
      // Assign users to department
      const result = await prisma.user.updateMany({
        where: {
          id: { in: userIds }
        },
        data: {
          departmentId: params.departmentId
        }
      });

      return NextResponse.json({
        message: `${result.count} users assigned to department`,
        count: result.count
      });
    } else if (action === 'remove') {
      // Remove users from department
      const result = await prisma.user.updateMany({
        where: {
          id: { in: userIds },
          departmentId: params.departmentId
        },
        data: {
          departmentId: null,
          managerId: null,
          departmentDirectorId: null
        }
      });

      return NextResponse.json({
        message: `${result.count} users removed from department`,
        count: result.count
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "add" or "remove"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error managing department users:', error);
    return NextResponse.json(
      { error: 'Failed to manage department users' },
      { status: 500 }
    );
  }
}

// PATCH: Update department leadership (manager/director)
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

    const { managerId, directorId } = await request.json();

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: params.departmentId }
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const updateData: any = {};
    const userUpdates: Array<Promise<any>> = [];

    // Update manager
    if (managerId !== undefined) {
      updateData.managerId = managerId || null;
      
      if (managerId) {
        // Update the user's role to MANAGER
        userUpdates.push(
          prisma.user.update({
            where: { id: managerId },
            data: {
              role: 'MANAGER',
              departmentId: params.departmentId
            }
          })
        );
        
        // Update all department users to have this manager
        userUpdates.push(
          prisma.user.updateMany({
            where: {
              departmentId: params.departmentId,
              id: { not: managerId }
            },
            data: {
              managerId: managerId
            }
          })
        );
      }
    }

    // Update director
    if (directorId !== undefined) {
      updateData.directorId = directorId || null;
      
      if (directorId) {
        // Update the user's role
        userUpdates.push(
          prisma.user.update({
            where: { id: directorId },
            data: {
              role: 'MANAGER',
              departmentId: params.departmentId
            }
          })
        );
        
        // Update all department users to have this director
        userUpdates.push(
          prisma.user.updateMany({
            where: {
              departmentId: params.departmentId,
              id: { not: directorId }
            },
            data: {
              departmentDirectorId: directorId
            }
          })
        );
      }
    }

    // Execute all updates in a transaction
    const [updatedDepartment, ...userUpdateResults] = await prisma.$transaction([
      prisma.department.update({
        where: { id: params.departmentId },
        data: updateData,
        include: {
          manager: true,
          director: true
        }
      }),
      ...userUpdates
    ]);

    return NextResponse.json({
      message: 'Department leadership updated successfully',
      department: updatedDepartment
    });
  } catch (error) {
    console.error('Error updating department leadership:', error);
    return NextResponse.json(
      { error: 'Failed to update department leadership' },
      { status: 500 }
    );
  }
}