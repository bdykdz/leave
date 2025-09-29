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
      const response = await fetch('/api/holidays?upcoming=true')
      const data = await response.json()
      setHolidays(data.holidays || [])
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
      {holidays.slice(0, 4).map((holiday) => (
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
      {holidays.length > 4 && (
        <p className="text-sm text-muted-foreground text-center pt-2">
          +{holidays.length - 4} more holidays
        </p>
      )}
    </div>
  )
}