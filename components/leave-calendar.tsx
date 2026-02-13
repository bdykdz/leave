"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns/format"
import { startOfMonth } from "date-fns/startOfMonth"
import { endOfMonth } from "date-fns/endOfMonth"
import { eachDayOfInterval } from "date-fns/eachDayOfInterval"
import { isSameMonth } from "date-fns/isSameMonth"
import { isSameDay } from "date-fns/isSameDay"
import { addMonths } from "date-fns/addMonths"
import { subMonths } from "date-fns/subMonths"
import { isWeekend } from "date-fns/isWeekend"
import { isBefore } from "date-fns/isBefore"
import { startOfDay } from "date-fns/startOfDay"
import { startOfWeek } from "date-fns/startOfWeek"
import { addWeeks } from "date-fns/addWeeks"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/components/language-provider"

interface LeaveCalendarProps {
  selectedDates: Date[]
  onDateSelect: (date: Date) => void
  blockedDates?: string[]
  blockedDateDetails?: Record<string, { status: string; leaveType: string }>
  isWFHCalendar?: boolean // Add prop to indicate if this is for WFH requests
  existingLeaveRequests?: Array<{
    startDate: string
    endDate: string
    selectedDates: string[]
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    leaveType: string
  }>
}

export function LeaveCalendar({ selectedDates, onDateSelect, blockedDates = [], blockedDateDetails = {}, isWFHCalendar = false, existingLeaveRequests = [] }: LeaveCalendarProps) {
  const t = useTranslations()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [companyHolidays, setCompanyHolidays] = useState<Date[]>([])
  const [blockedHolidays, setBlockedHolidays] = useState<Date[]>([]) // Holidays where WFH is blocked

  useEffect(() => {
    fetchHolidays()
  }, [currentMonth])

  const fetchHolidays = async () => {
    try {
      const year = currentMonth.getFullYear()
      const response = await fetch(`/api/holidays?year=${year}`)
      const data = await response.json()
      
      const allHolidays = data.holidays || []
      const holidayDates = allHolidays.map((holiday: any) => new Date(holiday.date))
      const blockedForWFH = allHolidays
        .filter((holiday: any) => holiday.isBlocked)
        .map((holiday: any) => new Date(holiday.date))
      setCompanyHolidays(holidayDates)
      setBlockedHolidays(blockedForWFH)
    } catch (error) {
      console.error('Failed to fetch holidays:', error)
      // Fallback to empty array
      setCompanyHolidays([])
    }
  }

  const teamLeave = [new Date(2025, 0, 15), new Date(2025, 0, 16), new Date(2025, 1, 10)]

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Get the first day of the week for the month (to show previous month's trailing days)
  // Adjust for Monday start: Sunday = 0, Monday = 1, etc. Convert to Monday = 0, Tuesday = 1, etc.
  const startDate = new Date(monthStart)
  const startDayOfWeek = monthStart.getDay()
  const daysFromMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1
  startDate.setDate(startDate.getDate() - daysFromMonday)

  // Get the last day of the week for the month (to show next month's leading days)
  const endDate = new Date(monthEnd)
  const endDayOfWeek = monthEnd.getDay()
  const daysToSunday = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek
  endDate.setDate(endDate.getDate() + daysToSunday)

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const isSelected = (date: Date) => {
    return selectedDates.some((selectedDate) => isSameDay(selectedDate, date))
  }

  const isCompanyHoliday = (date: Date) => {
    return companyHolidays.some((holiday) => isSameDay(holiday, date))
  }

  const isTeamLeave = (date: Date) => {
    return teamLeave.some((leave) => isSameDay(leave, date))
  }

  const isBlockedDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return blockedDates.includes(dateStr)
  }

  const getBlockedDateDetails = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return blockedDateDetails[dateStr]
  }

  const isPastDate = (date: Date) => {
    return isBefore(date, startOfDay(new Date()))
  }

  const isCurrentWeek = (date: Date) => {
    const today = new Date()
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }) // Monday
    const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 })
    return date >= weekStart && date < nextWeekStart
  }

  const isBlockedForWFH = (date: Date) => {
    // For WFH calendar, block current week and holidays marked as blocked
    if (!isWFHCalendar) return false
    
    if (isCurrentWeek(date)) return true
    
    return blockedHolidays.some((holiday) => isSameDay(holiday, date))
  }

  const hasExistingLeaveRequest = (date: Date) => {
    if (!isWFHCalendar || !existingLeaveRequests.length) return null
    
    const dateStr = format(date, 'yyyy-MM-dd')
    
    for (const request of existingLeaveRequests) {
      // Check if request has selectedDates (non-consecutive days)
      if (request.selectedDates && request.selectedDates.length > 0) {
        if (request.selectedDates.includes(dateStr)) {
          return request
        }
      } else {
        // Use string comparison to avoid timezone issues
        if (dateStr >= request.startDate && dateStr <= request.endDate) {
          return request
        }
      }
    }
    
    return null
  }

  const getDayClassName = (date: Date) => {
    const baseClasses =
      "h-10 w-10 text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center"

    if (!isSameMonth(date, currentMonth)) {
      return cn(baseClasses, "text-gray-300 cursor-not-allowed")
    }

    if (isPastDate(date)) {
      return cn(baseClasses, "text-gray-400 cursor-not-allowed")
    }

    // For WFH calendar, show current week as blocked
    if (isWFHCalendar && isCurrentWeek(date)) {
      return cn(baseClasses, "bg-gray-200 text-gray-500 cursor-not-allowed")
    }

    // For WFH calendar, show blocked holidays differently
    if (isWFHCalendar && isBlockedForWFH(date)) {
      return cn(baseClasses, "bg-red-100 text-red-600 cursor-not-allowed")
    }

    // For WFH calendar, show existing leave requests
    if (isWFHCalendar) {
      const existingRequest = hasExistingLeaveRequest(date)
      if (existingRequest) {
        if (existingRequest.status === 'APPROVED') {
          return cn(baseClasses, "bg-red-200 text-red-900 cursor-not-allowed border-2 border-red-400")
        } else if (existingRequest.status === 'PENDING') {
          return cn(baseClasses, "bg-yellow-200 text-yellow-900 cursor-not-allowed border-2 border-yellow-400")
        }
      }
    }

    if (isCompanyHoliday(date)) {
      return cn(baseClasses, "bg-purple-100 text-purple-800 cursor-not-allowed")
    }

    if (isBlockedDate(date)) {
      const details = getBlockedDateDetails(date)
      if (details?.status === 'APPROVED') {
        return cn(baseClasses, "bg-red-100 text-red-800 cursor-not-allowed")
      } else {
        return cn(baseClasses, "bg-yellow-100 text-yellow-800 cursor-not-allowed")
      }
    }

    if (isTeamLeave(date)) {
      return cn(baseClasses, "bg-orange-100 text-orange-800 hover:bg-orange-200")
    }

    if (isWeekend(date)) {
      return cn(baseClasses, "text-gray-500 cursor-not-allowed")
    }

    if (isSelected(date)) {
      return cn(baseClasses, "bg-blue-600 text-white hover:bg-blue-700")
    }

    return cn(baseClasses, "text-gray-900 hover:bg-blue-50 hover:text-blue-600")
  }

  const handleDateClick = (date: Date) => {
    // Common restrictions
    if (!isSameMonth(date, currentMonth) || isPastDate(date) || isBlockedDate(date) || isWeekend(date)) {
      return
    }
    
    // WFH-specific restrictions
    if (isWFHCalendar) {
      if (isCurrentWeek(date) || isBlockedForWFH(date)) {
        return
      }
      
      // Prevent clicking on dates with existing leave requests
      const existingRequest = hasExistingLeaveRequest(date)
      if (existingRequest && (existingRequest.status === 'APPROVED' || existingRequest.status === 'PENDING')) {
        return
      }
    } else {
      // Leave request restrictions
      if (isCompanyHoliday(date)) {
        return
      }
    }
    
    onDateSelect(date)
  }

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h3>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="h-10 w-10 flex items-center justify-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((date, index) => (
          <div key={index} className={getDayClassName(date)} onClick={() => handleDateClick(date)}>
            {format(date, "d")}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
            <span>{t.calendarLegend.selected}</span>
          </div>
          {isWFHCalendar ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded"></div>
              <span>{t.remoteForm.currentWeekNotAllowed}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-100 border border-purple-200 rounded"></div>
              <span>{t.calendarLegend.companyHoliday}</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {isWFHCalendar ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-200 border-2 border-red-400 rounded"></div>
                <span>{t.remoteForm.approvedLeaveConflict}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-200 border-2 border-yellow-400 rounded"></div>
                <span>{t.remoteForm.pendingLeaveConflict}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
                <span>{t.remoteForm.blockedHoliday}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-100 border border-purple-200 rounded"></div>
                <span>{t.calendarLegend.companyHoliday}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
                <span>{t.calendarLegend.approvedLeave}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
                <span>{t.calendarLegend.pendingLeave}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded"></div>
                <span>{t.calendarLegend.teamMemberAway}</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
            <span>{t.calendarLegend.weekend}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
