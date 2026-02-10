"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { 
  Calendar, 
  Home, 
  Users, 
  UserCheck, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  MapPin
} from "lucide-react"
import { format } from "date-fns"
import { useSession } from "next-auth/react"
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
  const [data, setData] = useState<DashboardSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations()

  useEffect(() => {
    fetchSummaryData()
  }, [])

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
            {/* People on Leave Today */}
            {data.onLeaveToday.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-red-500" />
                  <h3 className="font-medium text-sm">{t.dashboard.summary.onLeaveToday} ({data.onLeaveToday.length})</h3>
                </div>
                <div className="space-y-2">
                  {data.onLeaveToday.map((person) => (
                    <div key={person.id} className="flex items-center gap-3 p-2 bg-red-50 rounded-lg">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={person.avatar} />
                        <AvatarFallback>
                          {(person.name || 'U').split(' ').map((n: string) => n?.[0] || '').join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{person.name}</p>
                        <p className="text-xs text-gray-600">{person.department}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {person.leaveType}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* People Working from Home Today */}
            {data.workingFromHomeToday.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Home className="h-4 w-4 text-blue-500" />
                  <h3 className="font-medium text-sm">{t.dashboard.summary.workingFromHome} ({data.workingFromHomeToday.length})</h3>
                </div>
                <div className="space-y-2">
                  {data.workingFromHomeToday.map((person) => (
                    <div key={person.id} className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={person.avatar} />
                        <AvatarFallback>
                          {(person.name || 'U').split(' ').map((n: string) => n?.[0] || '').join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{person.name}</p>
                        <p className="text-xs text-gray-600">{person.department}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-blue-600">
                        <MapPin className="h-3 w-3" />
                        {person.location}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Currently Substituting For */}
            {data.substitutingFor.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="h-4 w-4 text-green-500" />
                  <h3 className="font-medium text-sm">{t.dashboard.summary.substitutingFor} ({data.substitutingFor.length})</h3>
                </div>
                <div className="space-y-2">
                  {data.substitutingFor.map((person) => (
                    <div key={person.requestId} className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={person.avatar} />
                        <AvatarFallback>
                          {(person.name || 'U').split(' ').map((n: string) => n?.[0] || '').join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{person.name}</p>
                        <p className="text-xs text-gray-600">
                          {person.leaveType} • {format(new Date(person.startDate), 'MMM d')} - {format(new Date(person.endDate), 'MMM d')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs bg-green-100">
                        {t.status.active}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Substitute Requests */}
            {data.pendingSubstituteRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <h3 className="font-medium text-sm">{t.dashboard.summary.pendingRequests} ({data.pendingSubstituteRequests.length})</h3>
                </div>
                <div className="space-y-2">
                  {data.pendingSubstituteRequests.map((request) => (
                    <div key={request.requestId} className="flex items-center gap-3 p-2 bg-orange-50 rounded-lg">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={request.avatar} />
                        <AvatarFallback>
                          {(request.requesterName || 'U').split(' ').map((n: string) => n?.[0] || '').join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{request.requesterName}</p>
                        <p className="text-xs text-gray-600">
                          {request.leaveType} • {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs bg-orange-100">
                          {request.status}
                        </Badge>
                        <Button size="sm" variant="outline" className="h-6 px-2">
                          <Clock className="h-3 w-3 mr-1" />
                          {t.buttons.review}
                        </Button>
                      </div>
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