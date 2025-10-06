"use client"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Calendar, Users, X, Home, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { format } from "date-fns/format"
import { startOfMonth } from "date-fns/startOfMonth"
import { endOfMonth } from "date-fns/endOfMonth"
import { eachDayOfInterval } from "date-fns/eachDayOfInterval"
import { isSameMonth } from "date-fns/isSameMonth"
import { isSameDay } from "date-fns/isSameDay"
import { addMonths } from "date-fns/addMonths"
import { subMonths } from "date-fns/subMonths"
import { isWeekend } from "date-fns/isWeekend"
import { startOfWeek } from "date-fns/startOfWeek"
import { endOfWeek } from "date-fns/endOfWeek"
import { addDays } from "date-fns/addDays"
import { isWithinInterval } from "date-fns/isWithinInterval"
import { parseISO } from "date-fns/parseISO"
import { cn } from "@/lib/utils"

interface CalendarEvent {
  id: string
  type: 'leave' | 'wfh'
  userId: string
  userName: string
  userAvatar?: string | null
  userInitials: string
  department: string
  startDate: string | Date
  endDate: string | Date
  leaveType: string
  status: string
  reason?: string
  substitute?: string | null
  location?: string
  selectedDates?: (string | Date)[] | null
}

interface Holiday {
  id: string
  nameEn: string
  nameRo: string
  date: string | Date
  isBlocked: boolean
}

interface CalendarSummary {
  totalMembers: number
  onLeave: number
  workingFromHome: number
  pending: number
}

interface DayDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  date: Date | null
  events: CalendarEvent[]
  holidays: Holiday[]
}

