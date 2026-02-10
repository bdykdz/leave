"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MobileNav } from "@/components/mobile/mobile-nav"
import { MobileManagerDashboard } from "@/components/mobile/mobile-manager-dashboard"
import {
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Home,
  ChevronLeft,
  ChevronRight,
  Clock,
  TrendingUp,
  UserCheck,
  UserX,
  Plus,
  Heart,
  AlertTriangle,
  CalendarDays,
  Building,
  BarChart3,
  ChevronDown,
} from "lucide-react"
import { TeamCalendar } from "@/components/team-calendar"
import { LeaveRequestForm } from "@/components/leave-request-form"
import { WorkRemoteRequestForm } from "@/components/wfh-request-form"
import { ApprovalDialogV2 } from "@/components/approval-dialog-v2"
import { DashboardSummary } from "@/components/dashboard-summary"
import { DelegationManager } from "@/components/manager/DelegationManager"
import { format, addMonths, subMonths } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, User } from "lucide-react"
import { toast } from "sonner"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTranslations } from "@/components/language-provider"
import { LanguageToggle } from "@/components/language-toggle"
import { NotificationBell } from "@/components/notifications/NotificationBell"

export default function ManagerDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const t = useTranslations()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [pendingRequestsPage, setPendingRequestsPage] = useState(1)
  const [teamStatsMonth, setTeamStatsMonth] = useState(new Date())
  const [myRequestsPage, setMyRequestsPage] = useState(1)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [showRemoteForm, setShowWFHForm] = useState(false)
  const [managerWfhMonth, setManagerWfhMonth] = useState(new Date())
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalDetails, setApprovalDetails] = useState<{
    action: "approve" | "deny"
    request: {
      id: string
      employeeName: string
      type: string
      dates: string
      days: number
      requestType?: string
    }
  } | null>(null)

  // State for real data
  const [loading, setLoading] = useState(true)
  const [managerLeaveBalance, setManagerLeaveBalance] = useState({
    vacation: { used: 0, total: 0 },
    personal: { used: 0, total: 0 },
    medical: { used: 0 },
  })
  const [teamStats, setTeamStats] = useState({
    totalMembers: 0,
    onLeaveToday: 0,
    workingFromHome: 0,
    inOffice: 0,
    pendingRequests: 0,
  })
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [totalPendingPages, setTotalPendingPages] = useState(0)
  const [approvedRequests, setApprovedRequests] = useState<any[]>([])
  const [totalApprovedPages, setTotalApprovedPages] = useState(0)
  const [deniedRequests, setDeniedRequests] = useState<any[]>([])
  const [totalDeniedPages, setTotalDeniedPages] = useState(0)
  const [teamRequestsTab, setTeamRequestsTab] = useState<'pending' | 'approved' | 'denied'>('pending')
  const [approvedRequestsPage, setApprovedRequestsPage] = useState(1)
  const [deniedRequestsPage, setDeniedRequestsPage] = useState(1)
  const [superior, setSuperior] = useState<any>(null)
  const [loadingSuperior, setLoadingSuperior] = useState(true)

  // Manager's WFH stats
  const [managerWfhStats, setManagerWfhStats] = useState({ 
    daysUsed: 0, 
    workingDaysInMonth: 22, 
    percentage: 0 
  })

  // Manager's own requests
  const [managerRequests, setManagerRequests] = useState<any[]>([])
  const [myRequestsTotalPages, setMyRequestsTotalPages] = useState(1)
  const myRequestsPerPage = 3

  // Team WFH stats
  const [teamWfhStats, setTeamWfhStats] = useState({ 
    averageWfhPercentage: 0, 
    totalWfhDays: 0, 
    totalWorkingDays: 0 
  })

  // All hooks must be called before any conditional returns
  // Fetch manager's leave balance
  useEffect(() => {
    if (status === "loading" || !session) return
    fetchManagerLeaveBalance()
    fetchSuperior()
  }, [session, status])

  // Fetch team stats
  useEffect(() => {
    if (status === "loading" || !session) return
    fetchTeamStats()
  }, [session, status])

  // Fetch pending requests
  useEffect(() => {
    if (status === "loading" || !session) return
    fetchPendingRequests()
  }, [pendingRequestsPage, session, status])

  // Fetch approved requests
  useEffect(() => {
    if (status === "loading" || !session) return
    if (teamRequestsTab === 'approved') {
      fetchApprovedRequests()
    }
  }, [approvedRequestsPage, teamRequestsTab, session, status])

  // Fetch denied requests
  useEffect(() => {
    if (status === "loading" || !session) return
    if (teamRequestsTab === 'denied') {
      fetchDeniedRequests()
    }
  }, [deniedRequestsPage, teamRequestsTab, session, status])

  // Fetch manager's WFH stats
  useEffect(() => {
    if (status === "loading" || !session) return
    fetchManagerWfhStats()
  }, [session, status])

  // Fetch manager's own requests
  useEffect(() => {
    if (status === "loading" || !session) return
    fetchManagerOwnRequests()
  }, [myRequestsPage, session, status])

  // Fetch team WFH stats
  useEffect(() => {
    if (status === "loading" || !session) return
    fetchTeamWfhStats()
  }, [session, status])

  const fetchSuperior = async () => {
    try {
      setLoadingSuperior(true)
      const response = await fetch('/api/manager/superior')
      if (response.ok) {
        const data = await response.json()
        setSuperior(data.superior)
      }
    } catch (error) {
      console.error('Error fetching superior:', error)
    } finally {
      setLoadingSuperior(false)
    }
  }

  const fetchManagerLeaveBalance = async () => {
    try {
      const response = await fetch('/api/manager/leave-balance')
      if (response.ok) {
        const data = await response.json()
        setManagerLeaveBalance(data)
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error)
      toast.error(t.messages.failedToLoadBalance)
    }
  }

  const fetchTeamStats = async () => {
    try {
      const response = await fetch('/api/manager/team/overview')
      if (response.ok) {
        const data = await response.json()
        setTeamStats(data)
      }
    } catch (error) {
      console.error('Error fetching team stats:', error)
      toast.error(t.messages.failedToLoadTeamStats)
    }
  }

  const fetchPendingRequests = async () => {
    try {
      setLoading(true)
      // Fetch more requests per page to ensure nothing is missed
      const response = await fetch(`/api/manager/team/pending-approvals?page=${pendingRequestsPage}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setPendingRequests(data.requests)
        setTotalPendingPages(data.pagination.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error)
      toast.error(t.messages.failedToLoadRequests)
    } finally {
      setLoading(false)
    }
  }

  const fetchApprovedRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/manager/team/approved-requests?page=${approvedRequestsPage}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setApprovedRequests(data.requests)
        setTotalApprovedPages(data.pagination.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching approved requests:', error)
      toast.error(t.messages.failedToLoadApprovedRequests)
    } finally {
      setLoading(false)
    }
  }

  const fetchManagerWfhStats = async () => {
    try {
      const response = await fetch('/api/manager/wfh-stats')
      if (response.ok) {
        const data = await response.json()
        setManagerWfhStats(data)
      }
    } catch (error) {
      console.error('Error fetching manager WFH stats:', error)
    }
  }

  const fetchManagerOwnRequests = async () => {
    try {
      const response = await fetch(`/api/manager/own-requests?page=${myRequestsPage}&limit=${myRequestsPerPage}`)
      if (response.ok) {
        const data = await response.json()
        setManagerRequests(data.requests)
        setMyRequestsTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Error fetching manager requests:', error)
    }
  }

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm(t.messages.confirmCancelRequest)) {
      return;
    }

    try {
      const response = await fetch(`/api/leave-requests/${requestId}/self-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Cancelled by manager'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel request');
      }

      // Refresh the requests list
      await fetchManagerOwnRequests();
      
      toast.success(t.messages.requestCancelledSuccess);
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast.error(error instanceof Error ? error.message : t.messages.failedToCancelRequest);
    }
  }

  const fetchTeamWfhStats = async () => {
    try {
      const response = await fetch('/api/manager/team/wfh-stats')
      if (response.ok) {
        const data = await response.json()
        setTeamWfhStats(data)
      }
    } catch (error) {
      console.error('Error fetching team WFH stats:', error)
    }
  }

  const fetchDeniedRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/manager/team/denied-requests?page=${deniedRequestsPage}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setDeniedRequests(data.requests)
        setTotalDeniedPages(data.pagination.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching denied requests:', error)
      toast.error(t.messages.failedToLoadDeniedRequests)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: string, comment?: string) => {
    try {
      const requestType = approvalDetails?.request?.requestType || 'leave'
      const response = await fetch(`/api/manager/team/approve-request/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment, requestType })
      })
      
      if (response.ok) {
        toast.success(t.messages.requestApprovedSuccess)
        // Refresh all data
        await Promise.all([
          fetchPendingRequests(),
          fetchTeamStats(),
          fetchApprovedRequests() // Always refresh approved requests
        ])
        setShowApprovalDialog(false)
      } else {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        toast.error(errorData.details || t.messages.failedToApprove)
      }
    } catch (error) {
      console.error('Error approving request:', error)
      toast.error(t.messages.failedToApprove)
    }
  }

  const handleDeny = async (requestId: string, comment?: string) => {
    try {
      const requestType = approvalDetails?.request?.requestType || 'leave'
      const response = await fetch(`/api/manager/team/deny-request/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment, requestType })
      })
      
      if (response.ok) {
        toast.success(t.messages.requestDeniedSuccess)
        // Refresh all data
        await Promise.all([
          fetchPendingRequests(),
          fetchTeamStats(),
          fetchDeniedRequests() // Always refresh denied requests
        ])
        setShowApprovalDialog(false)
      } else {
        toast.error(t.messages.failedToDeny)
      }
    } catch (error) {
      console.error('Error denying request:', error)
      toast.error(t.messages.failedToDeny)
    }
  }

  // Pagination for pending requests
  const pendingRequestsPerPage = 4
  const startIndex = (pendingRequestsPage - 1) * pendingRequestsPerPage
  const paginatedPendingRequests = pendingRequests.slice(startIndex, startIndex + pendingRequestsPerPage)

  // Manager's own requests are already paginated from the API
  const currentMyRequests = managerRequests

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "denied":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800"
      case "denied":
        return "bg-red-100 text-red-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleApproveRequest = (request: any) => {
    setApprovalDetails({
      action: "approve",
      request: {
        id: request?.id || '',
        employeeName: request.employee?.name || 'Unknown',
        type: request?.type || 'Unknown',
        dates: request?.dates || 'N/A',
        days: request?.days || 0,
        requestType: request?.requestType || 'leave',
      },
    })
    setShowApprovalDialog(true)
  }

  const handleDenyRequest = (request: any) => {
    setApprovalDetails({
      action: "deny",
      request: {
        id: request?.id || '',
        employeeName: request.employee?.name || 'Unknown',
        type: request?.type || 'Unknown',
        dates: request?.dates || 'N/A',
        days: request?.days || 0,
        requestType: request?.requestType || 'leave',
      },
    })
    setShowApprovalDialog(true)
  }

  const handleApprovalResponse = async (requestId: string, action: 'approve' | 'reject' | 'request_revision', comments?: string) => {
    try {
      if (action === 'approve') {
        await handleApprove(requestId, comments)
      } else if (action === 'reject') {
        await handleDeny(requestId, comments)
      }
      // Note: 'request_revision' is not implemented yet, but included for mobile component compatibility
    } catch (error) {
      console.error('Error processing approval:', error)
      toast.error('Failed to process request')
    }
  }

  // Navigation functions
  const previousTeamStatsMonth = () => {
    setTeamStatsMonth(subMonths(teamStatsMonth, 1))
  }

  const nextTeamStatsMonth = () => {
    setTeamStatsMonth(addMonths(teamStatsMonth, 1))
  }

  const previousManagerWfhMonth = () => {
    setManagerWfhMonth(subMonths(managerWfhMonth, 1))
  }

  const nextManagerWfhMonth = () => {
    setManagerWfhMonth(addMonths(managerWfhMonth, 1))
  }

  const previousRequestsPage = () => {
    setPendingRequestsPage(Math.max(1, pendingRequestsPage - 1))
  }

  const nextRequestsPage = () => {
    setPendingRequestsPage(Math.min(totalPendingPages, pendingRequestsPage + 1))
  }

  const previousMyRequestsPage = () => {
    setMyRequestsPage(Math.max(1, myRequestsPage - 1))
  }

  const nextMyRequestsPage = () => {
    setMyRequestsPage(Math.max(1, Math.min(myRequestsTotalPages, myRequestsPage + 1)))
  }

  // Check session status
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Check if user should access manager dashboard
  const isHREmployee = session?.user.role === "EMPLOYEE" && session?.user.department?.toLowerCase().includes("hr")
  
  if (!session || !["MANAGER", "DEPARTMENT_DIRECTOR", "HR", "EXECUTIVE"].includes(session.user.role)) {
    // HR employees should go to HR dashboard
    if (isHREmployee) {
      router.push('/hr')
    } else {
      router.push('/')
    }
    return null
  }

  // Helper function to get the correct dashboard route based on user role
  const getDashboardRoute = () => {
    switch (session?.user.role) {
      case "EXECUTIVE":
        return "/executive"
      case "MANAGER":
      case "DEPARTMENT_DIRECTOR":
        return "/manager"
      case "HR":
        return "/hr"
      case "EMPLOYEE":
      default:
        return "/employee"
    }
  }

  if (showRequestForm) {
    return <LeaveRequestForm onBack={() => setShowRequestForm(false)} />
  }

  if (showRemoteForm) {
    return <WorkRemoteRequestForm onBack={() => setShowWFHForm(false)} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-3">
                <MobileNav pendingCount={pendingRequests.length} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(getDashboardRoute())}
                  title={t.nav.backToPersonalDashboard}
                  className="hidden md:flex"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t.nav.dashboard} - {t.roles.manager}</h1>
                <p className="text-sm md:text-base text-gray-600">
                  {(session?.user?.firstName && session?.user?.lastName) ? `${session.user.firstName} ${session.user.lastName}` : (session?.user?.name || session?.user?.email || 'User')} - {session?.user?.department || 'Department'} {session?.user?.role === 'MANAGER' ? 'Manager' : session?.user?.role === 'DEPARTMENT_DIRECTOR' ? 'Director' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              {/* Hide text on mobile for these buttons */}
              <Button 
                onClick={() => router.push(getDashboardRoute())} 
                variant="outline" 
                className="hidden md:flex items-center gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                {t.nav.myDashboard}
              </Button>
              
              {/* Mobile-only button - icon only */}
              <Button 
                onClick={() => router.push(getDashboardRoute())} 
                variant="outline" 
                size="icon"
                className="md:hidden"
                title="My Dashboard"
              >
                <CalendarDays className="h-4 w-4" />
              </Button>

              {(session.user.role === "HR" || (session.user.role === "MANAGER" && session.user.department?.includes("HR"))) && (
                <>
                  <Button onClick={() => router.push("/hr")} variant="outline" className="hidden md:flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {t.nav.hrDashboard}
                  </Button>
                  <Button
                    onClick={() => router.push("/hr")}
                    variant="outline"
                    size="icon"
                    className="md:hidden"
                    title={t.nav.hrDashboard}
                  >
                    <Building className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              {/* Responsive badge */}
              <Badge
                variant="outline"
                className="text-xs md:text-sm bg-red-50 border-red-200 text-red-700 flex items-center gap-1"
              >
                <AlertTriangle className="h-3 w-3" />
                <span className="hidden sm:inline">{teamStats.pendingRequests} {t.labels.teamApprovalsEnding}</span>
                <span className="sm:hidden">{teamStats.pendingRequests}</span>
              </Badge>

              {/* Mobile-only action buttons */}
              <div className="flex md:hidden gap-1">
                <Button 
                  onClick={() => setShowWFHForm(true)} 
                  variant="outline" 
                  size="icon"
                  title="Work From Home Request"
                >
                  <Home className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => setShowRequestForm(true)} 
                  size="icon"
                  title="New Leave Request"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Desktop action buttons */}
              <div className="hidden md:flex gap-2">
                <Button onClick={() => setShowWFHForm(true)} variant="outline" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  {t.dashboard.newRemoteRequest}
                </Button>
                <Button onClick={() => setShowRequestForm(true)} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t.dashboard.newLeaveRequest}
                </Button>
              </div>

              <LanguageToggle />
              <NotificationBell />

              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={session?.user?.image || undefined} />
                      <AvatarFallback>
                        {(session?.user?.firstName && session?.user?.lastName) ? `${session?.user?.firstName?.[0] || ''}${session?.user?.lastName?.[0] || ''}` : (session?.user?.name ? session?.user?.name.split(' ').map(n => n?.[0] || '').join('').toUpperCase() : session?.user?.email?.[0]?.toUpperCase() || 'U')}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{(session?.user?.firstName && session?.user?.lastName) ? `${session.user.firstName} ${session.user.lastName}` : (session?.user?.name || session?.user?.email || 'User')}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">{session?.user?.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={() => signOut({ callbackUrl: '/login' })}>
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
        <div className="flex gap-2 md:gap-4 mb-6 overflow-x-auto pb-2">
          <Button 
            variant={activeTab === "dashboard" ? "default" : "outline"} 
            onClick={() => setActiveTab("dashboard")}
            size="sm"
            className="whitespace-nowrap"
          >
            {t.nav.dashboard}
          </Button>
          <Button 
            variant={activeTab === "team" ? "default" : "outline"} 
            onClick={() => setActiveTab("team")}
            size="sm"
            className="whitespace-nowrap"
          >
            {t.dashboard.teamOverview}
          </Button>
          <Button 
            variant={activeTab === "calendar" ? "default" : "outline"} 
            onClick={() => setActiveTab("calendar")}
            size="sm"
            className="whitespace-nowrap"
          >
            {t.dashboard.teamCalendar}
          </Button>
          <Button 
            variant={activeTab === "delegation" ? "default" : "outline"} 
            onClick={() => setActiveTab("delegation")}
            size="sm"
            className="whitespace-nowrap"
          >
            {t.nav.delegation}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">{t.nav.planning}</span>
                <span className="sm:hidden">{t.nav.planning}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => router.push('/holiday-planning')}>
                <Calendar className="h-4 w-4 mr-2" />
                {t.nav.myHolidayPlanning}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/manager/holiday-planning')}>
                <Users className="h-4 w-4 mr-2" />
                {t.nav.teamHolidayPlans}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/department-holiday-view')}>
                <Calendar className="h-4 w-4 mr-2" />
                {t.nav.departmentPlans}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="outline" 
            onClick={() => router.push('/analytics')}
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t.nav.analytics}</span>
            <span className="sm:hidden">{t.nav.analytics}</span>
          </Button>
        </div>

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Mobile Dashboard - only show on small screens */}
            <div className="block md:hidden">
              <MobileManagerDashboard
                pendingRequests={pendingRequests}
                teamStats={{
                  totalMembers: teamStats.totalMembers,
                  onLeaveToday: teamStats.onLeaveToday,
                  pendingRequests: pendingRequests.length,
                  approvalRate: 85 // Calculate from actual data
                }}
                onApproval={handleApprovalResponse}
              />
            </div>

            {/* Desktop Dashboard - hidden on small screens */}
            <div className="hidden md:block space-y-6">
              {/* Dashboard Summary */}
              <DashboardSummary userRole="MANAGER" />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Manager's Personal Dashboard */}
            <div className="lg:col-span-2 space-y-6">
              {/* Manager's Leave Balance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t.dashboard.vacationDays}</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {managerLeaveBalance.vacation.total - managerLeaveBalance.vacation.used}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {managerLeaveBalance.vacation.used} used of {managerLeaveBalance.vacation.total}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(managerLeaveBalance.vacation.used / managerLeaveBalance.vacation.total) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t.dashboard.medicalLeave}</CardTitle>
                    <Heart className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{managerLeaveBalance.medical.used}</div>
                    <p className="text-xs text-muted-foreground">{t.labels.daysUsedThisYear}</p>
                    <p className="text-xs text-gray-500 mt-2">{t.labels.managedByHR}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t.dashboard.personalDays}</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {managerLeaveBalance.personal.total - managerLeaveBalance.personal.used}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {managerLeaveBalance.personal.used} used of {managerLeaveBalance.personal.total}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${(managerLeaveBalance.personal.used / managerLeaveBalance.personal.total) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Manager's WFH Usage */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {t.dashboard.remoteWorkUsage} - {format(managerWfhMonth, "MMMM yyyy")}
                    </CardTitle>
                    <Home className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={previousManagerWfhMonth}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={nextManagerWfhMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{managerWfhStats.daysUsed} {t.common.days}</div>
                  <p className="text-xs text-muted-foreground">
                    {managerWfhStats.daysUsed} of {managerWfhStats.workingDaysInMonth} {t.labels.workingDaysThisMonth}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${managerWfhStats.percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-sm font-medium text-blue-600 mt-2">{managerWfhStats.percentage}% {t.labels.wfhThisMonth}</p>
                </CardContent>
              </Card>

              {/* Manager's Own Requests */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t.dashboard.myRequests}</CardTitle>
                      <CardDescription>{t.dashboard.myRequestsDescription}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        Page {myRequestsPage} of {myRequestsTotalPages}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={previousMyRequestsPage}
                          disabled={myRequestsPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={nextMyRequestsPage}
                          disabled={myRequestsPage === myRequestsTotalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentMyRequests.map((request) => {
                      const formatDateRange = (startDate: any, endDate: any) => {
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
                        if (start.getTime() === end.getTime()) {
                          return start?.toLocaleDateString('en-US', options) || 'N/A';
                        }
                        return start && end ? `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', options)}` : 'N/A';
                      };

                      return (
                        <div key={request?.id || Math.random()} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(request?.status || 'pending')}
                            <div className="flex items-center gap-2">
                              {request?.type === "Work from Home" && <Home className="h-4 w-4 text-blue-500" />}
                              <div>
                                <p className="font-medium">{request?.type || 'Unknown'}</p>
                                <p className="text-sm text-gray-600">
                                  {formatDateRange(request?.startDate, request?.endDate)}
                                </p>
                                <p className="text-xs text-gray-500">To: {request?.approver?.name || t.labels.pendingAssignment}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600">
                              {request?.totalDays || request?.days || 0} day{(request?.totalDays || request?.days || 0) > 1 ? "s" : ""}
                            </span>
                            <Badge className={getStatusColor(request?.status || 'pending')}>
                              {(request?.status || 'pending').charAt(0).toUpperCase() + (request?.status || 'pending').slice(1)}
                            </Badge>
                            {(request?.status?.toUpperCase() === 'PENDING' || (request?.status?.toUpperCase() === 'APPROVED' && request?.startDate && new Date(request.startDate) > new Date(new Date().setHours(0, 0, 0, 0)))) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelRequest(request?.id || '')}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              >
                                {t.common.cancel}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Pending Team Approvals on Dashboard */}
              <Card>
                <CardHeader>
                  <CardTitle>{t.dashboard.pendingTeamApprovals}</CardTitle>
                  <CardDescription>{t.dashboard.pendingTeamApprovalsDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : pendingRequests.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">{t.labels.noPendingRequests}</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingRequests.slice(0, 3).map((request) => (
                        <div key={request?.id || Math.random()} className="border rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={request.employee?.avatar} />
                                <AvatarFallback>
                                  {request?.employee?.name ? request.employee.name.split(' ').map((n: string) => n?.[0] || '').join('') : 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{request.employee?.name || 'Unknown'}</p>
                                <div className="flex items-center gap-1">
                                  <p className="text-xs text-gray-500">{request?.type || 'Unknown'}</p>
                                  {request?.requestType === 'wfh' && (
                                    <Badge variant="outline" className="text-xs h-4 px-1 bg-blue-50 text-blue-700 border-blue-200">WFH</Badge>
                                  )}
                                  <span className="text-xs text-gray-500">• {request?.days || 0} day{(request?.days || 0) > 1 ? 's' : ''}</span>
                                </div>
                                <p className="text-xs text-gray-400">{request?.dates || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 px-2"
                                onClick={() => handleApproveRequest(request)}
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 px-2"
                                onClick={() => handleDenyRequest(request)}
                              >
                                <XCircle className="h-3.5 w-3.5 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {pendingRequests.length > 3 && (
                    <Button 
                      variant="outline" 
                      className="w-full mt-3" 
                      onClick={() => setActiveTab("team")}
                    >
                      {t.common.viewAll} {pendingRequests.length} {t.common.requests}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Team Overview Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t.dashboard.teamQuickStats}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{teamStats.inOffice}</div>
                      <div className="text-xs text-gray-600">{t.dashboard.inOffice}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{teamStats.workingFromHome}</div>
                      <div className="text-xs text-gray-600">{t.labels.workingRemote}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{teamStats.onLeaveToday}</div>
                      <div className="text-xs text-gray-600">{t.dashboard.onLeave}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{teamStats.pendingRequests}</div>
                      <div className="text-xs text-gray-600">{t.tabs.pending}</div>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-4" onClick={() => setActiveTab("team")}>
                    {t.labels.manageTeam}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t.dashboard.reportingManager}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {superior?.name ? superior?.name.split(' ').map((n: string) => n?.[0] || '').join('').toUpperCase() : 'NA'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      {loadingSuperior ? (
                        <div className="space-y-2">
                          <div className="h-5 bg-gray-200 rounded animate-pulse w-32"></div>
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-48"></div>
                          <div className="h-3 bg-gray-200 rounded animate-pulse w-24"></div>
                        </div>
                      ) : superior ? (
                        <>
                          <h4 className="font-semibold">
                            {superior.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {superior.displayTitle || superior.position || superior.role}
                          </p>
                          <p className="text-xs text-gray-500">
                            {superior.description || t.labels.forLeaveApprovals}
                          </p>
                        </>
                      ) : (
                        <>
                          <h4 className="font-semibold">{t.labels.noSuperior}</h4>
                          <p className="text-sm text-gray-600">
                            {t.labels.contactHrForSuperior}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            </div>
            </div>
          </div>
        )}

        {activeTab === "team" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team Management Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Team Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t.dashboard.teamMembers}</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{teamStats.totalMembers}</div>
                    <p className="text-xs text-muted-foreground">{t.labels.totalTeamSize}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t.dashboard.inOffice}</CardTitle>
                    <UserCheck className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{teamStats.inOffice}</div>
                    <p className="text-xs text-muted-foreground">{t.labels.presentToday}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t.dashboard.workingFromHome}</CardTitle>
                    <Home className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{teamStats.workingFromHome}</div>
                    <p className="text-xs text-muted-foreground">{t.labels.remoteToday}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t.dashboard.onLeave}</CardTitle>
                    <UserX className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{teamStats.onLeaveToday}</div>
                    <p className="text-xs text-muted-foreground">{t.labels.awayToday}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Team WFH Stats */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {t.dashboard.teamRemoteWorkUsage} - {format(teamStatsMonth, "MMMM yyyy")}
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={previousTeamStatsMonth}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={nextTeamStatsMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{teamWfhStats.averageWfhPercentage}%</div>
                  <p className="text-xs text-muted-foreground">
                    {teamWfhStats.totalWfhDays} WFH days of {teamWfhStats.totalWorkingDays} total working days
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${teamWfhStats.averageWfhPercentage}%` }}
                    ></div>
                  </div>
                  <p className="text-sm font-medium text-blue-600 mt-2">{t.labels.avgTeamWfhPercentage}</p>
                </CardContent>
              </Card>

              {/* Team Requests with Tabs */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t.dashboard.teamLeaveRequests}</CardTitle>
                      <CardDescription>{t.dashboard.teamLeaveRequestsDescription}</CardDescription>
                    </div>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex gap-1 mt-4">
                    <Button
                      variant={teamRequestsTab === 'pending' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTeamRequestsTab('pending')}
                      className="flex items-center gap-2"
                    >
                      <Clock className="h-3 w-3" />
                      {t.tabs.pending} ({teamStats.pendingRequests})
                    </Button>
                    <Button
                      variant={teamRequestsTab === 'approved' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTeamRequestsTab('approved')}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="h-3 w-3" />
                      {t.tabs.approved}
                    </Button>
                    <Button
                      variant={teamRequestsTab === 'denied' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTeamRequestsTab('denied')}
                      className="flex items-center gap-2"
                    >
                      <XCircle className="h-3 w-3" />
                      {t.tabs.denied}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Pending Requests Tab */}
                  {teamRequestsTab === 'pending' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">
                          {totalPendingPages > 0 
                            ? `Showing ${pendingRequests.length} request${pendingRequests.length !== 1 ? 's' : ''} - Page ${pendingRequestsPage} of ${totalPendingPages}`
                            : t.labels.noPendingRequests}
                        </span>
                        {totalPendingPages > 1 && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={previousRequestsPage}
                              disabled={pendingRequestsPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            
                            {/* Page numbers */}
                            <div className="flex gap-1">
                              {Array.from({ length: Math.min(5, totalPendingPages) }, (_, i) => {
                                let pageNum;
                                if (totalPendingPages <= 5) {
                                  pageNum = i + 1;
                                } else if (pendingRequestsPage <= 3) {
                                  pageNum = i + 1;
                                } else if (pendingRequestsPage >= totalPendingPages - 2) {
                                  pageNum = totalPendingPages - 4 + i;
                                } else {
                                  pageNum = pendingRequestsPage - 2 + i;
                                }
                                return (
                                  <Button
                                    key={i}
                                    variant={pageNum === pendingRequestsPage ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setPendingRequestsPage(pageNum)}
                                    className="w-8 h-8 p-0"
                                  >
                                    {pageNum}
                                  </Button>
                                );
                              })}
                            </div>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={nextRequestsPage}
                              disabled={pendingRequestsPage === totalPendingPages}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {pendingRequests.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">{t.labels.noPendingRequests}</p>
                        ) : (
                          pendingRequests.map((request) => (
                      <div key={request?.id || Math.random()} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={request.employee?.avatar} />
                              <AvatarFallback>{request?.employee?.name ? request.employee.name.split(' ').map((n: string) => n?.[0] || '').join('') : 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{request.employee?.name || 'Unknown'}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {request.employee?.department || 'N/A'}
                                </Badge>
                                {(request?.requestType === 'wfh' || request?.type === "Work From Home") && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                    <Home className="h-3 w-3 mr-1" />
                                    WFH
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                <span className="font-medium">{request?.type || 'Unknown'}</span> • {request?.dates || 'N/A'} ({request?.days || 0}{" "}
                                day{(request?.days || 0) > 1 ? "s" : ""})
                              </p>
                              {request?.reason && <p className="text-sm text-gray-500">"{request.reason}"</p>}
                              <p className="text-xs text-gray-400 mt-1">{t.labels.submitted}: {request?.submittedDate || 'Unknown'}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApproveRequest(request)}>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              {t.common.approve}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDenyRequest(request)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              {t.common.deny}
                            </Button>
                          </div>
                        </div>
                      </div>
                          ))
                        )}
                      </div>
                      
                      {/* Bottom pagination for better UX */}
                      {totalPendingPages > 1 && pendingRequests.length > 0 && (
                        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={previousRequestsPage}
                            disabled={pendingRequestsPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            {t.common.previous}
                          </Button>

                          <span className="text-sm text-gray-500 mx-2">
                            Page {pendingRequestsPage} of {totalPendingPages}
                          </span>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={nextRequestsPage}
                            disabled={pendingRequestsPage === totalPendingPages}
                          >
                            {t.common.next}
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Approved Requests Tab */}
                  {teamRequestsTab === 'approved' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">
                          {totalApprovedPages > 0 
                            ? `Page ${approvedRequestsPage} of ${totalApprovedPages}`
                            : t.labels.noApprovedRequests}
                        </span>
                        {totalApprovedPages > 0 && (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setApprovedRequestsPage(Math.max(1, approvedRequestsPage - 1))}
                              disabled={approvedRequestsPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setApprovedRequestsPage(Math.min(totalApprovedPages, approvedRequestsPage + 1))}
                              disabled={approvedRequestsPage === totalApprovedPages || totalApprovedPages === 0}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {approvedRequests.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">{t.labels.noApprovedRequests}</p>
                        ) : (
                          approvedRequests.map((request) => (
                            <div key={request?.id || Math.random()} className="p-4 border rounded-lg bg-green-50 border-green-200">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={request.employee?.avatar} />
                                    <AvatarFallback>
                                      {request?.employee?.name ? request.employee.name.split(' ').map((n: string) => n?.[0] || '').join('') : 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{request.employee?.name || 'Unknown'}</h4>
                                    <p className="text-sm text-gray-600">{request.employee?.department || 'N/A'}</p>
                                    <div className="mt-2 space-y-1">
                                      <p className="text-sm">
                                        <span className="font-medium">{request?.type || 'Unknown'}</span> • {request?.days || 0} day{(request?.days || 0) > 1 ? 's' : ''}
                                      </p>
                                      <p className="text-sm text-gray-600">{request?.dates || 'N/A'}</p>
                                      {request?.reason && <p className="text-sm text-gray-500">"{request.reason}"</p>}
                                      <p className="text-xs text-green-600 mt-1">
                                        {t.labels.approvedOn}: {request?.approvedDate ? new Date(request.approvedDate).toLocaleDateString() : 'Unknown'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge className="bg-green-100 text-green-800">{t.labels.approvedByYou}</Badge>
                                  {request?.overallRequestStatus === 'PENDING' && (
                                    <p className="text-xs text-orange-600 mt-1">{t.labels.pendingExecutive}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {/* Denied Requests Tab */}
                  {teamRequestsTab === 'denied' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">
                          {totalDeniedPages > 0 
                            ? `Page ${deniedRequestsPage} of ${totalDeniedPages}`
                            : t.labels.noDeniedRequests}
                        </span>
                        {totalDeniedPages > 0 && (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeniedRequestsPage(Math.max(1, deniedRequestsPage - 1))}
                              disabled={deniedRequestsPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeniedRequestsPage(Math.min(totalDeniedPages, deniedRequestsPage + 1))}
                              disabled={deniedRequestsPage === totalDeniedPages || totalDeniedPages === 0}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {deniedRequests.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">{t.labels.noDeniedRequests}</p>
                        ) : (
                          deniedRequests.map((request) => (
                            <div key={request?.id || Math.random()} className="p-4 border rounded-lg bg-red-50 border-red-200">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={request.employee?.avatar} />
                                    <AvatarFallback>
                                      {request?.employee?.name ? request.employee.name.split(' ').map((n: string) => n?.[0] || '').join('') : 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{request.employee?.name || 'Unknown'}</h4>
                                    <p className="text-sm text-gray-600">{request.employee?.department || 'N/A'}</p>
                                    <div className="mt-2 space-y-1">
                                      <p className="text-sm">
                                        <span className="font-medium">{request?.type || 'Unknown'}</span> • {request?.days || 0} day{(request?.days || 0) > 1 ? 's' : ''}
                                      </p>
                                      <p className="text-sm text-gray-600">{request?.dates || 'N/A'}</p>
                                      {request?.reason && <p className="text-sm text-gray-500">Request: "{request.reason}"</p>}
                                      {request?.denialReason && (
                                        <p className="text-sm text-red-600 mt-1">
                                          {t.labels.denialReason}: "{request.denialReason}"
                                        </p>
                                      )}
                                      <p className="text-xs text-red-600 mt-1">
                                        {t.labels.deniedOn}: {request?.deniedDate ? new Date(request.deniedDate).toLocaleDateString() : 'Unknown'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <Badge className="bg-red-100 text-red-800">Denied</Badge>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Team Management Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t.dashboard.quickActions}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="outline">
                    <Clock className="h-4 w-4 mr-2" />
                    {t.labels.viewAllTeamRequests}
                  </Button>
                  <Button className="w-full" variant="outline">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    {t.labels.generateTeamReport}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "calendar" && <TeamCalendar />}

        {activeTab === "delegation" && <DelegationManager />}
      </div>

      {/* Approval Dialog */}
      {approvalDetails && (
        <ApprovalDialogV2
          isOpen={showApprovalDialog}
          onClose={() => {
            setShowApprovalDialog(false)
            setApprovalDetails(null)
          }}
          action={approvalDetails.action}
          request={approvalDetails.request}
          onConfirm={(comment) => {
            if (approvalDetails.action === 'approve') {
              handleApprove(approvalDetails?.request?.id || '', comment)
            } else {
              handleDeny(approvalDetails?.request?.id || '', comment)
            }
          }}
        />
      )}
    </div>
  )
}
