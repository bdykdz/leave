"use client"

import { useState, useEffect } from "react"
import { ChevronDown, Download, Calendar, Users, Home, TrendingUp, Shield, LogOut, Settings, User, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ApprovalDialogV2 } from "@/components/approval-dialog-v2"
import { useTranslations } from "@/components/language-provider"


export default function ExecutiveDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const t = useTranslations()
  const [timeframe, setTimeframe] = useState("month")
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [loading, setLoading] = useState(true)
  
  // State for real data
  const [companyMetrics, setCompanyMetrics] = useState({
    totalEmployees: 0,
    onLeaveToday: 0,
    workingRemoteToday: 0,
    inOfficeToday: 0,
    pendingApprovals: 0,
    totalLeaveDaysThisMonth: 0,
    totalRemoteDaysThisMonth: 0,
    averageLeaveDaysPerEmployee: 0,
    leaveUtilizationRate: 0,
  })
  
  const [departmentLeaveData, setDepartmentLeaveData] = useState<any[]>([])
  const [monthlyLeavePattern, setMonthlyLeavePattern] = useState<any[]>([])
  const [remoteWorkTrends, setRemoteWorkTrends] = useState<any[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [pendingRequestsPage, setPendingRequestsPage] = useState(1)
  const [totalPendingPages, setTotalPendingPages] = useState(0)
  const [peakAbsencePeriods, setPeakAbsencePeriods] = useState<any[]>([])
  const [leaveUtilizationData, setLeaveUtilizationData] = useState<any[]>([])
  
  // State for approval dialog
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
  
  // Fetch company metrics
  useEffect(() => {
    fetchCompanyMetrics()
  }, [])
  
  // Fetch department stats
  useEffect(() => {
    fetchDepartmentStats()
  }, [])
  
  // Fetch monthly patterns
  useEffect(() => {
    fetchMonthlyPatterns()
  }, [])
  
  // Fetch remote trends
  useEffect(() => {
    fetchRemoteTrends()
  }, [])
  
  // Fetch pending requests
  useEffect(() => {
    fetchPendingRequests()
  }, [pendingRequestsPage])
  
  // Initialize peak absence periods with sample data
  useEffect(() => {
    setPeakAbsencePeriods([
      {
        period: "Dec 23-27",
        percentageOfWorkforce: 32,
        departments: ["Engineering", "Sales", "HR"],
        totalEmployees: 45,
        businessImpact: "Critical project deadlines may be affected"
      },
      {
        period: "Jul 15-19",
        percentageOfWorkforce: 18,
        departments: ["Marketing", "Finance"],
        totalEmployees: 26,
        businessImpact: "Quarter-end reporting may require additional resources"
      }
    ])
    
    // Initialize leave utilization data
    setLeaveUtilizationData([
      { department: "Engineering", used: 145, remaining: 55, utilization: 72.5 },
      { department: "Sales", used: 89, remaining: 31, utilization: 74.2 },
      { department: "HR", used: 42, remaining: 18, utilization: 70.0 },
      { department: "Finance", used: 67, remaining: 33, utilization: 67.0 },
      { department: "Marketing", used: 53, remaining: 27, utilization: 66.3 }
    ])
  }, [])
  
  const fetchCompanyMetrics = async () => {
    try {
      const response = await fetch('/api/executive/company-metrics')
      if (response.ok) {
        const data = await response.json()
        setCompanyMetrics(data)
      }
    } catch (error) {
      console.error('Error fetching company metrics:', error)
      toast.error(t.messages.failedToLoadRequests)
    }
  }
  
  const fetchDepartmentStats = async () => {
    try {
      const response = await fetch('/api/executive/department-stats')
      if (response.ok) {
        const data = await response.json()
        setDepartmentLeaveData(data)
      }
    } catch (error) {
      console.error('Error fetching department stats:', error)
      toast.error(t.messages.failedToLoadRequests)
    }
  }
  
  const fetchMonthlyPatterns = async () => {
    try {
      const response = await fetch('/api/executive/monthly-patterns')
      if (response.ok) {
        const data = await response.json()
        setMonthlyLeavePattern(data)
      }
    } catch (error) {
      console.error('Error fetching monthly patterns:', error)
      toast.error(t.messages.failedToLoadRequests)
    }
  }
  
  const fetchRemoteTrends = async () => {
    try {
      const response = await fetch('/api/executive/remote-trends')
      if (response.ok) {
        const data = await response.json()
        setRemoteWorkTrends(data)
      }
    } catch (error) {
      console.error('Error fetching remote trends:', error)
      toast.error(t.messages.failedToLoadRequests)
    } finally {
      setLoading(false)
    }
  }
  
  const fetchPendingRequests = async () => {
    try {
      const response = await fetch(`/api/executive/pending-approvals?page=${pendingRequestsPage}&limit=5`)
      if (response.ok) {
        const data = await response.json()
        setPendingRequests(data.requests)
        setTotalPendingPages(data.pagination.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error)
      toast.error(t.messages.failedToLoadRequests)
    }
  }
  
  const handleApprove = async (requestId: string, comment?: string) => {
    try {
      const response = await fetch(`/api/executive/approve-request/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      })
      
      if (response.ok) {
        toast.success(t.messages.requestApprovedSuccess)
        await Promise.all([
          fetchPendingRequests(),
          fetchCompanyMetrics(),
          fetchDepartmentStats()
        ])
        setShowApprovalDialog(false)
      } else {
        const errorData = await response.json()
        toast.error(errorData.details || t.messages.failedToApprove)
      }
    } catch (error) {
      console.error('Error approving request:', error)
      toast.error(t.messages.failedToApprove)
    }
  }
  
  const handleDeny = async (requestId: string, comment?: string) => {
    try {
      const response = await fetch(`/api/executive/deny-request/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      })
      
      if (response.ok) {
        toast.success(t.messages.requestDeniedSuccess)
        await Promise.all([
          fetchPendingRequests(),
          fetchCompanyMetrics(),
          fetchDepartmentStats()
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
  
  const handleApproveRequest = (request: any) => {
    setApprovalDetails({
      action: "approve",
      request: {
        id: request.id,
        employeeName: request.employee?.name || 'Unknown',
        type: request.type,
        dates: request.dates,
        days: request.days,
      },
    })
    setShowApprovalDialog(true)
  }

  const handleDenyRequest = (request: any) => {
    setApprovalDetails({
      action: "deny",
      request: {
        id: request.id,
        employeeName: request.employee?.name || 'Unknown',
        type: request.type,
        dates: request.dates,
        days: request.days,
      },
    })
    setShowApprovalDialog(true)
  }
  
  // Calculate department capacity
  const departmentCapacity = departmentLeaveData.map((dept) => ({
    ...dept,
    availableToday: dept.employees - dept.onLeaveToday,
    capacityPercentage: Math.round(((dept.employees - dept.onLeaveToday) / dept.employees) * 100),
    remotePercentage: Math.round((dept.remoteToday / dept.employees) * 100),
  }))

  // Generate report function
  const generateReport = async (reportType: string, format: string) => {
    try {
      toast.info(`Generating ${reportType} report...`)
      
      const response = await fetch('/api/executive/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          format,
          timeframe,
          data: {
            companyMetrics,
            departmentStats: departmentLeaveData,
            monthlyPatterns: monthlyLeavePattern,
            remoteTrends: remoteWorkTrends,
            capacityData: departmentCapacity,
            leaveUtilization: leaveUtilizationData,
            peakPeriods: peakAbsencePeriods
          }
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Report generated successfully!')
      } else {
        toast.error('Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-semibold">{t.analytics.executiveDashboard}</h1>
            </div>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              {companyMetrics.pendingApprovals} {t.analytics.pendingApprovals}
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  {t.common.export}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => generateReport('department', 'pdf')}>{t.analytics.departmentSummary}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateReport('utilization', 'pdf')}>{t.analytics.leaveUtilizationReport}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateReport('capacity', 'pdf')}>{t.analytics.capacityPlanningReport}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateReport('manager-performance', 'pdf')}>{t.analytics.managerPerformanceReport}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => generateReport('full', 'csv')}>{t.analytics.exportAllDataCSV}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Back to Executive Dashboard Button */}
            <Button onClick={() => router.push("/executive")} variant="outline" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              {t.nav.backToDashboard}
            </Button>
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
                  <span>{t.common.profile}</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>{t.nav.settings}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => signOut({ callbackUrl: '/' })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t.common.logOut}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Current Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t.labels.workforceToday}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companyMetrics.inOfficeToday}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((companyMetrics.inOfficeToday / companyMetrics.totalEmployees) * 100)}% in office
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t.labels.onLeaveToday}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companyMetrics.onLeaveToday}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((companyMetrics.onLeaveToday / companyMetrics.totalEmployees) * 100)}% of workforce
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t.labels.workingRemote}</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companyMetrics.workingRemoteToday}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((companyMetrics.workingRemoteToday / companyMetrics.totalEmployees) * 100)}% remote today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t.labels.leaveUtilization}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companyMetrics.leaveUtilizationRate}%</div>
              <p className="text-xs text-muted-foreground">{t.labels.ofAllocatedLeaveUsedYTD}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">{t.tabs.overview}</TabsTrigger>
            <TabsTrigger value="departments">{t.tabs.departments}</TabsTrigger>
            <TabsTrigger value="patterns">{t.tabs.leavePatterns}</TabsTrigger>
            <TabsTrigger value="capacity">{t.tabs.capacityPlanning}</TabsTrigger>
            <TabsTrigger value="approvals">{t.tabs.approvalMetrics}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t.analytics.monthlyLeaveTrends}</CardTitle>
                  <CardDescription>{t.analytics.monthlyLeaveTrendsDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      vacationDays: {
                        label: "Vacation",
                        color: "hsl(var(--chart-1))",
                      },
                      personalDays: {
                        label: "Personal",
                        color: "hsl(var(--chart-2))",
                      },
                      medicalDays: {
                        label: "Medical",
                        color: "hsl(var(--chart-3))",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <BarChart data={monthlyLeavePattern}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="vacationDays" stackId="a" fill="var(--color-vacationDays)" />
                      <Bar dataKey="personalDays" stackId="a" fill="var(--color-personalDays)" />
                      <Bar dataKey="medicalDays" stackId="a" fill="var(--color-medicalDays)" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t.analytics.remoteWorkAdoption}</CardTitle>
                  <CardDescription>{t.analytics.remoteWorkAdoptionDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      Engineering: {
                        label: "Engineering",
                        color: "hsl(var(--chart-1))",
                      },
                      Product: {
                        label: "Product",
                        color: "hsl(var(--chart-2))",
                      },
                      Sales: {
                        label: "Sales",
                        color: "hsl(var(--chart-3))",
                      },
                      Marketing: {
                        label: "Marketing",
                        color: "hsl(var(--chart-4))",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <LineChart data={remoteWorkTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line type="monotone" dataKey="Engineering" stroke="var(--color-Engineering)" strokeWidth={2} />
                      <Line type="monotone" dataKey="Product" stroke="var(--color-Product)" strokeWidth={2} />
                      <Line type="monotone" dataKey="Sales" stroke="var(--color-Sales)" strokeWidth={2} />
                      <Line type="monotone" dataKey="Marketing" stroke="var(--color-Marketing)" strokeWidth={2} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t.analytics.peakAbsencePeriods}</CardTitle>
                <CardDescription>{t.analytics.peakAbsencePeriodsDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {peakAbsencePeriods && peakAbsencePeriods.length > 0 ? peakAbsencePeriods.map((period, index) => (
                    <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                      <div
                        className={`p-2 rounded-full ${
                          period.percentageOfWorkforce > 25
                            ? "bg-red-100 text-red-600"
                            : period.percentageOfWorkforce > 20
                              ? "bg-yellow-100 text-yellow-600"
                              : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold">{period.period}</h4>
                          <Badge
                            className={
                              period.percentageOfWorkforce > 25
                                ? "bg-red-500"
                                : period.percentageOfWorkforce > 20
                                  ? "bg-yellow-500"
                                  : "bg-blue-500"
                            }
                          >
                            {period.percentageOfWorkforce}% {t.analytics.absent}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {period.expectedAbsent} {t.analytics.expectedOnLeave}
                        </p>
                        <div className="text-sm text-gray-500">
                          <p className="mb-1">{t.analytics.departmentBreakdown}: {period.departments.join(", ")}</p>
                          <p className="font-medium text-blue-600">{period.businessImpact}</p>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-muted-foreground">{t.analytics.noPeakAbsencePeriods}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {departmentCapacity.map((dept) => (
                <Card key={dept.department}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{dept.department}</CardTitle>
                      <Badge
                        className={
                          dept.capacityPercentage < 75
                            ? "bg-red-500"
                            : dept.capacityPercentage < 85
                              ? "bg-yellow-500"
                              : "bg-green-500"
                        }
                      >
                        {dept.capacityPercentage}% {t.analytics.available}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">{t.labels.totalStaff}</p>
                        <p className="font-semibold">{dept.employees}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">{t.labels.availableToday}</p>
                        <p className="font-semibold">{dept.availableToday}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">{t.analytics.onLeave}</p>
                        <p className="font-semibold">{dept.onLeaveToday}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">{t.labels.remote}</p>
                        <p className="font-semibold">
                          {dept.remoteToday} ({dept.remotePercentage}%)
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{t.labels.pendingRequestsLabel}</span>
                        <Badge variant="outline">{dept.pendingRequests}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.analytics.leaveUtilizationByDepartment}</CardTitle>
                <CardDescription>{t.analytics.leaveUtilizationByDepartmentDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    used: {
                      label: "Days Used",
                      color: "hsl(var(--chart-1))",
                    },
                    remaining: {
                      label: "Days Remaining",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[400px]"
                >
                  <BarChart data={leaveUtilizationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="used" stackId="a" fill="var(--color-used)" />
                    <Bar dataKey="remaining" stackId="a" fill="var(--color-remaining)" />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t.analytics.leaveUtilizationRates}</CardTitle>
                  <CardDescription>{t.analytics.leaveUtilizationRatesDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {leaveUtilizationData.map((dept) => (
                      <div key={dept.department} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">{dept.department}</span>
                          <span className="text-sm font-bold">{dept.utilizationRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${dept.utilizationRate}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{dept.used} used</span>
                          <span>{dept.remaining} remaining</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t.analytics.keyInsights}</CardTitle>
                  <CardDescription>{t.analytics.keyInsightsDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 border rounded-lg bg-blue-50">
                      <h4 className="font-medium text-blue-800">{t.analytics.peakSeason}</h4>
                      <p className="text-sm text-blue-600">July shows highest leave usage (312 days)</p>
                      <p className="text-xs text-blue-500 mt-1">Plan coverage for summer months</p>
                    </div>
                    <div className="p-3 border rounded-lg bg-green-50">
                      <h4 className="font-medium text-green-800">{t.analytics.highUtilization}</h4>
                      <p className="text-sm text-green-600">Product team using 73% of allocated leave</p>
                      <p className="text-xs text-green-500 mt-1">Good work-life balance indicator</p>
                    </div>
                    <div className="p-3 border rounded-lg bg-yellow-50">
                      <h4 className="font-medium text-yellow-800">{t.analytics.lowUtilization}</h4>
                      <p className="text-sm text-yellow-600">HR team only using 61% of leave</p>
                      <p className="text-xs text-yellow-500 mt-1">May indicate burnout risk</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="capacity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.analytics.departmentCapacityAnalysis}</CardTitle>
                <CardDescription>{t.analytics.departmentCapacityAnalysisDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {departmentCapacity.map((dept) => (
                    <div key={dept.department} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">{dept.department}</h4>
                        <span className="text-sm text-gray-600">
                          {dept.availableToday}/{dept.employees} available ({dept.capacityPercentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="bg-green-500"
                            style={{ width: `${(dept.availableToday / dept.employees) * 100}%` }}
                          ></div>
                          <div
                            className="bg-blue-500"
                            style={{ width: `${(dept.remoteToday / dept.employees) * 100}%` }}
                          ></div>
                          <div
                            className="bg-red-500"
                            style={{ width: `${(dept.onLeaveToday / dept.employees) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>🟢 {t.analytics.inOffice}: {dept.availableToday - dept.remoteToday}</span>
                        <span>🔵 {t.labels.remote}: {dept.remoteToday}</span>
                        <span>🔴 {t.analytics.onLeave}: {dept.onLeaveToday}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approvals" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t.analytics.approvalEfficiency}</CardTitle>
                  <CardDescription>{t.analytics.approvalEfficiencyDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{companyMetrics.pendingApprovals}</div>
                        <div className="text-xs text-gray-600">{t.analytics.pendingApprovals}</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{companyMetrics.leaveUtilizationRate}%</div>
                        <div className="text-xs text-gray-600">{t.labels.leaveUtilization}</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{companyMetrics.averageLeaveDaysPerEmployee}</div>
                        <div className="text-xs text-gray-600">{t.analytics.avgLeaveDaysPerEmployee}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t.analytics.pendingApprovals}</CardTitle>
                      <CardDescription>{t.analytics.pendingExecutiveApprovalsDescription}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {totalPendingPages > 0 
                          ? `Page ${pendingRequestsPage} of ${totalPendingPages}`
                          : 'No pending requests'}
                      </span>
                      {totalPendingPages > 0 && (
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingRequestsPage(Math.max(1, pendingRequestsPage - 1))}
                            disabled={pendingRequestsPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingRequestsPage(Math.min(totalPendingPages, pendingRequestsPage + 1))}
                            disabled={pendingRequestsPage === totalPendingPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pendingRequests.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">{t.analytics.noPendingExecutiveApprovals}</p>
                    ) : (
                      pendingRequests.map((request) => (
                        <div key={request.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={request.employee?.avatar} />
                                <AvatarFallback>
                                  {(request.employee?.name || 'U').split(' ').map((n: string) => n?.[0] || '').join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold">{request.employee?.name || 'Unknown'}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {request.employee?.department || 'N/A'}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {request.employee?.position || 'N/A'}
                                  </Badge>
                                  {request.type === "Work from Home" && <Home className="h-4 w-4 text-blue-500" />}
                                </div>
                                <p className="text-sm text-gray-600 mb-1">
                                  <span className="font-medium">{request.type}</span> • {request.dates} ({request.days}{" "}
                                  day{request.days > 1 ? "s" : ""})
                                </p>
                                {request.reason && <p className="text-sm text-gray-500">"{request.reason}"</p>}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                  <span>Submitted: {new Date(request.submittedDate).toLocaleDateString()}</span>
                                  {request.managerApproved && (
                                    <span className="text-green-600">
                                      ✓ Manager approved on {new Date(request.managerApprovalDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
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
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Approval Dialog */}
      {showApprovalDialog && approvalDetails && (
        <ApprovalDialogV2
          isOpen={showApprovalDialog}
          onClose={() => setShowApprovalDialog(false)}
          action={approvalDetails.action}
          request={approvalDetails.request}
          onConfirm={(comment) => {
            if (approvalDetails.action === "approve") {
              handleApprove(approvalDetails.request.id, comment)
            } else {
              handleDeny(approvalDetails.request.id, comment)
            }
          }}
        />
      )}
    </div>
  )
}
