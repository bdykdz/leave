'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'

interface Holiday {
  id: string
  nameEn: string
  nameRo: string
  date: string
  description?: string
  isRecurring: boolean
  country: string
}

export function HolidaysList() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHolidays()
  }, [])

  const fetchHolidays = async () => {
    try {
      // Get holidays for next 6 months
      const now = new Date()
      const sixMonthsLater = new Date()
      sixMonthsLater.setMonth(now.getMonth() + 6)
      
      const currentYear = now.getFullYear()
      const futureYear = sixMonthsLater.getFullYear()
      
      // Fetch holidays for current and potentially next year
      const years = [currentYear]
      if (futureYear !== currentYear) {
        years.push(futureYear)
      }
      
      const allHolidays = []
      for (const year of years) {
        const response = await fetch(`/api/holidays?year=${year}`)
        const data = await response.json()
        allHolidays.push(...(data.holidays || []))
      }
      
      // Filter to only upcoming holidays within 6 months
      const upcomingHolidays = allHolidays.filter(holiday => {
        const holidayDate = new Date(holiday.date)
        return holidayDate >= now && holidayDate <= sixMonthsLater
      })
      
      setHolidays(upcomingHolidays)
    } catch (error) {
      console.error('Failed to fetch holidays:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-4">Loading holidays...</div>
  }

  if (holidays.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No upcoming holidays</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {holidays.slice(0, 6).map((holiday) => (
        <div key={holiday.id} className="flex justify-between items-center">
          <div>
            <p className="font-medium">{holiday.nameEn}</p>
            <p className="text-sm text-gray-600">{holiday.nameRo}</p>
            <p className="text-sm text-gray-600">
              {format(new Date(holiday.date), 'MMMM dd, yyyy')}
            </p>
          </div>
        </div>
      ))}
      {holidays.length > 6 && (
        <p className="text-sm text-muted-foreground text-center pt-2">
          +{holidays.length - 6} more holidays
        </p>
      )}
    </div>
  )
}