"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Calendar,
  Save,
  AlertCircle,
  FileText,
  Home,
  User,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { parseISO } from "date-fns"

interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  department: string
  role: string
  employeeId: string
}

interface LeaveType {
  id: string
  name: string
  code: string
  daysAllowed: number
  requiresDocument: boolean
  isHROnly: boolean
  category: string
}

interface LeaveBalance {
  entitled: number
  used: number
  pending: number
  available: number
}

export function ManualRequestEntry() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [currentBalance, setCurrentBalance] = useState<LeaveBalance | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'leave' | 'wfh'>('leave')
  // Separate search state per tab to avoid cross-tab interference (#10)
  const [leaveEmployeeSearch, setLeaveEmployeeSearch] = useState("")
  const [wfhEmployeeSearch, setWfhEmployeeSearch] = useState("")
  // Track whether totalDays was manually edited (#9)
  const leaveDaysManuallyEdited = useRef(false)
  const wfhDaysManuallyEdited = useRef(false)

  // Leave Request Form
  const [leaveForm, setLeaveForm] = useState({
    userId: "",
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
    status: "APPROVED",
    totalDays: "",
    hrNotes: "",
  })

  // WFH Request Form
  const [wfhForm, setWfhForm] = useState({
    userId: "",
    startDate: "",
    endDate: "",
    location: "home",
    status: "APPROVED",
    totalDays: "",
    hrNotes: "",
  })

  useEffect(() => {
    fetchEmployees()
    fetchLeaveTypes()
  }, [])

  // Auto-calculate totalDays for leave form using working days API (excludes weekends + holidays)
  useEffect(() => {
    if (leaveDaysManuallyEdited.current) return
    if (leaveForm.startDate && leaveForm.endDate) {
      const start = parseISO(leaveForm.startDate)
      const end = parseISO(leaveForm.endDate)
      if (end >= start) {
        fetch(`/api/working-days?startDate=${leaveForm.startDate}&endDate=${leaveForm.endDate}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && !leaveDaysManuallyEdited.current) {
              setLeaveForm(prev => ({ ...prev, totalDays: String(data.workingDays) }))
            }
          })
          .catch(() => {
            // Fallback: simple calendar days if API fails
            const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
            if (days > 0 && !leaveDaysManuallyEdited.current) {
              setLeaveForm(prev => ({ ...prev, totalDays: String(days) }))
            }
          })
      }
    }
  }, [leaveForm.startDate, leaveForm.endDate])

  // Auto-calculate totalDays for WFH form using working days API (excludes weekends + holidays)
  useEffect(() => {
    if (wfhDaysManuallyEdited.current) return
    if (wfhForm.startDate && wfhForm.endDate) {
      const start = parseISO(wfhForm.startDate)
      const end = parseISO(wfhForm.endDate)
      if (end >= start) {
        fetch(`/api/working-days?startDate=${wfhForm.startDate}&endDate=${wfhForm.endDate}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && !wfhDaysManuallyEdited.current) {
              setWfhForm(prev => ({ ...prev, totalDays: String(data.workingDays) }))
            }
          })
          .catch(() => {
            const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
            if (days > 0 && !wfhDaysManuallyEdited.current) {
              setWfhForm(prev => ({ ...prev, totalDays: String(days) }))
            }
          })
      }
    }
  }, [wfhForm.startDate, wfhForm.endDate])

  // Fetch balance when employee + leave type + valid date selected (#11 — guard against empty date)
  const fetchBalance = useCallback(async (userId: string, leaveTypeId: string, startDate: string) => {
    if (!userId || !leaveTypeId) {
      setCurrentBalance(null)
      return
    }
    // Guard: only fetch if startDate produces a valid year (#11)
    const parsedDate = startDate ? new Date(startDate) : null
    const year = parsedDate && !isNaN(parsedDate.getTime())
      ? parsedDate.getFullYear()
      : new Date().getFullYear()

    setLoadingBalance(true)
    try {
      const response = await fetch(`/api/hr/leave-balance?userId=${encodeURIComponent(userId)}&leaveTypeId=${encodeURIComponent(leaveTypeId)}&year=${year}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentBalance(data.balance ?? null)
      } else {
        setCurrentBalance(null)
      }
    } catch {
      setCurrentBalance(null)
    } finally {
      setLoadingBalance(false)
    }
  }, [])

  useEffect(() => {
    fetchBalance(leaveForm.userId, leaveForm.leaveTypeId, leaveForm.startDate)
  }, [leaveForm.userId, leaveForm.leaveTypeId, leaveForm.startDate, fetchBalance])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/hr/employees?pageSize=500&page=1')
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      }
    } catch {
      toast.error('Failed to load employees')
    }
  }

  const fetchLeaveTypes = async () => {
    try {
      const response = await fetch('/api/hr/leave-types')
      if (response.ok) {
        const data = await response.json()
        setLeaveTypes(data.leaveTypes || [])
      }
    } catch {
      console.error('Failed to load leave types')
    }
  }

  const handleLeaveSubmit = () => {
    if (!leaveForm.userId || !leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      toast.error('Please fill in all required fields')
      return
    }
    if (!leaveForm.totalDays || parseFloat(leaveForm.totalDays) <= 0) {
      toast.error('Total days must be greater than 0')
      return
    }
    setConfirmAction('leave')
    setShowConfirmDialog(true)
  }

  const handleWFHSubmit = () => {
    if (!wfhForm.userId || !wfhForm.startDate || !wfhForm.endDate) {
      toast.error('Please fill in all required fields')
      return
    }
    if (!wfhForm.totalDays || parseInt(wfhForm.totalDays) <= 0) {
      toast.error('Total days must be greater than 0')
      return
    }
    setConfirmAction('wfh')
    setShowConfirmDialog(true)
  }

  const executeSubmit = async () => {
    setShowConfirmDialog(false)
    setLoading(true)

    try {
      if (confirmAction === 'leave') {
        const response = await fetch('/api/hr/manual-leave-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: leaveForm.userId,
            leaveTypeId: leaveForm.leaveTypeId,
            startDate: leaveForm.startDate,
            endDate: leaveForm.endDate,
            totalDays: parseFloat(leaveForm.totalDays),
            reason: leaveForm.reason,
            status: leaveForm.status,
            hrNotes: leaveForm.hrNotes || undefined,
          })
        })

        if (response.ok) {
          const data = await response.json()
          toast.success(data.message || 'Leave request created successfully')
          resetLeaveForm()
        } else {
          const error = await response.json()
          toast.error(error.error || 'Failed to create leave request')
        }
      } else {
        const response = await fetch('/api/hr/manual-wfh-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: wfhForm.userId,
            startDate: wfhForm.startDate,
            endDate: wfhForm.endDate,
            totalDays: parseInt(wfhForm.totalDays),
            location: wfhForm.location || 'home',
            status: wfhForm.status,
            hrNotes: wfhForm.hrNotes || undefined,
          })
        })

        if (response.ok) {
          const data = await response.json()
          toast.success(data.message || 'WFH request created successfully')
          resetWfhForm()
        } else {
          const error = await response.json()
          toast.error(error.error || 'Failed to create WFH request')
        }
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const resetLeaveForm = () => {
    setLeaveForm({
      userId: "",
      leaveTypeId: "",
      startDate: "",
      endDate: "",
      reason: "",
      status: "APPROVED",
      totalDays: "",
      hrNotes: "",
    })
    setCurrentBalance(null)
    leaveDaysManuallyEdited.current = false
  }

  const resetWfhForm = () => {
    setWfhForm({
      userId: "",
      startDate: "",
      endDate: "",
      location: "home",
      status: "APPROVED",
      totalDays: "",
      hrNotes: "",
    })
    wfhDaysManuallyEdited.current = false
  }

  const selectedEmployee = employees.find(e => e.id === leaveForm.userId)
  const selectedWfhEmployee = employees.find(e => e.id === wfhForm.userId)
  const selectedLeaveType = leaveTypes.find(lt => lt.id === leaveForm.leaveTypeId)

  // Calculate projected balance after this request
  const projectedAvailable = currentBalance && leaveForm.totalDays
    ? currentBalance.available - parseFloat(leaveForm.totalDays)
    : null

  // Filter employees by search — separate per tab (#10)
  const leaveFilteredEmployees = leaveEmployeeSearch
    ? employees.filter(e =>
        `${e.firstName} ${e.lastName} ${e.email} ${e.department} ${e.employeeId}`
          .toLowerCase()
          .includes(leaveEmployeeSearch.toLowerCase())
      )
    : employees

  const wfhFilteredEmployees = wfhEmployeeSearch
    ? employees.filter(e =>
        `${e.firstName} ${e.lastName} ${e.email} ${e.department} ${e.employeeId}`
          .toLowerCase()
          .includes(wfhEmployeeSearch.toLowerCase())
      )
    : employees

  // Get confirmation summary
  const getConfirmSummary = () => {
    if (confirmAction === 'leave') {
      const emp = employees.find(e => e.id === leaveForm.userId)
      const lt = leaveTypes.find(t => t.id === leaveForm.leaveTypeId)
      return {
        employee: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        type: lt?.name || 'Unknown',
        dates: `${leaveForm.startDate} to ${leaveForm.endDate}`,
        days: leaveForm.totalDays,
        status: leaveForm.status,
      }
    } else {
      const emp = employees.find(e => e.id === wfhForm.userId)
      return {
        employee: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        type: 'Work From Home',
        dates: `${wfhForm.startDate} to ${wfhForm.endDate}`,
        days: wfhForm.totalDays,
        status: wfhForm.status,
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Manual Request Entry
              </CardTitle>
              <CardDescription>
                Create leave or WFH requests for any employee — bypasses all approval workflows and validation
              </CardDescription>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              HR Only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Manual entries bypass the normal approval workflow.
              Approved requests will immediately affect the employee&apos;s leave balance.
              All entries are recorded in the audit log.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="leave" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="leave" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Leave Request
              </TabsTrigger>
              <TabsTrigger value="wfh" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Work From Home
              </TabsTrigger>
            </TabsList>

            {/* Leave Request Tab */}
            <TabsContent value="leave" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Select Employee *</Label>
                  <Select
                    value={leaveForm.userId}
                    onValueChange={(value) => {
                      setLeaveForm(prev => ({ ...prev, userId: value }))
                      setLeaveEmployeeSearch("")
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 pb-2">
                        <Input
                          placeholder="Search employees..."
                          value={leaveEmployeeSearch}
                          onChange={(e) => setLeaveEmployeeSearch(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      {leaveFilteredEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} — {emp.department} ({emp.email})
                        </SelectItem>
                      ))}
                      {leaveFilteredEmployees.length === 0 && (
                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                          No employees found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedEmployee && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{selectedEmployee.firstName} {selectedEmployee.lastName}</span>
                        <Badge variant="outline">{selectedEmployee.role}</Badge>
                        <span className="text-xs text-muted-foreground">({selectedEmployee.employeeId})</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedEmployee.department} &bull; {selectedEmployee.email}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Leave Type *</Label>
                  <Select
                    value={leaveForm.leaveTypeId}
                    onValueChange={(value) => setLeaveForm(prev => ({ ...prev, leaveTypeId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} ({type.code})
                          {type.isHROnly ? ' [HR Only]' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLeaveType?.requiresDocument && (
                    <p className="text-xs text-amber-600 mt-1">
                      This leave type normally requires supporting documents
                    </p>
                  )}
                  {selectedLeaveType?.isHROnly && (
                    <p className="text-xs text-blue-600 mt-1">
                      HR-only leave type (not visible in employee self-service)
                    </p>
                  )}
                </div>

                <div>
                  <Label>Status *</Label>
                  <Select
                    value={leaveForm.status}
                    onValueChange={(value) => setLeaveForm(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APPROVED">Approved (immediate)</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => {
                      leaveDaysManuallyEdited.current = false
                      setLeaveForm(prev => ({ ...prev, startDate: e.target.value }))
                    }}
                  />
                </div>

                <div>
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => {
                      leaveDaysManuallyEdited.current = false
                      setLeaveForm(prev => ({ ...prev, endDate: e.target.value }))
                    }}
                    min={leaveForm.startDate}
                  />
                </div>

                <div>
                  <Label>Total Days *</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={leaveForm.totalDays}
                    onChange={(e) => {
                      leaveDaysManuallyEdited.current = true
                      setLeaveForm(prev => ({ ...prev, totalDays: e.target.value }))
                    }}
                    placeholder="e.g. 1, 0.5, 3"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-calculated working days (excl. weekends &amp; holidays). Edit for half-days (0.5).
                  </p>
                </div>

                {/* Balance display */}
                <div>
                  {loadingBalance && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading balance...
                    </div>
                  )}
                  {currentBalance && (
                    <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                      <Label className="text-xs font-medium">Current Balance</Label>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <span>Entitled: <strong>{currentBalance.entitled}</strong></span>
                        <span>Used: <strong>{currentBalance.used}</strong></span>
                        <span>Pending: <strong>{currentBalance.pending}</strong></span>
                        <span>Available: <strong className={currentBalance.available < 0 ? 'text-red-600' : ''}>{currentBalance.available}</strong></span>
                      </div>
                      {projectedAvailable !== null && (
                        <div className="pt-1 border-t mt-1">
                          <span className="text-xs">After this request: <strong className={projectedAvailable < 0 ? 'text-red-600' : 'text-green-600'}>{projectedAvailable}</strong></span>
                        </div>
                      )}
                    </div>
                  )}
                  {projectedAvailable !== null && projectedAvailable < 0 && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Balance will go negative. This is allowed for HR manual entries.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="col-span-2">
                  <Label>Reason for Leave *</Label>
                  <Textarea
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Enter reason for leave"
                    rows={3}
                    maxLength={2000}
                  />
                </div>

                <div className="col-span-2">
                  <Label>HR Notes (internal)</Label>
                  <Textarea
                    value={leaveForm.hrNotes}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, hrNotes: e.target.value }))}
                    placeholder="Internal notes — stored in record, not shown to employee"
                    rows={2}
                    maxLength={1000}
                    className="bg-yellow-50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={resetLeaveForm}>
                  Clear Form
                </Button>
                <Button
                  onClick={handleLeaveSubmit}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Create Leave Request
                </Button>
              </div>
            </TabsContent>

            {/* Work From Home Tab */}
            <TabsContent value="wfh" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Select Employee *</Label>
                  <Select
                    value={wfhForm.userId}
                    onValueChange={(value) => {
                      setWfhForm(prev => ({ ...prev, userId: value }))
                      setWfhEmployeeSearch("")
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 pb-2">
                        <Input
                          placeholder="Search employees..."
                          value={wfhEmployeeSearch}
                          onChange={(e) => setWfhEmployeeSearch(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      {wfhFilteredEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} — {emp.department} ({emp.email})
                        </SelectItem>
                      ))}
                      {wfhFilteredEmployees.length === 0 && (
                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                          No employees found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedWfhEmployee && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{selectedWfhEmployee.firstName} {selectedWfhEmployee.lastName}</span>
                        <Badge variant="outline">{selectedWfhEmployee.role}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedWfhEmployee.department} &bull; {selectedWfhEmployee.email}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={wfhForm.startDate}
                    onChange={(e) => {
                      wfhDaysManuallyEdited.current = false
                      setWfhForm(prev => ({ ...prev, startDate: e.target.value }))
                    }}
                  />
                </div>

                <div>
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={wfhForm.endDate}
                    onChange={(e) => {
                      wfhDaysManuallyEdited.current = false
                      setWfhForm(prev => ({ ...prev, endDate: e.target.value }))
                    }}
                    min={wfhForm.startDate}
                  />
                </div>

                <div>
                  <Label>Total Days *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={wfhForm.totalDays}
                    onChange={(e) => {
                      wfhDaysManuallyEdited.current = true
                      setWfhForm(prev => ({ ...prev, totalDays: e.target.value }))
                    }}
                    placeholder="Auto-calculated from dates"
                  />
                </div>

                <div>
                  <Label>Work Location</Label>
                  <Input
                    value={wfhForm.location}
                    onChange={(e) => setWfhForm(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g. home"
                    maxLength={200}
                  />
                </div>

                <div>
                  <Label>Status *</Label>
                  <Select
                    value={wfhForm.status}
                    onValueChange={(value) => setWfhForm(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APPROVED">Approved (immediate)</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>HR Notes (internal)</Label>
                  <Textarea
                    value={wfhForm.hrNotes}
                    onChange={(e) => setWfhForm(prev => ({ ...prev, hrNotes: e.target.value }))}
                    placeholder="Internal notes — stored in approval record comments"
                    rows={2}
                    maxLength={1000}
                    className="bg-yellow-50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={resetWfhForm}>
                  Clear Form
                </Button>
                <Button
                  onClick={handleWFHSubmit}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Create WFH Request
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Manual Entry</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>You are about to create a manual {confirmAction === 'leave' ? 'leave' : 'WFH'} request:</p>
                {(() => {
                  const summary = getConfirmSummary()
                  return (
                    <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                      <div><strong>Employee:</strong> {summary.employee}</div>
                      <div><strong>Type:</strong> {summary.type}</div>
                      <div><strong>Dates:</strong> {summary.dates}</div>
                      <div><strong>Days:</strong> {summary.days}</div>
                      <div><strong>Status:</strong> {summary.status}</div>
                      {projectedAvailable !== null && projectedAvailable < 0 && confirmAction === 'leave' && (
                        <div className="text-red-600 font-medium mt-2">
                          Warning: Balance will go negative ({projectedAvailable})
                        </div>
                      )}
                    </div>
                  )
                })()}
                <p className="text-sm text-muted-foreground">This action will be recorded in the audit log.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeSubmit}>
              Confirm &amp; Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
