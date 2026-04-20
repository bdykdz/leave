"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import { format } from "date-fns"

interface WFHRequestItem {
  id: string
  requestNumber: string
  status: string
  startDate: string
  endDate: string
  totalDays: number
  location: string
  createdByHrId: string | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    department: string
    role: string
  }
  approvals: {
    id: string
    status: string
    approver: {
      id: string
      firstName: string
      lastName: string
      role: string
    }
  }[]
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
}

export function WFHRequestsManager() {
  const [requests, setRequests] = useState<WFHRequestItem[]>([])
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
  const [editingRequest, setEditingRequest] = useState<WFHRequestItem | null>(null)
  const [editForm, setEditForm] = useState({
    startDate: "",
    endDate: "",
    totalDays: "",
    location: "",
    editReason: "",
  })
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancellingRequest, setCancellingRequest] = useState<WFHRequestItem | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

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
      const res = await fetch(`/api/hr/wfh-requests?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setRequests(data.requests)
      setTotalCount(data.totalCount)
      setTotalPages(data.totalPages)
    } catch {
      toast.error("Failed to load WFH requests")
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, statusFilter, search, yearFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // Debounced search
  const [searchInput, setSearchInput] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const openEditDialog = (request: WFHRequestItem) => {
    setEditingRequest(request)
    setEditForm({
      startDate: format(new Date(request.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(request.endDate), "yyyy-MM-dd"),
      totalDays: String(request.totalDays),
      location: request.location,
      editReason: "",
    })
    setEditDialogOpen(true)
  }

  const openCancelDialog = (request: WFHRequestItem) => {
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

    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/hr/wfh-requests/${editingRequest.id}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          totalDays: parseInt(editForm.totalDays),
          location: editForm.location,
          editReason: editForm.editReason,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || data.message || "Failed to edit request")
        return
      }

      toast.success(data.message || "WFH request updated successfully")
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
      const res = await fetch(`/api/hr/wfh-requests/${cancellingRequest.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to cancel request")
        return
      }

      toast.success("WFH request cancelled successfully")
      setCancelDialogOpen(false)
      setCancellingRequest(null)
      fetchRequests()
    } catch {
      toast.error("Failed to cancel request")
    } finally {
      setCancelSubmitting(false)
    }
  }

  const canEdit = (request: WFHRequestItem) => {
    if (request.status === "CANCELLED") return false
    if (request.status === "APPROVED") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (new Date(request.startDate) <= today) return false
    }
    return true
  }

  const canCancel = (request: WFHRequestItem) => {
    if (request.status === "CANCELLED" || request.status === "REJECTED") return false
    if (request.status === "APPROVED") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (new Date(request.startDate) <= today) return false
    }
    return true
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 3 }, (_, i) => String(currentYear - i))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>WFH Requests ({totalCount})</span>
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
            No WFH requests found
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead>Location</TableHead>
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
                    <TableCell className="text-sm">
                      <div>{format(new Date(request.startDate), "dd MMM yyyy")}</div>
                      {request.startDate !== request.endDate && (
                        <div className="text-muted-foreground">to {format(new Date(request.endDate), "dd MMM yyyy")}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{request.totalDays}</TableCell>
                    <TableCell className="text-sm">{request.location}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[request.status] || "bg-gray-100 text-gray-800"} variant="outline">
                        {request.status}
                      </Badge>
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
              <DialogTitle>Edit WFH Request</DialogTitle>
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
                {/* Info banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-800">
                    Editing this request will preserve the current approval status.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={editForm.startDate}
                        onChange={(e) => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={editForm.endDate}
                        onChange={(e) => setEditForm(prev => ({ ...prev, endDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Total Days</Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={editForm.totalDays}
                      onChange={(e) => setEditForm(prev => ({ ...prev, totalDays: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label>Location</Label>
                    <Input
                      value={editForm.location}
                      onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="e.g. home"
                    />
                  </div>

                  <div>
                    <Label className="text-red-600">Reason for Edit *</Label>
                    <Textarea
                      placeholder="Why is this request being modified?"
                      value={editForm.editReason}
                      onChange={(e) => setEditForm(prev => ({ ...prev, editReason: e.target.value }))}
                      rows={2}
                    />
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
              <DialogTitle>Cancel WFH Request</DialogTitle>
              <DialogDescription>
                {cancellingRequest && (
                  <>
                    Are you sure you want to cancel {cancellingRequest.requestNumber}?
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {cancellingRequest && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                  <div><span className="font-medium">Employee:</span> {cancellingRequest.user.firstName} {cancellingRequest.user.lastName}</div>
                  <div><span className="font-medium">Dates:</span> {format(new Date(cancellingRequest.startDate), "dd MMM yyyy")} - {format(new Date(cancellingRequest.endDate), "dd MMM yyyy")}</div>
                  <div><span className="font-medium">Days:</span> {cancellingRequest.totalDays}</div>
                  <div><span className="font-medium">Location:</span> {cancellingRequest.location}</div>
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
