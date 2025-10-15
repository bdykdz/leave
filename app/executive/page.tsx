"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  Shield,
  Building,
  UserCog,
} from "lucide-react"
import { TeamCalendar } from "@/components/team-calendar"
import { ExecutiveLeaveRequestForm } from "@/components/executive-leave-request-form"
import { WorkRemoteRequestForm } from "@/components/wfh-request-form"
import { ApprovalDialogV2 } from "@/components/approval-dialog-v2"
import { DashboardSummary } from "@/components/dashboard-summary"
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

export default function ExecutiveDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const t = useTranslations()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [pendingRequestsPage, setPendingRequestsPage] = useState(1)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [showRemoteForm, setShowWFHForm] = useState(false)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalDetails, setApprovalDetails] = useState<{
    action: "approve" | "deny"
    request: {
      id: string
      employeeName: string
      type: string
      dates: string
      days: number
    }
  } | null>(null)

  // State for executive's personal data
  const [loading, setLoading] = useState(true)
  const [executiveLeaveBalance, setExecutiveLeaveBalance] = useState<any[]>([])
  const [loadingBalances, setLoadingBalances] = useState(true)
  const [calendarKey, setCalendarKey] = useState(0)
  const [escalatedRequests, setEscalatedRequests] = useState<any[]>([])
  const [totalEscalatedPages, setTotalEscalatedPages] = useState(0)
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [loadingMyRequests, setLoadingMyRequests] = useState(true)
  const [directReportRequests, setDirectReportRequests] = useState<any[]>([])
  const [directReportPage, setDirectReportPage] = useState(1)
  const [totalDirectReportPages, setTotalDirectReportPages] = useState(0)
  const [loadingDirectReports, setLoadingDirectReports] = useState(true)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/login")
      return
    }

    // Only allow EXECUTIVE role on this page
    if (session.user.role !== "EXECUTIVE") {
      // Redirect to appropriate dashboard
      switch (session.user.role) {
        case "EMPLOYEE":
          router.push("/employee")
          break
        case "MANAGER":
          router.push("/manager")
          break
        case "HR":
          router.push("/hr")
          break
        default:
          router.push("/login")
      }
    } else {
      // Fetch executive's personal data
      fetchExecutiveLeaveBalance()
      fetchMyRequests()
      fetchEscalatedRequests()
      fetchDirectReportRequests()
    }
  }, [session, status, router])

  const fetchExecutiveLeaveBalance = async () => {
    try {
      setLoadingBalances(true)
      const response = await fetch('/api/employee/leave-balance')
      if (response.ok) {
        const data = await response.json()
        setExecutiveLeaveBalance(data.leaveBalances)
      }
    } catch (error) {
      console.error('Error fetching leave balances:', error)
    } finally {
      setLoadingBalances(false)
    }
  }

  const fetchMyRequests = async () => {
    try {
      setLoadingMyRequests(true)
      
      // Fetch both leave and WFH requests
      const [leaveResponse, wfhResponse] = await Promise.all([
        fetch('/api/leave-requests'),
        fetch('/api/wfh-requests')
      ])
      
      let allRequests: any[] = []
      
      if (leaveResponse.ok) {
        const leaveData = await leaveResponse.json()
        const leaveRequests = (leaveData.requests || []).map((req: any) => ({
          ...req,
          requestType: 'leave'
        }))
        allRequests.push(...leaveRequests)
      }
      
      if (wfhResponse.ok) {
        const wfhData = await wfhResponse.json()
        const wfhRequests = (wfhData.wfhRequests || []).map((req: any) => ({
          ...req,
          requestType: 'wfh',
          leaveType: { name: 'Work From Home' }
        }))
        allRequests.push(...wfhRequests)
      }
      
      // Sort by creation date (newest first)
      allRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
      setMyRequests(allRequests)
    } catch (error) {
      console.error('Error fetching my requests:', error)
    } finally {
      setLoadingMyRequests(false)
    }
  }

  const fetchEscalatedRequests = async () => {
    try {
      const response = await fetch(`/api/executive/pending-approvals?page=${pendingRequestsPage}&limit=5`)
      if (response.ok) {
        const data = await response.json()
        setEscalatedRequests(data.requests)
        setTotalEscalatedPages(data.pagination.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching escalated requests:', error)
      toast.error('Failed to load escalated requests')
    } finally {
      setLoading(false)
    }
  }

  const fetchDirectReportRequests = async () => {
    try {
      setLoadingDirectReports(true)
      const response = await fetch(`/api/manager/team/pending-approvals?page=${directReportPage}&limit=5`)
      if (response.ok) {
        const data = await response.json()
        setDirectReportRequests(data.requests || [])
        setTotalDirectReportPages(data.pagination?.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching direct report requests:', error)
    } finally {
      setLoadingDirectReports(false)
    }
  }

  const handleApprove = async (requestId: string, comment?: string, isDirectReport: boolean = false) => {
    try {
      const endpoint = isDirectReport 
        ? `/api/manager/approve-request/${requestId}`
        : `/api/executive/approve-request/${requestId}`
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment || '' })
      })
      
      if (response.ok) {
        toast.success('Request approved successfully')
        // Force calendar refresh
        setCalendarKey(prev => prev + 1)
        if (isDirectReport) {
          fetchDirectReportRequests()
        } else {
          fetchEscalatedRequests()
        }
        setShowApprovalDialog(false)
      } else {
        toast.error('Failed to approve request')
      }
    } catch (error) {
      console.error('Error approving request:', error)
      toast.error('Error approving request')
    }
  }

  const handleDeny = async (requestId: string, comment: string, isDirectReport: boolean = false) => {
    try {
      const endpoint = isDirectReport
        ? `/api/manager/deny-request/${requestId}`
        : `/api/executive/deny-request/${requestId}`
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      })
      
      if (response.ok) {
        toast.success('Request denied successfully')
        // Force calendar refresh
        setCalendarKey(prev => prev + 1)
        if (isDirectReport) {
          fetchDirectReportRequests()
        } else {
          fetchEscalatedRequests()
        }
        setShowApprovalDialog(false)
      } else {
        toast.error('Failed to deny request')
      }
    } catch (error) {
      console.error('Error denying request:', error)
      toast.error('Error denying request')
    }
  }

  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!session || session.user.role !== "EXECUTIVE") {
    return null
  }

  if (showRequestForm) {
    return <ExecutiveLeaveRequestForm onBack={() => setShowRequestForm(false)} />
  }

  if (showRemoteForm) {
    return <WorkRemoteRequestForm onBack={() => setShowWFHForm(false)} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-purple-600" />
              <h1 className="text-xl font-semibold">Executive Dashboard</h1>
            </div>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              {escalatedRequests.length} Escalated Approvals
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            {/* Navigation Buttons */}
            <Button onClick={() => router.push("/hr")} variant="outline" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              HR Dashboard
            </Button>
            <Button onClick={() => router.push("/admin")} variant="outline" className="flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Admin Panel
            </Button>
            <Button onClick={() => router.push("/executive/analytics")} variant="outline" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Analytics
            </Button>
            <LanguageToggle />
            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={session?.user?.image || ""} />
                    <AvatarFallback>
                      {session?.user?.name?.split(' ').map(n => n[0]).join('') || 'EX'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{session?.user?.name || 'Executive'}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">{session?.user?.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === "dashboard"
                  ? "border-purple-600 text-purple-600 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Dashboard
              </div>
            </button>
            <button
              onClick={() => setActiveTab("calendar")}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === "calendar"
                  ? "border-purple-600 text-purple-600 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Company Calendar
              </div>
            </button>
          </div>
        </div>

        {/* Welcome Message - Only show on dashboard */}
        {activeTab === "dashboard" && (
          <div className="text-center py-4">
            <h2 className="text-2xl font-bold text-gray-900">{t.dashboard.welcomeBack}, {session?.user?.firstName || session?.user?.name}</h2>
            <p className="text-gray-600 mt-1">Executive - {session?.user?.department}</p>
          </div>
        )}

        {/* Dashboard Tab Content */}
        {activeTab === "dashboard" && (
          <>
            {/* Dashboard Summary */}
            <DashboardSummary userRole="EXECUTIVE" />
            
            {/* Quick Actions */}
            <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.quickActions}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowRequestForm(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {t.dashboard.newLeaveRequest}
              </Button>
              <Button onClick={() => setShowWFHForm(true)} variant="outline" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                {t.dashboard.newRemoteRequest}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Personal Leave Balance */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.dashboard.leaveBalance}</CardTitle>
                <CardDescription>Your personal leave allocation</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingBalances ? (
                  <div className="space-y-3">
                    <div className="animate-pulse bg-gray-200 h-20 rounded"></div>
                    <div className="animate-pulse bg-gray-200 h-20 rounded"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {executiveLeaveBalance.map((balance, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{balance.leaveType?.name || 'Unknown Leave Type'}</h3>
                          <Badge variant="outline" className="text-xs">
                            {balance.available || 0} {t.leaveForm.days}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex justify-between">
                            <span>{t.leaveForm.entitled}:</span>
                            <span>{balance.entitled || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t.leaveForm.used}:</span>
                            <span>{balance.used || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t.leaveForm.pending}:</span>
                            <span>{balance.pending || 0}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>{t.leaveForm.available}:</span>
                            <span className="text-green-600">{balance.available || 0}</span>
                          </div>
                        </div>
                        {balance.entitled > 0 && (
                          <div className="mt-2 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(balance.used / balance.entitled) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* My Recent Requests */}
            <Card>
              <CardHeader>
                <CardTitle>My Recent Requests</CardTitle>
                <CardDescription>Your latest leave and remote work requests</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMyRequests ? (
                  <div className="space-y-3">
                    <div className="animate-pulse bg-gray-200 h-16 rounded"></div>
                    <div className="animate-pulse bg-gray-200 h-16 rounded"></div>
                  </div>
                ) : myRequests.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recent requests</p>
                ) : (
                  <div className="space-y-3">
                    {myRequests.slice(0, 3).map((request) => (
                      <div key={request.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">
                              {request.requestType === 'wfh' ? 'Work From Home' : (request.leaveType?.name || 'Leave Request')}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d')} 
                              ({request.totalDays} {t.leaveForm.days})
                              {request.requestType === 'wfh' && request.location && (
                                <span className="ml-2 text-xs text-blue-600">@ {request.location}</span>
                              )}
                            </p>
                          </div>
                          <Badge variant={
                            request.status === 'APPROVED' ? 'default' : 
                            request.status === 'REJECTED' ? 'destructive' : 
                            'secondary'
                          }>
                            {request.status === 'APPROVED' ? t.status.approved :
                             request.status === 'REJECTED' ? t.status.rejected :
                             request.status === 'PENDING' ? t.status.pending : request.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Direct Reports & Escalated Requests */}
          <div className="lg:col-span-2 space-y-6">
            {/* Direct Report Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Direct Report Approvals
                </CardTitle>
                <CardDescription>Requests from your direct team members</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDirectReports ? (
                  <div className="space-y-3">
                    <div className="animate-pulse bg-gray-200 h-24 rounded"></div>
                    <div className="animate-pulse bg-gray-200 h-24 rounded"></div>
                  </div>
                ) : directReportRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="text-gray-500">No pending requests from your team</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {directReportRequests.map((request: any) => (
                      <div key={request.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {request.employee?.name?.split(' ').map((n: string) => n[0]).join('') || 'NA'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h3 className="font-medium">{request.employee?.name}</h3>
                                <p className="text-sm text-gray-600">{request.employee?.department}</p>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium">{request.type}</p>
                              <p className="text-sm text-gray-600">{request.dates}</p>
                              <p className="text-sm">
                                <strong>{request.days}</strong> {t.leaveForm.days}
                              </p>
                              {request.reason && (
                                <p className="text-sm text-gray-600 italic">"{request.reason}"</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setApprovalDetails({
                                  action: "approve",
                                  request: {
                                    id: request.id,
                                    employeeName: request.employee?.name || 'Unknown',
                                    type: request.type,
                                    dates: request.dates,
                                    days: request.days,
                                    isDirectReport: true
                                  } as any
                                })
                                setShowApprovalDialog(true)
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setApprovalDetails({
                                  action: "deny",
                                  request: {
                                    id: request.id,
                                    employeeName: request.employee?.name || 'Unknown',
                                    type: request.type,
                                    dates: request.dates,
                                    days: request.days,
                                    isDirectReport: true
                                  } as any
                                })
                                setShowApprovalDialog(true)
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Deny
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Pagination */}
                    {totalDirectReportPages > 1 && (
                      <div className="flex items-center justify-center space-x-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (directReportPage > 1) {
                              setDirectReportPage(directReportPage - 1)
                              fetchDirectReportRequests()
                            }
                          }}
                          disabled={directReportPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                          Page {directReportPage} of {totalDirectReportPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (directReportPage < totalDirectReportPages) {
                              setDirectReportPage(directReportPage + 1)
                              fetchDirectReportRequests()
                            }
                          }}
                          disabled={directReportPage === totalDirectReportPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Escalated Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Escalated Requests Requiring Your Approval
                </CardTitle>
                <CardDescription>High-level leave requests that need executive approval</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <div className="animate-pulse bg-gray-200 h-24 rounded"></div>
                    <div className="animate-pulse bg-gray-200 h-24 rounded"></div>
                  </div>
                ) : escalatedRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="text-gray-500">No escalated requests pending your approval</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {escalatedRequests.map((request) => (
                      <div key={request.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {request.user?.firstName?.[0]}{request.user?.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h3 className="font-medium">{request.user?.firstName} {request.user?.lastName}</h3>
                                <p className="text-sm text-gray-600">{request.user?.department} • {request.user?.role?.replace('_', ' ')}</p>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium">{request.leaveType?.name || 'Leave Request'}</p>
                              <p className="text-sm text-gray-600">
                                {format(new Date(request.startDate), 'MMM d, yyyy')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                              </p>
                              <p className="text-sm">
                                <strong>{request.totalDays}</strong> {t.leaveForm.days}
                              </p>
                              {request.reason && (
                                <p className="text-sm text-gray-600 italic">"{request.reason}"</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setApprovalDetails({
                                  action: "approve",
                                  request: {
                                    id: request.id,
                                    employeeName: `${request.user?.firstName} ${request.user?.lastName}`,
                                    type: request.leaveType?.name || 'Leave Request',
                                    dates: `${format(new Date(request.startDate), 'MMM d')} - ${format(new Date(request.endDate), 'MMM d')}`,
                                    days: request.totalDays
                                  }
                                })
                                setShowApprovalDialog(true)
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setApprovalDetails({
                                  action: "deny",
                                  request: {
                                    id: request.id,
                                    employeeName: `${request.user?.firstName} ${request.user?.lastName}`,
                                    type: request.leaveType?.name || 'Leave Request',
                                    dates: `${format(new Date(request.startDate), 'MMM d')} - ${format(new Date(request.endDate), 'MMM d')}`,
                                    days: request.totalDays
                                  }
                                })
                                setShowApprovalDialog(true)
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Deny
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Pagination */}
                    {totalEscalatedPages > 1 && (
                      <div className="flex items-center justify-center space-x-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (pendingRequestsPage > 1) {
                              setPendingRequestsPage(pendingRequestsPage - 1)
                              fetchEscalatedRequests()
                            }
                          }}
                          disabled={pendingRequestsPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                          Page {pendingRequestsPage} of {totalEscalatedPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (pendingRequestsPage < totalEscalatedPages) {
                              setPendingRequestsPage(pendingRequestsPage + 1)
                              fetchEscalatedRequests()
                            }
                          }}
                          disabled={pendingRequestsPage === totalEscalatedPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
          </>
        )}

        {/* Calendar Tab Content */}
        {activeTab === "calendar" && <TeamCalendar key={calendarKey} />}
      </div>

      {/* Approval Dialog */}
      {showApprovalDialog && approvalDetails && (
        <ApprovalDialogV2
          isOpen={showApprovalDialog}
          onClose={() => {
            setShowApprovalDialog(false)
            setApprovalDetails(null)
          }}
          onApprove={(requestId, comment) => handleApprove(requestId, comment, approvalDetails.request.isDirectReport)}
          onDeny={(requestId, comment) => handleDeny(requestId, comment, approvalDetails.request.isDirectReport)}
          request={approvalDetails.request}
          action={approvalDetails.action}
        />
      )}
    </div>
  )
}