import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET: List all users
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin/HR/MANAGER - more permissive for viewing
    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!adminUser || !['ADMIN', 'HR', 'EXECUTIVE', 'MANAGER'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        employeeId: true,
        jobTitle: true,
        role: true,
        isActive: true,
        joinDate: true,
        departmentId: true,
        managerId: true,
        departmentDirectorId: true,
        createdAt: true,
        updatedAt: true,
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
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });

    // Fetch department details for each user
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true
      }
    });
    
    const departmentMap = new Map(departments.map(d => [d.id, d.name]));
    
    const usersWithDepartment = users.map(user => ({
      ...user,
      department: user.departmentId ? departmentMap.get(user.departmentId) || null : null
    }));

    return NextResponse.json({ users: usersWithDepartment });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST: Create new user
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
      return NextResponse.json({ error: 'Not authorized to create users' }, { status: 403 });
    }

    const data = await request.json();

    // Validate required fields
    if (!data.email || !data.firstName || !data.lastName) {
      return NextResponse.json(
        { error: 'Email, first name, and last name are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Generate a default password if not provided
    const password = data.password || `${data.firstName.toLowerCase()}${Math.floor(Math.random() * 10000)}`;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: hashedPassword,
        phone: data.phone,
        employeeId: data.employeeId,
        jobTitle: data.jobTitle,
        role: data.role || 'EMPLOYEE',
        departmentId: data.departmentId || null,
        managerId: data.managerId || null,
        departmentDirectorId: data.departmentDirectorId || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        joinDate: data.joinDate ? new Date(data.joinDate) : new Date()
      },
      include: {
        department: true,
        manager: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        departmentDirector: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Create default leave balances for the new user
    const currentYear = new Date().getFullYear();
    const leaveTypes = await prisma.leaveType.findMany();
    
    for (const leaveType of leaveTypes) {
      await prisma.leaveBalance.create({
        data: {
          userId: newUser.id,
          leaveTypeId: leaveType.id,
          year: currentYear,
          entitled: leaveType.defaultDays || 0,
          available: leaveType.defaultDays || 0,
          used: 0,
          carriedForward: 0
        }
      });
    }

    return NextResponse.json({
      message: 'User created successfully',
      user: newUser,
      temporaryPassword: data.password ? undefined : password // Only return if we generated it
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}