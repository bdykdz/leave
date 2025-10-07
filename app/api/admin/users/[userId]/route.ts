import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET: Fetch single user details
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
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

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      include: {
        department: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        departmentDirector: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        leaveBalances: {
          where: {
            year: new Date().getFullYear()
          },
          include: {
            leaveType: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PATCH: Update user details
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
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
    
    // Prepare update data
    const updateData: any = {};
    
    // Basic fields
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    // Date fields
    if (data.joiningDate !== undefined) {
      updateData.joiningDate = data.joiningDate ? new Date(data.joiningDate) : null;
    }
    if (data.managerId !== undefined) {
      updateData.managerId = data.managerId || null;
    }
    if (data.departmentDirectorId !== undefined) {
      updateData.departmentDirectorId = data.departmentDirectorId || null;
    }

    // Password update (optional)
    if (data.password) {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      updateData.password = hashedPassword;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: params.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        department: true,
        position: true,
        role: true,
        isActive: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        departmentDirector: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Update leave balances if provided
    if (data.leaveBalances && Array.isArray(data.leaveBalances)) {
      const currentYear = new Date().getFullYear();
      
      for (const balance of data.leaveBalances) {
        await prisma.leaveBalance.upsert({
          where: {
            userId_leaveTypeId_year: {
              userId: params.userId,
              leaveTypeId: balance.leaveTypeId,
              year: currentYear
            }
          },
          update: {
            entitled: balance.entitled || 0,
            available: balance.available || 0,
            used: balance.used || 0,
            carriedForward: balance.carriedForward || 0
          },
          create: {
            userId: params.userId,
            leaveTypeId: balance.leaveTypeId,
            year: currentYear,
            entitled: balance.entitled || 0,
            available: balance.available || 0,
            used: balance.used || 0,
            carriedForward: balance.carriedForward || 0
          }
        });
      }
    }

    return NextResponse.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE: Delete or deactivate user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
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

    // Prevent self-deletion
    if (params.userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if user has pending requests
    const pendingRequests = await prisma.leaveRequest.count({
      where: {
        userId: params.userId,
        status: 'PENDING'
      }
    });

    if (pendingRequests > 0) {
      return NextResponse.json(
        { error: 'User has pending leave requests. Please resolve them first.' },
        { status: 400 }
      );
    }

    // Soft delete (deactivate) instead of hard delete
    const updatedUser = await prisma.user.update({
      where: { id: params.userId },
      data: {
        isActive: false,
        // Remove from management chains
        managerId: null,
        departmentDirectorId: null
      }
    });

    // Update any users who have this person as manager or director
    await prisma.user.updateMany({
      where: { managerId: params.userId },
      data: { managerId: null }
    });

    await prisma.user.updateMany({
      where: { departmentDirectorId: params.userId },
      data: { departmentDirectorId: null }
    });

    return NextResponse.json({
      message: 'User deactivated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}