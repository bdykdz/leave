"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MobileApprovalCard } from "./mobile-approval-card"
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Users, 
  Calendar,
  TrendingUp,
  AlertTriangle,
  Plus,
  MoreHorizontal,
  Filter
} from "lucide-react"
import { format } from "date-fns"
import { useTranslations } from "@/components/language-provider"

interface MobileManagerDashboardProps {
  pendingRequests: any[]
  teamStats: {
    totalMembers: number
    onLeaveToday: number
    pendingRequests: number
    approvalRate: number
  }
  onApproval: (requestId: string, action: 'approve' | 'reject' | 'request_revision', comments?: string) => void
}

export function MobileManagerDashboard({ 
  pendingRequests, 
  teamStats, 
  onApproval 
}: MobileManagerDashboardProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'urgent' | 'recent'>('all')
  const t = useTranslations()

  const filteredRequests = pendingRequests.filter(request => {
    if (filter === 'urgent') {
      if (!request.startDate) return false
      const startDate = new Date(request.startDate)
      if (isNaN(startDate.getTime())) return false
      const daysUntilStart = Math.ceil((startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      return daysUntilStart <= 3 && daysUntilStart >= 0
    }
    if (filter === 'recent') {
      if (!request.createdAt) return false
      const createdDate = new Date(request.createdAt)
      if (isNaN(createdDate.getTime())) return false
      const hoursAgo = (new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60)
      return hoursAgo <= 24
    }
    return true
  })

  const quickStats = [
    {
      label: t.dashboard.teamMembers,
      value: teamStats.totalMembers,
      icon: Users,
      color: "text-blue-600"
    },
    {
      label: t.labels.onLeaveToday, 
      value: teamStats.onLeaveToday,
      icon: Calendar,
      color: "text-green-600"
    },
    {
      label: t.dashboard.pendingApprovals,
      value: teamStats.pendingRequests,
      icon: Clock,
      color: "text-orange-600",
      urgent: teamStats.pendingRequests > 5
    },
    {
      label: "Approval Rate",
      value: `${teamStats.approvalRate}%`,
      icon: CheckCircle,
      color: "text-purple-600"
    }
  ]

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        {quickStats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="relative">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-gray-50`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 truncate">{stat.label}</p>
                    <p className="text-lg font-bold">{stat.value}</p>
                  </div>
                </div>
                {stat.urgent && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 text-xs">
                    !
                  </Badge>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t.mobile.quickActions}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/analytics')}
              className="text-xs"
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              {t.mobile.viewAnalytics}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/holiday-planning')}
              className="text-xs"
            >
              <Calendar className="h-4 w-4 mr-1" />
              {t.nav.planning}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {t.dashboard.pendingApprovals}
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {pendingRequests.length}
                </Badge>
              )}
            </CardTitle>
            {pendingRequests.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/manager?tab=approvals')}
              >
                {t.common.viewAll}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600">{t.mobile.allCaughtUp}</p>
              <p className="text-sm text-gray-500">{t.mobile.noPendingApprovals}</p>
            </div>
          ) : (
            <>
              {/* Filter Options */}
              {pendingRequests.length > 3 && (
                <div className="flex space-x-2 mb-4">
                  <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                    className="text-xs"
                  >
                    {t.mobile.filterAll} ({pendingRequests.length})
                  </Button>
                  <Button
                    variant={filter === 'urgent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('urgent')}
                    className="text-xs"
                  >
                    {t.mobile.filterUrgent}
                  </Button>
                  <Button
                    variant={filter === 'recent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('recent')}
                    className="text-xs"
                  >
                    {t.mobile.filterRecent}
                  </Button>
                </div>
              )}

              {/* Requests List */}
              <div className="space-y-3">
                {filteredRequests.slice(0, 3).map((request) => (
                  <MobileApprovalCard
                    key={request.id}
                    request={request}
                    onApproval={onApproval}
                    compact={false}
                  />
                ))}

                {filteredRequests.length > 3 && (
                  <Button
                    variant="outline"
                    onClick={() => router.push('/manager?tab=approvals')}
                    className="w-full"
                  >
                    {t.mobile.viewMoreRequests} ({filteredRequests.length - 3})
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t.dashboard.recentActivity}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p>John Doe's leave request approved</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p>Sarah Wilson submitted WFH request</p>
                <p className="text-xs text-gray-500">4 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div className="flex-1">
                <p>Team holiday planning reminder sent</p>
                <p className="text-xs text-gray-500">Yesterday</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coverage Alerts */}
      {teamStats.onLeaveToday > teamStats.totalMembers * 0.3 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800">{t.mobile.coverageAlert}</p>
                <p className="text-sm text-orange-700">
                  {teamStats.onLeaveToday} team members on leave today ({Math.round((teamStats.onLeaveToday / teamStats.totalMembers) * 100)}% of team)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}