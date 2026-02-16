import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditAction } from '@/lib/utils/audit-log';

// PATCH: Toggle employee active status (soft delete)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is HR, ADMIN, or EXECUTIVE
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    });

    const isHREmployee = user?.role === 'EMPLOYEE' && (user?.department?.toLowerCase() === 'hr' || user?.department?.toLowerCase() === 'human resources');
    
    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { isActive, reason } = await request.json();

    // Get current employee status
    const currentEmployee = await prisma.user.findUnique({
      where: { id: params.id },
      select: { 
        isActive: true, 
        firstName: true, 
        lastName: true,
        email: true,
        employeeId: true,
        department: true,
        position: true,
        role: true
      }
    });

    if (!currentEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Prevent self-deactivation
    if (params.id === session.user.id && !isActive) {
      return NextResponse.json({ 
        error: 'Cannot deactivate yourself' 
      }, { status: 400 });
    }

    // If deactivating, handle related data
    if (!isActive) {
      // Cancel all pending leave requests
      await prisma.leaveRequest.updateMany({
        where: {
          userId: params.id,
          status: 'PENDING'
        },
        data: {
          status: 'CANCELLED',
          hrVerificationNotes: `Employee deactivated by ${session.user.email}. Reason: ${reason || 'Not specified'}`
        }
      });

      // Cancel all pending WFH requests
      await prisma.workFromHomeRequest.updateMany({
        where: {
          userId: params.id,
          status: 'PENDING'
        },
        data: {
          status: 'CANCELLED',
          hrNotes: `Employee deactivated by ${session.user.email}. Reason: ${reason || 'Not specified'}`
        }
      });

      // Remove from approval chains (set approvals to REJECTED for pending requests)
      await prisma.approval.updateMany({
        where: {
          approverId: params.id,
          status: 'PENDING'
        },
        data: {
          status: 'REJECTED',
          comments: 'Approver deactivated',
          approvedAt: new Date()
        }
      });
    }

    // Update employee status
    const updatedEmployee = await prisma.user.update({
      where: { id: params.id },
      data: {
        isActive
      }
    });

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: isActive ? AuditAction.REACTIVATE_EMPLOYEE : AuditAction.DEACTIVATE_EMPLOYEE,
      entity: 'USER',
      entityId: params.id,
      oldValues: { isActive: currentEmployee.isActive },
      newValues: { isActive },
      metadata: {
        reason,
        affectedUserId: params.id
      }
    });

    // Create notification for HR team
    const hrUsers = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'HR' },
          { role: 'ADMIN' },
          { 
            role: 'EMPLOYEE',
            department: { contains: 'HR', mode: 'insensitive' }
          }
        ],
        id: { not: session.user.id } // Don't notify the person who did the action
      },
      select: { id: true }
    });

    for (const hrUser of hrUsers) {
      await prisma.notification.create({
        data: {
          userId: hrUser.id,
          type: 'LEAVE_CANCELLED',
          title: isActive ? 'Employee Reactivated' : 'Employee Deactivated',
          message: `${currentEmployee.firstName} ${currentEmployee.lastName} (${currentEmployee.employeeId}) has been ${isActive ? 'reactivated' : 'deactivated'} by ${session.user.email}`,
          link: `/hr?tab=employees`
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Employee ${isActive ? 'reactivated' : 'deactivated'} successfully`,
      employee: {
        id: updatedEmployee.id,
        name: `${updatedEmployee.firstName || ''} ${updatedEmployee.lastName || ''}`,
        isActive: updatedEmployee.isActive
      }
    });

  } catch (error) {
    console.error('Error updating employee status:', error);
    return NextResponse.json(
      { error: 'Failed to update employee status' },
      { status: 500 }
    );
  }
}

// GET: Get employee deactivation history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is HR, ADMIN, or EXECUTIVE
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    });

    const isHREmployee = user?.role === 'EMPLOYEE' && (user?.department?.toLowerCase() === 'hr' || user?.department?.toLowerCase() === 'human resources');
    
    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get employee details
    const employee = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        isActive: true
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get audit logs for this employee's status changes
    const statusChangeLogs = await prisma.auditLog.findMany({
      where: {
        entityId: params.id,
        entity: 'USER',
        action: {
          in: ['DEACTIVATE_EMPLOYEE', 'REACTIVATE_EMPLOYEE']
        }
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: `${employee.firstName || ''} ${employee.lastName || ''}`,
        employeeId: employee.employeeId,
        isActive: employee.isActive
      },
      history: statusChangeLogs.map(log => ({
        action: log.action,
        timestamp: log.createdAt,
        performedBy: {
          name: `${log.user?.firstName || ''} ${log.user?.lastName || ''}`.trim() || 'Unknown',
          email: log.user?.email || ''
        },
        reason: (log.details as any)?.reason || 'Not specified'
      }))
    });

  } catch (error) {
    console.error('Error fetching employee status history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee status history' },
      { status: 500 }
    );
  }
}