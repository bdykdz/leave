"use client"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Calendar, Users, X, Home } from "lucide-react"
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
import { cn } from "@/lib/utils"

interface TeamMember {
  id: string
  name: string
  avatar: string
  color: string
  department: string
  location?: string // Added location for remote work
  leaves: {
    id: string
    type: string
    startDate: Date
    endDate: Date
    status: "approved" | "pending" | "denied"
    reason?: string
    replacedBy?: string
  }[]
}

interface DayDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  date: Date | null
  teamMembers: TeamMember[]
}

function DayDetailsModal({ isOpen, onClose, date, teamMembers }: DayDetailsModalProps) {
  if (!date) return null

  const leavesForDate = teamMembers
    .map((member) => {
      const leave = member.leaves.find((leave) =>
        isWithinInterval(date, {
          start: leave.startDate,
          end: leave.endDate,
        }),
      )
      return leave ? { member, leave } : null
    })
    .filter(Boolean) as Array<{ member: TeamMember; leave: TeamMember["leaves"][0] }>

  // Separate WFH from actual leave
  const actualLeave = leavesForDate.filter(({ leave }) => leave.type !== "Remote Work")
  const wfhRequests = leavesForDate.filter(({ leave }) => leave.type === "Remote Work")

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
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
          {/* Team Members Away */}
          {actualLeave.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-red-600">Team Members Away ({actualLeave.length})</h3>
              <div className="space-y-3">
                {actualLeave.map(({ member, leave }) => (
                  <div key={`${member.id}-${leave.id}`} className="flex items-start gap-4 p-4 border rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={`/placeholder.svg?height=40&width=40&text=${member.avatar}`} />
                      <AvatarFallback>{member.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{member.name}</h4>
                        <Badge className={getStatusColor(leave.status)}>{leave.status}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{member.department}</p>
                      <p className="text-sm">
                        <span className="font-medium">{leave.type}</span> • {format(leave.startDate, "MMM d")}
                        {!isSameDay(leave.startDate, leave.endDate) && ` - ${format(leave.endDate, "MMM d")}`}
                      </p>
                      {leave.reason && <p className="text-sm text-gray-500 mt-1">"{leave.reason}"</p>}
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
                Working Remotely ({wfhRequests.length})
              </h3>
              <div className="space-y-3">
                {wfhRequests.map(({ member, leave }) => (
                  <div
                    key={`wfh-${member.id}-${leave.id}`}
                    className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={`/placeholder.svg?height=40&width=40&text=${member.avatar}`} />
                      <AvatarFallback>{member.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{member.name}</h4>
                        <Badge className={getStatusColor(leave.status)}>{leave.status}</Badge>
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          Remote
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{member.department}</p>
                      {member.location && <p className="text-sm text-gray-600 mb-1">Location: {member.location}</p>}
                      <p className="text-sm">
                        <span className="font-medium">Remote Work</span> • {format(leave.startDate, "MMM d")}
                        {!isSameDay(leave.startDate, leave.endDate) && ` - ${format(leave.endDate, "MMM d")}`}
                      </p>
                      {leave.reason && <p className="text-sm text-gray-500 mt-1">"{leave.reason}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Replacing Members */}
          {actualLeave.filter(({ leave }) => leave.replacedBy).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-orange-600">
                Replacing Members ({actualLeave.filter(({ leave }) => leave.replacedBy).length})
              </h3>
              <div className="space-y-3">
                {actualLeave
                  .filter(({ leave }) => leave.replacedBy)
                  .map(({ member, leave }) => (
                    <div
                      key={`replace-${member.id}-${leave.id}`}
                      className="flex items-center gap-4 p-4 bg-orange-50 border border-orange-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={`/placeholder.svg?height=32&width=32&text=${leave.replacedBy?.charAt(0)}`}
                          />
                          <AvatarFallback className="text-xs">{leave.replacedBy?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{leave.replacedBy}</p>
                          <p className="text-xs text-gray-600">Covering for {member.name}</p>
                        </div>
                      </div>
                      <div className="flex-1 text-right">
                        <p className="text-sm text-gray-600">{member.department}</p>
                        <p className="text-xs text-orange-600">Replacement duties</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {(actualLeave.length > 0 || wfhRequests.length > 0) && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semiboldld mb-2">Day Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold text-red-600">{actualLeave.length}</div>
                  <div className="text-xs text-gray-600">Away</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-600">{wfhRequests.length}</div>
                  <div className="text-xs text-gray-600">Remote</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-600">
                    {teamMembers.length - actualLeave.length - wfhRequests.length}
                  </div>
                  <div className="text-xs text-gray-600">In Office</div>
                </div>
              </div>
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

  // Mock team data with WFH requests
  const teamMembers: TeamMember[] = [
    {
      id: "1",
      name: "Sarah Johnson",
      avatar: "SJ",
      color: "bg-blue-500",
      department: "Engineering",
      location: "Home Office",
      leaves: [
        {
          id: "1",
          type: "Vacation",
          startDate: new Date(2025, 0, 15),
          endDate: new Date(2025, 0, 17),
          status: "approved",
          reason: "Family trip to Hawaii",
          replacedBy: "David Kim",
        },
        {
          id: "2",
          type: "Remote Work",
          startDate: new Date(2025, 0, 22),
          endDate: new Date(2025, 0, 22),
          status: "approved",
          reason: "Home internet installation",
        },
      ],
    },
    {
      id: "2",
      name: "Michael Chen",
      avatar: "MC",
      color: "bg-green-500",
      department: "Engineering",
      location: "Home",
      leaves: [
        {
          id: "3",
          type: "Vacation",
          startDate: new Date(2025, 0, 27),
          endDate: new Date(2025, 0, 30),
          status: "approved",
          reason: "Year-end break",
          replacedBy: "Anna Thompson",
        },
        {
          id: "4",
          type: "Remote Work",
          startDate: new Date(2025, 0, 20),
          endDate: new Date(2025, 0, 21),
          status: "approved",
          reason: "Focus time for project deadline",
        },
      ],
    },
    {
      id: "3",
      name: "Emily Rodriguez",
      avatar: "ER",
      color: "bg-purple-500",
      department: "Design",
      location: "Remote Location",
      leaves: [
        {
          id: "5",
          type: "Personal",
          startDate: new Date(2025, 0, 8),
          endDate: new Date(2025, 0, 8),
          status: "approved",
        },
        {
          id: "6",
          type: "Remote Work",
          startDate: new Date(2025, 0, 24),
          endDate: new Date(2025, 0, 24),
          status: "pending",
          reason: "Design review with remote client",
        },
      ],
    },
    {
      id: "4",
      name: "David Kim",
      avatar: "DK",
      color: "bg-orange-500",
      department: "Product",
      leaves: [
        {
          id: "7",
          type: "Sick",
          startDate: new Date(2025, 0, 18),
          endDate: new Date(2025, 0, 18),
          status: "approved",
        },
      ],
    },
    {
      id: "5",
      name: "Lisa Wang",
      avatar: "LW",
      color: "bg-pink-500",
      department: "Marketing",
      location: "Home",
      leaves: [
        {
          id: "8",
          type: "Vacation",
          startDate: new Date(2025, 0, 26),
          endDate: new Date(2025, 0, 26),
          status: "approved",
          replacedBy: "James Wilson",
        },
        {
          id: "9",
          type: "Remote Work",
          startDate: new Date(2025, 0, 23),
          endDate: new Date(2025, 0, 23),
          status: "approved",
          reason: "Marketing campaign planning",
        },
      ],
    },
    {
      id: "6",
      name: "James Wilson",
      avatar: "JW",
      color: "bg-indigo-500",
      department: "Sales",
      location: "Client Site",
      leaves: [
        {
          id: "10",
          type: "Personal",
          startDate: new Date(2025, 1, 5),
          endDate: new Date(2025, 1, 5),
          status: "pending",
        },
        {
          id: "11",
          type: "Remote Work",
          startDate: new Date(2025, 0, 25),
          endDate: new Date(2025, 0, 25),
          status: "approved",
          reason: "Client calls in different timezone",
        },
      ],
    },
    {
      id: "7",
      name: "Anna Thompson",
      avatar: "AT",
      color: "bg-teal-500",
      department: "HR",
      leaves: [],
    },
    {
      id: "8",
      name: "Robert Garcia",
      avatar: "RG",
      color: "bg-red-500",
      department: "Finance",
      location: "Home",
      leaves: [
        {
          id: "12",
          type: "Remote Work",
          startDate: new Date(2025, 0, 29),
          endDate: new Date(2025, 0, 29),
          status: "approved",
          reason: "Month-end financial reports",
        },
      ],
    },
  ]

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

  const getLeavesForDate = (date: Date) => {
    const leaves: Array<{
      member: TeamMember
      leave: TeamMember["leaves"][0]
      isStart: boolean
      isEnd: boolean
    }> = []

    teamMembers.forEach((member) => {
      member.leaves.forEach((leave) => {
        if (
          isWithinInterval(date, {
            start: leave.startDate,
            end: leave.endDate,
          })
        ) {
          leaves.push({
            member,
            leave,
            isStart: isSameDay(date, leave.startDate),
            isEnd: isSameDay(date, leave.endDate),
          })
        }
      })
    })

    return leaves
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

      {/* Quick Stats - Moved above calendar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">3</div>
              <div className="text-sm text-gray-600">In Office</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">5</div>
              <div className="text-sm text-gray-600">Remote</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">5</div>
              <div className="text-sm text-gray-600">On Leave</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">2</div>
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
            {calendarDays.map((date, index) => {
              const leavesForDate = getLeavesForDate(date)
              const isCurrentMonth = isSameMonth(date, currentMonth)
              const isWeekendDay = isWeekend(date)

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-32 p-2 border-r border-b relative cursor-pointer hover:bg-gray-50 transition-colors",
                    !isCurrentMonth && "bg-gray-50",
                    isWeekendDay && "bg-gray-25",
                  )}
                  onClick={() => handleDayClick(date)}
                >
                  {/* Date number */}
                  <div
                    className={cn(
                      "text-sm font-medium mb-2",
                      !isCurrentMonth && "text-gray-400",
                      isWeekendDay && "text-gray-500",
                    )}
                  >
                    {format(date, "d")}
                  </div>

                  {/* Leave blocks with names */}
                  <div className="space-y-1">
                    {leavesForDate.slice(0, 3).map((item, leaveIndex) => {
                      const isWFH = item.leave.type === "Remote Work"
                      return (
                        <div
                          key={`${item.member.id}-${item.leave.id}-${leaveIndex}`}
                          className={cn(
                            "text-xs px-2 py-1 rounded font-medium cursor-pointer hover:opacity-80 transition-opacity",
                            isWFH
                              ? "bg-blue-100 text-blue-800 border border-blue-300"
                              : `${item.member.color} text-white`,
                            item.leave.status === "pending" && "opacity-70 border-dashed",
                          )}
                          title={`${item.member.name} - ${item.leave.type} (${item.leave.status})`}
                        >
                          {item.isStart ? (
                            <span className="truncate block flex items-center gap-1">
                              {isWFH && <Home className="h-3 w-3" />}
                              {item.member.name.split(" ")[0]} - {isWFH ? "Remote" : item.leave.type}
                            </span>
                          ) : (
                            <span className="truncate block flex items-center gap-1">
                              {isWFH && <Home className="h-3 w-3" />}
                              {item.member.name.split(" ")[0]} •••
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {leavesForDate.length > 3 && (
                      <div className="text-xs px-2 py-1 bg-gray-500 text-white rounded font-medium">
                        +{leavesForDate.length - 3} more
                      </div>
                    )}
                  </div>

                  {/* Click indicator */}
                  {leavesForDate.length > 0 && <div className="absolute bottom-1 right-1 text-xs text-gray-400">👁️</div>}
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
        teamMembers={teamMembers}
      />
    </div>
  )
}
