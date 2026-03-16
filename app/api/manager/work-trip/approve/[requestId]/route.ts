import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { emailService } from "@/lib/email-service";
import { format } from "date-fns";
import { log } from "@/lib/logger";
import { asyncHandler } from "@/lib/async-handler";
import { sanitizeComment } from "@/lib/utils/sanitize";

// Format work trip dates for display
function formatWorkTripDates(startDate: Date, endDate: Date, selectedDates?: string[] | null): string {
  if (selectedDates && selectedDates.length > 0) {
    const dates = selectedDates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
    const groups: string[] = [];
    let currentGroup = [dates[0]];

    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];
      const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (dayDiff === 1) {
        currentGroup.push(currDate);
      } else {
        groups.push(formatDateGroup(currentGroup));
        currentGroup = [currDate];
      }
    }
    groups.push(formatDateGroup(currentGroup));

    return groups.join(', ');
  } else {
    const start = format(startDate, 'dd MMMM yyyy');
    const end = format(endDate, 'dd MMMM yyyy');

    if (startDate.toDateString() === endDate.toDateString()) {
      return start;
    }

    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startDate.getDate()}-${endDate.getDate()} ${format(startDate, 'MMMM yyyy')}`;
    }

    return `${start} - ${end}`;
  }
}

function formatDateGroup(dates: Date[]): string {
  if (dates.length === 1) {
    return format(dates[0], 'dd MMMM yyyy');
  } else {
    const first = dates[0].getDate();
    const last = dates[dates.length - 1].getDate();
    const month = format(dates[0], 'MMMM yyyy');
    return `${first}-${last} ${month}`;
  }
}

export const POST = asyncHandler(async (
  request: Request,
  { params }: { params: { requestId: string } }
) => {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const rawComment = body.comment || '';

  let signature = body.signature || null;

  let commentForSanitize = rawComment;
  if (!signature && rawComment.includes('[SIGNATURE:')) {
    const signatureMatch = rawComment.match(/\[SIGNATURE:(data:image\/[^\]]+)\]/);
    if (signatureMatch) {
      signature = signatureMatch[1];
      commentForSanitize = rawComment.replace(/\[SIGNATURE:data:image\/[^\]]+\]/, '').trim();
    }
  }

  if (signature && signature.length > 50000) {
    return NextResponse.json(
      { error: 'Signature data exceeds maximum allowed size' },
      { status: 400 }
    );
  }

  const comment = sanitizeComment(commentForSanitize);

  const requestId = params.requestId;

  log.info('Processing work trip approval request', {
    requestId,
    userId: session.user.id
  });

  const workTripRequest = await prisma.workTripRequest.findUnique({
    where: { id: requestId },
    include: {
      user: true,
      approvals: {
        where: {
          approverId: session.user.id
        }
      }
    }
  });

  if (!workTripRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Validate permission - must be manager of requester or assigned as a pending approver
  const isManager = workTripRequest.user.managerId === session.user.id;
  const isAssignedApprover = workTripRequest.approvals.some(
    a => a.approverId === session.user.id && a.status === 'PENDING'
  );
  if (!isManager && !isAssignedApprover) {
    return NextResponse.json({ error: "Not authorized to approve this request" }, { status: 403 });
  }

  // Cannot approve own request
  if (workTripRequest.userId === session.user.id) {
    return NextResponse.json({ error: "Cannot approve your own request" }, { status: 403 });
  }

  // Get or create approval record
  let approval = workTripRequest.approvals[0];
  if (!approval) {
    approval = await prisma.workTripApproval.create({
      data: {
        workTripRequestId: requestId,
        approverId: session.user.id,
        status: 'PENDING'
      }
    });
  }

  // Update approval
  await prisma.workTripApproval.update({
    where: { id: approval.id },
    data: {
      status: 'APPROVED',
      comments: comment,
      approvedAt: new Date()
    }
  });

  // Update work trip request status
  await prisma.workTripRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED' }
  });

  // Add manager signature if provided
  if (signature) {
    const document = await prisma.workTripDocument.findUnique({
      where: { workTripRequestId: requestId }
    });

    if (document) {
      await prisma.workTripSignature.create({
        data: {
          documentId: document.id,
          signerId: session.user.id,
          signerRole: 'manager',
          signatureData: signature
        }
      });

      await prisma.workTripDocument.update({
        where: { id: document.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
    }
  }

  // Create notification for employee
  await prisma.notification.create({
    data: {
      userId: workTripRequest.userId,
      type: 'LEAVE_APPROVED',
      title: 'Work Trip Request Approved',
      message: `Your work trip request to ${workTripRequest.destination} for ${workTripRequest.totalDays} days has been approved`,
      link: `/employee?request=${requestId}`
    }
  });

  // Send email to employee
  try {
    const formattedDates = formatWorkTripDates(workTripRequest.startDate, workTripRequest.endDate, workTripRequest.selectedDates as string[] | null);

    await emailService.sendWorkTripApprovalNotification(workTripRequest.user.email, {
      employeeName: `${workTripRequest.user.firstName || ''} ${workTripRequest.user.lastName || ''}`.trim(),
      startDate: formattedDates,
      endDate: '',
      days: workTripRequest.totalDays,
      destination: workTripRequest.destination,
      purpose: workTripRequest.purpose,
      approved: true,
      managerName: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim(),
      comments: comment
    });
  } catch (emailError) {
    console.error('Error sending work trip approval email:', emailError);
  }

  log.info('Work trip request approved', { requestId });

  return NextResponse.json({
    success: true,
    message: "Work trip request approved successfully"
  });
});

// Deny work trip request
export const DELETE = asyncHandler(async (
  request: Request,
  { params }: { params: { requestId: string } }
) => {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const comment = body.comment || '';
  const requestId = params.requestId;

  log.info('Processing work trip denial', {
    requestId,
    userId: session.user.id
  });

  const workTripRequest = await prisma.workTripRequest.findUnique({
    where: { id: requestId },
    include: {
      user: true,
      approvals: {
        where: {
          approverId: session.user.id
        }
      }
    }
  });

  if (!workTripRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (workTripRequest.user.managerId !== session.user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const approval = workTripRequest.approvals[0];
  if (approval) {
    await prisma.workTripApproval.update({
      where: { id: approval.id },
      data: {
        status: 'REJECTED',
        comments: comment,
        approvedAt: new Date()
      }
    });
  }

  await prisma.workTripRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED' }
  });

  // Create notification for employee
  await prisma.notification.create({
    data: {
      userId: workTripRequest.userId,
      type: 'WORK_TRIP_CANCELLED',
      title: 'Work Trip Request Rejected',
      message: `Your work trip request to ${workTripRequest.destination} has been rejected. Reason: ${comment}`,
      link: `/employee?request=${requestId}`
    }
  });

  // Send email to employee
  try {
    const formattedDates = formatWorkTripDates(workTripRequest.startDate, workTripRequest.endDate, workTripRequest.selectedDates as string[] | null);

    await emailService.sendWorkTripApprovalNotification(workTripRequest.user.email, {
      employeeName: `${workTripRequest.user.firstName || ''} ${workTripRequest.user.lastName || ''}`.trim(),
      startDate: formattedDates,
      endDate: '',
      days: workTripRequest.totalDays,
      destination: workTripRequest.destination,
      purpose: workTripRequest.purpose,
      approved: false,
      managerName: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim(),
      comments: comment
    });
  } catch (emailError) {
    console.error('Error sending work trip rejection email:', emailError);
  }

  log.info('Work trip request rejected', { requestId });

  return NextResponse.json({
    success: true,
    message: "Work trip request rejected"
  });
});
