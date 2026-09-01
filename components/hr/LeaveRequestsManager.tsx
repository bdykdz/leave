"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { addDays, format } from "date-fns"

interface LeaveRequestItem {
  id: string
  requestNumber: string
  status: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  leaveTypeId: string
  createdByHrId: string | null
  selectedDates: string[]
  supportingDocuments: any
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    department: string
    role: string
  }
  leaveType: {
    id: string
    name: string
    code: string
  }
  substitutes: {
    userId: string
    user: {
      id: string
      firstName: string
      lastName: string
    }
  }[]
  approvals: {
    id: string
    level: number
    status: string
    approver: {
      id: string
      firstName: string
      lastName: string
      role: string
    }
  }[]
}

interface LeaveTypeOption {
  id: string
  name: string
  code: string
}

// PENDING but the leave period has already passed — still approvable until the
// escalation cron auto-cancels it after the configured grace period.
function isOverdue(request: { status: string; endDate: string }): boolean {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return request.status === "PENDING" && new Date(request.endDate) < todayStart
}

// Parse a date or datetime string as a local calendar day, ignoring time/zone
function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number)
  return new Date(y, m - 1, d)
}

// Mon–Fri days between two dates, inclusive. Ignores public holidays, so it can
// slightly overcount — only used to decide whether a request skips days in its range.
function weekdayCount(start: Date, end: Date): number {
  let count = 0
  const d = new Date(start)
  d.setHours(0, 0, 0, 0)
  const last = new Date(end)
  last.setHours(0, 0, 0, 0)
  while (d <= last) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// A request whose selected dates don't cover every working day between its
// start and end (e.g. only Monday and Friday of a week).
function hasNonContiguousDates(request: LeaveRequestItem): boolean {
  return (
    request.selectedDates.length > 0 &&
    request.selectedDates.length < weekdayCount(new Date(request.startDate), new Date(request.endDate))
  )
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  DRAFT: "bg-blue-100 text-blue-800",
}

export function LeaveRequestsManager() {
  const [requests, setRequests] = useState<LeaveRequestItem[]>([])
  const [graceDays, setGraceDays] = useState(60)
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState<LeaveRequestItem | null>(null)
  const [editForm, setEditForm] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    totalDays: "",
    reason: "",
    editReason: "",
    notifyManager: false,
  })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [calculatingDays, setCalculatingDays] = useState(false)
  // Only recalculate totalDays after HR actually changes a date — the stored
  // totalDays can legitimately differ from the range (non-contiguous requests).
  const [datesEdited, setDatesEdited] = useState(false)
  // "range": start/end inputs; "days": multi-select calendar for arbitrary days
  const [dateMode, setDateMode] = useState<"range" | "days">("range")
  const [pickedDates, setPickedDates] = useState<Date[]>([])
  const [editHolidays, setEditHolidays] = useState<Record<number, Date[]>>({})
  const holidayYearsRequested = useRef<Set<number>>(new Set())

  const ensureHolidays = (year: number) => {
    if (holidayYearsRequested.current.has(year)) return
    holidayYearsRequested.current.add(year)
    fetch(`/api/holidays?year=${year}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        const dates = (data?.holidays || []).map((h: { date: string }) => parseDateOnly(h.date))
        setEditHolidays(prev => ({ ...prev, [year]: dates }))
      })
      .catch(() => holidayYearsRequested.current.delete(year))
  }

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancellingRequest, setCancellingRequest] = useState<LeaveRequestItem | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  // Leave types
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([])

  // Balance preview
  const [balancePreview, setBalancePreview] = useState<{
    entitled: number
    used: number
    pending: number
    available: number
  } | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: statusFilter,
        search,
        year: yearFilter,
      })
      const res = await fetch(`/api/hr/leave-requests?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setRequests(data.requests)
      setTotalCount(data.totalCount)
      setTotalPages(data.totalPages)
      if (typeof data.autoCancelGraceDays === "number") {
        setGraceDays(data.autoCancelGraceDays)
      }
    } catch {
      toast.error("Failed to load leave requests")
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, statusFilter, search, yearFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  useEffect(() => {
    fetch("/api/hr/leave-types")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLeaveTypes(data)
        }
      })
      .catch(() => {})
  }, [])

  // Debounced search
  const [searchInput, setSearchInput] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Auto-calculate working days when HR changes the dates in the edit form.
  // Skipped until a date is actually edited: on open the stored totalDays must
  // stand, since non-contiguous requests have fewer days than their range.
  useEffect(() => {
    if (!datesEdited || dateMode !== "range") return
    if (!editForm.startDate || !editForm.endDate) return

    const start = new Date(editForm.startDate)
    const end = new Date(editForm.endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return

    let stale = false
    setCalculatingDays(true)
    const params = new URLSearchParams({
      startDate: editForm.startDate,
      endDate: editForm.endDate,
    })
    fetch(`/api/working-days?${params}`)
      .then(r => r.json())
      .then(data => {
        if (!stale && data.workingDays !== undefined) {
          setEditForm(prev => ({ ...prev, totalDays: String(data.workingDays) }))
        }
      })
      .catch(() => {})
      .finally(() => { if (!stale) setCalculatingDays(false) })
    return () => { stale = true }
  }, [datesEdited, dateMode, editForm.startDate, editForm.endDate])

  // Fetch balance when leave type or user changes in edit
  useEffect(() => {
    if (!editingRequest || !editForm.leaveTypeId) return

    const params = new URLSearchParams({
      userId: editingRequest.user.id,
      leaveTypeId: editForm.leaveTypeId,
      year: editForm.startDate ? String(new Date(editForm.startDate).getFullYear()) : yearFilter,
    })
    fetch(`/api/hr/leave-balance?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.entitled !== undefined) {
          setBalancePreview(data)
        }
      })
      .catch(() => setBalancePreview(null))
  }, [editingRequest, editForm.leaveTypeId, editForm.startDate, yearFilter])

  const openEditDialog = (request: LeaveRequestItem) => {
    setEditingRequest(request)
    setEditForm({
      leaveTypeId: request.leaveTypeId,
      startDate: format(new Date(request.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(request.endDate), "yyyy-MM-dd"),
      totalDays: String(request.totalDays),
      reason: request.reason,
      editReason: "",
      notifyManager: false,
    })
    setDatesEdited(false)
    // Open non-contiguous requests directly in the day picker — the range
    // inputs alone would misrepresent what the request covers
    setDateMode(hasNonContiguousDates(request) ? "days" : "range")
    setPickedDates(request.selectedDates.map(parseDateOnly).sort((a, b) => a.getTime() - b.getTime()))
    ensureHolidays(new Date(request.startDate).getFullYear())
    ensureHolidays(new Date(request.endDate).getFullYear())
    setBalancePreview(null)
    setEditDialogOpen(true)
  }

  const handlePickDates = (days: Date[] | undefined) => {
    const sorted = [...(days ?? [])].sort((a, b) => a.getTime() - b.getTime())
    // Any pick counts as a date change — if HR later switches back to range
    // mode, the stale original selectedDates must not be sent along
    setDatesEdited(true)
    setPickedDates(sorted)
    setEditForm(prev => ({
      ...prev,
      totalDays: String(sorted.length),
      startDate: sorted.length ? format(sorted[0], "yyyy-MM-dd") : prev.startDate,
      endDate: sorted.length ? format(sorted[sorted.length - 1], "yyyy-MM-dd") : prev.endDate,
    }))
  }

  const openCancelDialog = (request: LeaveRequestItem) => {
    setCancellingRequest(request)
    setCancelReason("")
    setCancelDialogOpen(true)
  }

  const handleEditSubmit = async () => {
    if (!editingRequest) return
    if (!editForm.editReason.trim()) {
      toast.error("Please provide a reason for this edit")
      return
    }
    if (dateMode === "days" && pickedDates.length === 0) {
      toast.error("Pick at least one day")
      return
    }

    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/hr/leave-requests/${editingRequest.id}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveTypeId: editForm.leaveTypeId,
          totalDays: parseFloat(editForm.totalDays),
          ...(dateMode === "days"
            ? {
                // Day-picker mode: send the exact days; range is derived from them
                startDate: format(pickedDates[0], "yyyy-MM-dd"),
                endDate: format(pickedDates[pickedDates.length - 1], "yyyy-MM-dd"),
                selectedDates: pickedDates.map(d => format(d, "yyyy-MM-dd")),
              }
            : {
                startDate: editForm.startDate,
                endDate: editForm.endDate,
                // Keep the originally selected days when neither the dates nor
                // the day count changed; otherwise let the API rebuild them
                // from the range, so days and count can't drift apart.
                ...(datesEdited || parseFloat(editForm.totalDays) !== editingRequest.totalDays
                  ? {}
                  : { selectedDates: editingRequest.selectedDates }),
              }),
          reason: editForm.reason,
          editReason: editForm.editReason,
          notifyManager: editForm.notifyManager,
          substituteIds: editingRequest.substitutes.map(s => s.userId),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || data.message || "Failed to edit request")
        return
      }

      toast.success(data.message || "Request updated successfully")
      setEditDialogOpen(false)
      setEditingRequest(null)
      fetchRequests()
    } catch {
      toast.error("Failed to edit request")
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleCancelSubmit = async () => {
    if (!cancellingRequest) return

    setCancelSubmitting(true)
    try {
      const res = await fetch(`/api/leave-requests/${cancellingRequest.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to cancel request")
        return
      }

      toast.success("Leave request cancelled successfully")
      setCancelDialogOpen(false)
      setCancellingRequest(null)
      fetchRequests()
    } catch {
      toast.error("Failed to cancel request")
    } finally {
      setCancelSubmitting(false)
    }
  }

  const canEdit = (request: LeaveRequestItem) => {
    if (request.status === "CANCELLED") return false
    return true
  }

  const canCancel = (request: LeaveRequestItem) => {
    if (request.status === "CANCELLED" || request.status === "REJECTED") return false
    return true
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 3 }, (_, i) => String(currentYear - i))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Leave Requests ({totalCount})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or request number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="OVERDUE">Pending (overdue)</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {yearOptions.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No leave requests found
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approvals</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono text-sm">{request.requestNumber}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.user.firstName} {request.user.lastName}</div>
                        <div className="text-xs text-muted-foreground">{request.user.department}</div>
                      </div>
                    </TableCell>
                    <TableCell>{request.leaveType.name}</TableCell>
                    <TableCell className="text-sm">
                      <div>{format(new Date(request.startDate), "dd MMM yyyy")}</div>
                      {request.startDate !== request.endDate && (
                        <div className="text-muted-foreground">to {format(new Date(request.endDate), "dd MMM yyyy")}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{request.totalDays}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[request.status] || "bg-gray-100 text-gray-800"} variant="outline">
                        {request.status}
                      </Badge>
                      {isOverdue(request) && (
                        <div className="mt-1">
                          <Badge className="bg-orange-100 text-orange-800" variant="outline">
                            OVERDUE
                          </Badge>
                          {/* HR manual entries are exempt from auto-cancel */}
                          {!request.createdByHrId && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              auto-cancels {format(addDays(new Date(request.endDate), graceDays), "dd MMM yyyy")}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {request.approvals.map((a) => (
                          <div key={a.id} className="text-xs">
                            <span className={
                              a.status === "APPROVED" ? "text-green-600" :
                              a.status === "REJECTED" ? "text-red-600" :
                              "text-yellow-600"
                            }>
                              {a.approver.firstName} {a.approver.lastName}
                            </span>
                            <span className="text-muted-foreground ml-1">({a.status.toLowerCase()})</span>
                          </div>
                        ))}
                        {request.approvals.length === 0 && (
                          <span className="text-xs text-muted-foreground">No approvals</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {canEdit(request) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(request)}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                        )}
                        {canCancel(request) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => openCancelDialog(request)}
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center text-sm px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Leave Request</DialogTitle>
              <DialogDescription>
                {editingRequest && (
                  <>
                    {editingRequest.requestNumber} - {editingRequest.user.firstName} {editingRequest.user.lastName}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {editingRequest && (
              <div className="space-y-4">
                {/* Warning banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-800">
                    Editing this request will preserve the current approval status.
                    {editingRequest.status === "APPROVED" && " The leave balance will be recalculated based on the changes."}
                    {editingRequest.status === "REJECTED" && " This rejected request will remain rejected."}
                  </p>
                </div>

                {/* Non-contiguous request: the range alone is misleading */}
                {dateMode === "range" && hasNonContiguousDates(editingRequest) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-800">
                      <p>
                        This request covers only <strong>{editingRequest.selectedDates.length} specific day{editingRequest.selectedDates.length === 1 ? "" : "s"}</strong>,
                        not the full range:{" "}
                        <strong>
                          {editingRequest.selectedDates
                            .map(d => format(new Date(d), "MMM d"))
                            .join(", ")}
                        </strong>
                      </p>
                      <p className="mt-1">
                        Changing the dates or the day count below will replace them with <em>all</em> working days in the range.
                        Switch to &quot;Pick days&quot; to edit the individual days instead.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <Label>Leave Type</Label>
                    <Select
                      value={editForm.leaveTypeId}
                      onValueChange={(v) => setEditForm(prev => ({ ...prev, leaveTypeId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map(lt => (
                          <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Dates</Label>
                      <div className="inline-flex rounded-md border overflow-hidden text-xs">
                        <button
                          type="button"
                          className={`px-2 py-1 ${dateMode === "range" ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}
                          onClick={() => setDateMode("range")}
                        >
                          Date range
                        </button>
                        <button
                          type="button"
                          className={`px-2 py-1 border-l ${dateMode === "days" ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}
                          onClick={() => setDateMode("days")}
                        >
                          Pick days
                        </button>
                      </div>
                    </div>

                    {dateMode === "range" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Start Date</Label>
                          <Input
                            type="date"
                            value={editForm.startDate}
                            onChange={(e) => {
                              setDatesEdited(true)
                              setEditForm(prev => ({ ...prev, startDate: e.target.value }))
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">End Date</Label>
                          <Input
                            type="date"
                            value={editForm.endDate}
                            onChange={(e) => {
                              setDatesEdited(true)
                              setEditForm(prev => ({ ...prev, endDate: e.target.value }))
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center border rounded-md p-2">
                        <Calendar
                          mode="multiple"
                          selected={pickedDates}
                          onSelect={handlePickDates}
                          defaultMonth={pickedDates[0] ?? (editForm.startDate ? parseDateOnly(editForm.startDate) : undefined)}
                          onMonthChange={(month) => ensureHolidays(month.getFullYear())}
                          disabled={[{ dayOfWeek: [0, 6] }, ...Object.values(editHolidays).flat()]}
                        />
                        <p className="text-xs text-muted-foreground self-start px-1">
                          {pickedDates.length === 0
                            ? "No days selected"
                            : `${pickedDates.length} day${pickedDates.length === 1 ? "" : "s"}: ${pickedDates
                                .slice(0, 10)
                                .map(d => format(d, "MMM d"))
                                .join(", ")}${pickedDates.length > 10 ? ` +${pickedDates.length - 10}` : ""}`}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Total Working Days {calculatingDays && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={editForm.totalDays}
                      onChange={(e) => setEditForm(prev => ({ ...prev, totalDays: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {dateMode === "days"
                        ? "Set from the picked days. Override if needed."
                        : "Recalculated when you change the dates. Override if needed."}
                    </p>
                  </div>

                  <div>
                    <Label>Reason</Label>
                    <Textarea
                      value={editForm.reason}
                      onChange={(e) => setEditForm(prev => ({ ...prev, reason: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  {/* Balance Preview */}
                  {balancePreview && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm font-medium mb-1">Balance Preview</p>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div>
                          <div className="font-semibold">{balancePreview.entitled}</div>
                          <div className="text-muted-foreground">Entitled</div>
                        </div>
                        <div>
                          <div className="font-semibold">{balancePreview.used}</div>
                          <div className="text-muted-foreground">Used</div>
                        </div>
                        <div>
                          <div className="font-semibold">{balancePreview.pending}</div>
                          <div className="text-muted-foreground">Pending</div>
                        </div>
                        <div>
                          <div className="font-semibold">{balancePreview.available}</div>
                          <div className="text-muted-foreground">Available</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-red-600">Reason for Edit *</Label>
                    <Textarea
                      placeholder="Why is this request being modified?"
                      value={editForm.editReason}
                      onChange={(e) => setEditForm(prev => ({ ...prev, editReason: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-notify-manager"
                      checked={editForm.notifyManager}
                      onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, notifyManager: checked === true }))}
                    />
                    <Label htmlFor="edit-notify-manager" className="font-normal cursor-pointer">
                      Notify manager by email
                    </Label>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} disabled={editSubmitting || !editForm.editReason.trim()}>
                {editSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Leave Request</DialogTitle>
              <DialogDescription>
                {cancellingRequest && (
                  <>
                    Are you sure you want to cancel {cancellingRequest.requestNumber}?
                    This will restore the employee&apos;s leave balance.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {cancellingRequest && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                  <div><span className="font-medium">Employee:</span> {cancellingRequest.user.firstName} {cancellingRequest.user.lastName}</div>
                  <div><span className="font-medium">Type:</span> {cancellingRequest.leaveType.name}</div>
                  <div><span className="font-medium">Dates:</span> {format(new Date(cancellingRequest.startDate), "dd MMM yyyy")} - {format(new Date(cancellingRequest.endDate), "dd MMM yyyy")}</div>
                  <div><span className="font-medium">Days:</span> {cancellingRequest.totalDays}</div>
                  <div><span className="font-medium">Status:</span> {cancellingRequest.status}</div>
                </div>

                <div>
                  <Label>Cancellation Reason (optional)</Label>
                  <Textarea
                    placeholder="Reason for cancellation..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelSubmitting}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelSubmit}
                disabled={cancelSubmitting}
              >
                {cancelSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Confirm Cancel
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
