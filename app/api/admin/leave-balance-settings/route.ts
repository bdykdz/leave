import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { LeaveBalanceService } from '@/lib/services/leave-balance-service';
import { canModifySystemSettings } from '@/lib/auth-helpers';

// GET: Fetch leave balance settings
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
    const settings = await prisma.companySetting.findUnique({
      where: { key: 'LEAVE_BALANCE_CONFIG' }
    });

    // Default configuration
    const defaultSettings = {
      excludeWeekends: true,
      excludePublicHolidays: true,
      proRateEnabled: true,
      proRateMethod: 'DAYS_REMAINING',
      carryForwardEnabled: true,
      maxCarryForwardDays: 10,
      carryForwardExpiryMonths: 3,
      autoExpireCarryForward: true,
      allowNegativeBalance: false,
      maxNegativeBalanceDays: 0,
      requireApprovalForNegative: true,
      yearEndProcessingAuto: true,
      yearEndProcessingDate: '12-31',
      notifyUsersBeforeYearEnd: true,
      notificationDaysBefore: 30
    };

    return NextResponse.json({ 
      settings: settings?.value || defaultSettings 
    });
  } catch (error) {
    console.error('Error fetching leave balance settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT: Update leave balance settings
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
    if (settings.maxCarryForwardDays < 0 || settings.maxCarryForwardDays > 30) {
      return NextResponse.json(
        { error: 'Max carry forward days must be between 0 and 30' },
        { status: 400 }
      );
    }

    if (settings.carryForwardExpiryMonths < 1 || settings.carryForwardExpiryMonths > 12) {
      return NextResponse.json(
        { error: 'Carry forward expiry must be between 1 and 12 months' },
        { status: 400 }
      );
    }

    // Upsert settings
    await prisma.companySetting.upsert({
      where: { key: 'LEAVE_BALANCE_CONFIG' },
      update: {
        value: settings,
        updatedBy: session.user.id
      },
      create: {
        key: 'LEAVE_BALANCE_CONFIG',
        value: settings,
        category: 'leave',
        description: 'Leave balance calculation and carry-forward configuration',
        updatedBy: session.user.id
      }
    });

    // Update the service configuration
    const balanceService = LeaveBalanceService.getInstance();
    balanceService.updateConfig({
      carryForwardEnabled: settings.carryForwardEnabled,
      maxCarryForwardDays: settings.maxCarryForwardDays,
      carryForwardExpiryMonths: settings.carryForwardExpiryMonths,
      proRateEnabled: settings.proRateEnabled
    });

    // Log the change
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SETTINGS_UPDATE',
        entityType: 'LEAVE_BALANCE_SETTINGS',
        entityId: 'CONFIG',
        details: {
          changes: settings
        }
      }
    });

    return NextResponse.json({ 
      message: 'Leave balance settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Error updating leave balance settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}