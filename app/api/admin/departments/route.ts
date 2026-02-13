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
        isActive: true,
        order: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Since Department doesn't have manager/director fields,
    // we need to count users per department separately
    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const userCount = await prisma.user.count({
          where: { department: dept.name }
        });
        
        return {
          ...dept,
          _count: {
            users: userCount,
            childDepartments: 0 // No parent-child relationship in this schema
          }
        };
      })
    );

    return NextResponse.json(departmentsWithCounts);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

// PUT: Update existing department
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!adminUser || !['ADMIN', 'HR', 'EXECUTIVE'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const data = await request.json();

    if (!data.id) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
    }

    // Check if department exists
    const existing = await prisma.department.findUnique({
      where: { id: data.id }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // If name is being changed, check for duplicates
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.department.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          id: { not: data.id }
        }
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Department with this name already exists' },
          { status: 400 }
        );
      }
    }

    // If code is being changed, check for duplicates
    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.department.findFirst({
        where: {
          code: { equals: data.code, mode: 'insensitive' },
          id: { not: data.id }
        }
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Department with this code already exists' },
          { status: 400 }
        );
      }
    }

    const department = await prisma.department.update({
      where: { id: data.id },
      data: {
        name: data.name || undefined,
        code: data.code || undefined,
        description: data.description !== undefined ? data.description : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
        order: data.order !== undefined ? data.order : undefined,
      }
    });

    return NextResponse.json({
      message: 'Department updated successfully',
      department
    });
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json(
      { error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

// DELETE: Delete department
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!adminUser || !['ADMIN', 'HR', 'EXECUTIVE'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
    }

    // Check if any users are in this department
    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const userCount = await prisma.user.count({
      where: { department: dept.name }
    });

    if (userCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete department with ${userCount} users. Reassign them first.` },
        { status: 400 }
      );
    }

    await prisma.department.delete({ where: { id } });

    return NextResponse.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { error: 'Failed to delete department' },
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

    // Generate a unique code if not provided
    const code = data.code || data.name.toUpperCase().replace(/\s+/g, '_').substring(0, 10);

    // Create department
    const department = await prisma.department.create({
      data: {
        name: data.name,
        description: data.description,
        code: code,
        isActive: data.isActive !== undefined ? data.isActive : true,
        order: data.order || 0
      }
    });

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