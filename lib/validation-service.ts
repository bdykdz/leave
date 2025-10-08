import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, isAfter, isBefore, isWithinInterval, addDays } from 'date-fns';
import { log } from './logger';
import { WorkingDaysService } from './services/working-days-service';

const prisma = new PrismaClient();
const workingDaysService = WorkingDaysService.getInstance();

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export class ValidationService {
  /**
   * Validate leave request dates
   */
  static async validateLeaveRequestDates(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeRequestId?: string
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const now = startOfDay(new Date());
    
    // 1. Check if start date is in the past
    if (isBefore(startOfDay(startDate), now)) {
      errors.push({
        field: 'startDate',
        message: 'Leave start date cannot be in the past',
        code: 'PAST_DATE',
      });
    }
    
    // 2. Check if end date is before start date
    if (isBefore(endDate, startDate)) {
      errors.push({
        field: 'endDate',
        message: 'End date must be after or equal to start date',
        code: 'INVALID_DATE_RANGE',
      });
    }
    
    // 3. Check for maximum consecutive days (e.g., 30 days)
    const maxConsecutiveDays = parseInt(process.env.MAX_CONSECUTIVE_LEAVE_DAYS || '30');
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (daysDiff > maxConsecutiveDays) {
      errors.push({
        field: 'endDate',
        message: `Maximum consecutive leave days is ${maxConsecutiveDays}`,
        code: 'EXCEEDS_MAX_DAYS',
      });
    }
    
    // 4. Check for overlapping leave requests
    const overlapping = await this.checkOverlappingRequests(
      userId,
      startDate,
      endDate,
      excludeRequestId
    );
    
    if (overlapping.length > 0) {
      errors.push({
        field: 'dates',
        message: `You already have leave requests for these dates: ${overlapping.join(', ')}`,
        code: 'OVERLAPPING_REQUESTS',
      });
    }
    
    // 5. Check for blocked dates
    const blockedDates = await this.checkBlockedDates(startDate, endDate);
    if (blockedDates.length > 0) {
      errors.push({
        field: 'dates',
        message: `The following dates are blocked: ${blockedDates.join(', ')}`,
        code: 'BLOCKED_DATES',
      });
    }
    
    // 6. Check for minimum advance notice (e.g., 2 days)
    const minAdvanceDays = parseInt(process.env.MIN_ADVANCE_NOTICE_DAYS || '2');
    const minStartDate = addDays(now, minAdvanceDays);
    if (isBefore(startDate, minStartDate)) {
      errors.push({
        field: 'startDate',
        message: `Leave requests must be submitted at least ${minAdvanceDays} days in advance`,
        code: 'INSUFFICIENT_NOTICE',
      });
    }
    
    return errors;
  }
  
  /**
   * Check for overlapping leave requests
   */
  static async checkOverlappingRequests(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeRequestId?: string
  ): Promise<string[]> {
    const existingRequests = await prisma.leaveRequest.findMany({
      where: {
        userId,
        ...(excludeRequestId && { id: { not: excludeRequestId } }),
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            // New request starts within existing request
            startDate: { lte: startDate },
            endDate: { gte: startDate },
          },
          {
            // New request ends within existing request
            startDate: { lte: endDate },
            endDate: { gte: endDate },
          },
          {
            // New request completely overlaps existing request
            startDate: { gte: startDate },
            endDate: { lte: endDate },
          },
        ],
      },
      select: {
        requestNumber: true,
        startDate: true,
        endDate: true,
      },
    });
    
    return existingRequests.map(req => 
      `${req.requestNumber} (${req.startDate.toLocaleDateString()} - ${req.endDate.toLocaleDateString()})`
    );
  }
  
  /**
   * Check for blocked dates (holidays, company events, etc.)
   */
  static async checkBlockedDates(
    startDate: Date,
    endDate: Date
  ): Promise<string[]> {
    const blockedDates: string[] = [];
    
    // Check for holidays
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        isBlocked: true, // Assuming holidays have a flag for blocked leave
      },
    });
    
    holidays.forEach(holiday => {
      blockedDates.push(`${holiday.date.toLocaleDateString()} (${holiday.name})`);
    });
    
    return blockedDates;
  }
  
  /**
   * Validate substitute availability and check for circular references
   */
  static async validateSubstitute(
    substituteId: string,
    startDate: Date,
    endDate: Date,
    requestingUserId?: string
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Check if substitute is the same as requesting user (self-substitution)
    if (substituteId === requestingUserId) {
      errors.push({
        field: 'substituteId',
        message: 'You cannot be your own substitute',
        code: 'SELF_SUBSTITUTION',
      });
      return errors;
    }
    
    // Check if substitute is on leave during the requested period
    const substituteOnLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId: substituteId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });
    
    if (substituteOnLeave) {
      errors.push({
        field: 'substituteId',
        message: 'Selected substitute is on leave during this period',
        code: 'SUBSTITUTE_UNAVAILABLE',
      });
    }
    
    // Check if substitute is working from home (might be acceptable depending on policy)
    const substituteWFH = await prisma.workFromHomeRequest.findFirst({
      where: {
        userId: substituteId,
        status: { in: ['APPROVED'] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });
    
    if (substituteWFH) {
      // This is a warning, not an error - WFH substitutes might be acceptable
      log.warn('Substitute is working from home during this period', {
        substituteId,
        wfhRequestId: substituteWFH.id
      });
    }
    
    // Check for circular substitution (A substitutes for B while B substitutes for A)
    if (requestingUserId) {
      const circularSubstitution = await prisma.leaveRequest.findFirst({
        where: {
          userId: substituteId,
          substituteId: requestingUserId,
          status: { in: ['PENDING', 'APPROVED'] },
          OR: [
            {
              startDate: { lte: endDate },
              endDate: { gte: startDate },
            },
          ],
        },
      });
      
      if (circularSubstitution) {
        errors.push({
          field: 'substituteId',
          message: 'Circular substitution detected - this person has already selected you as their substitute',
          code: 'CIRCULAR_SUBSTITUTION',
        });
      }
    }
    
    // Check if substitute is inactive
    const substitute = await prisma.user.findUnique({
      where: { id: substituteId },
      select: { isActive: true, firstName: true, lastName: true }
    });
    
    if (!substitute?.isActive) {
      errors.push({
        field: 'substituteId',
        message: 'Selected substitute is no longer active',
        code: 'SUBSTITUTE_INACTIVE',
      });
    }
    
    return errors;
  }
  
  /**
   * Validate multiple substitutes (for complex coverage scenarios)
   */
  static async validateSubstitutes(
    substituteIds: string[],
    startDate: Date,
    endDate: Date,
    requestingUserId?: string
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Check for duplicates
    const uniqueIds = new Set(substituteIds);
    if (uniqueIds.size !== substituteIds.length) {
      errors.push({
        field: 'substituteIds',
        message: 'Duplicate substitutes selected',
        code: 'DUPLICATE_SUBSTITUTES',
      });
    }
    
    // Validate each substitute
    for (const substituteId of substituteIds) {
      const substituteErrors = await this.validateSubstitute(
        substituteId,
        startDate,
        endDate,
        requestingUserId
      );
      errors.push(...substituteErrors);
    }
    
    return errors;
  }
  
  /**
   * Validate approval permissions (prevent self-approval)
   */
  static async validateApprovalPermission(
    approverId: string,
    requesterId: string,
    requestId: string
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Check if approver is the requester (self-approval)
    if (approverId === requesterId) {
      errors.push({
        field: 'approverId',
        message: 'You cannot approve your own leave request',
        code: 'SELF_APPROVAL_NOT_ALLOWED',
      });
      
      log.warn('Self-approval attempt blocked', {
        approverId,
        requesterId,
        requestId,
      });
    }
    
    // Check if approver is in the approval chain
    const approval = await prisma.approval.findFirst({
      where: {
        leaveRequestId: requestId,
        approverId: approverId,
        status: 'PENDING',
      },
    });
    
    if (!approval) {
      errors.push({
        field: 'approverId',
        message: 'You are not authorized to approve this request',
        code: 'NOT_IN_APPROVAL_CHAIN',
      });
    }
    
    return errors;
  }
  
  /**
   * Check for duplicate leave requests
   */
  static async checkDuplicateRequest(
    userId: string,
    startDate: Date,
    endDate: Date,
    leaveTypeId: string
  ): Promise<boolean> {
    const recentRequest = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        leaveTypeId,
        startDate,
        endDate,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Within last 5 minutes
        },
      },
    });
    
    return !!recentRequest;
  }
  
  /**
   * Validate leave balance
   */
  static async validateLeaveBalance(
    userId: string,
    leaveTypeId: string,
    requestedDays: number,
    startDate: Date,
    endDate: Date
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const currentYear = new Date().getFullYear();
    
    // Calculate actual working days
    const actualWorkingDays = await workingDaysService.calculateWorkingDays(startDate, endDate, true);
    
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId,
          year: currentYear,
        },
      },
    });
    
    if (!balance) {
      errors.push({
        field: 'leaveTypeId',
        message: 'Leave balance not found',
        code: 'BALANCE_NOT_FOUND',
      });
      return errors;
    }
    
    // Use actual working days for validation, not the requested days
    if (balance.available < actualWorkingDays) {
      errors.push({
        field: 'totalDays',
        message: `Insufficient leave balance. Available: ${balance.available} days, Required: ${actualWorkingDays} working days`,
        code: 'INSUFFICIENT_BALANCE',
      });
    }
    
    // Strict enforcement - prevent negative balances
    const remainingBalance = balance.available - actualWorkingDays;
    if (remainingBalance < 0) {
      errors.push({
        field: 'totalDays',
        message: `This request would result in a negative balance (${remainingBalance} days)`,
        code: 'NEGATIVE_BALANCE_NOT_ALLOWED',
      });
    }
    
    // Check if user has reached maximum carry forward
    const maxCarryForward = parseInt(process.env.MAX_CARRY_FORWARD_DAYS || '10');
    if (balance.carriedForward >= maxCarryForward) {
      log.info('User has maximum carried forward days', {
        userId,
        carriedForward: balance.carriedForward,
        maxCarryForward,
      });
    }
    
    return errors;
  }
  
  /**
   * Comprehensive leave request validation
   */
  static async validateLeaveRequest(
    userId: string,
    data: {
      leaveTypeId: string;
      startDate: Date;
      endDate: Date;
      totalDays: number;
      substituteIds?: string[];
    },
    excludeRequestId?: string
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Date validations
    const dateErrors = await this.validateLeaveRequestDates(
      userId,
      data.startDate,
      data.endDate,
      excludeRequestId
    );
    errors.push(...dateErrors);
    
    // Balance validation with working days calculation
    const balanceErrors = await this.validateLeaveBalance(
      userId,
      data.leaveTypeId,
      data.totalDays,
      data.startDate,
      data.endDate
    );
    errors.push(...balanceErrors);
    
    // Substitute validation
    if (data.substituteIds && data.substituteIds.length > 0) {
      for (const substituteId of data.substituteIds) {
        const subErrors = await this.validateSubstitute(
          substituteId,
          data.startDate,
          data.endDate
        );
        errors.push(...subErrors);
      }
    }
    
    // Check for duplicate request
    if (!excludeRequestId) {
      const isDuplicate = await this.checkDuplicateRequest(
        userId,
        data.startDate,
        data.endDate,
        data.leaveTypeId
      );
      
      if (isDuplicate) {
        errors.push({
          field: 'request',
          message: 'A similar request was recently submitted. Please check your pending requests.',
          code: 'DUPLICATE_REQUEST',
        });
      }
    }
    
    return errors;
  }
}