import { NextRequest, NextResponse } from 'next/server';
import { EscalationService } from '@/lib/services/escalation-service';

// This endpoint is designed to be called by external cron services
// Example: Setup a cron job to call this endpoint daily at midnight
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Running escalation check from cron job...');
    
    const escalationService = new EscalationService();
    
    // Initialize settings if they don't exist
    await escalationService.initializeDefaultSettings();
    
    // Check and escalate pending approvals
    await escalationService.checkAndEscalatePendingApprovals();

    return NextResponse.json({ 
      success: true,
      message: 'Escalation check completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cron escalation error:', error);
    return NextResponse.json({ 
      error: 'Failed to run escalation check',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support POST for some cron services
export async function POST(request: NextRequest) {
  return GET(request);
}