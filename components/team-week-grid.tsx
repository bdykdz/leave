"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Home, Briefcase, UserX, Users } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

type Cell = {
  status: "leave" | "wfh" | "trip"
  type: string
  dates: string
  days: number
  reason?: string | null
  substitute?: string | null
  location?: string | null
  destination?: string | null
}

type Member = {
  id: string
  name: string
  department: string
  avatar: string
  cells: Record<string, Cell>
}

type WeekData = {
  weekStart: string
  weekEnd: string
  days: string[]
  members: Member[]
}

const LABELS = {
  en: {
    title: "This week at a glance",
    subtitle: "Who's on leave, working from home, or on a trip — slide to other weeks.",
    thisWeek: "This week",
    noTeam: "No team members to show for this week.",
    inOffice: "In office",
    leave: "Leave",
    wfh: "Work From Home",
    trip: "Work Trip",
    member: "Team member",
    reason: "Reason",
    substitute: "Substitute",
    period: "Period",
    location: "Location",
    destination: "Destination",
    days: "days",
    day: "day",
    loading: "Loading…",
  },
  ro: {
    title: "Săptămâna aceasta dintr-o privire",
    subtitle: "Cine e în concediu, lucrează de acasă sau e în deplasare — navighează între săptămâni.",
    thisWeek: "Săptămâna curentă",
    noTeam: "Niciun membru al echipei de afișat pentru această săptămână.",
    inOffice: "La birou",
    leave: "Concediu",
    wfh: "De acasă",
    trip: "Deplasare",
    member: "Membru echipă",
    reason: "Motiv",
    substitute: "Înlocuitor",
    period: "Perioadă",
    location: "Locație",
    destination: "Destinație",
    days: "zile",
    day: "zi",
    loading: "Se încarcă…",
  },
}

const WEEKDAYS = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  ro: ["Lun", "Mar", "Mie", "Joi", "Vin"],
}

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ro: ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"],
}

function todayKey() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

// Monday of the week containing the given date, as a yyyy-MM-dd key.
function mondayKeyOf(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const offset = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - offset)
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

function shiftWeeks(mondayKey: string, weeks: number) {
  const [y, m, d] = mondayKey.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + weeks * 7)
  return mondayKeyOf(date)
}

function statusMeta(status: Cell["status"], L: typeof LABELS["en"]) {
  switch (status) {
    case "leave":
      return { label: L.leave, cell: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100", dot: "bg-red-500", Icon: UserX }
    case "wfh":
      return { label: L.wfh, cell: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", dot: "bg-blue-500", Icon: Home }
    case "trip":
      return { label: L.trip, cell: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100", dot: "bg-amber-500", Icon: Briefcase }
  }
}

export function TeamWeekGrid() {
  const { language } = useLanguage()
  const lang = language === "ro" ? "ro" : "en"
  const L = LABELS[lang]

  const [weekStart, setWeekStart] = useState<string>(() => mondayKeyOf(new Date()))
  const [data, setData] = useState<WeekData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ member: string; cell: Cell } | null>(null)

  const tKey = useMemo(() => todayKey(), [])
  const isCurrentWeek = weekStart === mondayKeyOf(new Date())

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/manager/team/week?start=${weekStart}`)
        if (res.ok && !cancelled) {
          setData(await res.json())
        }
      } catch (e) {
        console.error("Error loading team week", e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [weekStart])

  const fmtDayMonth = (key: string) => {
    const [y, m, d] = key.split("-").map(Number)
    return `${d} ${MONTHS[lang][m - 1]}`
  }

  const weekLabel = data
    ? `${fmtDayMonth(data.weekStart)} – ${fmtDayMonth(data.weekEnd)} ${data.weekStart.split("-")[0]}`
    : ""

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">{L.title}</CardTitle>
              <CardDescription className="text-xs">{L.subtitle}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCurrentWeek && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setWeekStart(mondayKeyOf(new Date()))}
              >
                {L.thisWeek}
              </Button>
            )}
            <span className="min-w-[150px] text-center text-sm font-medium">{weekLabel}</span>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(shiftWeeks(weekStart, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(shiftWeeks(weekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{L.loading}</p>
        ) : !data || data.members.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{L.noTeam}</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Header row */}
              <div className="grid grid-cols-[180px_repeat(5,1fr)] border-b">
                <div className="px-2 py-2 text-xs font-medium text-muted-foreground">{L.member}</div>
                {data.days.map((key, i) => {
                  const isToday = key === tKey
                  return (
                    <div
                      key={key}
                      className={`px-1 py-2 text-center text-xs font-medium ${
                        isToday ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      <div>{WEEKDAYS[lang][i]}</div>
                      <div className={isToday ? "font-bold" : ""}>{key.split("-")[2]}</div>
                    </div>
                  )
                })}
              </div>

              {/* Member rows */}
              {data.members.map((member) => (
                <div
                  key={member.id}
                  className="grid grid-cols-[180px_repeat(5,1fr)] items-center border-b last:border-b-0"
                >
                  <div className="flex items-center gap-2 px-2 py-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback className="text-[10px]">
                        {member.name.split(" ").map((n) => n?.[0] || "").join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm" title={member.name}>
                      {member.name}
                    </span>
                  </div>
                  {data.days.map((key) => {
                    const cell = member.cells[key]
                    if (!cell) {
                      return (
                        <div key={key} className="flex justify-center py-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-200" title={L.inOffice} />
                        </div>
                      )
                    }
                    const meta = statusMeta(cell.status, L)!
                    const Icon = meta.Icon
                    return (
                      <div key={key} className="flex justify-center px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => setSelected({ member: member.name, cell })}
                          className={`flex h-8 w-full max-w-[64px] items-center justify-center gap-1 rounded-md border text-xs transition-colors ${meta.cell}`}
                          title={`${cell.type} — ${cell.dates}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> {L.leave}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-400" /> {L.wfh}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> {L.trip}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300" /> {L.inOffice}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      {/* Cell detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const meta = statusMeta(selected.cell.status, L)!
                    const Icon = meta.Icon
                    return (
                      <span className={`flex h-7 w-7 items-center justify-center rounded-md border ${meta.cell}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                    )
                  })()}
                  <span>{selected.member}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{statusMeta(selected.cell.status, L)!.label}</span>
                  <span className="font-medium">
                    {selected.cell.days} {selected.cell.days === 1 ? L.day : L.days}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{L.period}</span>
                  <span className="text-right font-medium">{selected.cell.dates}</span>
                </div>
                <div className="mt-1 font-medium">{selected.cell.type}</div>
                {selected.cell.status === "wfh" && selected.cell.location && (
                  <p className="text-muted-foreground">
                    {L.location}: <span className="text-foreground">{selected.cell.location}</span>
                  </p>
                )}
                {selected.cell.status === "trip" && selected.cell.destination && (
                  <p className="text-muted-foreground">
                    {L.destination}: <span className="text-foreground">{selected.cell.destination}</span>
                  </p>
                )}
                {selected.cell.reason && (
                  <p className="text-muted-foreground">
                    {L.reason}: <span className="italic text-foreground">"{selected.cell.reason}"</span>
                  </p>
                )}
                {selected.cell.substitute && (
                  <p className="text-muted-foreground">
                    {L.substitute}: <span className="text-foreground">{selected.cell.substitute}</span>
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
