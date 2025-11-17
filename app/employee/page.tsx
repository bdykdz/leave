"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Users,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Home,
  Heart,
  ChevronLeft,
  ChevronRight,
  Shield,
  TrendingUp,
  Building,
} from "lucide-react"
import { LeaveRequestForm } from "@/components/leave-request-form"
import { WorkRemoteRequestForm } from "@/components/wfh-request-form"
import { TeamCalendar } from "@/components/team-calendar"
import { HolidaysList } from "@/components/HolidaysList"
import { DashboardSummary } from "@/components/dashboard-summary"
import { format } from "date-fns/format"
import { addMonths } from "date-fns/addMonths"
import { subMonths } from "date-fns/subMonths"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { signOut } from "next-auth/react"
import { useTranslations } from "@/components/language-provider"
import { LanguageToggle } from "@/components/language-toggle"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { toast } from "sonner"

export default function EmployeeDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const t = useTranslations()
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [showRemoteForm, setShowRemoteForm] = useState(false)
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [wfhCurrentMonth, setWfhCurrentMonth] = useState(new Date()) // For WFH pagination
  const [requestsCurrentPage, setRequestsCurrentPage] = useState(1) // For requests pagination
  const [leaveBalances, setLeaveBalances] = useState<any[]>([])
  const [loadingBalances, setLoadingBalances] = useState(true)
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [wfhRequests, setWfhRequests] = useState<any[]>([])
  const [allRequests, setAllRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [hasDirectReports, setHasDirectReports] = useState(false)
  const [wfhStats, setWfhStats] = useState({ 
    daysUsed: 0, 
    workingDaysInMonth: 22, 
    percentage: 0,
    monthName: format(new Date(), 'MMMM yyyy')
  })
  const [wfhStatsLoading, setWfhStatsLoading] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/login")
      return
    }

    // Check if HR employee should be redirected to HR dashboard
    if (session.user.role === "HR" || 
        (session.user.role === "EMPLOYEE" && session.user.department?.toLowerCase().includes("hr"))) {
      router.push("/hr")
      return
    }

    // All authenticated users can see their personal dashboard
    // No need to redirect based on role
    
    // Add a small delay to ensure all state is initialized
    const initTimer = setTimeout(() => {
      // Fetch leave balances and requests
      fetchLeaveBalances()
      fetchAllRequests()
      checkManagementStatus()
    }, 50)
    
    return () => clearTimeout(initTimer)
  }, [session, status, router])

  const fetchLeaveBalances = async () => {
    try {
      setLoadingBalances(true)
      const response = await fetch('/api/employee/leave-balance')
      if (response.ok) {
        const data = await response.json()
        setLeaveBalances(data.leaveBalances || [])
      } else {
        console.error('Failed to fetch leave balances:', response.status)
        setLeaveBalances([])
      }
    } catch (error) {
      console.error('Error fetching leave balances:', error)
      setLeaveBalances([])
    } finally {
      setLoadingBalances(false)
    }
  }

  const checkManagementStatus = async () => {
    // Check if current user has any direct reports
    try {
      const response = await fetch('/api/manager/team-members')
      if (response.ok) {
        const data = await response.json()
        // If user has team members, they have management responsibilities
        setHasDirectReports(data.teamMembers && data.teamMembers.length > 0)
      } else if (response.status === 403) {
        // User is not a manager, so they don't have direct reports
        setHasDirectReports(false)
      }
    } catch (error) {
      console.error('Error checking management status:', error)
      setHasDirectReports(false)
    }
  }

  const fetchAllRequests = async () => {
    try {
      setLoadingRequests(true)
      // Fetch both leave and WFH requests
      const [leaveResponse, wfhResponse] = await Promise.all([
        fetch('/api/leave-requests?year=all'),
        fetch('/api/wfh-requests?year=all')
      ])
      
      let leaveReqs: any[] = []
      let wfhReqs: any[] = []
      
      if (leaveResponse.ok) {
        try {
          const leaveData = await leaveResponse.json()
          console.log('Fetched leave requests:', leaveData.leaveRequests)
          leaveReqs = leaveData.leaveRequests || []
          setLeaveRequests(leaveReqs)
        } catch (parseError) {
          console.error('Error parsing leave requests response:', parseError)
          setLeaveRequests([])
        }
      } else {
        console.error('Failed to fetch leave requests:', leaveResponse.status)
        setLeaveRequests([])
      }
      
      if (wfhResponse.ok) {
        try {
          const wfhData = await wfhResponse.json()
          console.log('Fetched WFH requests:', wfhData.wfhRequests)
          wfhReqs = wfhData.wfhRequests || []
          setWfhRequests(wfhReqs)
        } catch (parseError) {
          console.error('Error parsing WFH requests response:', parseError)
          setWfhRequests([])
        }
      } else {
        console.error('Failed to fetch WFH requests:', wfhResponse.status)
        setWfhRequests([])
      }
      
      // Combine and sort all requests by created date
      const combinedRequests = [
        ...leaveReqs.map(r => ({ ...r, requestType: 'leave' })),
        ...wfhReqs.map(r => ({ 
          ...r, 
          requestType: 'wfh', 
          leaveType: { name: 'Work From Home' },
          reason: r.location // Map location to reason for display
        }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
      setAllRequests(combinedRequests)
    } catch (error) {
      console.error('Error fetching leave requests:', error)
      setLeaveRequests([])
      setWfhRequests([])
      setAllRequests([])
    } finally {
      setLoadingRequests(false)
    }
  }

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) {
      return;
    }

    // Prevent double-clicks
    if (cancellingRequestId) {
      return;
    }

    setCancellingRequestId(requestId);
    try {
      const response = await fetch(`/api/leave-requests/${requestId}/self-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Cancelled by employee'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel request');
      }

      // Refresh the requests list
      await fetchAllRequests();
      
      toast.success('Request cancelled successfully');
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to cancel request');
    } finally {
      setCancellingRequestId(null);
    }
  }

  // Fetch WFH stats for current selected month
  const fetchWfhStats = async (date: Date) => {
    // Guard against calling before component is ready
    if (!session || status === "loading") return
    
    setWfhStatsLoading(true)
    try {
      const monthKey = format(date, "yyyy-MM")
      const response = await fetch(`/api/employee/wfh-stats?month=${monthKey}`)
      if (response.ok) {
        const stats = await response.json()
        setWfhStats(stats)
      } else {
        // Fallback to default values if API fails
        setWfhStats({ 
          daysUsed: 0, 
          workingDaysInMonth: 22, 
          percentage: 0,
          monthName: format(date, 'MMMM yyyy')
        })
      }
    } catch (error) {
      console.error('Error fetching WFH stats:', error)
      // Fallback to default values
      setWfhStats({ 
        daysUsed: 0, 
        workingDaysInMonth: 22, 
        percentage: 0,
        monthName: format(date, 'MMMM yyyy')
      })
    } finally {
      setWfhStatsLoading(false)
    }
  }

  // Update WFH stats when month changes (only after session is loaded)
  // This useEffect MUST be called after all other hooks and before any returns
  useEffect(() => {
    if (status === "loading" || !session) return
    
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      fetchWfhStats(wfhCurrentMonth)
    }, 100)
    
    return () => clearTimeout(timer)
  }, [wfhCurrentMonth, session, status])

  // All hooks must be called before this point
  // Now we can have conditional returns

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!session) {
    return null
  }

  // Get specific leave types from balances
  const normalLeave = leaveBalances.find(b => b.leaveTypeCode === 'AL' || b.leaveTypeCode === 'NL')
  const sickLeave = leaveBalances.find(b => b.leaveTypeCode === 'SL')
  const specialLeaves = leaveBalances.filter(b => !['AL', 'NL', 'SL'].includes(b.leaveTypeCode))

  // Format request dates - moved before useEffect to maintain hook order
  const formatRequestDates = (request: any) => {
    // Always format the dates ourselves to ensure consistency
    const start = new Date(request.startDate)
    const end = new Date(request.endDate)
    
    // Check if we have selected dates (non-consecutive days)
    if (request.supportingDocuments?.selectedDates && Array.isArray(request.supportingDocuments.selectedDates)) {
      const selectedDates = request.supportingDocuments.selectedDates.map((d: string) => new Date(d))
      const sortedDates = selectedDates.sort((a: Date, b: Date) => a.getTime() - b.getTime())
      
      // Group consecutive dates
      const groups: Date[][] = []
      let currentGroup = [sortedDates[0]]
      
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = sortedDates[i - 1]
        const currDate = sortedDates[i]
        const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (dayDiff === 1) {
          currentGroup.push(currDate)
        } else {
          groups.push(currentGroup)
          currentGroup = [currDate]
        }
      }
      groups.push(currentGroup)
      
      // Format each group
      return groups.map(group => {
        if (group.length === 1) {
          return format(group[0], "MMM d")
        } else {
          return `${format(group[0], "MMM d")}-${format(group[group.length - 1], "d")}`
        }
      }).join(", ") + `, ${format(sortedDates[0], "yyyy")}`
    }
    
    // Single day request
    if (start.toDateString() === end.toDateString()) {
      return format(start, "EEEE, MMMM d, yyyy")
    }
    
    // Multi-day request in same month
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${format(start, "MMMM d")} - ${format(end, "d, yyyy")}`
    }
    
    // Multi-day request across months
    return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`
  }

  // Pagination for requests
  const requestsPerPage = 5
  const totalPages = Math.max(1, Math.ceil(allRequests.length / requestsPerPage))
  const startIndex = (requestsCurrentPage - 1) * requestsPerPage
  const endIndex = startIndex + requestsPerPage
  const currentRequests = allRequests.slice(startIndex, endIndex)

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "PENDING":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  }

  // WFH month navigation
  const previousWfhMonth = () => {
    setWfhCurrentMonth(subMonths(wfhCurrentMonth, 1))
  }

  const nextWfhMonth = () => {
    setWfhCurrentMonth(addMonths(wfhCurrentMonth, 1))
  }

  // Requests pagination
  const previousRequestsPage = () => {
    setRequestsCurrentPage(Math.max(1, requestsCurrentPage - 1))
  }

  const nextRequestsPage = () => {
    setRequestsCurrentPage(Math.min(totalPages, requestsCurrentPage + 1))
  }

  if (showRequestForm) {
    return <LeaveRequestForm onBack={() => {
      setShowRequestForm(false)
      // Refresh data when returning from form
      fetchLeaveBalances()
      fetchAllRequests()
    }} />
  }

  if (showRemoteForm) {
    return <WorkRemoteRequestForm onBack={() => {
      setShowRemoteForm(false)
      // Refresh data when returning from form
      fetchLeaveBalances()
      fetchAllRequests()
    }} />
  }

  const userName = `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || session.user.email

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
              <p className="text-gray-600">{t.dashboard.welcomeBack}, {userName}</p>
            </div>
            <div className="flex items-center gap-3">
              {(session.user.role === "ADMIN" || session.user.role === "EXECUTIVE") && (
                <Button onClick={() => router.push("/admin")} variant="outline" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Admin Dashboard
                </Button>
              )}
              {(session.user.role === "HR" || (session.user.role === "EMPLOYEE" && session.user.department?.includes("HR"))) && (
                <>
                  <Button onClick={() => router.push("/hr")} variant="outline" className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    HR Dashboard
                  </Button>
                  {hasDirectReports && (
                    <>
                      <Button onClick={() => router.push("/admin")} variant="outline" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin Dashboard
                      </Button>
                      <Button onClick={() => router.push("/manager")} variant="outline" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Manager Dashboard
                      </Button>
                    </>
                  )}
                </>
              )}
              {session.user.role === "EXECUTIVE" && (
                <>
                  <Button onClick={() => router.push("/executive")} variant="outline" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Executive Dashboard
                  </Button>
                  {hasDirectReports && (
                    <Button onClick={() => router.push("/manager")} variant="outline" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Manager Dashboard
                    </Button>
                  )}
                </>
              )}
              {session.user.role === "MANAGER" && (
                <Button onClick={() => router.push("/manager")} variant="outline" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Manager Dashboard
                </Button>
              )}
              <Button onClick={() => setShowRemoteForm(true)} variant="outline" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                {t.dashboard.newRemoteRequest}
              </Button>
              <Button onClick={() => setShowRequestForm(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {t.dashboard.newLeaveRequest}
              </Button>

              <LanguageToggle />
              <NotificationBell />

              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={session.user.image || undefined} />
                      <AvatarFallback>{session.user.firstName?.[0]}{session.user.lastName?.[0]}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{userName}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">{session.user.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t.nav.logout}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-4 mb-6">
          <Button variant={activeTab === "dashboard" ? "default" : "outline"} onClick={() => setActiveTab("dashboard")}>
            {t.nav.dashboard}
          </Button>
          <Button variant={activeTab === "calendar" ? "default" : "outline"} onClick={() => setActiveTab("calendar")}>
            {t.dashboard.teamCalendar}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/holiday-planning')}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            My Holiday Planning
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/department-holiday-view')}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Department Plans
          </Button>
        </div>

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Dashboard Summary */}
            <DashboardSummary userRole="EMPLOYEE" />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Leave Balance Cards */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Normal Leave Card */}
                {normalLeave && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{normalLeave.leaveTypeName}</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{normalLeave.available || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {normalLeave.used || 0} {t.leaveForm.used} of {normalLeave.entitled || 0} {t.leaveForm.days}
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${normalLeave.entitled > 0 ? ((normalLeave.used / normalLeave.entitled) * 100) : 0}%` }}
                        ></div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sick Leave Card */}
                {sickLeave && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{sickLeave.leaveTypeName}</CardTitle>
                      <Heart className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{sickLeave.used || 0}</div>
                      <p className="text-xs text-muted-foreground">{t.leaveForm.days} used this year</p>
                      <p className="text-xs text-gray-500 mt-2">No limit - tracked by HR</p>
                    </CardContent>
                  </Card>
                )}

                {/* Special Leave Summary Card */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t.leaveTypes.special}</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{specialLeaves.reduce((sum, leave) => sum + (leave.used || 0), 0)}</div>
                    <p className="text-xs text-muted-foreground">Total special leave {t.leaveForm.days} used</p>
                    <div className="text-xs text-gray-500 mt-2 space-y-1">
                      {specialLeaves.filter(leave => leave.used > 0).map(leave => (
                        <div key={leave.leaveTypeId}>{leave.leaveTypeName}: {leave.used} {t.leaveForm.days}</div>
                      ))}
                      {specialLeaves.filter(leave => leave.used > 0).length === 0 && (
                        <div>No special leave taken</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* WFH Usage Card with Pagination */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {t.remoteForm.title} - {format(wfhCurrentMonth, "MMMM yyyy")}
                    </CardTitle>
                    <Home className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={previousWfhMonth}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={nextWfhMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {wfhStatsLoading ? (
                    <div className="animate-pulse">
                      <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                      <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-blue-600">{wfhStats.daysUsed} {t.leaveForm.days}</div>
                      <p className="text-xs text-muted-foreground">
                        {wfhStats.daysUsed} of {wfhStats.workingDaysInMonth} working {t.leaveForm.days} this month
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${wfhStats.percentage}%` }}></div>
                      </div>
                      <p className="text-sm font-medium text-blue-600 mt-2">{wfhStats.percentage}% WFH this month</p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Recent Requests with Pagination */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Requests</CardTitle>
                      <CardDescription>Your latest leave and work from home requests</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        Page {requestsCurrentPage} of {totalPages}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={previousRequestsPage}
                          disabled={requestsCurrentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={nextRequestsPage}
                          disabled={requestsCurrentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingRequests ? (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-gray-500">Loading requests...</p>
                    </div>
                  ) : allRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No requests found</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {currentRequests.map((request) => (
                          <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(request.status)}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{request.leaveType?.name || "Leave"}</p>
                                  {request.requestType === 'wfh' && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">WFH</Badge>
                                  )}
                                  <span className="text-xs text-gray-500">• {request.totalDays} day{request.totalDays > 1 ? "s" : ""}</span>
                                </div>
                                <p className="text-sm text-gray-600">{formatRequestDates(request)}</p>
                                <p className="text-xs text-gray-500">
                                  Requested {format(new Date(request.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <Badge className={getStatusColor(request.status)}>
                                  {formatStatus(request.status)}
                                </Badge>
                                {(request.status.toUpperCase() === 'PENDING' || (request.status.toUpperCase() === 'APPROVED' && new Date(request.startDate) > new Date(new Date().setHours(0, 0, 0, 0)))) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCancelRequest(request.id)}
                                    disabled={cancellingRequestId === request.id}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 disabled:opacity-50"
                                  >
                                    {cancellingRequestId === request.id ? 'Cancelling...' : 'Cancel'}
                                  </Button>
                                )}
                              </div>
                              {request.status === 'PENDING' && request.approvals && request.approvals.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Awaiting approval
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination Footer */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <p className="text-sm text-gray-500">
                          Showing {startIndex + 1}-{Math.min(endIndex, allRequests.length)} of {allRequests.length} requests
                        </p>
                        <div className="flex gap-2">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <Button
                              key={page}
                              variant={page === requestsCurrentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => setRequestsCurrentPage(page)}
                              className="w-8 h-8 p-0"
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Upcoming Company Holidays */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Holidays</CardTitle>
                <CardDescription>Company-wide holidays</CardDescription>
              </CardHeader>
              <CardContent>
                <HolidaysList />
              </CardContent>
            </Card>
            </div>
          </div>
        )}

        {activeTab === "calendar" && <TeamCalendar />}
      </div>
    </div>
  )
}