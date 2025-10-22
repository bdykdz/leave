"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Users, TrendingUp, Calendar, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

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
}

export function LeaveAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/hr/analytics')
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
                  {stat.change} {stat.title === "Employees on Leave Today" ? "" : "from last period"}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leaves by Department</CardTitle>
            <CardDescription>Total leave days taken this month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.departmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="department" 
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value} days`, 
                    name === 'leaves' ? 'Total Leave Days' : name
                  ]}
                />
                <Bar dataKey="leaves" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Leave Trend</CardTitle>
            <CardDescription>Leave usage over the past 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`${value} days`, 'Total Leave Days']}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="leaves" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Leave Statistics</CardTitle>
          <CardDescription>Average leave days per employee by department this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.departmentData.map((dept) => (
              <div key={dept.department} className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-32 font-medium">{dept.department}</div>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((dept.average / 5) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium">{dept.average} days avg</div>
              </div>
            ))}
          </div>
          {analyticsData.departmentData.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No department data available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}