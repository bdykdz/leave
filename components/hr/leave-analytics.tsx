"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Users, TrendingUp, Calendar, AlertCircle, Loader2, RefreshCw, Download, CalendarIcon, FileText } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface AnalyticsData {
  stats: Array<{
    title: string
    value: string
    change: string
    icon: string
    color: string
  }>
  departmentData: Array<{
    department: string
    leaves: number
    average: number
  }>
  monthlyTrend: Array<{
    month: string
    leaves: number
  }>
  upcomingHolidays?: Array<{
    name: string
    date: string
  }>
}

type DateRange = {
  from: Date | undefined
  to: Date | undefined
}

type PresetRange = 'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'current_year' | 'custom'

export function LeaveAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [selectedRange, setSelectedRange] = useState<PresetRange>('current_month')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  })
  const [calendarOpen, setCalendarOpen] = useState(false)

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (dateRange.from) params.append('startDate', dateRange.from.toISOString())
      if (dateRange.to) params.append('endDate', dateRange.to.toISOString())
      
      const response = await fetch(`/api/hr/analytics?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAnalyticsData(data)
      } else {
        toast.error('Failed to load analytics data')
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  const handlePresetRange = (preset: PresetRange) => {
    setSelectedRange(preset)
    const now = new Date()
    
    switch (preset) {
      case 'current_month':
        setDateRange({
          from: startOfMonth(now),
          to: endOfMonth(now)
        })
        break
      case 'last_month':
        const lastMonth = subMonths(now, 1)
        setDateRange({
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth)
        })
        break
      case 'last_3_months':
        setDateRange({
          from: startOfMonth(subMonths(now, 2)),
          to: endOfMonth(now)
        })
        break
      case 'last_6_months':
        setDateRange({
          from: startOfMonth(subMonths(now, 5)),
          to: endOfMonth(now)
        })
        break
      case 'current_year':
        setDateRange({
          from: new Date(now.getFullYear(), 0, 1),
          to: new Date(now.getFullYear(), 11, 31)
        })
        break
      case 'custom':
        // Don't change the date range, let user pick
        break
    }
  }

  const exportToPDF = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (dateRange.from) params.append('startDate', dateRange.from.toISOString())
      if (dateRange.to) params.append('endDate', dateRange.to.toISOString())
      params.append('format', 'pdf')
      
      const response = await fetch(`/api/hr/analytics/export?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Analytics report exported successfully')
      } else {
        toast.error('Failed to export analytics report')
      }
    } catch (error) {
      console.error('Error exporting analytics:', error)
      toast.error('Failed to export analytics report')
    } finally {
      setExporting(false)
    }
  }

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Calendar': return Calendar
      case 'TrendingUp': return TrendingUp
      case 'Users': return Users
      case 'AlertCircle': return AlertCircle
      default: return Calendar
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading analytics...</span>
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load analytics data</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>
                Data from {dateRange.from ? format(dateRange.from, 'MMM dd, yyyy') : 'N/A'} to{' '}
                {dateRange.to ? format(dateRange.to, 'MMM dd, yyyy') : 'N/A'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-1" />
                )}
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Preset Ranges */}
            <div className="space-y-2">
              <Label htmlFor="range-select">Time Period</Label>
              <Select value={selectedRange} onValueChange={(value: PresetRange) => handlePresetRange(value)}>
                <SelectTrigger className="w-[180px]" id="range-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">Current Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                  <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                  <SelectItem value="current_year">Current Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {selectedRange === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? format(dateRange.from, "MMM dd") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.to ? format(dateRange.to, "MMM dd") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <Button onClick={fetchAnalytics} disabled={!dateRange.from || !dateRange.to}>
                  Apply Filter
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {analyticsData.stats.map((stat, index) => {
          const IconComponent = getIconComponent(stat.icon)
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <IconComponent className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.change} {stat.title === "Away Today" ? "" : "from last period"}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Department Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Leaves by Department</CardTitle>
            <CardDescription>Total leave days taken in selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.departmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="leaves" fill="#8884d8" name="Total Days" />
                <Bar dataKey="average" fill="#82ca9d" name="Avg per Employee" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Trend</CardTitle>
            <CardDescription>Leave requests over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="leaves" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Holidays */}
      {analyticsData.upcomingHolidays && analyticsData.upcomingHolidays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Holidays</CardTitle>
            <CardDescription>Public holidays in current period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analyticsData.upcomingHolidays.map((holiday, index) => (
                <div key={index} className="flex items-center gap-2 bg-yellow-50 text-yellow-800 px-3 py-1 rounded-full border border-yellow-200">
                  <Calendar className="h-3 w-3" />
                  <span className="text-sm font-medium">{holiday.name}</span>
                  <span className="text-xs">{holiday.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}