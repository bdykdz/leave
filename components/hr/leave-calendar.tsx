"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Users, Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"

interface LeaveEvent {
  id: string
  employeeName: string
  department: string
  leaveType: string
  startDate: Date
  endDate: Date
  status: string
}

export function LeaveCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [leaveEvents, setLeaveEvents] = useState<LeaveEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaveEvents()
  }, [])

  const fetchLeaveEvents = async () => {
    try {
      // Mock data for now
      setLeaveEvents([
        {
          id: "1",
          employeeName: "John Doe",
          department: "Engineering",
          leaveType: "Annual Leave",
          startDate: new Date(),
          endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          status: "APPROVED"
        },
        {
          id: "2",
          employeeName: "Jane Smith",
          department: "Sales",
          leaveType: "Sick Leave",
          startDate: new Date(),
          endDate: new Date(),
          status: "APPROVED"
        }
      ])
    } catch (error) {
      console.error('Error fetching leave events:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEventsForDate = (date: Date | undefined) => {
    if (!date) return []
    return leaveEvents.filter(event => {
      const eventDate = new Date(event.startDate)
      return eventDate.toDateString() === date.toDateString()
    })
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
            {todayEvents.length > 0 && (
              <Badge variant="secondary">
                <Users className="mr-1 h-3 w-3" />
                {todayEvents.length} on leave
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            {loading ? (
              <div className="text-center py-8">Loading events...</div>
            ) : todayEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leaves scheduled for this date
              </div>
            ) : (
              <div className="space-y-3">
                {todayEvents.map((event) => (
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
                      {format(event.startDate, "MMM d")} - {format(event.endDate, "MMM d")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}