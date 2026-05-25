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
  Building,
  ChevronDown,
  FileSignature,
  Briefcase,
} from "lucide-react"
import { TeamCalendar } from "@/components/team-calendar"
import { LeaveRequestForm } from "@/components/leave-request-form"
import { WorkRemoteRequestForm } from "@/components/wfh-request-form"
import { WorkTripRequestForm } from "@/components/work-trip-request-form"
import { ApprovalDialogV2 } from "@/components/approval-dialog-v2"
import { DashboardSummary } from "@/components/dashboard-summary"
import { DelegationManager } from "@/components/manager/DelegationManager"
import { TeamWeekGrid } from "@/components/team-week-grid"
import { ApprovalsByMember } from "@/components/approvals-by-member"
import { format, addMonths, subMonths } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, User, BookOpen } from "lucide-react"
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
  const [showWorkTripForm, setShowWorkTripForm] = useState(false)
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
  const [leaveBalances, setLeaveBalances] = useState<any[]>([])
  const [teamStats, setTeamStats] = useState({
    totalMembers: 0,
    onLeaveToday: 0,
    workingFromHome: 0,
    onWorkTrip: 0,
    inOffice: 0,
    pendingRequests: 0,
    inOfficeMembers: [] as string[],
    onLeaveMembers: [] as string[],
    wfhMembers: [] as string[],
    workTripMembers: [] as string[],
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
  const [requestCategoryTab, setRequestCategoryTab] = useState<'leave' | 'wfh' | 'workTrip'>('leave')
  const [wfhPendingRequests, setWfhPendingRequests] = useState<any[]>([])
  const [totalWfhPendingPages, setTotalWfhPendingPages] = useState(0)
  const [wfhPendingPage, setWfhPendingPage] = useState(1)
  const [wfhApprovedRequests, setWfhApprovedRequests] = useState<any[]>([])
  const [totalWfhApprovedPages, setTotalWfhApprovedPages] = useState(0)
  const [wfhApprovedPage, setWfhApprovedPage] = useState(1)
  const [wfhDeniedRequests, setWfhDeniedRequests] = useState<any[]>([])
  const [totalWfhDeniedPages, setTotalWfhDeniedPages] = useState(0)
  const [wfhDeniedPage, setWfhDeniedPage] = useState(1)
  const [wfhSubTab, setWfhSubTab] = useState<'pending' | 'approved' | 'denied'>('pending')
  // Work trip state
  const [workTripPendingRequests, setWorkTripPendingRequests] = useState<any[]>([])
  const [totalWorkTripPendingPages, setTotalWorkTripPendingPages] = useState(0)
  const [workTripPendingPage, setWorkTripPendingPage] = useState(1)
  const [workTripApprovedRequests, setWorkTripApprovedRequests] = useState<any[]>([])
  const [totalWorkTripApprovedPages, setTotalWorkTripApprovedPages] = useState(0)
  const [workTripApprovedPage, setWorkTripApprovedPage] = useState(1)
  const [workTripDeniedRequests, setWorkTripDeniedRequests] = useState<any[]>([])
  const [totalWorkTripDeniedPages, setTotalWorkTripDeniedPages] = useState(0)
  const [workTripDeniedPage, setWorkTripDeniedPage] = useState(1)
  const [workTripSubTab, setWorkTripSubTab] = useState<'pending' | 'approved' | 'denied'>('pending')
  const [superior, setSuperior] = useState<any>(null)
  const [loadingSuperior, setLoadingSuperior] = useState(true)
  const [pendingDocSignatures, setPendingDocSignatures] = useState<any[]>([])
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(new Set())

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

  // Fetch pending document signatures
  useEffect(() => {
    if (status === "loading" || !session) return
    fetchPendingDocSignatures()
  }, [session, status])

  // Fetch pending requests (re-fetch when category tab or active tab changes)
  useEffect(() => {
    if (status === "loading" || !session) return
    fetchPendingRequests()
  }, [pendingRequestsPage, requestCategoryTab, activeTab, session, status])

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

  // Fetch WFH pending requests
  useEffect(() => {
    if (status === "loading" || !session) return
    if (requestCategoryTab === 'wfh' && wfhSubTab === 'pending') {
      fetchWfhPendingRequests()
    }
  }, [wfhPendingPage, requestCategoryTab, wfhSubTab, session, status])

  // Fetch WFH approved requests
  useEffect(() => {
    if (status === "loading" || !session) return
    if (requestCategoryTab === 'wfh' && wfhSubTab === 'approved') {
      fetchWfhApprovedRequests()
    }
  }, [wfhApprovedPage, requestCategoryTab, wfhSubTab, session, status])

  // Fetch WFH denied requests
  useEffect(() => {
    if (status === "loading" || !session) return
    if (requestCategoryTab === 'wfh' && wfhSubTab === 'denied') {
      fetchWfhDeniedRequests()
    }
  }, [wfhDeniedPage, requestCategoryTab, wfhSubTab, session, status])

  // Fetch work trip pending requests
  useEffect(() => {
    if (status === "loading" || !session) return
    if (requestCategoryTab === 'workTrip' && workTripSubTab === 'pending') {
      fetchWorkTripPendingRequests()
    }
  }, [workTripPendingPage, requestCategoryTab, workTripSubTab, session, status])

  // Fetch work trip approved requests
  useEffect(() => {
    if (status === "loading" || !session) return
    if (requestCategoryTab === 'workTrip' && workTripSubTab === 'approved') {
      fetchWorkTripApprovedRequests()
    }
  }, [workTripApprovedPage, requestCategoryTab, workTripSubTab, session, status])

  // Fetch work trip denied requests
  useEffect(() => {
    if (status === "loading" || !session) return
    if (requestCategoryTab === 'workTrip' && workTripSubTab === 'denied') {
      fetchWorkTripDeniedRequests()
    }
  }, [workTripDeniedPage, requestCategoryTab, workTripSubTab, session, status])

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
      const response = await fetch('/api/employee/leave-balance')
      if (response.ok) {
        const data = await response.json()
        setLeaveBalances(data.leaveBalances || [])
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error)
      toast.error(t.messages.failedToLoadBalance)
    }
  }

  const fetchPendingDocSignatures = async () => {
    try {
      const response = await fetch('/api/documents/pending-signatures')
      if (response.ok) {
        const data = await response.json()
        setPendingDocSignatures(data.documents || [])
      }
    } catch (error) {
      console.error('Error fetching pending document signatures:', error)
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
      // On team tab with leave category, fetch leave-only; on dashboard, fetch combined (leave + WFH)
      const typeParam = activeTab === 'team' && requestCategoryTab === 'leave' ? '&type=leave' : ''
      const response = await fetch(`/api/manager/team/pending-approvals?page=${pendingRequestsPage}&limit=10${typeParam}`)
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

  const handleCancelRequest = async (requestId: string, requestType: string = 'leave') => {
    if (!confirm(t.messages.confirmCancelRequest)) {
      return;
    }

    try {
      const endpoint = requestType === 'wfh'
        ? `/api/wfh-requests/${requestId}/self-cancel`
        : requestType === 'workTrip'
        ? `/api/work-trip-requests/${requestId}/self-cancel`
        : `/api/leave-requests/${requestId}/self-cancel`;
      const response = await fetch(endpoint, {
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

  const fetchWfhPendingRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/manager/team/wfh-pending?page=${wfhPendingPage}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setWfhPendingRequests(data.requests)
        setTotalWfhPendingPages(data.pagination.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching WFH pending requests:', error)
      toast.error(t.messages.failedToLoadRequests)
    } finally {
      setLoading(false)
    }
  }

  const fetchWfhApprovedRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/manager/team/wfh-approved?page=${wfhApprovedPage}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setWfhApprovedRequests(data.requests)
        setTotalWfhApprovedPages(data.pagination.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching WFH approved requests:', error)
      toast.error(t.messages.failedToLoadApprovedRequests)
    } finally {
      setLoading(false)
    }
  }

  const fetchWfhDeniedRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/manager/team/wfh-denied?page=${wfhDeniedPage}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setWfhDeniedRequests(data.requests)
        setTotalWfhDeniedPages(data.pagination.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching WFH denied requests:', error)
      toast.error(t.messages.failedToLoadDeniedRequests)
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkTripPendingRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/manager/team/work-trip-pending?page=${workTripPendingPage}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setWorkTripPendingRequests(data.requests)
        setTotalWorkTripPendingPages(data.pagination.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching work trip pending requests:', error)
      toast.error(t.messages.failedToLoadRequests)
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkTripApprovedRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/manager/team/work-trip-approved?page=${workTripApprovedPage}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setWorkTripApprovedRequests(data.requests)
        setTotalWorkTripApprovedPages(data.pagination.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching work trip approved requests:', error)
      toast.error(t.messages.failedToLoadApprovedRequests)
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkTripDeniedRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/manager/team/work-trip-denied?page=${workTripDeniedPage}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setWorkTripDeniedRequests(data.requests)
        setTotalWorkTripDeniedPages(data.pagination.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching work trip denied requests:', error)
      toast.error(t.messages.failedToLoadDeniedRequests)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: string, comment?: string, signature?: string): Promise<boolean> => {
    // Prevent double-processing
    if (processingRequestIds.has(requestId)) {
      toast.error('This request is already being processed')
      return false
    }
    setProcessingRequestIds(prev => new Set(prev).add(requestId))

    try {
      const requestType = approvalDetails?.request?.requestType || 'leave'
      const response = await fetch(`/api/manager/team/approve-request/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment, signature, requestType })
      })

      if (response.ok) {
        toast.success(t.messages.requestApprovedSuccess)
        // Optimistically remove from pending list immediately
        if (requestType === 'wfh') {
          setWfhPendingRequests(prev => prev.filter(r => r.id !== requestId))
        } else if (requestType === 'workTrip') {
          setWorkTripPendingRequests(prev => prev.filter(r => r.id !== requestId))
        } else {
          setPendingRequests(prev => prev.filter(r => r.id !== requestId))
        }
        // Refresh all data in the background
        const refreshPromises: Promise<void>[] = [fetchTeamStats()]
        if (requestType === 'wfh') {
          refreshPromises.push(fetchWfhPendingRequests(), fetchWfhApprovedRequests())
        } else if (requestType === 'workTrip') {
          refreshPromises.push(fetchWorkTripPendingRequests(), fetchWorkTripApprovedRequests())
        } else {
          refreshPromises.push(fetchPendingRequests(), fetchApprovedRequests())
        }
        Promise.all(refreshPromises).finally(() => {
          setProcessingRequestIds(prev => {
            const next = new Set(prev)
            next.delete(requestId)
            return next
          })
        })
        return true
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', errorData)
        toast.error(errorData.error || errorData.details || t.messages.failedToApprove)
        setProcessingRequestIds(prev => {
          const next = new Set(prev)
          next.delete(requestId)
          return next
        })
        return false
      }
    } catch (error) {
      console.error('Error approving request:', error)
      toast.error(t.messages.failedToApprove)
      setProcessingRequestIds(prev => {
        const next = new Set(prev)
        next.delete(requestId)
        return next
      })
      return false
    }
  }

  const handleDeny = async (requestId: string, comment?: string): Promise<boolean> => {
    // Prevent double-processing
    if (processingRequestIds.has(requestId)) {
      toast.error('This request is already being processed')
      return false
    }
    setProcessingRequestIds(prev => new Set(prev).add(requestId))

    try {
      const requestType = approvalDetails?.request?.requestType || 'leave'
      const response = await fetch(`/api/manager/team/deny-request/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment, requestType })
      })

      if (response.ok) {
        toast.success(t.messages.requestDeniedSuccess)
        // Optimistically remove from pending list immediately
        if (requestType === 'wfh') {
          setWfhPendingRequests(prev => prev.filter(r => r.id !== requestId))
        } else if (requestType === 'workTrip') {
          setWorkTripPendingRequests(prev => prev.filter(r => r.id !== requestId))
        } else {
          setPendingRequests(prev => prev.filter(r => r.id !== requestId))
        }
        // Refresh all data in the background
        const refreshPromises: Promise<void>[] = [fetchTeamStats()]
        if (requestType === 'wfh') {
          refreshPromises.push(fetchWfhPendingRequests(), fetchWfhDeniedRequests())
        } else if (requestType === 'workTrip') {
          refreshPromises.push(fetchWorkTripPendingRequests(), fetchWorkTripDeniedRequests())
        } else {
          refreshPromises.push(fetchPendingRequests(), fetchDeniedRequests())
        }
        Promise.all(refreshPromises).finally(() => {
          setProcessingRequestIds(prev => {
            const next = new Set(prev)
            next.delete(requestId)
            return next
          })
        })
        setShowApprovalDialog(false)
        return true
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || errorData.details || t.messages.failedToDeny)
        setProcessingRequestIds(prev => {
          const next = new Set(prev)
          next.delete(requestId)
          return next
        })
        return false
      }
    } catch (error) {
      console.error('Error denying request:', error)
      toast.error(t.messages.failedToDeny)
      setProcessingRequestIds(prev => {
        const next = new Set(prev)
        next.delete(requestId)
        return next
      })
      return false
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
    if (processingRequestIds.has(request?.id)) return
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
    if (processingRequestIds.has(request?.id)) return
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
          <p className="mt-4 text-gray-600">{t.common.loading}</p>
        </div>
      </div>
    )
  }

  // Check if user should access manager dashboard
  const isHREmployee = session?.user.role === "EMPLOYEE" && (session?.user.department?.toLowerCase() === "hr" || session?.user.department?.toLowerCase() === "human resources")
  
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

  if (showWorkTripForm) {
    return <WorkTripRequestForm onBack={() => setShowWorkTripForm(false)} />
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
              {(session.user.role === "HR" || (session.user.role === "MANAGER" && (session.user.department?.toLowerCase() === "hr" || session.user.department?.toLowerCase() === "human resources"))) && (
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
                  onClick={() => setShowWorkTripForm(true)}
                  variant="outline"
                  size="icon"
                  title="Work Trip Request"
                  className="border-green-200 text-green-700"
                >
                  <Briefcase className="h-4 w-4" />
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
                <Button onClick={() => setShowWorkTripForm(true)} variant="outline" className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50">
                  <Briefcase className="h-4 w-4" />
                  {t.workTripForm?.title || 'Work Trip'}
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
                  <DropdownMenuItem onClick={() => router.push('/wiki')}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    <span>{t.nav.wiki}</span>
                  </DropdownMenuItem>
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

              {/* Pending Document Signatures */}
              {pendingDocSignatures.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileSignature className="h-5 w-5 text-orange-600" />
                      Documents Pending Your Signature ({pendingDocSignatures.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {pendingDocSignatures.map((doc: any) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 bg-white border rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {doc.leaveType}{!doc.isOwnDocument && ` - ${doc.employeeName}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(doc.startDate), "MMM d")} - {format(new Date(doc.endDate), "MMM d, yyyy")}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => router.push(`/documents/${doc.id}/sign`)}
                          >
                            Sign Now
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Manager's Personal Dashboard */}
            <div className="lg:col-span-2 space-y-6">
              {/* Manager's Leave Balance Cards */}
              {(() => {
                const normalLeave = leaveBalances.find((b: any) => b.leaveTypeCode === 'AL' || b.leaveTypeCode === 'NL')
                const sickLeave = leaveBalances.find((b: any) => b.leaveTypeCode === 'SL')
                const specialLeaves = leaveBalances.filter((b: any) => !['AL', 'NL', 'SL'].includes(b.leaveTypeCode))
                return (
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
                          <p className="text-xs text-muted-foreground">{t.labels.daysUsedThisYear}</p>
                          <p className="text-xs text-gray-500 mt-2">{t.labels.noLimitTrackedByHr}</p>
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
                        <div className="text-2xl font-bold">{specialLeaves.reduce((sum: number, leave: any) => sum + (leave.used || 0), 0)}</div>
                        <p className="text-xs text-muted-foreground">{t.labels.totalSpecialLeave}</p>
                        <div className="text-xs text-gray-500 mt-2 space-y-1">
                          {specialLeaves.filter((leave: any) => leave.used > 0).map((leave: any) => (
                            <div key={leave.leaveTypeId}>{leave.leaveTypeName}: {leave.used} {t.leaveForm.days}</div>
                          ))}
                          {specialLeaves.filter((leave: any) => leave.used > 0).length === 0 && (
                            <div>{t.labels.noSpecialLeaveTaken}</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })()}

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
                              {request?.requestType === 'workTrip' && <Briefcase className="h-4 w-4 text-green-500" />}
                              <div>
                                <p className="font-medium">{request?.type || 'Unknown'}</p>
                                <p className="text-sm text-gray-600">
                                  {formatDateRange(request?.startDate, request?.endDate)}
                                </p>
                                <p className="text-xs text-gray-500">{t.labels.to}: {request?.approver?.name || t.labels.pendingAssignment}</p>
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
                            {/* Self-cancel disabled for leave requests pending HR policy decision. WFH and work trip can be cancelled. */}
                            {(request?.requestType === 'wfh' || request?.requestType === 'workTrip') && (request?.status?.toUpperCase() === 'PENDING' || (request?.status?.toUpperCase() === 'APPROVED' && request?.startDate && new Date(request.startDate) > new Date(new Date().setHours(0, 0, 0, 0)))) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelRequest(request?.id || '', request?.requestType || 'leave')}
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
                                  {request?.requestType === 'workTrip' && (
                                    <Badge variant="outline" className="text-xs h-4 px-1 bg-green-50 text-green-700 border-green-200">WT</Badge>
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
                                disabled={processingRequestIds.has(request.id)}
                                onClick={() => handleApproveRequest(request)}
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                disabled={processingRequestIds.has(request.id)}
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

              {/* Weekly team schedule */}
              <TeamWeekGrid />

              {/* Team Roster */}
              {(teamStats.inOfficeMembers.length > 0 || teamStats.wfhMembers.length > 0 || teamStats.onLeaveMembers.length > 0 || (teamStats.workTripMembers && teamStats.workTripMembers.length > 0)) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">{t.dashboard?.teamRoster || "Team Roster"}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {teamStats.inOfficeMembers.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Building className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-600">
                            {t.dashboard.inOffice} ({teamStats.inOfficeMembers.length})
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground pl-6">
                          {teamStats.inOfficeMembers.join(', ')}
                        </p>
                      </div>
                    )}
                    {teamStats.wfhMembers.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Home className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-600">
                            {t.dashboard.workingFromHome} ({teamStats.wfhMembers.length})
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground pl-6">
                          {teamStats.wfhMembers.join(', ')}
                        </p>
                      </div>
                    )}
                    {teamStats.workTripMembers && teamStats.workTripMembers.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Briefcase className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-600">
                            {t.calendarLegend?.onWorkTrip || 'On Work Trip'} ({teamStats.workTripMembers.length})
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground pl-6">
                          {teamStats.workTripMembers.join(', ')}
                        </p>
                      </div>
                    )}
                    {teamStats.onLeaveMembers.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <UserX className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium text-red-600">
                            {t.dashboard.onLeave} ({teamStats.onLeaveMembers.length})
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground pl-6">
                          {teamStats.onLeaveMembers.join(', ')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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

              {/* Approvals grouped per team member */}
              <ApprovalsByMember />

              {/* Team Requests with Tabs */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t.dashboard.teamLeaveRequests}</CardTitle>
                      <CardDescription>{t.dashboard.teamLeaveRequestsDescription}</CardDescription>
                    </div>
                  </div>

                  {/* Top-level Leave / WFH toggle */}
                  <div className="flex gap-1 mt-4 p-1 bg-gray-100 rounded-lg w-fit">
                    <Button
                      variant={requestCategoryTab === 'leave' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => { setRequestCategoryTab('leave'); setTeamRequestsTab('pending') }}
                      className="flex items-center gap-2"
                    >
                      <Calendar className="h-3 w-3" />
                      Leave
                    </Button>
                    <Button
                      variant={requestCategoryTab === 'wfh' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => { setRequestCategoryTab('wfh'); setWfhSubTab('pending') }}
                      className="flex items-center gap-2"
                    >
                      <Home className="h-3 w-3" />
                      WFH
                    </Button>
                    <Button
                      variant={requestCategoryTab === 'workTrip' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => { setRequestCategoryTab('workTrip'); setWorkTripSubTab('pending') }}
                      className="flex items-center gap-2"
                    >
                      <Briefcase className="h-3 w-3" />
                      {t.common?.workTrip || 'Deplasări'}
                    </Button>
                  </div>

                  {/* Sub-tabs for Leave */}
                  {requestCategoryTab === 'leave' && (
                    <div className="flex gap-1 mt-2">
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
                  )}

                  {/* Sub-tabs for WFH */}
                  {requestCategoryTab === 'wfh' && (
                    <div className="flex gap-1 mt-2">
                      <Button
                        variant={wfhSubTab === 'pending' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setWfhSubTab('pending')}
                        className="flex items-center gap-2"
                      >
                        <Clock className="h-3 w-3" />
                        {t.tabs.pending}
                      </Button>
                      <Button
                        variant={wfhSubTab === 'approved' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setWfhSubTab('approved')}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-3 w-3" />
                        {t.tabs.approved}
                      </Button>
                      <Button
                        variant={wfhSubTab === 'denied' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setWfhSubTab('denied')}
                        className="flex items-center gap-2"
                      >
                        <XCircle className="h-3 w-3" />
                        {t.tabs.denied}
                      </Button>
                    </div>
                  )}

                  {/* Sub-tabs for Work Trip */}
                  {requestCategoryTab === 'workTrip' && (
                    <div className="flex gap-1 mt-2">
                      <Button
                        variant={workTripSubTab === 'pending' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setWorkTripSubTab('pending')}
                        className="flex items-center gap-2"
                      >
                        <Clock className="h-3 w-3" />
                        {t.tabs.pending}
                      </Button>
                      <Button
                        variant={workTripSubTab === 'approved' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setWorkTripSubTab('approved')}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-3 w-3" />
                        {t.tabs.approved}
                      </Button>
                      <Button
                        variant={workTripSubTab === 'denied' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setWorkTripSubTab('denied')}
                        className="flex items-center gap-2"
                      >
                        <XCircle className="h-3 w-3" />
                        {t.tabs.denied}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {/* === LEAVE CATEGORY === */}
                  {requestCategoryTab === 'leave' && (<>
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
                                {request?.requestType === 'workTrip' && (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                    <Briefcase className="h-3 w-3 mr-1" />
                                    WT
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
                            <Button size="sm" disabled={processingRequestIds.has(request.id)} onClick={() => handleApproveRequest(request)}>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              {t.common.approve}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processingRequestIds.has(request.id)}
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
                  </>)}

                  {/* === WFH CATEGORY === */}
                  {requestCategoryTab === 'wfh' && (<>
                  {/* WFH Pending Tab */}
                  {wfhSubTab === 'pending' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">
                          {totalWfhPendingPages > 0
                            ? `Showing ${wfhPendingRequests.length} request${wfhPendingRequests.length !== 1 ? 's' : ''} - Page ${wfhPendingPage} of ${totalWfhPendingPages}`
                            : t.labels.noPendingRequests}
                        </span>
                        {totalWfhPendingPages > 1 && (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setWfhPendingPage(Math.max(1, wfhPendingPage - 1))}
                              disabled={wfhPendingPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setWfhPendingPage(Math.min(totalWfhPendingPages, wfhPendingPage + 1))}
                              disabled={wfhPendingPage === totalWfhPendingPages}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {wfhPendingRequests.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">{t.labels.noPendingRequests}</p>
                        ) : (
                          wfhPendingRequests.map((request) => (
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
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                        <Home className="h-3 w-3 mr-1" />
                                        WFH
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">
                                      <span className="font-medium">Work From Home</span> • {request?.dates || 'N/A'} ({request?.days || 0} day{(request?.days || 0) > 1 ? 's' : ''})
                                    </p>
                                    {request?.location && <p className="text-sm text-gray-500">Location: "{request.location}"</p>}
                                    <p className="text-xs text-gray-400 mt-1">{t.labels.submitted}: {request?.submittedDate || 'Unknown'}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" disabled={processingRequestIds.has(request.id)} onClick={() => handleApproveRequest(request)}>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    {t.common.approve}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={processingRequestIds.has(request.id)}
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
                      {totalWfhPendingPages > 1 && wfhPendingRequests.length > 0 && (
                        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
                          <Button variant="outline" size="sm" onClick={() => setWfhPendingPage(Math.max(1, wfhPendingPage - 1))} disabled={wfhPendingPage === 1}>
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            {t.common.previous}
                          </Button>
                          <span className="text-sm text-gray-500 mx-2">Page {wfhPendingPage} of {totalWfhPendingPages}</span>
                          <Button variant="outline" size="sm" onClick={() => setWfhPendingPage(Math.min(totalWfhPendingPages, wfhPendingPage + 1))} disabled={wfhPendingPage === totalWfhPendingPages}>
                            {t.common.next}
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {/* WFH Approved Tab */}
                  {wfhSubTab === 'approved' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">
                          {totalWfhApprovedPages > 0
                            ? `Page ${wfhApprovedPage} of ${totalWfhApprovedPages}`
                            : t.labels.noApprovedRequests}
                        </span>
                        {totalWfhApprovedPages > 0 && (
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => setWfhApprovedPage(Math.max(1, wfhApprovedPage - 1))} disabled={wfhApprovedPage === 1}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setWfhApprovedPage(Math.min(totalWfhApprovedPages, wfhApprovedPage + 1))} disabled={wfhApprovedPage === totalWfhApprovedPages || totalWfhApprovedPages === 0}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {wfhApprovedRequests.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">{t.labels.noApprovedRequests}</p>
                        ) : (
                          wfhApprovedRequests.map((request) => (
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
                                        <span className="font-medium">Work From Home</span> • {request?.days || 0} day{(request?.days || 0) > 1 ? 's' : ''}
                                      </p>
                                      <p className="text-sm text-gray-600">{request?.dates || 'N/A'}</p>
                                      {request?.location && <p className="text-sm text-gray-500">Location: "{request.location}"</p>}
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

                  {/* WFH Denied Tab */}
                  {wfhSubTab === 'denied' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">
                          {totalWfhDeniedPages > 0
                            ? `Page ${wfhDeniedPage} of ${totalWfhDeniedPages}`
                            : t.labels.noDeniedRequests}
                        </span>
                        {totalWfhDeniedPages > 0 && (
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => setWfhDeniedPage(Math.max(1, wfhDeniedPage - 1))} disabled={wfhDeniedPage === 1}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setWfhDeniedPage(Math.min(totalWfhDeniedPages, wfhDeniedPage + 1))} disabled={wfhDeniedPage === totalWfhDeniedPages || totalWfhDeniedPages === 0}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {wfhDeniedRequests.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">{t.labels.noDeniedRequests}</p>
                        ) : (
                          wfhDeniedRequests.map((request) => (
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
                                        <span className="font-medium">Work From Home</span> • {request?.days || 0} day{(request?.days || 0) > 1 ? 's' : ''}
                                      </p>
                                      <p className="text-sm text-gray-600">{request?.dates || 'N/A'}</p>
                                      {request?.location && <p className="text-sm text-gray-500">Location: "{request.location}"</p>}
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
                  </>)}

                  {/* === WORK TRIP CATEGORY === */}
                  {requestCategoryTab === 'workTrip' && (<>
                  {/* Sub-tabs for Work Trip */}
                  {workTripSubTab === 'pending' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">
                          {totalWorkTripPendingPages > 0
                            ? `Showing ${workTripPendingRequests.length} request${workTripPendingRequests.length !== 1 ? 's' : ''} - Page ${workTripPendingPage} of ${totalWorkTripPendingPages}`
                            : t.labels.noPendingRequests}
                        </span>
                        {totalWorkTripPendingPages > 1 && (
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => setWorkTripPendingPage(Math.max(1, workTripPendingPage - 1))} disabled={workTripPendingPage === 1}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setWorkTripPendingPage(Math.min(totalWorkTripPendingPages, workTripPendingPage + 1))} disabled={workTripPendingPage === totalWorkTripPendingPages}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {workTripPendingRequests.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">{t.labels.noPendingRequests}</p>
                        ) : (
                          workTripPendingRequests.map((request) => (
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
                                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                        <Briefcase className="h-3 w-3 mr-1" />
                                        WT
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">
                                      <span className="font-medium">{t.common?.workTripFull || 'Work Trip'}</span> • {request?.dates || 'N/A'} ({request?.days || 0} day{(request?.days || 0) > 1 ? 's' : ''})
                                    </p>
                                    {request?.destination && <p className="text-sm text-gray-500">{t.workTripForm?.destination || 'Destination'}: "{request.destination}"</p>}
                                    {request?.purpose && <p className="text-sm text-gray-500">{t.workTripForm?.purpose || 'Purpose'}: "{request.purpose}"</p>}
                                    <p className="text-xs text-gray-400 mt-1">{t.labels.submitted}: {request?.submittedDate || 'Unknown'}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" disabled={processingRequestIds.has(request.id)} onClick={() => handleApproveRequest(request)}>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    {t.common.approve}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={processingRequestIds.has(request.id)}
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
                      {totalWorkTripPendingPages > 1 && workTripPendingRequests.length > 0 && (
                        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
                          <Button variant="outline" size="sm" onClick={() => setWorkTripPendingPage(Math.max(1, workTripPendingPage - 1))} disabled={workTripPendingPage === 1}>
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            {t.common.previous}
                          </Button>
                          <span className="text-sm text-gray-500 mx-2">Page {workTripPendingPage} of {totalWorkTripPendingPages}</span>
                          <Button variant="outline" size="sm" onClick={() => setWorkTripPendingPage(Math.min(totalWorkTripPendingPages, workTripPendingPage + 1))} disabled={workTripPendingPage === totalWorkTripPendingPages}>
                            {t.common.next}
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Work Trip Approved Tab */}
                  {workTripSubTab === 'approved' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">
                          {totalWorkTripApprovedPages > 0
                            ? `Page ${workTripApprovedPage} of ${totalWorkTripApprovedPages}`
                            : t.labels.noApprovedRequests}
                        </span>
                        {totalWorkTripApprovedPages > 0 && (
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => setWorkTripApprovedPage(Math.max(1, workTripApprovedPage - 1))} disabled={workTripApprovedPage === 1}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setWorkTripApprovedPage(Math.min(totalWorkTripApprovedPages, workTripApprovedPage + 1))} disabled={workTripApprovedPage === totalWorkTripApprovedPages || totalWorkTripApprovedPages === 0}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {workTripApprovedRequests.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">{t.labels.noApprovedRequests}</p>
                        ) : (
                          workTripApprovedRequests.map((request) => (
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
                                        <span className="font-medium">{t.common?.workTripFull || 'Work Trip'}</span> • {request?.days || 0} day{(request?.days || 0) > 1 ? 's' : ''}
                                      </p>
                                      <p className="text-sm text-gray-600">{request?.dates || 'N/A'}</p>
                                      {request?.destination && <p className="text-sm text-gray-500">{t.workTripForm?.destination || 'Destination'}: "{request.destination}"</p>}
                                      <p className="text-xs text-green-600 mt-1">
                                        {t.labels.approvedOn}: {request?.approvedDate ? new Date(request.approvedDate).toLocaleDateString() : 'Unknown'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge className="bg-green-100 text-green-800">{t.labels.approvedByYou}</Badge>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {/* Work Trip Denied Tab */}
                  {workTripSubTab === 'denied' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">
                          {totalWorkTripDeniedPages > 0
                            ? `Page ${workTripDeniedPage} of ${totalWorkTripDeniedPages}`
                            : t.labels.noDeniedRequests}
                        </span>
                        {totalWorkTripDeniedPages > 0 && (
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => setWorkTripDeniedPage(Math.max(1, workTripDeniedPage - 1))} disabled={workTripDeniedPage === 1}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setWorkTripDeniedPage(Math.min(totalWorkTripDeniedPages, workTripDeniedPage + 1))} disabled={workTripDeniedPage === totalWorkTripDeniedPages || totalWorkTripDeniedPages === 0}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {workTripDeniedRequests.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">{t.labels.noDeniedRequests}</p>
                        ) : (
                          workTripDeniedRequests.map((request) => (
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
                                        <span className="font-medium">{t.common?.workTripFull || 'Work Trip'}</span> • {request?.days || 0} day{(request?.days || 0) > 1 ? 's' : ''}
                                      </p>
                                      <p className="text-sm text-gray-600">{request?.dates || 'N/A'}</p>
                                      {request?.destination && <p className="text-sm text-gray-500">{t.workTripForm?.destination || 'Destination'}: "{request.destination}"</p>}
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
                  </>)}
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
          onConfirm={async (comment, signature) => {
            if (approvalDetails.action === 'approve') {
              return await handleApprove(approvalDetails?.request?.id || '', comment, signature)
            } else {
              await handleDeny(approvalDetails?.request?.id || '', comment)
            }
          }}
        />
      )}
    </div>
  )
}
