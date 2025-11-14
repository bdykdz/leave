import { prisma } from '@/lib/prisma'
import { PlanningStage, PlanStatus, PlanPriority } from '@prisma/client'

export class HolidayPlanningService {
  /**
   * Get or create planning window for a specific year
   */
  static async getCurrentPlanningWindow(year: number) {
    let window = await prisma.holidayPlanningWindow.findUnique({
      where: { year },
      include: { holidayPlans: true }
    })

    if (!window) {
      // Create default window for the year
      window = await this.createOrUpdatePlanningWindow(year)
    }

    return window
  }

  /**
   * Create or update planning window
   */
  static async createOrUpdatePlanningWindow(year: number, userId?: string) {
    const now = new Date()
    const currentYear = now.getFullYear()
    
    // Default dates for planning window
    const openDate = new Date(currentYear, 9, 1) // October 1st
    const closeDate = new Date(currentYear, 11, 31) // December 31st
    
    // Simple stage logic: OPEN during Oct-Dec, CLOSED otherwise
    let stage: PlanningStage = PlanningStage.CLOSED
    const currentMonth = now.getMonth()
    
    if (currentMonth >= 9 && currentMonth <= 11) { // October-December
      stage = PlanningStage.DRAFT // Use DRAFT as "OPEN" status
    } else if (currentYear > year || (currentYear === year && currentMonth > 11)) {
      stage = PlanningStage.LOCKED // Past planning windows are locked
    }

    const window = await prisma.holidayPlanningWindow.upsert({
      where: { year },
      update: {
        stage,
        updatedAt: now,
        isActive: stage === PlanningStage.DRAFT
      },
      create: {
        year,
        openDate,
        closeDate,
        stage,
        isActive: stage === PlanningStage.DRAFT,
        createdBy: userId
      },
      include: { holidayPlans: true }
    })

    return window
  }

  /**
   * Update planning stage based on current date
   */
  static async updatePlanningStage() {
    const now = new Date()
    const currentYear = now.getFullYear()
    const nextYear = currentYear + 1
    const currentMonth = now.getMonth()
    
    // Simple logic: Open Oct-Dec, Closed/Locked otherwise
    
    // Lock past year windows
    await prisma.holidayPlanningWindow.updateMany({
      where: {
        year: { lt: nextYear },
        stage: { not: PlanningStage.LOCKED }
      },
      data: { 
        stage: PlanningStage.LOCKED,
        isActive: false
      }
    })
    
    // Update next year window: Open during Oct-Dec, Closed otherwise
    if (currentMonth >= 9 && currentMonth <= 11) { // October-December
      await prisma.holidayPlanningWindow.updateMany({
        where: { year: nextYear },
        data: { 
          stage: PlanningStage.DRAFT, // Use DRAFT as "OPEN"
          isActive: true
        }
      })
    } else {
      await prisma.holidayPlanningWindow.updateMany({
        where: { year: nextYear },
        data: { 
          stage: PlanningStage.CLOSED,
          isActive: false
        }
      })
    }
  }

