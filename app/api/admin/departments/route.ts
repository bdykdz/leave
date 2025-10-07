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
      select: {
        id: true,
        name: true,
        description: true,
        code: true,
        managerId: true,
        directorId: true,
        parentDepartmentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
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
    
    // Fetch manager and director details separately if needed
    const departmentsWithDetails = await Promise.all(
      departments.map(async (dept) => {
        let manager = null;
        let director = null;
        
        if (dept.managerId) {
          manager = await prisma.user.findUnique({
            where: { id: dept.managerId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          });
        }
        
        if (dept.directorId) {
          director = await prisma.user.findUnique({
            where: { id: dept.directorId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          });
        }
        
        return {
          ...dept,
          manager,
          director
        };
      })
    );

    return NextResponse.json(departmentsWithDetails);
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