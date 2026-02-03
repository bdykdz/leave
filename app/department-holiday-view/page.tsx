"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ArrowLeft, Users, Eye } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface HolidayPlan {
  id: string
  year: number
  status: 'SUBMITTED' | 'REVIEWED' | 'FINALIZED'
  submittedAt?: string
  dates: Array<{
    id: string
    date: string
    priority: 'ESSENTIAL' | 'PREFERRED' | 'NICE_TO_HAVE'
    reason?: string
  }>
  user: {
    firstName: string
    lastName: string
    employeeId: string
    department: string
    position: string
    role: string
  }
}

interface DepartmentSummary {
  totalMembers: number
  membersWithPlans: number
  planningCoverage: number
}

const PRIORITY_OPTIONS = [
  { value: 'ESSENTIAL', label: 'Essential', color: 'bg-red-500' },
  { value: 'PREFERRED', label: 'Preferred', color: 'bg-blue-500' },
  { value: 'NICE_TO_HAVE', label: 'Nice to Have', color: 'bg-green-500' }
]

const STATUS_COLORS = {
  'SUBMITTED': 'bg-yellow-500',
  'REVIEWED': 'bg-green-500',
  'FINALIZED': 'bg-blue-500'
}

const ROLE_ORDER = {
  'EXECUTIVE': 1,
  'DIRECTOR': 2,
  'MANAGER': 3,
  'EMPLOYEE': 4
}

export default function DepartmentHolidayViewPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [holidayPlans, setHolidayPlans] = useState<HolidayPlan[]>([])
  const [summary, setSummary] = useState<DepartmentSummary | null>(null)
  const [department, setDepartment] = useState('')
  const [loading, setLoading] = useState(true)

  const currentYear = new Date().getFullYear()
  const planningYear = currentYear + 1

  useEffect(() => {
    if (session) {
      loadDepartmentHolidayPlans()
    }
  }, [session])

  const loadDepartmentHolidayPlans = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/holiday-planning/department-view?year=${planningYear}`)
      
      if (response.ok) {
        const data = await response.json()
        setHolidayPlans(data.departmentPlans || [])
        setSummary(data.summary)
        setDepartment(data.department)
      } else {
        console.error('Failed to load department holiday plans')
      }
    } catch (error) {
      console.error('Error loading department holiday plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-500'
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'Pending Review'
      case 'REVIEWED': return 'Approved'
      case 'FINALIZED': return 'Finalized'
      default: return status
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'EXECUTIVE': return '👑'
      case 'DIRECTOR': return '🎯'
      case 'MANAGER': return '👤'
      default: return '👨‍💼'
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please log in to view department holiday plans</p>
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
          <p>Loading department holiday plans...</p>
        </div>
      </div>
    )
  }

  // Group plans by month for better visualization
  const plansByMonth: { [key: string]: HolidayPlan[] } = {}
  holidayPlans.forEach(plan => {
    plan.dates.forEach(date => {
      const month = format(parseISO(date.date), 'MMMM yyyy')
      if (!plansByMonth[month]) {
        plansByMonth[month] = []
      }
      if (!plansByMonth[month].find(p => p.id === plan.id)) {
        plansByMonth[month].push(plan)
      }
    })
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {department} Department - Holiday Plans {planningYear}
              </h1>
              <p className="text-gray-600">View your colleagues' approved holiday plans</p>
            </div>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Department Summary */}
        {summary && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Department Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{summary.totalMembers}</p>
                  <p className="text-sm text-gray-600">Total Members</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{summary.membersWithPlans}</p>
                  <p className="text-sm text-gray-600">Plans Submitted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{summary.planningCoverage.toFixed(0)}%</p>
                  <p className="text-sm text-gray-600">Planning Coverage</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {holidayPlans.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Holiday Plans Yet</h3>
            <p className="text-gray-600">No approved holiday plans to display for {planningYear}.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Team Members Plans */}
            <Card>
              <CardHeader>
                <CardTitle>Team Holiday Plans</CardTitle>
                <CardDescription>
                  Approved holiday plans from your department colleagues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {holidayPlans
                    .sort((a, b) => {
                      const roleA = ROLE_ORDER[a.user.role as keyof typeof ROLE_ORDER] || 5
                      const roleB = ROLE_ORDER[b.user.role as keyof typeof ROLE_ORDER] || 5
                      if (roleA !== roleB) return roleA - roleB
                      return `${a.user.lastName} ${a.user.firstName}`.localeCompare(`${b.user.lastName} ${b.user.firstName}`)
                    })
                    .map((plan) => (
                      <div key={plan.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{getRoleIcon(plan.user.role)}</span>
                            <div>
                              <h4 className="font-medium">
                                {plan.user.firstName} {plan.user.lastName}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {plan.user.position} • {plan.user.employeeId}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={`${getStatusBadgeColor(plan.status)} text-white`}>
                              {formatStatus(plan.status)}
                            </Badge>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4 mr-1" />
                                  View Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>
                                    {plan.user.firstName} {plan.user.lastName}'s Holiday Plan
                                  </DialogTitle>
                                  <DialogDescription>
                                    Holiday planning for {planningYear}
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                  {plan.dates.length === 0 ? (
                                    <p className="text-gray-600">No specific dates planned</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {plan.dates
                                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                        .map((date, index) => {
                                          const priority = PRIORITY_OPTIONS.find(p => p.value === date.priority)
                                          return (
                                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                              <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${priority?.color}`}></div>
                                                <div>
                                                  <p className="font-medium">
                                                    {format(parseISO(date.date), 'EEEE, MMMM d, yyyy')}
                                                  </p>
                                                  {date.reason && (
                                                    <p className="text-sm text-gray-600">{date.reason}</p>
                                                  )}
                                                </div>
                                              </div>
                                              <Badge variant="secondary">{priority?.label}</Badge>
                                            </div>
                                          )
                                        })}
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Total Days:</span>
                            <span className="font-medium ml-1">{plan.dates.length}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Essential Days:</span>
                            <span className="font-medium ml-1">
                              {plan.dates.filter(d => d.priority === 'ESSENTIAL').length}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">First Holiday:</span>
                            <span className="font-medium ml-1">
                              {plan.dates.length > 0 
                                ? format(parseISO(plan.dates[0].date), 'MMM d')
                                : 'N/A'
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}