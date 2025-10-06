import { PrismaClient } from '@prisma/client';
import { startOfWeek, endOfWeek, isAfter, isBefore, startOfDay, addWeeks } from 'date-fns';
import { log } from './logger';

const prisma = new PrismaClient();

export interface WFHValidationError {
  field: string;
  message: string;
  code: string;
}

export class WFHValidationService {
  /**
   * Validate WFH request dates
   */
  static async validateWFHDates(
    userId: string,
    startDate: Date,
    endDate: Date,
    selectedDates?: Date[],
    excludeRequestId?: string
  ): Promise<WFHValidationError[]> {
    const errors: WFHValidationError[] = [];
    const today = startOfDay(new Date());
    const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Monday as start
    const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
    
    // 1. Check if request is for current week (not allowed)
    if (isBefore(startDate, nextWeekStart)) {
      errors.push({
        field: 'startDate',
        message: 'WFH requests must be made for next week or later. Cannot request for current week.',
        code: 'CURRENT_WEEK_NOT_ALLOWED',
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
    
    // 3. Check for overlapping WFH requests
    const overlapping = await this.checkOverlappingWFHRequests(
      userId,
      startDate,
      endDate,
      excludeRequestId
    );
    
    if (overlapping.length > 0) {
      errors.push({
        field: 'dates',
        message: `You already have WFH requests for these dates: ${overlapping.join(', ')}`,
        code: 'OVERLAPPING_REQUESTS',
      });
    }
    
    // 4. Check if user has leave on the same dates
    const hasLeave = await this.checkLeaveConflict(userId, startDate, endDate, selectedDates);
    if (hasLeave.length > 0) {
      errors.push({
        field: 'dates',
        message: `You have leave requests on these dates: ${hasLeave.join(', ')}`,
        code: 'LEAVE_CONFLICT',
      });
    }
    
    // 5. Check for blocked dates (holidays where WFH is not allowed)
    const blockedDates = await this.checkBlockedDates(startDate, endDate);
    if (blockedDates.length > 0) {
      errors.push({
        field: 'dates',
        message: `WFH not allowed on holidays: ${blockedDates.join(', ')}`,
        code: 'BLOCKED_DATES',
      });
    }
    
    return errors;
  }
  
  /**
   * Check for overlapping WFH requests
   */
  static async checkOverlappingWFHRequests(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeRequestId?: string
  ): Promise<string[]> {
    const existingRequests = await prisma.workFromHomeRequest.findMany({
      where: {
        userId,
        ...(excludeRequestId && { id: { not: excludeRequestId } }),
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: startDate },
            endDate: { gte: startDate },
          },
          {
            startDate: { lte: endDate },
            endDate: { gte: endDate },
          },
          {
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
   * Check for leave conflicts
   */
  static async checkLeaveConflict(
    userId: string,
    startDate: Date,
    endDate: Date,
    selectedDates?: Date[]
  ): Promise<string[]> {
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
      select: {
        requestNumber: true,
        startDate: true,
        endDate: true,
      },
    });
    
    return leaveRequests.map(req => 
      `${req.requestNumber} (${req.startDate.toLocaleDateString()} - ${req.endDate.toLocaleDateString()})`
    );
  }
  
  /**
   * Check for blocked dates (holidays)
   */
  static async checkBlockedDates(
    startDate: Date,
    endDate: Date
  ): Promise<string[]> {
    const blockedDates: string[] = [];
    
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        isBlocked: true,
        isActive: true,
      },
    });
    
    holidays.forEach(holiday => {
      blockedDates.push(`${holiday.date.toLocaleDateString()} (${holiday.nameEn})`);
    });
    
    return blockedDates;
  }
  
  /**
   * Check for duplicate WFH requests
   */
  static async checkDuplicateWFHRequest(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<boolean> {
    const recentRequest = await prisma.workFromHomeRequest.findFirst({
      where: {
        userId,
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
   * Validate location
   */
  static validateLocation(location: string): WFHValidationError[] {
    const errors: WFHValidationError[] = [];
    
    if (!location || location.trim().length === 0) {
      errors.push({
        field: 'location',
        message: 'Location is required',
        code: 'LOCATION_REQUIRED',
      });
    } else if (location.trim().length < 3) {
      errors.push({
        field: 'location',
        message: 'Location must be at least 3 characters',
        code: 'LOCATION_TOO_SHORT',
      });
    } else if (location.trim().length > 100) {
      errors.push({
        field: 'location',
        message: 'Location must be less than 100 characters',
        code: 'LOCATION_TOO_LONG',
      });
    }
    
    return errors;
  }
  
  /**
   * Comprehensive WFH request validation
   */
  static async validateWFHRequest(
    userId: string,
    data: {
      startDate: Date;
      endDate: Date;
      selectedDates?: Date[];
      location: string;
    },
    excludeRequestId?: string
  ): Promise<WFHValidationError[]> {
    const errors: WFHValidationError[] = [];
    
    // Date validations
    const dateErrors = await this.validateWFHDates(
      userId,
      data.startDate,
      data.endDate,
      data.selectedDates,
      excludeRequestId
    );
    errors.push(...dateErrors);
    
    // Location validation
    const locationErrors = this.validateLocation(data.location);
    errors.push(...locationErrors);
    
    // Check for duplicate request
    if (!excludeRequestId) {
      const isDuplicate = await this.checkDuplicateWFHRequest(
        userId,
        data.startDate,
        data.endDate
      );
      
      if (isDuplicate) {
        errors.push({
          field: 'request',
          message: 'A similar WFH request was recently submitted. Please check your pending requests.',
          code: 'DUPLICATE_REQUEST',
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Validate WFH approval permission
   */
  static async validateWFHApprovalPermission(
    approverId: string,
    requesterId: string,
    requestId: string
  ): Promise<WFHValidationError[]> {
    const errors: WFHValidationError[] = [];
    
    // Check if approver is the requester (self-approval)
    if (approverId === requesterId) {
      errors.push({
        field: 'approverId',
        message: 'You cannot approve your own WFH request',
        code: 'SELF_APPROVAL_NOT_ALLOWED',
      });
      
      log.warn('WFH self-approval attempt blocked', {
        approverId,
        requesterId,
        requestId,
      });
    }
    
    // Check if approver is authorized
    const approval = await prisma.wFHApproval.findFirst({
      where: {
        wfhRequestId: requestId,
        approverId: approverId,
        status: 'PENDING',
      },
    });
    
    if (!approval) {
      const wfhRequest = await prisma.workFromHomeRequest.findUnique({
        where: { id: requestId },
        include: { user: true },
      });
      
      // Check if approver is the manager
      if (wfhRequest && wfhRequest.user.managerId !== approverId) {
        errors.push({
          field: 'approverId',
          message: 'You are not authorized to approve this WFH request',
          code: 'NOT_AUTHORIZED',
        });
      }
    }
    
    return errors;
  }
}