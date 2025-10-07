import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { escalationScheduler } from '@/lib/scheduler/escalation-scheduler';
import { prisma } from '@/lib/prisma';

// GET: Get scheduler status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin/HR
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !['ADMIN', 'HR', 'EXECUTIVE'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const status = escalationScheduler.getStatus();
    
    // Get recent escalation history
    const recentEscalations = await prisma.approval.findMany({
      where: {
        escalatedToId: { not: null },
        escalatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: {
        leaveRequest: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        approver: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        escalatedAt: 'desc'
      },
      take: 10
    });

    return NextResponse.json({
      scheduler: status,
      recentEscalations,
      config: {
        enableInternalScheduler: process.env.ENABLE_INTERNAL_SCHEDULER === 'true',
        cronUrl: process.env.CRON_SECRET ? '/api/cron/escalation' : null
      }
    });
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    return NextResponse.json(
      { error: 'Failed to get scheduler status' },
      { status: 500 }
    );
  }
}

// POST: Control scheduler (start/stop/trigger)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin/HR
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !['ADMIN', 'HR', 'EXECUTIVE'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { action, intervalHours } = await request.json();

    switch (action) {
      case 'start':
        const intervalMs = intervalHours ? intervalHours * 60 * 60 * 1000 : undefined;
        escalationScheduler.start(intervalMs);
        
        // Save configuration
        await prisma.companySetting.upsert({
          where: { key: 'internalSchedulerEnabled' },
          update: { value: 'true' },
          create: {
            key: 'internalSchedulerEnabled',
            value: 'true',
            category: 'scheduler',
            description: 'Internal escalation scheduler enabled'
          }
        });
        
        if (intervalHours) {
          await prisma.companySetting.upsert({
            where: { key: 'schedulerIntervalHours' },
            update: { value: String(intervalHours) },
            create: {
              key: 'schedulerIntervalHours',
              value: String(intervalHours),
              category: 'scheduler',
              description: 'Scheduler interval in hours'
            }
          });
        }
        
        return NextResponse.json({
          message: 'Scheduler started',
          status: escalationScheduler.getStatus()
        });

      case 'stop':
        escalationScheduler.stop();
        
        await prisma.companySetting.upsert({
          where: { key: 'internalSchedulerEnabled' },
          update: { value: 'false' },
          create: {
            key: 'internalSchedulerEnabled',
            value: 'false',
            category: 'scheduler',
            description: 'Internal escalation scheduler enabled'
          }
        });
        
        return NextResponse.json({
          message: 'Scheduler stopped',
          status: escalationScheduler.getStatus()
        });

      case 'trigger':
        await escalationScheduler.triggerManual();
        
        return NextResponse.json({
          message: 'Manual escalation check triggered',
          status: escalationScheduler.getStatus()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use start, stop, or trigger' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error controlling scheduler:', error);
    return NextResponse.json(
      { error: 'Failed to control scheduler' },
      { status: 500 }
    );
  }
}