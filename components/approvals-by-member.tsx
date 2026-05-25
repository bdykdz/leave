"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChevronDown, ChevronRight, Calendar, Home, Briefcase, CheckCircle } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

type Item = {
  kind: "leave" | "wfh" | "trip"
  type: string
  days: number
  dates: string
  reason: string | null
  substitute: string | null
  approvedDate: string | null
  overallStatus: string
}

type MemberGroup = {
  id: string
  name: string
  department: string
  avatar: string
  totalDays: number
  leaveDays: number
  wfhDays: number
  tripDays: number
  count: number
  items: Item[]
}

type Range = "year" | "90d" | "all"

const LABELS = {
  en: {
    title: "Approved by you — per team member",
    subtitle: "Everything you've approved, grouped by person with a running day total.",
    year: "This year",
    last90: "Last 90 days",
    all: "All time",
    daysApproved: "days approved",
    noApprovals: "You haven't approved any requests in this period.",
    requests: "requests",
    substitute: "Substitute",
    pendingOthers: "awaiting further approval",
    loading: "Loading…",
    leave: "Leave",
    wfh: "WFH",
    trip: "Trip",
    approved: "Approved",
  },
  ro: {
    title: "Aprobate de tine — per membru al echipei",
    subtitle: "Tot ce ai aprobat, grupat pe persoană, cu totalul de zile.",
    year: "Anul acesta",
    last90: "Ultimele 90 zile",
    all: "Toată perioada",
    daysApproved: "zile aprobate",
    noApprovals: "Nu ai aprobat nicio cerere în această perioadă.",
    requests: "cereri",
    substitute: "Înlocuitor",
    pendingOthers: "în așteptarea altor aprobări",
    loading: "Se încarcă…",
    leave: "Concediu",
    wfh: "De acasă",
    trip: "Deplasare",
    approved: "Aprobat",
  },
}

function itemMeta(kind: Item["kind"]) {
  switch (kind) {
    case "leave":
      return { dot: "bg-red-500", Icon: Calendar }
    case "wfh":
      return { dot: "bg-blue-500", Icon: Home }
    case "trip":
      return { dot: "bg-amber-500", Icon: Briefcase }
  }
}

export function ApprovalsByMember() {
  const { language } = useLanguage()
  const lang = language === "ro" ? "ro" : "en"
  const L = LABELS[lang]

  const [range, setRange] = useState<Range>("year")
  const [members, setMembers] = useState<MemberGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/manager/team/approvals-summary?range=${range}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setMembers(data.members || [])
        }
      } catch (e) {
        console.error("Error loading approvals summary", e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [range])

  const ranges: { key: Range; label: string }[] = [
    { key: "year", label: L.year },
    { key: "90d", label: L.last90 },
    { key: "all", label: L.all },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{L.title}</CardTitle>
            <CardDescription>{L.subtitle}</CardDescription>
          </div>
          <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
            {ranges.map((r) => (
              <Button
                key={r.key}
                variant={range === r.key ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{L.loading}</p>
        ) : members.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{L.noApprovals}</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const isCollapsed = collapsed[member.id]
              return (
                <div key={member.id} className="rounded-lg border">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((prev) => ({ ...prev, [member.id]: !prev[member.id] }))
                    }
                    className="flex w-full items-center justify-between gap-3 p-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback className="text-xs">
                          {member.name.split(" ").map((n) => n?.[0] || "").join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold">{member.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {member.department || "—"} · {member.count} {L.requests}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{member.totalDays}</div>
                      <div className="text-xs text-muted-foreground">{L.daysApproved}</div>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-2 border-t px-3 py-2">
                      {member.items.map((item, idx) => {
                        const meta = itemMeta(item.kind)!
                        const Icon = meta.Icon
                        return (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2">
                                <span className="font-medium">
                                  {item.days} {lang === "ro" ? "zile" : "d"}
                                </span>
                                <span>{item.type}</span>
                                <span className="text-muted-foreground">· {item.dates}</span>
                                {item.overallStatus === "PENDING" && (
                                  <Badge variant="outline" className="border-orange-200 text-orange-600">
                                    {L.pendingOthers}
                                  </Badge>
                                )}
                              </div>
                              {item.reason && (
                                <div className="text-muted-foreground italic">"{item.reason}"</div>
                              )}
                              {item.substitute && (
                                <div className="text-xs text-muted-foreground">
                                  {L.substitute}: {item.substitute}
                                </div>
                              )}
                            </div>
                            {item.approvedDate && (
                              <span className="flex shrink-0 items-center gap-1 text-xs text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                {new Date(item.approvedDate).toLocaleDateString(
                                  lang === "ro" ? "ro-RO" : "en-US",
                                )}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
