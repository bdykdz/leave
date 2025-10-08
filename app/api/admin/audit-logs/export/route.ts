import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';

// GET: Export audit logs as CSV
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

    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build where clause
    const where: any = {};

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Fetch all matching logs
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Create CSV content
    const csvHeaders = [
      'Timestamp',
      'User Name',
      'User Email',
      'Department',
      'Action',
      'Entity Type',
      'Entity ID',
      'IP Address',
      'Details'
    ].join(',');

    const csvRows = logs.map(log => {
      const details = JSON.stringify(log.details || {}).replace(/"/g, '""');
      return [
        format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss'),
        `"${log.user.firstName} ${log.user.lastName}"`,
        log.user.email,
        log.user.department || 'N/A',
        log.action,
        log.entityType,
        log.entityId,
        log.ipAddress || 'N/A',
        `"${details}"`
      ].join(',');
    });

    const csvContent = [csvHeaders, ...csvRows].join('\n');

    // Log the export action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DATA_EXPORT',
        entityType: 'AUDIT_LOGS',
        entityId: 'export',
        details: {
          filters: {
            action,
            entityType,
            dateFrom,
            dateTo
          },
          recordCount: logs.length
        }
      }
    });

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}