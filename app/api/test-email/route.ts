import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { emailService } from '@/lib/email-service';

// Test endpoint for email functionality
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow HR and executives to test emails
    if (!['HR', 'EXECUTIVE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { type, email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    let result = false;

    if (type === 'leave-request') {
      // Test leave request notification
      result = await emailService.sendLeaveRequestNotification(email, {
        employeeName: 'Ion Popescu',
        leaveType: 'Concediu de odihnă',
        startDate: '15 octombrie 2025',
        endDate: '20 octombrie 2025',
        days: 6,
        reason: 'Vacanță planificată în familie',
        managerName: 'Maria Ionescu',
        companyName: process.env.COMPANY_NAME || 'Compania noastră',
        requestId: 'test-123'
      });
    } else if (type === 'approval') {
      // Test approval notification
      result = await emailService.sendApprovalNotification(email, {
        employeeName: 'Ion Popescu',
        leaveType: 'Concediu de odihnă',
        startDate: '15 octombrie 2025',
        endDate: '20 octombrie 2025',
        days: 6,
        approverName: 'Maria Ionescu',
        status: 'approved',
        comments: 'Aprobat pentru perioada solicitată',
        companyName: process.env.COMPANY_NAME || 'Compania noastră',
        requestId: 'test-123'
      });
    } else if (type === 'rejection') {
      // Test rejection notification
      result = await emailService.sendApprovalNotification(email, {
        employeeName: 'Ion Popescu',
        leaveType: 'Concediu de odihnă',
        startDate: '15 octombrie 2025',
        endDate: '20 octombrie 2025',
        days: 6,
        approverName: 'Maria Ionescu',
        status: 'rejected',
        comments: 'Perioada solicitată nu este disponibilă',
        companyName: process.env.COMPANY_NAME || 'Compania noastră',
        requestId: 'test-123'
      });
    } else {
      return NextResponse.json({ error: 'Invalid email type' }, { status: 400 });
    }

    if (result) {
      return NextResponse.json({ 
        success: true, 
        message: `Test email sent successfully to ${email}` 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to send test email' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send test email', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check email configuration
export async function GET() {
  try {
    const config = {
      provider: 'Resend',
      apiKey: process.env.RESEND_API_KEY ? 'configured' : 'not configured',
      fromEmail: process.env.RESEND_FROM_EMAIL || 'not configured',
      companyName: process.env.COMPANY_NAME || 'not configured'
    };

    return NextResponse.json({
      configured: !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      config
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check configuration' }, { status: 500 });
  }
}