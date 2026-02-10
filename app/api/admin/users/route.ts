import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email-service';
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
        phoneNumber: true, // Changed from phone
        employeeId: true,
        position: true, // Changed from jobTitle
        role: true,
        isActive: true,
        joiningDate: true, // Changed from joinDate
        department: true, // This is a string field, not a relation
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

    return NextResponse.json({ users });
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

    // Generate employee ID if not provided
    const employeeId = data.employeeId || `EMP${Date.now().toString().slice(-6)}`;

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: hashedPassword,
        phoneNumber: data.phoneNumber || '',
        employeeId: employeeId,
        position: data.position || 'Employee',
        department: data.department || 'General',
        role: data.role || 'EMPLOYEE',
        managerId: (data.managerId === 'none' || !data.managerId) ? null : data.managerId,
        departmentDirectorId: (data.departmentDirectorId === 'none' || !data.departmentDirectorId) ? null : data.departmentDirectorId,
        isActive: data.isActive !== undefined ? data.isActive : true,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date()
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        position: true,
        department: true,
        role: true,
        isActive: true,
        joiningDate: true,
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
          entitled: leaveType.daysAllowed || 0,
          available: leaveType.daysAllowed || 0,
          used: 0,
          carriedForward: 0
        }
      });
    }

    // Send welcome email to the new user
    try {
      const companyName = process.env.COMPANY_NAME || 'TPF';
      const loginUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      
      await emailService.sendNewUserWelcomeEmail(newUser.email, {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        employeeId: newUser.employeeId,
        position: newUser.position,
        department: newUser.department,
        temporaryPassword: data.password ? undefined : password, // Only include if we generated it
        managerName: newUser.manager ? `${newUser.manager.firstName} ${newUser.manager.lastName}` : undefined,
        companyName: companyName,
        loginUrl: loginUrl
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the user creation if email fails
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