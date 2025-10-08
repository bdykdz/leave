import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { canModifySystemSettings } from '@/lib/auth-helpers';

// GET: Fetch escalation settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !canModifySystemSettings(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Fetch settings from database or return defaults
    const settings = await prisma.companySetting.findFirst({
      where: { key: 'ESCALATION_SETTINGS' }
    });

    // If no settings exist, return default configuration
    const defaultSettings = {
      enabled: true,
      escalationTimeout: 48,
      maxEscalationLevels: 3,
      autoApproveAfterMaxEscalations: true,
      sendEmailNotifications: true,
      sendReminderBeforeEscalation: true,
      reminderTime: 24,
      skipAbsentApprovers: true,
      skipIfDelegated: true,
      defaultManagerChain: ['MANAGER', 'DEPARTMENT_DIRECTOR', 'HR'],
      defaultHRChain: ['HR', 'EXECUTIVE'],
      defaultExecutiveChain: ['EXECUTIVE']
    };

    return NextResponse.json({ 
      settings: settings?.value || defaultSettings 
    });
  } catch (error) {
    console.error('Error fetching escalation settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch escalation settings' },
      { status: 500 }
    );
  }
}

// PUT: Update escalation settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !canModifySystemSettings(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const settings = await request.json();

    // Validate settings
    if (settings.escalationTimeout < 1 || settings.escalationTimeout > 168) {
      return NextResponse.json(
        { error: 'Escalation timeout must be between 1 and 168 hours' },
        { status: 400 }
      );
    }

    if (settings.maxEscalationLevels < 1 || settings.maxEscalationLevels > 5) {
      return NextResponse.json(
        { error: 'Max escalation levels must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Upsert settings
    const savedSettings = await prisma.companySetting.upsert({
      where: { key: 'ESCALATION_SETTINGS' },
      update: {
        value: settings,
        updatedAt: new Date()
      },
      create: {
        key: 'ESCALATION_SETTINGS',
        value: settings,
        description: 'Automatic approval escalation rules and timeouts'
      }
    });

    // Log the change
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_ESCALATION_SETTINGS',
        entityType: 'ESCALATION_SETTINGS',
        entityId: 'default',
        details: {
          changes: settings
        }
      }
    });

    return NextResponse.json({ 
      message: 'Escalation settings updated successfully',
      settings: savedSettings.value
    });
  } catch (error) {
    console.error('Error updating escalation settings:', error);
    return NextResponse.json(
      { error: 'Failed to update escalation settings' },
      { status: 500 }
    );
  }
}