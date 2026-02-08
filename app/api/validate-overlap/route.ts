import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      userId, 
      startDate, 
      endDate, 
      requestType, // 'LEAVE' or 'WFH'
      excludeRequestId // for editing existing requests
    } = await request.json();

    const start = new Date(startDate);
    const end = new Date(endDate);
    const targetUserId = userId || session.user.id;

    // Check for overlapping leave requests
    const overlappingLeave = await prisma.leaveRequest.findMany({
      where: {
        userId: targetUserId,
        id: excludeRequestId ? { not: excludeRequestId } : undefined,
        status: { in: ['APPROVED', 'PENDING'] },
        OR: [
          {
            // New request starts within existing request
            startDate: { lte: start },
            endDate: { gte: start }
          },
          {
            // New request ends within existing request
            startDate: { lte: end },
            endDate: { gte: end }
          },
          {
            // New request completely covers existing request
            startDate: { gte: start },
            endDate: { lte: end }
          }
        ]
      },
      include: {
        leaveType: true
      }
    });

    // Check for overlapping WFH requests
    const overlappingWFH = await prisma.workFromHomeRequest.findMany({
      where: {
        userId: targetUserId,
        id: excludeRequestId ? { not: excludeRequestId } : undefined,
        status: { in: ['APPROVED', 'PENDING'] },
        OR: [
          {
            // New request starts within existing request
            startDate: { lte: start },
            endDate: { gte: start }
          },
          {
            // New request ends within existing request
            startDate: { lte: end },
            endDate: { gte: end }
          },
          {
            // New request completely covers existing request
            startDate: { gte: start },
            endDate: { lte: end }
          }
        ]
      }
    });

    // Prepare response
    const hasOverlap = overlappingLeave.length > 0 || overlappingWFH.length > 0;
    const conflicts = [];

    // Add leave conflicts
    for (const leave of overlappingLeave) {
      conflicts.push({
        type: 'LEAVE',
        requestNumber: leave.requestNumber,
        leaveType: leave.leaveType.name,
        startDate: leave.startDate,
        endDate: leave.endDate,
        status: leave.status,
        reason: leave.reason,
        message: `You have a ${leave.status.toLowerCase()} ${leave.leaveType.name} request from ${leave.startDate.toLocaleDateString()} to ${leave.endDate.toLocaleDateString()}`
      });
    }

    // Add WFH conflicts
    for (const wfh of overlappingWFH) {
      conflicts.push({
        type: 'WFH',
        requestNumber: wfh.requestNumber,
        startDate: wfh.startDate,
        endDate: wfh.endDate,
        status: wfh.status,
        reason: wfh.reason,
        location: wfh.location,
        message: `You have a ${wfh.status.toLowerCase()} work from home request from ${wfh.startDate.toLocaleDateString()} to ${wfh.endDate.toLocaleDateString()}`
      });
    }

    // Special validation: Cannot have leave and WFH on same days
    const criticalConflict = requestType === 'LEAVE' 
      ? overlappingWFH.length > 0 
      : overlappingLeave.length > 0;

    if (criticalConflict) {
      return NextResponse.json({
        hasOverlap: true,
        conflicts,
        critical: true,
        message: requestType === 'LEAVE' 
          ? 'You cannot request leave when you already have a work from home request for these dates. Please cancel the WFH request first.'
          : 'You cannot request work from home when you are already on leave for these dates. Please cancel the leave request first.'
      });
    }

    if (hasOverlap) {
      return NextResponse.json({
        hasOverlap: true,
        conflicts,
        critical: false,
        message: `You already have ${requestType === 'LEAVE' ? 'another leave' : 'another work from home'} request for these dates. Please choose different dates or cancel the existing request.`
      });
    }

    return NextResponse.json({
      hasOverlap: false,
      conflicts: [],
      message: 'No conflicts found'
    });

  } catch (error) {
    console.error('Error validating overlap:', error);
    return NextResponse.json(
      { error: 'Failed to validate overlap' },
      { status: 500 }
    );
  }
}