function DayDetailsModal({ isOpen, onClose, date, events, holidays }: DayDetailsModalProps) {
  if (!date) return null

  const eventsForDate = events.filter(event => {
    const eventStart = typeof event.startDate === 'string' ? parseISO(event.startDate) : event.startDate
    const eventEnd = typeof event.endDate === 'string' ? parseISO(event.endDate) : event.endDate
    
    // Check if using selected dates or date range
    if (event.selectedDates && event.selectedDates.length > 0) {
      return event.selectedDates.some(selectedDate => {
        const parsedDate = typeof selectedDate === 'string' ? parseISO(selectedDate) : selectedDate
        return isSameDay(parsedDate, date)
      })
    }
    
    return isWithinInterval(date, {
      start: eventStart,
      end: eventEnd,
    })
  })

  const holidayForDate = holidays.find(holiday => {
    const holidayDate = typeof holiday.date === 'string' ? parseISO(holiday.date) : holiday.date
    return isSameDay(holidayDate, date)
  })

  // Separate WFH from actual leave
  const actualLeave = eventsForDate.filter(event => event.type === 'leave')
  const wfhRequests = eventsForDate.filter(event => event.type === 'wfh')

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "rejected":
      case "denied":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Team Status - {format(date, "EEEE, MMMM d, yyyy")}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Holiday Info */}
          {holidayForDate && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 mb-1">{holidayForDate.nameEn}</h3>
              <p className="text-sm text-amber-600">{holidayForDate.nameRo}</p>
              {holidayForDate.isBlocked && (
                <p className="text-xs text-amber-700 mt-1">Work from home not allowed on this day</p>
              )}
            </div>
          )}

          {/* Team Members Away */}
          {actualLeave.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-red-600">Team Members Away ({actualLeave.length})</h3>
              <div className="space-y-3">
                {actualLeave.map((event) => (
                  <div key={event.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <Avatar className="h-10 w-10">
                      {event.userAvatar && <AvatarImage src={event.userAvatar} />}
                      <AvatarFallback>{event.userInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{event.userName}</h4>
                        <Badge className={getStatusColor(event.status)}>{event.status}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{event.department}</p>
                      <p className="text-sm">
                        <span className="font-medium">{event.leaveType}</span> • {format(typeof event.startDate === 'string' ? parseISO(event.startDate) : event.startDate, "MMM d")}
                        {!isSameDay(
                          typeof event.startDate === 'string' ? parseISO(event.startDate) : event.startDate,
                          typeof event.endDate === 'string' ? parseISO(event.endDate) : event.endDate
                        ) && ` - ${format(typeof event.endDate === 'string' ? parseISO(event.endDate) : event.endDate, "MMM d")}`}
                      </p>
                      {event.reason && <p className="text-sm text-gray-500 mt-1">"{event.reason}"</p>}
                      {event.substitute && <p className="text-sm text-blue-600 mt-1">Substitute: {event.substitute}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Work from Home */}
          {wfhRequests.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-blue-600 flex items-center gap-2">
                <Home className="h-5 w-5" />
                Working From Home ({wfhRequests.length})
              </h3>
              <div className="space-y-3">
                {wfhRequests.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <Avatar className="h-10 w-10">
                      {event.userAvatar && <AvatarImage src={event.userAvatar} />}
                      <AvatarFallback>{event.userInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{event.userName}</h4>
                        <Badge className={getStatusColor(event.status)}>{event.status}</Badge>
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          WFH
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{event.department}</p>
                      {event.location && <p className="text-sm text-gray-600 mb-1">Location: {event.location}</p>}
                      <p className="text-sm">
                        <span className="font-medium">Work From Home</span> • {format(typeof event.startDate === 'string' ? parseISO(event.startDate) : event.startDate, "MMM d")}
                        {!isSameDay(
                          typeof event.startDate === 'string' ? parseISO(event.startDate) : event.startDate,
                          typeof event.endDate === 'string' ? parseISO(event.endDate) : event.endDate
                        ) && ` - ${format(typeof event.endDate === 'string' ? parseISO(event.endDate) : event.endDate, "MMM d")}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary Box */}
          {(actualLeave.length > 0 || wfhRequests.length > 0) && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Day Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold text-red-600">{actualLeave.length}</div>
                  <div className="text-xs text-gray-600">Away</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-600">{wfhRequests.length}</div>
                  <div className="text-xs text-gray-600">WFH</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-600">
                    {Math.max(0, 10 - actualLeave.length - wfhRequests.length)}
                  </div>
                  <div className="text-xs text-gray-600">In Office</div>
                </div>
              </div>
            </div>
          )}

          {/* No events */}
          {actualLeave.length === 0 && wfhRequests.length === 0 && !holidayForDate && (
            <div className="text-center py-8 text-gray-500">
              <p>No team members away or working from home on this date</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TeamCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [summary, setSummary] = useState<CalendarSummary>({
    totalMembers: 0,
    onLeave: 0,
    workingFromHome: 0,
    pending: 0
  })

  // Fetch calendar data
  useEffect(() => {
    const fetchCalendarData = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/calendar?month=${currentMonth.toISOString()}`)
        if (response.ok) {
          const data = await response.json()
          setEvents(data.events || [])
          setHolidays(data.holidays || [])
          setSummary(data.summary || {
            totalMembers: 0,
            onLeave: 0,
            workingFromHome: 0,
            pending: 0
          })
        }
      } catch (error) {
        console.error('Failed to fetch calendar data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCalendarData()
  }, [currentMonth])

  const getCalendarDays = () => {
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentMonth)
      const weekEnd = endOfWeek(currentMonth)
      return eachDayOfInterval({ start: weekStart, end: weekEnd })
    } else {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      const startDate = startOfWeek(monthStart)
      const endDate = endOfWeek(monthEnd)
      return eachDayOfInterval({ start: startDate, end: endDate })
    }
  }

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventStart = typeof event.startDate === 'string' ? parseISO(event.startDate) : event.startDate
      const eventEnd = typeof event.endDate === 'string' ? parseISO(event.endDate) : event.endDate
      
      // Check if using selected dates or date range
      if (event.selectedDates && event.selectedDates.length > 0) {
        return event.selectedDates.some(selectedDate => {
          const parsedDate = typeof selectedDate === 'string' ? parseISO(selectedDate) : selectedDate
          return isSameDay(parsedDate, date)
        })
      }
      
      return isWithinInterval(date, {
        start: eventStart,
        end: eventEnd,
      })
    })
  }

  const getHolidayForDate = (date: Date) => {
    return holidays.find(holiday => {
      const holidayDate = typeof holiday.date === 'string' ? parseISO(holiday.date) : holiday.date
      return isSameDay(holidayDate, date)
    })
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    setIsModalOpen(true)
  }

  const previousPeriod = () => {
    if (viewMode === "week") {
      setCurrentMonth(addDays(currentMonth, -7))
    } else {
      setCurrentMonth(subMonths(currentMonth, 1))
    }
  }

  const nextPeriod = () => {
    if (viewMode === "week") {
      setCurrentMonth(addDays(currentMonth, 7))
    } else {
      setCurrentMonth(addMonths(currentMonth, 1))
    }
  }

  const calendarDays = getCalendarDays()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={previousPeriod}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={nextPeriod}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-xl font-semibold">
            {viewMode === "week"
              ? `Week of ${format(startOfWeek(currentMonth), "MMM d, yyyy")}`
              : format(currentMonth, "MMMM yyyy")}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === "month" ? "default" : "outline"} size="sm" onClick={() => setViewMode("month")}>
            <Calendar className="h-4 w-4 mr-2" />
            Month
          </Button>
          <Button variant={viewMode === "week" ? "default" : "outline"} size="sm" onClick={() => setViewMode("week")}>
            <Users className="h-4 w-4 mr-2" />
            Week
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{summary.totalMembers}</div>
              <div className="text-sm text-gray-600">Total Team</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.workingFromHome}</div>
              <div className="text-sm text-gray-600">Working From Home</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.onLeave}</div>
              <div className="text-sm text-gray-600">On Leave</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
              <div className="text-sm text-gray-600">Pending Requests</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="h-12 flex items-center justify-center text-sm font-medium text-gray-500 border-b"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day, index) => {
              const dayEvents = getEventsForDate(day)
              const holiday = getHolidayForDate(day)
              const leaveCount = dayEvents.filter(e => e.type === 'leave').length
              const wfhCount = dayEvents.filter(e => e.type === 'wfh').length
              const isCurrentMonth = isSameMonth(day, currentMonth)

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[80px] p-2 border rounded-lg cursor-pointer transition-colors",
                    isCurrentMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50",
                    isWeekend(day) && "bg-gray-100",
                    holiday && "bg-amber-50 border-amber-200"
                  )}
                  onClick={() => handleDayClick(day)}
                >
                  <div className="text-sm font-medium mb-1">{format(day, "d")}</div>
                  
                  {holiday && (
                    <div className="text-xs text-amber-600 mb-1 truncate" title={holiday.nameEn}>
                      {holiday.nameEn}
                    </div>
                  )}

                  {leaveCount > 0 && (
                    <div className="flex items-center gap-1 mb-1">
                      <div className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                      <span className="text-xs text-red-600">{leaveCount} away</span>
                    </div>
                  )}

                  {wfhCount > 0 && (
                    <div className="flex items-center gap-1">
                      <Home className="h-3 w-3 text-blue-500" />
                      <span className="text-xs text-blue-600">{wfhCount} WFH</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day Details Modal */}
      <DayDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        date={selectedDate}
        events={events}
        holidays={holidays}
      />
    </div>
  )
}