import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { WFHValidationService } from "@/lib/wfh-validation-service";
import { emailService } from "@/lib/email-service";
import { format } from "date-fns";
import { log } from "@/lib/logger";
import { asyncHandler } from "@/lib/async-handler";

export const POST = asyncHandler(async (
  request: Request,
  { params }: { params: { requestId: string } }
) => {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const comment = body.comment || '';
  const signature = body.signature || null;
  const requestId = params.requestId;
  
  log.info('Processing WFH approval request', { 
    requestId, 
    userId: session.user.id 
  });

  // Get the WFH request
  const wfhRequest = await prisma.workFromHomeRequest.findUnique({
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

  if (!wfhRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Validate approval permission
  const validationErrors = await WFHValidationService.validateWFHApprovalPermission(
    session.user.id,
    wfhRequest.userId,
    requestId
  );
  
  if (validationErrors.length > 0) {
    log.warn('WFH approval validation failed', {
      approverId: session.user.id,
      requesterId: wfhRequest.userId,
      requestId,
      errors: validationErrors
    });
    
    return NextResponse.json(
      { 
        error: validationErrors[0].message,
        code: validationErrors[0].code
      },
      { status: 403 }
    );
  }

  // Get or create approval record
  let approval = wfhRequest.approvals[0];
  if (!approval) {
    approval = await prisma.wFHApproval.create({
      data: {
        wfhRequestId: requestId,
        approverId: session.user.id,
        status: 'PENDING'
      }
    });
  }

  // Update approval
  await prisma.wFHApproval.update({
    where: { id: approval.id },
    data: {
      status: 'APPROVED',
      comments: comment,
      approvedAt: new Date()
    }
  });

  // Update WFH request status
  await prisma.workFromHomeRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED' }
  });

  // Add manager signature if provided
  if (signature) {
    const document = await prisma.wFHDocument.findUnique({
      where: { wfhRequestId: requestId }
    });

    if (document) {
      await prisma.wFHSignature.create({
        data: {
          documentId: document.id,
          signerId: session.user.id,
          signerRole: 'manager',
          signatureData: signature
        }
      });

      // Update document status
      await prisma.wFHDocument.update({
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
      userId: wfhRequest.userId,
      type: 'REQUEST_APPROVED',
      title: 'WFH Request Approved',
      message: `Your WFH request for ${wfhRequest.totalDays} days has been approved`,
      link: `/employee/wfh-requests/${requestId}`
    }
  });

  // Send email to employee
  await emailService.sendWFHApprovalNotification(wfhRequest.user.email, {
    employeeName: `${wfhRequest.user.firstName} ${wfhRequest.user.lastName}`,
    startDate: format(wfhRequest.startDate, 'dd MMMM yyyy'),
    endDate: format(wfhRequest.endDate, 'dd MMMM yyyy'),
    days: wfhRequest.totalDays,
    location: wfhRequest.location,
    approved: true,
    managerName: `${session.user.firstName} ${session.user.lastName}`,
    comments: comment
  });

  log.info('WFH request approved', { requestId });

  return NextResponse.json({
    success: true,
    message: "WFH request approved successfully"
  });
});

// Deny WFH request
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
  
  log.info('Processing WFH denial', { 
    requestId, 
    userId: session.user.id 
  });

  // Get the WFH request
  const wfhRequest = await prisma.workFromHomeRequest.findUnique({
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

  if (!wfhRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Validate permission
  if (wfhRequest.user.managerId !== session.user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Update approval if exists
  const approval = wfhRequest.approvals[0];
  if (approval) {
    await prisma.wFHApproval.update({
      where: { id: approval.id },
      data: {
        status: 'REJECTED',
        comments: comment,
        approvedAt: new Date()
      }
    });
  }

  // Update WFH request status
  await prisma.workFromHomeRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED' }
  });

  // Create notification for employee
  await prisma.notification.create({
    data: {
      userId: wfhRequest.userId,
      type: 'REQUEST_REJECTED',
      title: 'WFH Request Rejected',
      message: `Your WFH request has been rejected. Reason: ${comment}`,
      link: `/employee/wfh-requests/${requestId}`
    }
  });

  // Send email to employee
  await emailService.sendWFHApprovalNotification(wfhRequest.user.email, {
    employeeName: `${wfhRequest.user.firstName} ${wfhRequest.user.lastName}`,
    startDate: format(wfhRequest.startDate, 'dd MMMM yyyy'),
    endDate: format(wfhRequest.endDate, 'dd MMMM yyyy'),
    days: wfhRequest.totalDays,
    location: wfhRequest.location,
    approved: false,
    managerName: `${session.user.firstName} ${session.user.lastName}`,
    comments: comment
  });

  log.info('WFH request rejected', { requestId });

  return NextResponse.json({
    success: true,
    message: "WFH request rejected"
  });
});