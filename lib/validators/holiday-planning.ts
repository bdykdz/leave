import { z } from 'zod'
import { PlanPriority } from '@prisma/client'

export const createPlanSchema = z.object({
  year: z.number().int().min(2024).max(2030),
  dates: z.array(z.object({
    date: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "Invalid date format"
    }),
    priority: z.nativeEnum(PlanPriority),
    reason: z.string().max(500).optional().transform(val => {
      // Basic sanitization: trim whitespace and remove potentially harmful characters
      return val ? val.trim().replace(/[<>]/g, '') : undefined
    })
  })).max(30, "Maximum 30 holiday days allowed per year")
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
export function validatePlanningDates(dates: { date: string; priority: PlanPriority }[], planningYear?: number): string[] {
  const errors: string[] = []
  const currentYear = new Date().getFullYear()
  const targetYear = planningYear || currentYear + 1
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Normalize to start of day for accurate comparison
  
  dates.forEach((dateEntry, index) => {
    const date = new Date(dateEntry.date)
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      errors.push(`Date at index ${index} is invalid`)
      return
    }
    
    // Validate date string format matches parsed date (prevents invalid dates like Feb 30)
    const parsedDateString = date.toISOString().split('T')[0]
    if (parsedDateString !== dateEntry.date) {
      errors.push(`Date at index ${index} is not a valid calendar date`)
      return
    }
    
    // Check if date is in the correct planning year
    if (date.getFullYear() !== targetYear) {
      errors.push(`Date at index ${index} must be for year ${targetYear}`)
    }
    
    // Check if date is not in the past (normalize date for comparison)
    const normalizedDate = new Date(date)
    normalizedDate.setHours(0, 0, 0, 0)
    if (normalizedDate < today) {
      errors.push(`Date at index ${index} cannot be in the past`)
    }
    
    // Check for weekends (optional validation)
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // This is just a warning, not an error
      console.warn(`Date at index ${index} (${dateEntry.date}) is a weekend`)
    }
  })
  
  // Check for duplicate dates
  const dateStrings = dates.map(d => d.date)
  const uniqueDates = new Set(dateStrings)
  if (uniqueDates.size !== dateStrings.length) {
    const duplicates = dateStrings.filter((date, index) => dateStrings.indexOf(date) !== index)
    errors.push(`Duplicate dates found: ${[...new Set(duplicates)].join(', ')}`)
  }
  
  return errors
}