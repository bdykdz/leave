import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { CleanupService } from '@/lib/cleanup-service';
import { log } from '@/lib/logger';

// GET /api/admin/cleanup - Run cleanup manually (admin only)
export async function GET(request: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  
  // Check if user is admin
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Unauthorized - Admin access required' },
      { status: 401 }
    );
  }

  log.info('Starting manual cleanup', { userId: session.user.id });

  // Perform cleanup
  const cleanupResults = await CleanupService.performCleanup();
  const fixResults = await CleanupService.fixInconsistencies();
  const archiveResults = await CleanupService.archiveOldData();

  const results = {
    cleanup: cleanupResults,
    fixes: fixResults,
    archive: archiveResults,
    timestamp: new Date().toISOString(),
  };

  log.info('Cleanup completed', results);

  return NextResponse.json({
    success: true,
    results,
    message: 'Cleanup completed successfully',
  });
  } catch (error) {
    log.error('Cleanup failed:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}

// POST /api/admin/cleanup - Scheduled cleanup (called by cron job)
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const cronSecret = request.headers.get('x-cron-secret');
    
    if (cronSecret !== process.env.CRON_SECRET) {
      log.warn('Invalid cron secret for cleanup');
      return NextResponse.json(
        { error: 'Invalid cron secret' },
        { status: 401 }
      );
    }

    log.info('Starting scheduled cleanup');

    // Perform cleanup
    const cleanupResults = await CleanupService.performCleanup();
    const fixResults = await CleanupService.fixInconsistencies();

    const results: any = {
      cleanup: cleanupResults,
      fixes: fixResults,
      timestamp: new Date().toISOString(),
    };

    // Only archive on Sundays
    if (new Date().getDay() === 0) {
      const archiveResults = await CleanupService.archiveOldData();
      results.archive = archiveResults;
    }

    log.info('Scheduled cleanup completed', results);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    log.error('Scheduled cleanup failed:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}