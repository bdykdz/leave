"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Users, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO } from "date-fns"

interface TeamMemberHoliday {
  id: string
  firstName: string
  lastName: string
  position: string
  department: string
  holidays: Array<{
    date: string
    priority: 'ESSENTIAL' | 'PREFERRED' | 'NICE_TO_HAVE'
    reason?: string
  }>
}

interface DayInfo {
  date: Date
  holidays: Array<{
    member: TeamMemberHoliday
    priority: string
    reason?: string
  }>
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
}

const PRIORITY_COLORS = {
  'ESSENTIAL': 'bg-red-500',
  'PREFERRED': 'bg-blue-500', 
  'NICE_TO_HAVE': 'bg-green-500'
}

const PRIORITY_LABELS = {
  'ESSENTIAL': 'Essential',
  'PREFERRED': 'Preferred',
  'NICE_TO_HAVE': 'Nice to Have'
}

export default function TeamCalendarPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [teamHolidays, setTeamHolidays] = useState<TeamMemberHoliday[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const planningYear = new Date().getFullYear() + 1

  useEffect(() => {
    if (session) {
      loadTeamHolidays()
    }
  }, [session, currentMonth])

  const loadTeamHolidays = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/team-calendar?year=${planningYear}&month=${format(currentMonth, 'yyyy-MM')}`)
      
      if (response.ok) {
        const data = await response.json()
        setTeamHolidays(data.teamMembers || [])
      } else {
        console.error('Failed to load team calendar')
      }
    } catch (error) {
      console.error('Error loading team calendar:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateCalendarData = (): DayInfo[] => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const startDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() - monthStart.getDay())
    const endDate = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + (6 - monthEnd.getDay()))
    
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    
    return days.map(date => {
      const dateString = format(date, 'yyyy-MM-dd')
      const holidays: DayInfo['holidays'] = []
      
      // Find all team members with holidays on this date
      teamHolidays.forEach(member => {
        member.holidays.forEach(holiday => {
          if (holiday.date === dateString) {
            holidays.push({
              member,
              priority: holiday.priority,
              reason: holiday.reason
            })
          }
        })
      })
      
      return {
        date,
        holidays,
        isCurrentMonth: isSameMonth(date, currentMonth),
        isToday: isSameDay(date, new Date()),
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      }
    })
  }

  const getDayIntensity = (holidays: DayInfo['holidays']): string => {
    if (holidays.length === 0) return ''
    if (holidays.length === 1) return 'bg-blue-100 border-blue-300'
    if (holidays.length <= 3) return 'bg-orange-100 border-orange-300'
    return 'bg-red-100 border-red-300' // High conflict
  }

  const calendarData = generateCalendarData()
  const selectedDayInfo = selectedDate ? calendarData.find(day => isSameDay(day.date, selectedDate)) : null

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please log in to view the team calendar</p>
          <Button onClick={() => router.push('/login')}>Go to Login</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading team calendar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Team Holiday Calendar {planningYear}</h1>
              <p className="text-gray-600">Visual overview of your team's planned holidays</p>
            </div>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {format(currentMonth, 'MMMM yyyy')}
                    </CardTitle>
                    <CardDescription>
                      Click on any date to see who's on holiday
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarData.map((dayInfo, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(dayInfo.date)}
                      className={`
                        p-2 h-16 text-left border-2 rounded-lg transition-all relative
                        ${dayInfo.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                        ${dayInfo.isToday ? 'ring-2 ring-blue-500' : ''}
                        ${dayInfo.isWeekend && dayInfo.isCurrentMonth ? 'bg-gray-100' : ''}
                        ${getDayIntensity(dayInfo.holidays)}
                        ${selectedDate && isSameDay(dayInfo.date, selectedDate) ? 'ring-2 ring-purple-500' : ''}
                        hover:bg-gray-100
                      `}
                    >
                      <div className={`text-sm ${dayInfo.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                        {format(dayInfo.date, 'd')}
                      </div>
                      {dayInfo.holidays.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dayInfo.holidays.slice(0, 3).map((holiday, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[holiday.priority as keyof typeof PRIORITY_COLORS]}`}
                            />
                          ))}
                          {dayInfo.holidays.length > 3 && (
                            <div className="text-xs text-gray-600">+{dayInfo.holidays.length - 3}</div>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Details Panel */}
          <div className="space-y-6">
            {/* Legend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Legend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm">Essential</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm">Preferred</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm">Nice to Have</span>
                </div>
                <hr />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
                    <span className="text-sm">1 person away</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-100 border-2 border-orange-300 rounded"></div>
                    <span className="text-sm">2-3 people away</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
                    <span className="text-sm">4+ people away</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selected Date Details */}
            {selectedDayInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {format(selectedDayInfo.date, 'EEEE, MMMM d')}
                  </CardTitle>
                  <CardDescription>
                    {selectedDayInfo.holidays.length === 0 ? 'No holidays planned' : 
                     selectedDayInfo.holidays.length === 1 ? '1 person on holiday' :
                     `${selectedDayInfo.holidays.length} people on holiday`}
                  </CardDescription>
                </CardHeader>
                {selectedDayInfo.holidays.length > 0 && (
                  <CardContent className="space-y-3">
                    {selectedDayInfo.holidays.map((holiday, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">
                            {holiday.member.firstName} {holiday.member.lastName}
                          </p>
                          <p className="text-sm text-gray-600">{holiday.member.position}</p>
                          {holiday.reason && (
                            <p className="text-sm text-gray-500 mt-1">{holiday.reason}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className={`${PRIORITY_COLORS[holiday.priority as keyof typeof PRIORITY_COLORS]} text-white`}>
                          {PRIORITY_LABELS[holiday.priority as keyof typeof PRIORITY_LABELS]}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )}

            {/* Team Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Team Members:</span>
                    <span className="text-sm font-medium">{teamHolidays.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">With Holiday Plans:</span>
                    <span className="text-sm font-medium">
                      {teamHolidays.filter(m => m.holidays.length > 0).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Planning Coverage:</span>
                    <span className="text-sm font-medium">
                      {teamHolidays.length > 0 ? 
                        Math.round((teamHolidays.filter(m => m.holidays.length > 0).length / teamHolidays.length) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}