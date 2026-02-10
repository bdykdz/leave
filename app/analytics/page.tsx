"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowLeft, 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { useTranslations } from "@/components/language-provider"

interface DashboardMetrics {
  totalEmployees: number
  activeRequests: number
  approvalsPending: number
  totalDaysRequested: number
  averageProcessingTime: number
}

interface LeaveUsageTrend {
  month: string
  totalDays: number
  averagePerEmployee: number
  requestCount: number
}

interface DepartmentAnalytics {
  department: string
  totalEmployees: number
  totalLeave: number
  averagePerEmployee: number
  pendingRequests: number
  utilizationRate: number
}

interface ApprovalMetrics {
  averageApprovalTime: number
  approvalRate: number
  escalationRate: number
  topApprovers: Array<{
    name: string
    approvals: number
    averageTime: number
  }>
}

interface SeasonalAnalytics {
  month: string
  requestVolume: number
  approvalRate: number
  averageDaysRequested: number
  popularLeaveTypes: Array<{
    name: string
    count: number
  }>
}

interface TeamCoverageAnalytics {
  date: string
  totalEmployees: number
  onLeave: number
  coveragePercentage: number
  criticalCoverage: boolean
  conflicts: number
}

const chartConfig = {
  totalDays: {
    label: "Total Days",
    color: "hsl(var(--chart-1))",
  },
  averagePerEmployee: {
    label: "Avg per Employee", 
    color: "hsl(var(--chart-2))",
  },
  totalLeave: {
    label: "Total Leave Days",
    color: "hsl(var(--chart-1))",
  },
  requestVolume: {
    label: "Request Volume",
    color: "hsl(var(--chart-1))",
  },
  averageDaysRequested: {
    label: "Avg Days",
    color: "hsl(var(--chart-2))",
  },
  coveragePercentage: {
    label: "Coverage %",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  // Analytics data states
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [trends, setTrends] = useState<LeaveUsageTrend[]>([])
  const [departments, setDepartments] = useState<DepartmentAnalytics[]>([])
  const [approvals, setApprovals] = useState<ApprovalMetrics | null>(null)
  const [seasonal, setSeasonal] = useState<SeasonalAnalytics[]>([])
  const [coverage, setCoverage] = useState<TeamCoverageAnalytics[]>([])

  useEffect(() => {
    if (session) {
      loadAnalytics()
    }
  }, [session, activeTab])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      
      // Load different analytics based on active tab
      switch (activeTab) {
        case 'overview':
          await Promise.all([
            loadMetrics(),
            loadTrends()
          ])
          break
        case 'departments':
          await loadDepartments()
          break
        case 'approvals':
          await loadApprovals()
          break
        case 'seasonal':
          await loadSeasonal()
          break
        case 'coverage':
          await loadCoverage()
          break
      }
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMetrics = async () => {
    const response = await fetch('/api/analytics/dashboard?type=overview')
    if (response.ok) {
      const data = await response.json()
      setMetrics(data)
    }
  }

  const loadTrends = async () => {
    const response = await fetch('/api/analytics/dashboard?type=trends&months=12')
    if (response.ok) {
      const data = await response.json()
      setTrends(data)
    }
  }

  const loadDepartments = async () => {
    const response = await fetch('/api/analytics/dashboard?type=departments')
    if (response.ok) {
      const data = await response.json()
      setDepartments(data)
    }
  }

  const loadApprovals = async () => {
    const response = await fetch('/api/analytics/dashboard?type=approvals')
    if (response.ok) {
      const data = await response.json()
      setApprovals(data)
    }
  }

  const loadSeasonal = async () => {
    const response = await fetch('/api/analytics/dashboard?type=seasonal')
    if (response.ok) {
      const data = await response.json()
      setSeasonal(data)
    }
  }

  const loadCoverage = async () => {
    const response = await fetch('/api/analytics/dashboard?type=coverage&days=30')
    if (response.ok) {
      const data = await response.json()
      setCoverage(data)
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t.errors.accessDenied}</h1>
          <p className="text-gray-600 mb-4">{t.errors.loginRequired}</p>
          <Button onClick={() => router.push('/login')}>Go to Login</Button>
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
              <h1 className="text-2xl font-bold text-gray-900">{t.nav.analytics} {t.dashboard.title}</h1>
              <p className="text-gray-600">Comprehensive insights into leave management and team dynamics</p>
            </div>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
            <TabsTrigger value="coverage">Coverage</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {metrics && (
              <>
                {/* Key Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        <p className="text-sm font-medium text-gray-600">{t.metrics.totalEmployees}</p>
                      </div>
                      <p className="text-2xl font-bold">{metrics.totalEmployees}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-5 w-5 text-orange-500" />
                        <p className="text-sm font-medium text-gray-600">{t.metrics.activeRequests}</p>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">{metrics.activeRequests}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-5 w-5 text-purple-500" />
                        <p className="text-sm font-medium text-gray-600">{t.metrics.pendingApprovals}</p>
                      </div>
                      <p className="text-2xl font-bold text-purple-600">{metrics.approvalsPending}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-5 w-5 text-green-500" />
                        <p className="text-sm font-medium text-gray-600">{t.metrics.daysRequested}</p>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{metrics.totalDaysRequested}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-5 w-5 text-indigo-500" />
                        <p className="text-sm font-medium text-gray-600">{t.metrics.averageProcessing}</p>
                      </div>
                      <p className="text-2xl font-bold text-indigo-600">{metrics.averageProcessingTime}d</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Leave Usage Trends Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Leave Usage Trends</CardTitle>
                    <CardDescription>Monthly leave usage patterns over the past year</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trends.length > 0 && (
                      <ChartContainer config={chartConfig}>
                        <AreaChart data={trends} margin={{ left: 12, right: 12 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" />}
                          />
                          <Area
                            dataKey="totalDays"
                            type="natural"
                            fill="var(--color-totalDays)"
                            fillOpacity={0.4}
                            stroke="var(--color-totalDays)"
                            stackId="a"
                          />
                          <Area
                            dataKey="averagePerEmployee"
                            type="natural"
                            fill="var(--color-averagePerEmployee)"
                            fillOpacity={0.4}
                            stroke="var(--color-averagePerEmployee)"
                            stackId="b"
                          />
                        </AreaChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Department Analytics</CardTitle>
                <CardDescription>Leave usage and metrics by department</CardDescription>
              </CardHeader>
              <CardContent>
                {departments.length > 0 && (
                  <>
                    <ChartContainer config={chartConfig}>
                      <BarChart data={departments} margin={{ left: 12, right: 12 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="department"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent indicator="dashed" />}
                        />
                        <Bar dataKey="totalLeave" fill="var(--color-totalLeave)" />
                        <Bar dataKey="averagePerEmployee" fill="var(--color-averagePerEmployee)" />
                      </BarChart>
                    </ChartContainer>
                    
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {departments.map((dept, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <h4 className="font-medium text-lg">{dept.department}</h4>
                          <div className="mt-2 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>{t.labels.employees}:</span>
                              <span className="font-medium">{dept.totalEmployees}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{t.labels.totalLeave}:</span>
                              <span className="font-medium">{dept.totalLeave} {t.common.days}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{t.labels.utilization}:</span>
                              <span className="font-medium">{dept.utilizationRate.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{t.labels.pending}:</span>
                              <Badge variant={dept.pendingRequests > 0 ? "destructive" : "secondary"}>
                                {dept.pendingRequests}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Approvals Tab */}
          <TabsContent value="approvals" className="space-y-6">
            {approvals && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-5 w-5 text-blue-500" />
                        <p className="text-sm font-medium text-gray-600">{t.metrics.averageApprovalTime}</p>
                      </div>
                      <p className="text-2xl font-bold">{approvals.averageApprovalTime} days</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <p className="text-sm font-medium text-gray-600">{t.metrics.approvalRate}</p>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{approvals.approvalRate}%</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        <p className="text-sm font-medium text-gray-600">{t.metrics.escalationRate}</p>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">{approvals.escalationRate}%</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Approvers</CardTitle>
                    <CardDescription>Most active approvers and their performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {approvals.topApprovers.map((approver, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{approver.name}</p>
                            <p className="text-sm text-gray-600">{approver.approvals} approvals</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{approver.averageTime.toFixed(1)} days</p>
                            <p className="text-xs text-gray-500">avg time</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Seasonal Tab */}
          <TabsContent value="seasonal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Seasonal Analysis</CardTitle>
                <CardDescription>Leave patterns throughout the year</CardDescription>
              </CardHeader>
              <CardContent>
                {seasonal.length > 0 && (
                  <ChartContainer config={chartConfig}>
                    <LineChart data={seasonal} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent />}
                      />
                      <Line
                        dataKey="requestVolume"
                        type="monotone"
                        stroke="var(--color-requestVolume)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        dataKey="averageDaysRequested"
                        type="monotone"
                        stroke="var(--color-averageDaysRequested)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coverage Tab */}
          <TabsContent value="coverage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Coverage Analysis</CardTitle>
                <CardDescription>Upcoming coverage gaps and critical periods</CardDescription>
              </CardHeader>
              <CardContent>
                {coverage.length > 0 && (
                  <>
                    <ChartContainer config={chartConfig}>
                      <AreaChart data={coverage} margin={{ left: 12, right: 12 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent indicator="dot" />}
                        />
                        <Area
                          dataKey="coveragePercentage"
                          type="natural"
                          fill="var(--color-coveragePercentage)"
                          fillOpacity={0.4}
                          stroke="var(--color-coveragePercentage)"
                        />
                      </AreaChart>
                    </ChartContainer>
                    
                    <div className="mt-6">
                      <h4 className="font-medium mb-4">{t.metrics.criticalCoveragePeriods}</h4>
                      <div className="space-y-2">
                        {coverage.filter(c => c.criticalCoverage).slice(0, 5).map((day, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div>
                              <p className="font-medium text-red-800">{day.date}</p>
                              <p className="text-sm text-red-600">{day.onLeave} out of {day.totalEmployees} on leave</p>
                            </div>
                            <Badge variant="destructive">{day.coveragePercentage.toFixed(1)}% coverage</Badge>
                          </div>
                        ))}
                        {coverage.filter(c => c.criticalCoverage).length === 0 && (
                          <p className="text-gray-500 text-center py-4">{t.metrics.noCriticalCoveragePeriods}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading analytics...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}