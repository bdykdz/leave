"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Users, Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { format, isSameDay, parseISO } from "date-fns"
import { toast } from "sonner"

interface LeaveEvent {
  id: string
  employeeName: string
  department: string
  leaveType: string
  startDate: Date
  endDate: Date
  status: string
  totalDays: number
  email: string
}

interface CalendarData {
  approvedEvents: LeaveEvent[]
  pendingEvents: LeaveEvent[]
}

export function LeaveCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [calendarData, setCalendarData] = useState<CalendarData>({ approvedEvents: [], pendingEvents: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaveEvents()
  }, [])

  const fetchLeaveEvents = async () => {
    try {
      const response = await fetch('/api/hr/leave-calendar')
      if (response.ok) {
        const data = await response.json()
        // Convert date strings back to Date objects
        const processEvents = (events: any[]) => events.map(event => ({
          ...event,
          startDate: parseISO(event.startDate),
          endDate: parseISO(event.endDate)
        }))
        
        setCalendarData({
          approvedEvents: processEvents(data.approvedEvents),
          pendingEvents: processEvents(data.pendingEvents)
        })
      } else {
        toast.error('Failed to load calendar data')
      }
    } catch (error) {
      console.error('Error fetching leave events:', error)
      toast.error('Failed to load calendar data')
    } finally {
      setLoading(false)
    }
  }

  const getEventsForDate = (date: Date | undefined) => {
    if (!date) return { approved: [], pending: [] }
    
    const approved = calendarData.approvedEvents.filter(event => {
      return isSameDay(event.startDate, date) || 
             isSameDay(event.endDate, date) ||
             (event.startDate <= date && event.endDate >= date)
    })
    
    const pending = calendarData.pendingEvents.filter(event => {
      return isSameDay(event.startDate, date) || 
             isSameDay(event.endDate, date) ||
             (event.startDate <= date && event.endDate >= date)
    })
    
    return { approved, pending }
  }

  const getLeaveTypeBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'annual leave': return 'bg-blue-100 text-blue-800'
      case 'sick leave': return 'bg-red-100 text-red-800'
      case 'personal leave': return 'bg-purple-100 text-purple-800'
      case 'remote work': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const todayEvents = getEventsForDate(selectedDate)
  const totalEvents = todayEvents.approved.length + todayEvents.pending.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading calendar...</span>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Leave Calendar</CardTitle>
          <CardDescription>View all employee leaves at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Leave Schedule</CardTitle>
              <CardDescription>
                {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
              </CardDescription>
            </div>
            {totalEvents > 0 && (
              <Badge variant="secondary">
                <Users className="mr-1 h-3 w-3" />
                {totalEvents} on leave
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            {totalEvents === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leaves scheduled for this date
              </div>
            ) : (
              <div className="space-y-4">
                {/* Approved Leaves */}
                {todayEvents.approved.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-green-800 mb-2">Approved Leaves</h4>
                    <div className="space-y-3">
                      {todayEvents.approved.map((event) => (
                        <div key={event.id} className="border rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-medium">{event.employeeName}</p>
                              <p className="text-sm text-muted-foreground">{event.department}</p>
                            </div>
                            <Badge className={getLeaveTypeBadgeColor(event.leaveType)}>
                              {event.leaveType}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-muted-foreground">
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {format(event.startDate, "MMM d")} - {format(event.endDate, "MMM d")} ({event.totalDays} days)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Leaves */}
                {todayEvents.pending.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-orange-800 mb-2">Pending Approval</h4>
                    <div className="space-y-3">
                      {todayEvents.pending.map((event) => (
                        <div key={event.id} className="border rounded-lg p-3 bg-orange-50">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-medium">{event.employeeName}</p>
                              <p className="text-sm text-muted-foreground">{event.department}</p>
                            </div>
                            <div className="space-y-1">
                              <Badge variant="outline" className="border-orange-200 text-orange-800">
                                {event.leaveType}
                              </Badge>
                              <Badge variant="outline" className="border-orange-300 text-orange-900 text-xs">
                                Pending
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-muted-foreground">
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {format(event.startDate, "MMM d")} - {format(event.endDate, "MMM d")} ({event.totalDays} days)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}