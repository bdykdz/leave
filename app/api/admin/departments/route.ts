import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET: List all departments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const departments = await prisma.department.findMany({
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        director: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        parentDepartment: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            users: true,
            childDepartments: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

// POST: Create new department
export async function POST(request: NextRequest) {
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

    // Validate required fields
    if (!data.name) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      );
    }

    // Check if department name already exists
    const existing = await prisma.department.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: 'insensitive'
        }
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Department with this name already exists' },
        { status: 400 }
      );
    }

    // Create department
    const department = await prisma.department.create({
      data: {
        name: data.name,
        description: data.description,
        code: data.code,
        managerId: data.managerId || null,
        directorId: data.directorId || null,
        parentDepartmentId: data.parentDepartmentId || null,
        isActive: data.isActive !== undefined ? data.isActive : true
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        director: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        parentDepartment: true
      }
    });

    // Update users if manager or director roles are assigned
    if (data.managerId) {
      await prisma.user.update({
        where: { id: data.managerId },
        data: { 
          role: 'MANAGER',
          departmentId: department.id
        }
      });
    }

    if (data.directorId) {
      await prisma.user.update({
        where: { id: data.directorId },
        data: { 
          role: 'MANAGER',
          departmentId: department.id
        }
      });
    }

    return NextResponse.json({
      message: 'Department created successfully',
      department
    });
  } catch (error) {
    console.error('Error creating department:', error);
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    );
  }
}