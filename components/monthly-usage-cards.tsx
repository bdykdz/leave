"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Home, ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns/format"
import { addMonths } from "date-fns/addMonths"
import { subMonths } from "date-fns/subMonths"
import { getDay } from "date-fns/getDay"
import { useTranslations } from "@/components/language-provider"

interface LeaveStats {
  daysUsed: number
  workingDaysInMonth: number
  percentage: number
  dates: string[]
  byType: { name: string; code: string; days: number; dates: string[] }[]
}

interface WfhStats {
  daysUsed: number
  workingDaysInMonth: number
  percentage: number
  dates: string[]
}

const emptyLeaveStats: LeaveStats = { daysUsed: 0, workingDaysInMonth: 22, percentage: 0, dates: [], byType: [] }
const emptyWfhStats: WfhStats = { daysUsed: 0, workingDaysInMonth: 22, percentage: 0, dates: [] }

// "2026-08-03" strings -> "Aug 3-5, Aug 12" (runs bridged across weekends)
function formatDayList(dateStrings: string[]): string {
  if (dateStrings.length === 0) return ""
  const dates = dateStrings
    .map(s => new Date(`${s}T00:00:00`))
    .sort((a, b) => a.getTime() - b.getTime())

  const isWeekend = (d: Date) => getDay(d) === 0 || getDay(d) === 6
  const isContiguous = (prev: Date, curr: Date) => {
    const gap = new Date(prev)
    gap.setDate(gap.getDate() + 1)
    while (gap < curr) {
      if (!isWeekend(gap)) return false
      gap.setDate(gap.getDate() + 1)
    }
    return true
  }

  const groups: Date[][] = []
  let currentGroup = [dates[0]]
  for (let i = 1; i < dates.length; i++) {
    if (isContiguous(dates[i - 1], dates[i])) {
      currentGroup.push(dates[i])
    } else {
      groups.push(currentGroup)
      currentGroup = [dates[i]]
    }
  }
  groups.push(currentGroup)

  return groups
    .map(group => {
      if (group.length === 1) return format(group[0], "MMM d")
      return `${format(group[0], "MMM d")}-${format(group[group.length - 1], "d")}`
    })
    .join(", ")
}

function MeterSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-24"></div>
    </div>
  )
}

export function MonthlyUsageCards({ className = "" }: { className?: string }) {
  const t = useTranslations()
  const [month, setMonth] = useState(new Date())
  const [leaveStats, setLeaveStats] = useState<LeaveStats>(emptyLeaveStats)
  const [wfhStats, setWfhStats] = useState<WfhStats>(emptyWfhStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchStats = async () => {
      setLoading(true)
      const monthKey = format(month, "yyyy-MM")
      try {
        const [leaveResponse, wfhResponse] = await Promise.all([
          fetch(`/api/employee/leave-stats?month=${monthKey}`),
          fetch(`/api/employee/wfh-stats?month=${monthKey}`)
        ])
        if (cancelled) return
        setLeaveStats(leaveResponse.ok ? await leaveResponse.json() : emptyLeaveStats)
        setWfhStats(wfhResponse.ok ? await wfhResponse.json() : emptyWfhStats)
      } catch (error) {
        console.error("Error fetching monthly usage stats:", error)
        if (!cancelled) {
          setLeaveStats(emptyLeaveStats)
          setWfhStats(emptyWfhStats)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStats()
    return () => {
      cancelled = true
    }
  }, [month])

  const monthNav = (
    <div className="flex gap-1">
      <Button variant="outline" size="sm" onClick={() => setMonth(subMonths(month, 1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* Leave Usage Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">
              {t.dashboard.leaveUsage} - {format(month, "MMMM yyyy")}
            </CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </div>
          {monthNav}
        </CardHeader>
        <CardContent>
          {loading ? (
            <MeterSkeleton />
          ) : (
            <>
              <div className="text-2xl font-bold text-green-600">{leaveStats.daysUsed} {t.leaveForm.days}</div>
              <p className="text-xs text-muted-foreground">
                {leaveStats.daysUsed} {t.common.of} {leaveStats.workingDaysInMonth} {t.labels.workingDaysThisMonth}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div className="bg-green-600 h-2 rounded-full transition-all duration-300" style={{ width: `${leaveStats.percentage}%` }}></div>
              </div>
              <p className="text-sm font-medium text-green-600 mt-2">{leaveStats.percentage}% {t.labels.leaveThisMonth}</p>
              <div className="text-xs text-gray-500 mt-3 space-y-1 border-t pt-2">
                {leaveStats.byType.length === 0 ? (
                  <div>{t.labels.noLeaveThisMonth}</div>
                ) : (
                  leaveStats.byType.map(type => (
                    <div key={type.code} className="flex justify-between gap-2">
                      <span className="font-medium text-gray-700">{type.name}</span>
                      <span className="text-right">{formatDayList(type.dates)}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* WFH Usage Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">
              {t.dashboard.remoteWorkUsage} - {format(month, "MMMM yyyy")}
            </CardTitle>
            <Home className="h-4 w-4 text-blue-600" />
          </div>
          {monthNav}
        </CardHeader>
        <CardContent>
          {loading ? (
            <MeterSkeleton />
          ) : (
            <>
              <div className="text-2xl font-bold text-blue-600">{wfhStats.daysUsed} {t.leaveForm.days}</div>
              <p className="text-xs text-muted-foreground">
                {wfhStats.daysUsed} {t.common.of} {wfhStats.workingDaysInMonth} {t.labels.workingDaysThisMonth}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${wfhStats.percentage}%` }}></div>
              </div>
              <p className="text-sm font-medium text-blue-600 mt-2">{wfhStats.percentage}% {t.labels.wfhThisMonth}</p>
              <div className="text-xs text-gray-500 mt-3 space-y-1 border-t pt-2">
                {wfhStats.dates.length === 0 ? (
                  <div>{t.labels.noWfhThisMonth}</div>
                ) : (
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-gray-700">{t.labels.daysTaken}</span>
                    <span className="text-right">{formatDayList(wfhStats.dates)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
