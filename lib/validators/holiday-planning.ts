import { z } from 'zod'
import { PlanPriority } from '@prisma/client'

export const createPlanSchema = z.object({
  year: z.number().int().min(2024).max(2030),
  dates: z.array(z.object({
    date: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "Invalid date format"
    }),
    priority: z.nativeEnum(PlanPriority),
    reason: z.string().optional(),
    isHalfDay: z.boolean().optional().default(false)
  }))
})

export const submitPlanSchema = z.object({
  year: z.number().int().min(2024).max(2030),
  action: z.literal('submit')
})

export const createWindowSchema = z.object({
  year: z.number().int().min(2024).max(2030)
})

/**
 * Check if planning window is open (October-December)
 */
export function isPlanningWindowOpen(): boolean {
  const now = new Date()
  const currentMonth = now.getMonth() // 0-based: 9=Oct, 10=Nov, 11=Dec
  return currentMonth >= 9 && currentMonth <= 11
}

/**
 * Validate holiday planning dates
 */
export function validatePlanningDates(dates: { date: string; priority: PlanPriority }[]): string[] {
  const errors: string[] = []
  const currentYear = new Date().getFullYear()
  const nextYear = currentYear + 1
  
  dates.forEach((dateEntry, index) => {
    const date = new Date(dateEntry.date)
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      errors.push(`Date at index ${index} is invalid`)
      return
    }
    
    // Check if date is in the planning year (next year)
    if (date.getFullYear() !== nextYear) {
      errors.push(`Date at index ${index} must be for year ${nextYear}`)
    }
    
    // Check if date is not in the past (for current year planning)
    if (date < new Date()) {
      errors.push(`Date at index ${index} cannot be in the past`)
    }
    
    // Check for weekends (optional validation)
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // This is just a warning, not an error
      console.warn(`Date at index ${index} is a weekend`)
    }
  })
  
  // Check for duplicate dates
  const dateStrings = dates.map(d => d.date)
  const duplicates = dateStrings.filter((date, index) => dateStrings.indexOf(date) !== index)
  if (duplicates.length > 0) {
    errors.push(`Duplicate dates found: ${duplicates.join(', ')}`)
  }
  
  return errors
}