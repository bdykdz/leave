"use client"
import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Calendar, Users, X, Home, Loader2, Search } from "lucide-react"
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
import { useTranslations } from "@/components/language-provider"

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

interface CalendarUser {
  id: string
  name: string
  department: string
}

interface DayDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  date: Date | null
  events: CalendarEvent[]
  holidays: Holiday[]
  summary: CalendarSummary
  allUsers: CalendarUser[]
}

function DayDetailsModal({ isOpen, onClose, date, events, holidays, summary, allUsers }: DayDetailsModalProps) {
  const t = useTranslations()
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (!isOpen) setSearchTerm("")
  }, [isOpen])

  const eventsForDate = useMemo(() => date ? events.filter(event => {
    const eventStart = typeof event.startDate === 'string' ? parseISO(event.startDate) : event.startDate
    const eventEnd = typeof event.endDate === 'string' ? parseISO(event.endDate) : event.endDate

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
  }) : [], [date, events])

  const holidayForDate = useMemo(() => date ? holidays.find(holiday => {
    const holidayDate = typeof holiday.date === 'string' ? parseISO(holiday.date) : holiday.date
    return isSameDay(holidayDate, date)
  }) : undefined, [date, holidays])

  // Separate WFH from actual leave, deduplicated by userId — only show APPROVED
  const actualLeave = useMemo(() => Array.from(
    new Map(eventsForDate.filter(e => e.type === 'leave' && e.status === 'approved').map(e => [e.userId, e])).values()
  ), [eventsForDate])

  const wfhRequests = useMemo(() => Array.from(
    new Map(eventsForDate.filter(e => e.type === 'wfh' && e.status === 'approved').map(e => [e.userId, e])).values()
  ), [eventsForDate])

  // Search implementation
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return null
    const term = searchTerm.toLowerCase()
    const onLeaveIds = new Set(actualLeave.map(e => e.userId))
    const onWfhIds = new Set(wfhRequests.map(e => e.userId))

    return allUsers
      .filter(u => u.name.toLowerCase().includes(term))
      .map(user => ({
        ...user,
        status: onLeaveIds.has(user.id) ? 'leave' as const
              : onWfhIds.has(user.id) ? 'wfh' as const
              : 'atWork' as const,
      }))
  }, [searchTerm, actualLeave, wfhRequests, allUsers])

  if (!date) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t.calendarDetail.teamStatus} - {format(date, "EEEE, MMMM d, yyyy")}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Holiday Info */}
          {holidayForDate && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 mb-1">{holidayForDate.nameEn}</h3>
              <p className="text-sm text-amber-600">{holidayForDate.nameRo}</p>
              {holidayForDate.isBlocked && (
                <p className="text-xs text-amber-700 mt-1">{t.calendarDetail.wfhNotAllowed}</p>
              )}
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t.calendarDetail.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Search Results */}
          {searchResults !== null ? (
            searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map(user => (
                  <div key={user.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
                    <span className={cn(
                      "text-sm font-medium",
                      user.status === 'leave' && "text-red-600",
                      user.status === 'wfh' && "text-blue-600",
                      user.status === 'atWork' && "text-green-600",
                    )}>
                      {user.name}
                      <span className="text-gray-400 font-normal text-xs ml-1">({user.department})</span>
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        user.status === 'leave' && "bg-red-50 text-red-700 border-red-200",
                        user.status === 'wfh' && "bg-blue-50 text-blue-700 border-blue-200",
                        user.status === 'atWork' && "bg-green-50 text-green-700 border-green-200",
                      )}
                    >
                      {user.status === 'leave' ? t.calendarDetail.onLeave
                        : user.status === 'wfh' ? t.common.wfh
                        : t.calendarDetail.atWork}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">
                <p>{t.calendarDetail.noResults}</p>
              </div>
            )
          ) : (
            <>
              {/* Compact Leave Names */}
              {actualLeave.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-600 mb-1">
                    {t.calendarDetail.teamMembersAway} ({actualLeave.length})
                  </h3>
                  <p className="text-sm leading-relaxed">
                    {actualLeave.map((event, i) => (
                      <span key={event.id}>
                        {i > 0 && <span className="text-gray-400">, </span>}
                        <span className="text-red-600 font-medium">{event.userName}</span>
                      </span>
                    ))}
                  </p>
                </div>
              )}

              {/* Compact WFH Names */}
              {wfhRequests.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-600 mb-1 flex items-center gap-1">
                    <Home className="h-4 w-4" />
                    {t.calendarDetail.workingFromHomeCount} ({wfhRequests.length})
                  </h3>
                  <p className="text-sm leading-relaxed">
                    {wfhRequests.map((event, i) => (
                      <span key={event.id}>
                        {i > 0 && <span className="text-gray-400">, </span>}
                        <span className="text-blue-600 font-medium">{event.userName}</span>
                      </span>
                    ))}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Summary Box */}
          {(actualLeave.length > 0 || wfhRequests.length > 0) && !searchResults && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">{t.calendarDetail.daySummary}</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold text-red-600">{actualLeave.length}</div>
                  <div className="text-xs text-gray-600">{t.calendarLegend.away}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-600">{wfhRequests.length}</div>
                  <div className="text-xs text-gray-600">{t.common.wfh}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-600">
                    {Math.max(0, summary.totalMembers - actualLeave.length - wfhRequests.length)}
                  </div>
                  <div className="text-xs text-gray-600">{t.calendarDetail.inOffice}</div>
                </div>
              </div>
            </div>
          )}

          {/* No events */}
          {actualLeave.length === 0 && wfhRequests.length === 0 && !holidayForDate && !searchResults && (
            <div className="text-center py-8 text-gray-500">
              <p>{t.calendarDetail.noTeamMembersAway}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TeamCalendar() {
  const t = useTranslations()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [allUsers, setAllUsers] = useState<CalendarUser[]>([])
  const [summary, setSummary] = useState<CalendarSummary>({
    totalMembers: 0,
    onLeave: 0,
    workingFromHome: 0,
    pending: 0
  })

  // Fetch calendar data
  useEffect(() => {
    const controller = new AbortController()

    const fetchCalendarData = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/calendar?month=${currentMonth.toISOString()}`, {
          signal: controller.signal,
        })
        if (response.ok) {
          const data = await response.json()
          setEvents(data.events || [])
          setHolidays(data.holidays || [])
          setAllUsers(data.allUsers || [])
          setSummary(data.summary || {
            totalMembers: 0,
            onLeave: 0,
            workingFromHome: 0,
            pending: 0
          })
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Failed to fetch calendar data:', error)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchCalendarData()

    return () => controller.abort()
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
              <div className="text-sm text-gray-600">{t.calendarLegend.totalTeam}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.workingFromHome}</div>
              <div className="text-sm text-gray-600">{t.calendarLegend.workingFromHome}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.onLeave}</div>
              <div className="text-sm text-gray-600">{t.calendarLegend.onLeave}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
              <div className="text-sm text-gray-600">{t.calendarLegend.pendingRequests}</div>
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
              const leaveCount = dayEvents.filter(e => e.type === 'leave' && e.status === 'approved').length
              const wfhCount = dayEvents.filter(e => e.type === 'wfh' && e.status === 'approved').length
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
                      <span className="text-xs text-red-600">{leaveCount} {t.calendarLegend.away}</span>
                    </div>
                  )}

                  {wfhCount > 0 && (
                    <div className="flex items-center gap-1">
                      <Home className="h-3 w-3 text-blue-500" />
                      <span className="text-xs text-blue-600">{wfhCount} {t.common.wfh}</span>
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
        summary={summary}
        allUsers={allUsers}
      />
    </div>
  )
}