  /**
   * Get user's holiday plan for a specific year
   */
  static async getUserHolidayPlan(userId: string, year: number) {
    const plan = await prisma.holidayPlan.findUnique({
      where: {
        userId_year: { userId, year }
      },
      include: {
        dates: {
          orderBy: { date: 'asc' }
        },
        window: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true
          }
        }
      }
    })

    return plan
  }

  /**
   * Create or update user's holiday plan
   */
  static async createOrUpdateUserPlan(
    userId: string, 
    year: number, 
    dates: { date: string; priority: PlanPriority; reason?: string; isHalfDay?: boolean }[]
  ) {
    // Get or create planning window
    const window = await this.getCurrentPlanningWindow(year)
    
    if (!window) {
      throw new Error('Planning window not available')
    }

    // Check if planning window allows editing (only block if LOCKED or CLOSED)
    if (window.stage === PlanningStage.LOCKED || window.stage === PlanningStage.CLOSED) {
      throw new Error('Planning window is not active')
    }

    // Get existing plan or create new one
    let plan = await prisma.holidayPlan.findUnique({
      where: { userId_year: { userId, year } },
      include: { dates: true }
    })

    if (!plan) {
      plan = await prisma.holidayPlan.create({
        data: {
          windowId: window.id,
          userId,
          year,
          status: PlanStatus.DRAFT,
          version: 0
        },
        include: { dates: true }
      })
    }

    // Check if plan can be edited (only block if LOCKED)
    if (plan.status === PlanStatus.LOCKED) {
      throw new Error('Plan is locked and cannot be edited')
    }

    // Delete existing dates and create new ones
    await prisma.holidayPlanDate.deleteMany({
      where: { planId: plan.id }
    })

    if (dates.length > 0) {
      await prisma.holidayPlanDate.createMany({
        data: dates.map(date => ({
          planId: plan.id,
          date: new Date(date.date),
          priority: date.priority,
          reason: date.reason,
          isHalfDay: date.isHalfDay || false
        }))
      })
    }

    // Update plan version
    const updatedPlan = await prisma.holidayPlan.update({
      where: { id: plan.id },
      data: {
        version: { increment: 1 },
        updatedAt: new Date()
      },
      include: {
        dates: { orderBy: { date: 'asc' } },
        window: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true
          }
        }
      }
    })

    return updatedPlan
  }

  /**
   * Submit plan for review
   */
  static async submitPlan(userId: string, year: number) {
    const plan = await prisma.holidayPlan.findUnique({
      where: { userId_year: { userId, year } },
      include: { window: true, dates: true }
    })

    if (!plan) {
      throw new Error('Plan not found')
    }

    // Allow submission anytime during Oct-Dec (when window is active)
    if (plan.window.stage === PlanningStage.LOCKED || plan.window.stage === PlanningStage.CLOSED) {
      throw new Error('Planning window is not open for submissions')
    }

    if (plan.status === PlanStatus.LOCKED) {
      throw new Error('Plan is already locked')
    }

    const updatedPlan = await prisma.holidayPlan.update({
      where: { id: plan.id },
      data: {
        status: PlanStatus.SUBMITTED,
        submittedAt: new Date()
      },
      include: {
        dates: { orderBy: { date: 'asc' } },
        window: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true
          }
        }
      }
    })

    return updatedPlan
  }

  /**
   * Get department holiday plans for coverage analysis
   */
  static async getDepartmentPlans(department: string, year: number) {
    const plans = await prisma.user.findMany({
      where: {
        department,
        isActive: true
      },
      include: {
        holidayPlans: {
          where: { year },
          include: {
            dates: {
              orderBy: { date: 'asc' }
            }
          }
        }
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    })

    return plans
  }

  /**
   * Check planning window status
   */
  static isPlanningWindowOpen(): boolean {
    const now = new Date()
    const currentMonth = now.getMonth()
    
    // Planning is open October through December
    return currentMonth >= 9 && currentMonth <= 11
  }

  /**
   * Get planning analytics
   */
  static async getPlannedVsActual(userId: string, year: number) {
    // This is a placeholder for analytics functionality
    // In a real implementation, this would compare planned holidays vs actual leave requests
    const plan = await this.getUserHolidayPlan(userId, year)
    
    if (!plan) {
      return {
        plannedDays: 0,
        actualDays: 0,
        variance: 0,
        details: []
      }
    }

    const plannedDays = plan.dates.reduce((total, date) => {
      return total + (date.isHalfDay ? 0.5 : 1)
    }, 0)

    return {
      plannedDays,
      actualDays: 0, // Would be calculated from actual leave requests
      variance: 0,
      details: plan.dates.map(date => ({
        date: date.date,
        planned: true,
        actual: false, // Would be determined from leave requests
        priority: date.priority
      }))
    }
  }
}