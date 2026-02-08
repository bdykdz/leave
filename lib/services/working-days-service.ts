import { prisma } from '@/lib/prisma';
import { addDays, isWeekend, format, eachDayOfInterval, isSameDay } from 'date-fns';

export class WorkingDaysService {
  private static instance: WorkingDaysService;
  private holidaysCache: Map<string, Date[]> = new Map();
  private cacheExpiry: Date = new Date();

  private constructor() {}

  static getInstance(): WorkingDaysService {
    if (!WorkingDaysService.instance) {
      WorkingDaysService.instance = new WorkingDaysService();
    }
    return WorkingDaysService.instance;
  }

  /**
   * Calculate working days between two dates (excluding weekends and public holidays)
   */
  async calculateWorkingDays(
    startDate: Date,
    endDate: Date,
    includeEndDate: boolean = true
  ): Promise<number> {
    // Ensure dates are in correct order
    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }

    // Get all days in the range
    const days = eachDayOfInterval({ 
      start: startDate, 
      end: includeEndDate ? endDate : addDays(endDate, -1) 
    });

    // Get holidays for this period
    const holidays = await this.getHolidaysInRange(startDate, endDate);

    // Count working days
    let workingDays = 0;
    for (const day of days) {
      if (!this.isNonWorkingDay(day, holidays)) {
        workingDays++;
      }
    }

    return workingDays;
  }

  /**
   * Check if a specific date is a working day
   */
  async isWorkingDay(date: Date): Promise<boolean> {
    if (isWeekend(date)) {
      return false;
    }

    const holidays = await this.getHolidaysInRange(date, date);
    return !holidays.some(holiday => isSameDay(holiday, date));
  }

  /**
   * Get the next working day from a given date
   */
  async getNextWorkingDay(date: Date): Promise<Date> {
    let nextDay = addDays(date, 1);
    while (!(await this.isWorkingDay(nextDay))) {
      nextDay = addDays(nextDay, 1);
    }
    return nextDay;
  }

  /**
   * Calculate end date given start date and number of working days
   */
  async calculateEndDate(
    startDate: Date,
    numberOfWorkingDays: number
  ): Promise<Date> {
    if (numberOfWorkingDays <= 0) {
      return startDate;
    }

    let currentDate = new Date(startDate);
    let remainingDays = numberOfWorkingDays;

    // If start date is not a working day, move to next working day
    if (!(await this.isWorkingDay(currentDate))) {
      currentDate = await this.getNextWorkingDay(currentDate);
    }

    remainingDays--; // Count the start date

    while (remainingDays > 0) {
      currentDate = addDays(currentDate, 1);
      if (await this.isWorkingDay(currentDate)) {
        remainingDays--;
      }
    }

    return currentDate;
  }

  /**
   * Check if a date is a non-working day (weekend or holiday)
   */
  private isNonWorkingDay(date: Date, holidays: Date[]): boolean {
    // Check if weekend
    if (isWeekend(date)) {
      return true;
    }

    // Check if holiday
    return holidays.some(holiday => isSameDay(holiday, date));
  }

  /**
   * Get holidays within a date range (with caching)
   */
  private async getHolidaysInRange(startDate: Date, endDate: Date): Promise<Date[]> {
    const cacheKey = `${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}`;
    
    // Check cache
    if (this.cacheExpiry > new Date() && this.holidaysCache.has(cacheKey)) {
      return this.holidaysCache.get(cacheKey)!;
    }

    // Fetch from database
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      select: {
        date: true
      }
    });

    const holidayDates = holidays.map(h => new Date(h.date));
    
    // Cache for 1 hour
    this.holidaysCache.set(cacheKey, holidayDates);
    if (this.cacheExpiry < new Date()) {
      this.cacheExpiry = new Date(Date.now() + 60 * 60 * 1000);
      // Clear old cache entries
      if (this.holidaysCache.size > 100) {
        this.holidaysCache.clear();
      }
    }

    return holidayDates;
  }

  /**
   * Calculate working days for a leave request (with special handling for half days)
   */
  async calculateLeaveDays(
    startDate: Date,
    endDate: Date,
    isHalfDay: boolean = false,
    halfDayPeriod?: 'MORNING' | 'AFTERNOON'
  ): Promise<number> {
    // For half day requests
    if (isHalfDay) {
      // Half day must be a single day
      if (isSameDay(startDate, endDate)) {
        const isWorking = await this.isWorkingDay(startDate);
        return isWorking ? 0.5 : 0;
      } else {
        throw new Error('Half day leave can only be for a single day');
      }
    }

    // For full day requests
    return this.calculateWorkingDays(startDate, endDate, true);
  }

  /**
   * Get working days breakdown for a date range
   */
  async getWorkingDaysBreakdown(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalDays: number;
    workingDays: number;
    weekends: number;
    holidays: number;
    holidayDates: Date[];
  }> {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const holidays = await this.getHolidaysInRange(startDate, endDate);
    
    let weekendCount = 0;
    let holidayCount = 0;
    let workingDayCount = 0;
    const holidayDates: Date[] = [];

    for (const day of days) {
      if (isWeekend(day)) {
        weekendCount++;
      } else if (holidays.some(h => isSameDay(h, day))) {
        holidayCount++;
        holidayDates.push(day);
      } else {
        workingDayCount++;
      }
    }

    return {
      totalDays: days.length,
      workingDays: workingDayCount,
      weekends: weekendCount,
      holidays: holidayCount,
      holidayDates
    };
  }
}