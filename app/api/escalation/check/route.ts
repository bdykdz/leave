import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { EscalationService } from '@/lib/services/escalation-service';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only HR and ADMIN can manually trigger escalation
    if (!['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const escalationService = new EscalationService();
    await escalationService.checkAndEscalatePendingApprovals();

    return NextResponse.json({ 
      success: true,
      message: 'Escalation check completed successfully'
    });
  } catch (error) {
    console.error('Error checking escalations:', error);
    return NextResponse.json({ 
      error: 'Failed to check escalations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}