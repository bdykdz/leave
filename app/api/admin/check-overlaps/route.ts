import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      }
    });

    const overlaps = [];

    // Build a set of actual dates for a request using selectedDates when available
    function getActualDates(req: { startDate: Date; endDate: Date; selectedDates?: any }): Set<string> {
      const dates = new Set<string>();
      if (req.selectedDates && Array.isArray(req.selectedDates) && req.selectedDates.length > 0) {
        for (const d of req.selectedDates) {
          dates.add(d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0]);
        }
      } else {
        const cursor = new Date(req.startDate);
        const end = new Date(req.endDate);
        while (cursor <= end) {
          dates.add(cursor.toISOString().split('T')[0]);
          cursor.setDate(cursor.getDate() + 1);
        }
      }
      return dates;
    }

    // Check if two date sets have any common dates
    function hasDateOverlap(dates1: Set<string>, dates2: Set<string>): boolean {
      for (const d of dates1) {
        if (dates2.has(d)) return true;
      }
      return false;
    }

    for (const user of users) {
      // Get all approved/pending leave requests for this user
      const leaveRequests = await prisma.leaveRequest.findMany({
        where: {
          userId: user.id,
          status: { in: ['APPROVED', 'PENDING'] }
        },
        orderBy: { startDate: 'asc' }
      });

      // Get all approved/pending WFH requests for this user
      const wfhRequests = await prisma.workFromHomeRequest.findMany({
        where: {
          userId: user.id,
          status: { in: ['APPROVED', 'PENDING'] }
        },
        orderBy: { startDate: 'asc' }
      });

      // Check for leave-to-leave overlaps
      for (let i = 0; i < leaveRequests.length; i++) {
        for (let j = i + 1; j < leaveRequests.length; j++) {
          const req1 = leaveRequests[i];
          const req2 = leaveRequests[j];

          if (hasDateOverlap(getActualDates(req1), getActualDates(req2))) {
            overlaps.push({
              type: 'LEAVE_LEAVE',
              user: {
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email
              },
              request1: {
                id: req1.id,
                requestNumber: req1.requestNumber,
                startDate: req1.startDate,
                endDate: req1.endDate,
                status: req1.status,
                type: 'LEAVE'
              },
              request2: {
                id: req2.id,
                requestNumber: req2.requestNumber,
                startDate: req2.startDate,
                endDate: req2.endDate,
                status: req2.status,
                type: 'LEAVE'
              }
            });
          }
        }
      }

      // Check for WFH-to-WFH overlaps
      for (let i = 0; i < wfhRequests.length; i++) {
        for (let j = i + 1; j < wfhRequests.length; j++) {
          const req1 = wfhRequests[i];
          const req2 = wfhRequests[j];

          if (hasDateOverlap(getActualDates(req1), getActualDates(req2))) {
            overlaps.push({
              type: 'WFH_WFH',
              user: {
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email
              },
              request1: {
                id: req1.id,
                requestNumber: req1.requestNumber,
                startDate: req1.startDate,
                endDate: req1.endDate,
                status: req1.status,
                type: 'WFH'
              },
              request2: {
                id: req2.id,
                requestNumber: req2.requestNumber,
                startDate: req2.startDate,
                endDate: req2.endDate,
                status: req2.status,
                type: 'WFH'
              }
            });
          }
        }
      }

      // Check for leave-to-WFH overlaps (most critical)
      for (const leaveReq of leaveRequests) {
        for (const wfhReq of wfhRequests) {
          if (hasDateOverlap(getActualDates(leaveReq), getActualDates(wfhReq))) {
            overlaps.push({
              type: 'LEAVE_WFH',
              user: {
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email
              },
              request1: {
                id: leaveReq.id,
                requestNumber: leaveReq.requestNumber,
                startDate: leaveReq.startDate,
                endDate: leaveReq.endDate,
                status: leaveReq.status,
                type: 'LEAVE'
              },
              request2: {
                id: wfhReq.id,
                requestNumber: wfhReq.requestNumber,
                startDate: wfhReq.startDate,
                endDate: wfhReq.endDate,
                status: wfhReq.status,
                type: 'WFH'
              }
            });
          }
        }
      }
    }

    // Group overlaps by type for summary
    const summary = {
      total: overlaps.length,
      leaveToLeave: overlaps.filter(o => o.type === 'LEAVE_LEAVE').length,
      wfhToWfh: overlaps.filter(o => o.type === 'WFH_WFH').length,
      leaveToWfh: overlaps.filter(o => o.type === 'LEAVE_WFH').length,
      affectedUsers: [...new Set(overlaps.map(o => o.user.id))].length
    };

    return NextResponse.json({
      summary,
      overlaps
    });
  } catch (error) {
    console.error('Error checking overlaps:', error);
    return NextResponse.json(
      { error: 'Failed to check overlaps' },
      { status: 500 }
    );
  }
}