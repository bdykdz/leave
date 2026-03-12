"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  Home,
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  ChevronRight,
  Briefcase,
} from "lucide-react"
import { format } from "date-fns"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTranslations } from "@/components/language-provider"

interface DashboardSummaryData {
  onLeaveToday: {
    id: string
    name: string
    leaveType: string
    avatar?: string
    department?: string
  }[]
  workingFromHomeToday: {
    id: string
    name: string
    location: string
    avatar?: string
    department?: string
  }[]
  onWorkTripToday: {
    id: string
    name: string
    destination: string
    avatar?: string
    department?: string
  }[]
  substitutingFor: {
    id: string
    requestId: string
    name: string
    leaveType: string
    startDate: string
    endDate: string
    avatar?: string
    department?: string
  }[]
  pendingSubstituteRequests: {
    id: string
    requestId: string
    requesterName: string
    leaveType: string
    startDate: string
    endDate: string
    status: string
    avatar?: string
    department?: string
  }[]
}

interface DashboardSummaryProps {
  userRole?: string
  className?: string
}

export function DashboardSummary({ userRole, className = "" }: DashboardSummaryProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations()

  useEffect(() => {
    if (session) {
      fetchSummaryData()
    }
  }, [session])

  const fetchSummaryData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/dashboard/summary')
      
      if (!response.ok) {
        throw new Error(t.dashboard.summary.errors.fetchFailed)
      }
      
      const summaryData = await response.json()
      setData(summaryData)
    } catch (error) {
      console.error('Error fetching dashboard summary:', error)
      setError(error instanceof Error ? error.message : t.dashboard.summary.errors.unknown)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t.dashboard.summary.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="animate-pulse bg-gray-200 h-6 rounded"></div>
            <div className="animate-pulse bg-gray-200 h-6 rounded"></div>
            <div className="animate-pulse bg-gray-200 h-6 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t.dashboard.summary.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">
            {error || t.dashboard.summary.errors.loadFailed}
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasAnyData = data.onLeaveToday.length > 0 ||
                    data.workingFromHomeToday.length > 0 ||
                    (data.onWorkTripToday && data.onWorkTripToday.length > 0) ||
                    data.substitutingFor.length > 0 ||
                    data.pendingSubstituteRequests.length > 0

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {t.dashboard.summary.title} - {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnyData ? (
          <p className="text-gray-500 text-center py-4">
            {t.labels.noActivityToday}
          </p>
        ) : (
          <div className="space-y-6">
            {/* People on Leave Today - inline comma-separated list */}
            {data.onLeaveToday.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-600 mb-1 flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {t.dashboard.summary.onLeaveToday} ({data.onLeaveToday.length})
                </h3>
                <p className="text-sm text-gray-700 px-2">
                  {data.onLeaveToday.map(p => p.name).join(', ')}
                </p>
              </div>
            )}

            {/* People Working from Home Today - inline comma-separated list */}
            {data.workingFromHomeToday.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-blue-600 mb-1 flex items-center gap-1">
                  <Home className="h-4 w-4" />
                  {t.dashboard.summary.workingFromHome} ({data.workingFromHomeToday.length})
                </h3>
                <p className="text-sm text-gray-700 px-2">
                  {data.workingFromHomeToday.map(p => p.name).join(', ')}
                </p>
              </div>
            )}

            {/* People on Work Trip Today - inline comma-separated list */}
            {data.onWorkTripToday && data.onWorkTripToday.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-600 mb-1 flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {t.labels.onWorkTripToday} ({data.onWorkTripToday.length})
                </h3>
                <p className="text-sm text-gray-700 px-2">
                  {data.onWorkTripToday.map(p => p.name).join(', ')}
                </p>
              </div>
            )}

            {/* Currently Substituting For - compact name list */}
            {data.substitutingFor.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-600 mb-1 flex items-center gap-1">
                  <UserCheck className="h-4 w-4" />
                  {t.dashboard.summary.substitutingFor} ({data.substitutingFor.length})
                </h3>
                <div className="space-y-1">
                  {data.substitutingFor.map((person) => (
                    <div key={person.requestId} className="flex items-center justify-between py-1 px-2 rounded hover:bg-green-50">
                      <span className="text-sm">
                        <span className="text-green-600 font-medium">{person.name}</span>
                        <span className="text-gray-400 text-xs ml-1">
                          {person.leaveType} • {format(new Date(person.startDate), 'MMM d')} - {format(new Date(person.endDate), 'MMM d')}
                        </span>
                      </span>
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        {t.status.active}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Substitute Requests - compact name list */}
            {data.pendingSubstituteRequests.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-orange-600 mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {t.dashboard.summary.pendingRequests} ({data.pendingSubstituteRequests.length})
                </h3>
                <div className="space-y-1">
                  {data.pendingSubstituteRequests.map((request) => (
                    <div key={request.requestId} className="flex items-center justify-between py-1 px-2 rounded hover:bg-orange-50">
                      <span className="text-sm">
                        <span className="text-orange-600 font-medium">{request.requesterName}</span>
                        <span className="text-gray-400 text-xs ml-1">
                          {request.leaveType} • {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d')}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => router.push(`/manager`)}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {t.buttons.review}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}