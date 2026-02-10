import { prisma } from '@/lib/prisma'
import { PlanningStage, PlanStatus, PlanPriority } from '@prisma/client'
import { emailService, HolidayPlanSubmissionEmailData } from '@/lib/email-service'
import { format } from 'date-fns'
import { AuditService, AuditContext } from './audit-service'

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

    // Debug logging
    console.log('getUserHolidayPlan - userId:', userId, 'year:', year)
    console.log('Found plan:', plan ? 'YES' : 'NO')
    if (plan) {
      console.log('Plan has dates:', plan.dates?.length || 0)
      console.log('Raw dates:', plan.dates)
    }

    // Ensure dates are properly serialized
    if (plan && plan.dates) {
      const serializedPlan = {
        ...plan,
        dates: plan.dates.map(date => ({
          ...date,
          date: date.date.toISOString()
        }))
      }
      console.log('Serialized plan dates:', serializedPlan.dates)
      return serializedPlan
    }

    return plan
  }

  /**
   * Create or update user's holiday plan
   */
  static async createOrUpdateUserPlan(
    userId: string, 
    year: number, 
    dates: { date: string; priority: PlanPriority; reason?: string }[],
    auditContext?: AuditContext
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

    // Check if plan can be edited (only block if LOCKED or FINALIZED)
    if (plan.status === PlanStatus.LOCKED) {
      throw new Error('Plan is locked and cannot be edited')
    }
    if (plan.status === PlanStatus.FINALIZED) {
      throw new Error('Plan has been finalized and cannot be edited')
    }
    // Allow editing DRAFT, SUBMITTED, and REVIEWED plans

    // Validate 30-day limit
    if (dates.length > 30) {
      throw new Error('Cannot exceed 30 holiday days per year')
    }

    // Use transaction to ensure atomic updates
    const updatedPlan = await prisma.$transaction(async (tx) => {
      // Delete existing dates
      await tx.holidayPlanDate.deleteMany({
        where: { planId: plan.id }
      })

      // Create new dates if any
      if (dates.length > 0) {
        await tx.holidayPlanDate.createMany({
          data: dates.map(date => ({
            planId: plan.id,
            date: new Date(date.date),
            priority: date.priority,
            reason: date.reason
          }))
        })
      }

      // Update plan version atomically
      return await tx.holidayPlan.update({
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
    })

    // Log audit trail
    await AuditService.logHolidayPlan({
      action: plan ? 'UPDATED' : 'CREATED',
      planId: updatedPlan.id,
      userId,
      oldPlan: plan ? { dates: plan.dates, version: plan.version } : null,
      newPlan: { dates: updatedPlan.dates, version: updatedPlan.version },
      context: auditContext
    })

    return updatedPlan
  }

  /**
   * Submit plan for review
   */
  static async submitPlan(userId: string, year: number, auditContext?: AuditContext) {
    // Get or create planning window first
    const window = await this.getCurrentPlanningWindow(year)
    
    if (!window) {
      throw new Error('Planning window not available')
    }

    // Check if planning window allows submission
    if (window.stage === PlanningStage.LOCKED || window.stage === PlanningStage.CLOSED) {
      throw new Error('Planning window is not open for submissions')
    }

    // Try to find existing plan or create empty one
    let plan = await prisma.holidayPlan.findUnique({
      where: { userId_year: { userId, year } },
      include: { 
        window: true, 
        dates: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            managerId: true,
            departmentDirectorId: true
          }
        }
      }
    })

    // If no plan exists, create an empty one
    if (!plan) {
      plan = await prisma.holidayPlan.create({
        data: {
          windowId: window.id,
          userId,
          year,
          status: PlanStatus.DRAFT,
          version: 0
        },
        include: { 
          window: true, 
          dates: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              managerId: true,
              departmentDirectorId: true
            }
          }
        }
      })
    }

    // Check if plan can be submitted
    if (plan.status === PlanStatus.LOCKED) {
      throw new Error('Plan is already locked')
    }
    
    // Allow resubmission if already submitted (updates the submittedAt timestamp)

    // Use atomic update with where condition to prevent race conditions
    const updatedPlan = await prisma.holidayPlan.update({
      where: { 
        id: plan.id,
        status: {
          in: [PlanStatus.DRAFT, PlanStatus.SUBMITTED] // Allow updating DRAFT or SUBMITTED plans
        }
      },
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
            department: true,
            managerId: true,
            departmentDirectorId: true
          }
        }
      }
    })

    // Log audit trail
    await AuditService.logHolidayPlan({
      action: 'SUBMITTED',
      planId: updatedPlan.id,
      userId,
      oldPlan: plan,
      newPlan: updatedPlan,
      context: auditContext
    })

    // Send email notifications to manager and department director
    const emailResult = await this.sendSubmissionNotifications(updatedPlan)
    
    // Add email status to the response (optional - for debugging)
    if (!emailResult.success) {
      console.warn('Holiday plan submitted but email notifications failed:', emailResult.error)
    }

    return updatedPlan
  }

  /**
   * Send email notifications when a holiday plan is submitted
   */
  static async sendSubmissionNotifications(plan: any): Promise<{ success: boolean; error?: string }> {
    try {
      const employeeName = `${plan.user.firstName} ${plan.user.lastName}`
      const totalDays = plan.dates.length
      const submissionDate = format(plan.submittedAt, 'MMMM d, yyyy')
      const companyName = process.env.COMPANY_NAME || 'TPF'

      // Prepare notification data
      const notificationData: HolidayPlanSubmissionEmailData = {
        employeeName,
        managerName: '', // Will be set below
        year: plan.year,
        totalDays,
        submissionDate,
        companyName,
        planId: plan.id
      }

      const promises: Promise<boolean>[] = []

      // Send to direct manager only
      if (plan.user.managerId) {
        const manager = await prisma.user.findUnique({
          where: { id: plan.user.managerId },
          select: { firstName: true, lastName: true, email: true }
        })

        if (manager) {
          const managerNotificationData = {
            ...notificationData,
            managerName: `${manager.firstName} ${manager.lastName}`
          }
          promises.push(
            emailService.sendHolidayPlanSubmissionNotification(manager.email, managerNotificationData)
          )
        }
      }

      // Wait for all emails to be sent
      if (promises.length > 0) {
        const results = await Promise.all(promises)
        const successCount = results.filter(Boolean).length
        console.log(`Holiday plan submission notifications: ${successCount}/${promises.length} sent successfully`)
        return { success: successCount > 0 }
      } else {
        console.log('No managers found to notify for holiday plan submission')
        return { success: false, error: 'No managers configured' }
      }

    } catch (error) {
      console.error('Error sending holiday plan submission notifications:', error)
      // Don't throw error to prevent blocking the submission process
      return { success: false, error: error instanceof Error ? error.message : 'Email sending failed' }
    }
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
   * Detect holiday plan overlaps and gaps for a team/department
   */
  static async detectOverlapsAndGaps(managerId: string, year: number, isDepartmentDirector: boolean = false) {
    try {
      let teamMembers = []
      
      if (isDepartmentDirector) {
        // Get all users where this director is the departmentDirectorId (handles multi-department)
        teamMembers = await prisma.user.findMany({
          where: {
            departmentDirectorId: managerId,
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
          }
        })
      } else {
        // Get direct reports only
        teamMembers = await prisma.user.findMany({
          where: {
            managerId,
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
          }
        })
      }

      // Create a map of all planned holiday dates
      const dateMap: { [key: string]: Array<{ user: any; priority: string; reason?: string }> } = {}
      
      teamMembers.forEach(member => {
        if (member.holidayPlans.length > 0) {
          const plan = member.holidayPlans[0]
          plan.dates.forEach(date => {
            const dateKey = date.date.toISOString().split('T')[0]
            if (!dateMap[dateKey]) {
              dateMap[dateKey] = []
            }
            dateMap[dateKey].push({
              user: {
                id: member.id,
                firstName: member.firstName,
                lastName: member.lastName,
                position: member.position
              },
              priority: date.priority,
              reason: date.reason || undefined
            })
          })
        }
      })

      // Detect overlaps (multiple people on the same date)
      const overlaps = Object.entries(dateMap)
        .filter(([date, users]) => users.length > 1)
        .map(([date, users]) => ({
          date,
          users,
          conflictLevel: this.calculateConflictLevel(users),
          riskLevel: this.calculateRiskLevel(users)
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      // Detect gaps (periods with no coverage)
      const gaps = this.detectCoverageGaps(dateMap, year)

      // Get team size for context
      const totalTeamSize = teamMembers.length
      const membersWithPlans = teamMembers.filter(m => m.holidayPlans.length > 0).length

      return {
        overlaps,
        gaps,
        teamSize: totalTeamSize,
        membersWithPlans,
        planningCoverage: totalTeamSize > 0 ? (membersWithPlans / totalTeamSize) * 100 : 0
      }

    } catch (error) {
      console.error('Error detecting overlaps and gaps:', error)
      return {
        overlaps: [],
        gaps: [],
        teamSize: 0,
        membersWithPlans: 0,
        planningCoverage: 0
      }
    }
  }

  /**
   * Calculate conflict level based on users and priorities
   */
  private static calculateConflictLevel(users: Array<{ priority: string; user: any }>): 'HIGH' | 'MEDIUM' | 'LOW' {
    const essentialCount = users.filter(u => u.priority === 'ESSENTIAL').length
    const preferredCount = users.filter(u => u.priority === 'PREFERRED').length
    
    if (essentialCount > 1) return 'HIGH'
    if (essentialCount === 1 && preferredCount > 0) return 'MEDIUM'
    if (users.length >= 3) return 'MEDIUM'
    return 'LOW'
  }

  /**
   * Calculate risk level based on team coverage
   */
  private static calculateRiskLevel(users: Array<any>): 'HIGH' | 'MEDIUM' | 'LOW' {
    // This is a simplified risk calculation
    // In practice, you'd factor in team size, critical roles, etc.
    if (users.length >= 3) return 'HIGH'
    if (users.length === 2) return 'MEDIUM'
    return 'LOW'
  }

  /**
   * Detect periods with potential coverage gaps
   */
  private static detectCoverageGaps(dateMap: { [key: string]: any[] }, year: number): Array<{ startDate: string; endDate: string; duration: number; type: string }> {
    const gaps = []
    const dates = Object.keys(dateMap).sort()
    
    // Look for consecutive periods with high absence
    let gapStart = null
    let consecutiveDays = 0
    
    // This is a simplified gap detection
    // You could enhance this based on your business rules
    for (let i = 0; i < dates.length - 1; i++) {
      const currentDate = new Date(dates[i])
      const nextDate = new Date(dates[i + 1])
      const daysDiff = (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
      
      if (daysDiff > 7) { // Gap of more than 7 days
        gaps.push({
          startDate: dates[i],
          endDate: dates[i + 1],
          duration: daysDiff,
          type: 'EXTENDED_GAP'
        })
      }
    }
    
    return gaps
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

    const plannedDays = plan.dates.length

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