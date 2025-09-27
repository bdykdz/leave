"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Users, TrendingUp, Calendar, AlertCircle } from "lucide-react"

export function LeaveAnalytics() {
  // Mock data
  const departmentData = [
    { department: "Engineering", leaves: 45, average: 3.2 },
    { department: "Sales", leaves: 32, average: 2.8 },
    { department: "HR", leaves: 28, average: 3.5 },
    { department: "Finance", leaves: 25, average: 2.5 },
    { department: "Marketing", leaves: 30, average: 3.0 }
  ]

  const monthlyTrend = [
    { month: "Jan", leaves: 120 },
    { month: "Feb", leaves: 98 },
    { month: "Mar", leaves: 145 },
    { month: "Apr", leaves: 110 },
    { month: "May", leaves: 125 },
    { month: "Jun", leaves: 160 }
  ]

  const stats = [
    {
      title: "Total Leaves This Month",
      value: "156",
      change: "+12%",
      icon: Calendar,
      color: "text-blue-600"
    },
    {
      title: "Average Leave Days",
      value: "2.8",
      change: "-5%",
      icon: TrendingUp,
      color: "text-green-600"
    },
    {
      title: "Employees on Leave Today",
      value: "12",
      change: "0%",
      icon: Users,
      color: "text-purple-600"
    },
    {
      title: "Pending Approvals",
      value: "8",
      change: "+2",
      icon: AlertCircle,
      color: "text-orange-600"
    }
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leaves by Department</CardTitle>
            <CardDescription>Total leave days taken this month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="leaves" fill="#3b82f6" />
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
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="leaves" stroke="#10b981" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Leave Statistics</CardTitle>
          <CardDescription>Average leave days per employee by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departmentData.map((dept) => (
              <div key={dept.department} className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-32 font-medium">{dept.department}</div>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${(dept.average / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium">{dept.average} days</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}