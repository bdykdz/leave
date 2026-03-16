"use client"

import { useState, useEffect, useRef } from "react"
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
  Check,
  ChevronsUpDown,
  Briefcase,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
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
  const [confirmAction, setConfirmAction] = useState<'leave' | 'wfh' | 'worktrip'>('leave')
  // Popover open state per tab for employee combobox
  const [leaveEmployeeOpen, setLeaveEmployeeOpen] = useState(false)
  const [wfhEmployeeOpen, setWfhEmployeeOpen] = useState(false)
  const [workTripEmployeeOpen, setWorkTripEmployeeOpen] = useState(false)
  // Manual search state for employee comboboxes (fixes cmdk selection bug)
  const [leaveEmployeeSearch, setLeaveEmployeeSearch] = useState("")
  const [wfhEmployeeSearch, setWfhEmployeeSearch] = useState("")
  const [workTripEmployeeSearch, setWorkTripEmployeeSearch] = useState("")
  // Track whether totalDays was manually edited
  const leaveDaysManuallyEdited = useRef(false)
  const wfhDaysManuallyEdited = useRef(false)
  const workTripDaysManuallyEdited = useRef(false)

  // Leave Request Form
  const [leaveForm, setLeaveForm] = useState({
    userId: "",
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
    totalDays: "",
    hrNotes: "",
  })

  // WFH Request Form
  const [wfhForm, setWfhForm] = useState({
    userId: "",
    startDate: "",
    endDate: "",
    location: "home",
    totalDays: "",
    hrNotes: "",
  })

  // Work Trip Request Form
  const [workTripForm, setWorkTripForm] = useState({
    userId: "",
    startDate: "",
    endDate: "",
    totalDays: "",
    destination: "",
    purpose: "",
    hrNotes: "",
  })

  useEffect(() => {
    fetchEmployees()
    fetchLeaveTypes()
  }, [])

  // Auto-calculate totalDays for leave form using working days API (excludes weekends + holidays)
  useEffect(() => {
    if (leaveDaysManuallyEdited.current) return
    if (!leaveForm.startDate || !leaveForm.endDate) return
    const start = parseISO(leaveForm.startDate)
    const end = parseISO(leaveForm.endDate)
    if (end < start) return

    const controller = new AbortController()
    const params = new URLSearchParams({ startDate: leaveForm.startDate, endDate: leaveForm.endDate })
    fetch(`/api/working-days?${params}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && !leaveDaysManuallyEdited.current) {
          setLeaveForm(prev => ({ ...prev, totalDays: String(data.workingDays) }))
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        // Fallback: simple calendar days if API fails
        const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        if (days > 0 && !leaveDaysManuallyEdited.current) {
          setLeaveForm(prev => ({ ...prev, totalDays: String(days) }))
        }
      })
    return () => controller.abort()
  }, [leaveForm.startDate, leaveForm.endDate])

  // Auto-calculate totalDays for WFH form using working days API (excludes weekends + holidays)
  useEffect(() => {
    if (wfhDaysManuallyEdited.current) return
    if (!wfhForm.startDate || !wfhForm.endDate) return
    const start = parseISO(wfhForm.startDate)
    const end = parseISO(wfhForm.endDate)
    if (end < start) return

    const controller = new AbortController()
    const params = new URLSearchParams({ startDate: wfhForm.startDate, endDate: wfhForm.endDate })
    fetch(`/api/working-days?${params}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && !wfhDaysManuallyEdited.current) {
          setWfhForm(prev => ({ ...prev, totalDays: String(data.workingDays) }))
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        if (days > 0 && !wfhDaysManuallyEdited.current) {
          setWfhForm(prev => ({ ...prev, totalDays: String(days) }))
        }
      })
    return () => controller.abort()
  }, [wfhForm.startDate, wfhForm.endDate])

  // Auto-calculate totalDays for Work Trip form using working days API
  useEffect(() => {
    if (workTripDaysManuallyEdited.current) return
    if (!workTripForm.startDate || !workTripForm.endDate) return
    const start = parseISO(workTripForm.startDate)
    const end = parseISO(workTripForm.endDate)
    if (end < start) return

    const controller = new AbortController()
    const params = new URLSearchParams({ startDate: workTripForm.startDate, endDate: workTripForm.endDate })
    fetch(`/api/working-days?${params}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && !workTripDaysManuallyEdited.current) {
          setWorkTripForm(prev => ({ ...prev, totalDays: String(data.workingDays) }))
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        if (days > 0 && !workTripDaysManuallyEdited.current) {
          setWorkTripForm(prev => ({ ...prev, totalDays: String(days) }))
        }
      })
    return () => controller.abort()
  }, [workTripForm.startDate, workTripForm.endDate])

  // Fetch balance when employee + leave type + valid date selected
  useEffect(() => {
    if (!leaveForm.userId || !leaveForm.leaveTypeId) {
      setCurrentBalance(null)
      return
    }
    const parsedDate = leaveForm.startDate ? new Date(leaveForm.startDate) : null
    const year = parsedDate && !isNaN(parsedDate.getTime())
      ? parsedDate.getFullYear()
      : new Date().getFullYear()

    const controller = new AbortController()
    setLoadingBalance(true)
    fetch(`/api/hr/leave-balance?userId=${encodeURIComponent(leaveForm.userId)}&leaveTypeId=${encodeURIComponent(leaveForm.leaveTypeId)}&year=${year}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setCurrentBalance(data?.balance ?? null)
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setCurrentBalance(null)
      })
      .finally(() => setLoadingBalance(false))
    return () => controller.abort()
  }, [leaveForm.userId, leaveForm.leaveTypeId, leaveForm.startDate])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setEmployees((data.users || []).map((u: Record<string, unknown>) => ({
          id: u.id,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          email: u.email || '',
          department: u.department || '',
          role: u.role || '',
          employeeId: u.employeeId || '',
        })))
      }
    } catch {
      toast.error('Failed to load employees')
    }
  }

  const fetchLeaveTypes = async () => {
    try {
      const response = await fetch('/api/admin/leave-types')
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

  const handleWorkTripSubmit = () => {
    if (!workTripForm.userId || !workTripForm.startDate || !workTripForm.endDate) {
      toast.error('Please fill in all required fields')
      return
    }
    if (!workTripForm.totalDays || parseInt(workTripForm.totalDays) <= 0) {
      toast.error('Total days must be greater than 0')
      return
    }
    if (!workTripForm.destination) {
      toast.error('Destination is required')
      return
    }
    if (!workTripForm.purpose) {
      toast.error('Purpose is required')
      return
    }
    setConfirmAction('worktrip')
    setShowConfirmDialog(true)
  }

  const executeSubmit = async () => {
    setShowConfirmDialog(false)
    setLoading(true)

    try {
      if (confirmAction === 'leave') {
        const response = await fetch('/api/admin/manual-leave-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: leaveForm.userId,
            leaveTypeId: leaveForm.leaveTypeId,
            startDate: leaveForm.startDate,
            endDate: leaveForm.endDate,
            totalDays: parseFloat(leaveForm.totalDays),
            reason: leaveForm.reason,
            hrNotes: leaveForm.hrNotes || undefined,
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.warning) {
            toast.warning(data.warning)
          }
          toast.success(data.message || 'Leave request created successfully')
          resetLeaveForm()
        } else {
          const error = await response.json()
          toast.error(error.error || 'Failed to create leave request')
        }
      } else if (confirmAction === 'wfh') {
        const response = await fetch('/api/admin/manual-wfh-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: wfhForm.userId,
            startDate: wfhForm.startDate,
            endDate: wfhForm.endDate,
            totalDays: parseInt(wfhForm.totalDays),
            location: wfhForm.location || 'home',
            hrNotes: wfhForm.hrNotes || undefined,
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.warning) {
            toast.warning(data.warning)
          }
          toast.success(data.message || 'WFH request created successfully')
          resetWfhForm()
        } else {
          const error = await response.json()
          toast.error(error.error || 'Failed to create WFH request')
        }
      } else {
        // Work Trip
        const response = await fetch('/api/admin/manual-work-trip-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: workTripForm.userId,
            startDate: workTripForm.startDate,
            endDate: workTripForm.endDate,
            totalDays: parseInt(workTripForm.totalDays),
            destination: workTripForm.destination,
            purpose: workTripForm.purpose,
            hrNotes: workTripForm.hrNotes || undefined,
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.warning) {
            toast.warning(data.warning)
          }
          toast.success(data.message || 'Work trip request created successfully')
          resetWorkTripForm()
        } else {
          const error = await response.json()
          toast.error(error.error || 'Failed to create work trip request')
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
      totalDays: "",
      hrNotes: "",
    })
    wfhDaysManuallyEdited.current = false
  }

  const resetWorkTripForm = () => {
    setWorkTripForm({
      userId: "",
      startDate: "",
      endDate: "",
      totalDays: "",
      destination: "",
      purpose: "",
      hrNotes: "",
    })
    workTripDaysManuallyEdited.current = false
  }

  const selectedEmployee = employees.find(e => e.id === leaveForm.userId)
  const selectedWfhEmployee = employees.find(e => e.id === wfhForm.userId)
  const selectedWorkTripEmployee = employees.find(e => e.id === workTripForm.userId)
  const selectedLeaveType = leaveTypes.find(lt => lt.id === leaveForm.leaveTypeId)

  // Manual filtering for employee comboboxes (bypasses cmdk's buggy internal filtering)
  const filterEmployees = (emps: Employee[], search: string) => {
    if (!search) return emps
    const q = search.toLowerCase()
    return emps.filter(emp =>
      `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase().includes(q) ||
      (emp.department || '').toLowerCase().includes(q) ||
      (emp.email || '').toLowerCase().includes(q) ||
      (emp.employeeId || '').toLowerCase().includes(q)
    )
  }
  const filteredLeaveEmployees = filterEmployees(employees, leaveEmployeeSearch)
  const filteredWfhEmployees = filterEmployees(employees, wfhEmployeeSearch)
  const filteredWorkTripEmployees = filterEmployees(employees, workTripEmployeeSearch)

  // Calculate projected balance after this request
  const projectedAvailable = currentBalance && leaveForm.totalDays
    ? currentBalance.available - parseFloat(leaveForm.totalDays)
    : null

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
      }
    } else if (confirmAction === 'wfh') {
      const emp = employees.find(e => e.id === wfhForm.userId)
      return {
        employee: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        type: 'Work From Home',
        dates: `${wfhForm.startDate} to ${wfhForm.endDate}`,
        days: wfhForm.totalDays,
      }
    } else {
      const emp = employees.find(e => e.id === workTripForm.userId)
      return {
        employee: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        type: `Work Trip — ${workTripForm.destination || 'N/A'}`,
        dates: `${workTripForm.startDate} to ${workTripForm.endDate}`,
        days: workTripForm.totalDays,
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
                Create leave, WFH, or work trip requests on behalf of employees — requests will be sent to the employee&apos;s manager for approval
              </CardDescription>
            </div>
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Admin Only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Requests created here will be sent to the employee&apos;s manager for approval.
              The leave balance will be updated as pending until approved. All entries are recorded in the audit log.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="leave" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="leave" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Leave Request
              </TabsTrigger>
              <TabsTrigger value="wfh" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Work From Home
              </TabsTrigger>
              <TabsTrigger value="worktrip" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Work Trip
              </TabsTrigger>
            </TabsList>

            {/* Leave Request Tab */}
            <TabsContent value="leave" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Select Employee *</Label>
                  <Popover open={leaveEmployeeOpen} onOpenChange={(open) => {
                    setLeaveEmployeeOpen(open)
                    if (!open) setLeaveEmployeeSearch("")
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={leaveEmployeeOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedEmployee
                          ? `${selectedEmployee.firstName} ${selectedEmployee.lastName} — ${selectedEmployee.department}`
                          : "Choose an employee"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search employees..." value={leaveEmployeeSearch} onValueChange={setLeaveEmployeeSearch} />
                        <CommandList>
                          <CommandEmpty>No employees found.</CommandEmpty>
                          <CommandGroup>
                            {filteredLeaveEmployees.map(emp => (
                              <CommandItem
                                key={emp.id}
                                value={emp.id}
                                onSelect={() => {
                                  setLeaveForm(prev => ({ ...prev, userId: emp.id }))
                                  setLeaveEmployeeOpen(false)
                                  setLeaveEmployeeSearch("")
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", leaveForm.userId === emp.id ? "opacity-100" : "opacity-0")} />
                                {emp.firstName} {emp.lastName} — {emp.department} ({emp.email})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedEmployee && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{selectedEmployee.firstName} {selectedEmployee.lastName}</span>
                        <Badge variant="outline">{selectedEmployee.role}</Badge>
                        {selectedEmployee.employeeId && (
                          <span className="text-xs text-muted-foreground">({selectedEmployee.employeeId})</span>
                        )}
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
                    max="366"
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
                        Balance will go negative. This is allowed for admin manual entries.
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
                  <Label>Admin Notes (internal)</Label>
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
                  <Popover open={wfhEmployeeOpen} onOpenChange={(open) => {
                    setWfhEmployeeOpen(open)
                    if (!open) setWfhEmployeeSearch("")
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={wfhEmployeeOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedWfhEmployee
                          ? `${selectedWfhEmployee.firstName} ${selectedWfhEmployee.lastName} — ${selectedWfhEmployee.department}`
                          : "Choose an employee"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search employees..." value={wfhEmployeeSearch} onValueChange={setWfhEmployeeSearch} />
                        <CommandList>
                          <CommandEmpty>No employees found.</CommandEmpty>
                          <CommandGroup>
                            {filteredWfhEmployees.map(emp => (
                              <CommandItem
                                key={emp.id}
                                value={emp.id}
                                onSelect={() => {
                                  setWfhForm(prev => ({ ...prev, userId: emp.id }))
                                  setWfhEmployeeOpen(false)
                                  setWfhEmployeeSearch("")
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", wfhForm.userId === emp.id ? "opacity-100" : "opacity-0")} />
                                {emp.firstName} {emp.lastName} — {emp.department} ({emp.email})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                    max="366"
                    step="1"
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

                <div className="col-span-2">
                  <Label>Admin Notes (internal)</Label>
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

            {/* Work Trip Tab */}
            <TabsContent value="worktrip" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Select Employee *</Label>
                  <Popover open={workTripEmployeeOpen} onOpenChange={(open) => {
                    setWorkTripEmployeeOpen(open)
                    if (!open) setWorkTripEmployeeSearch("")
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={workTripEmployeeOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedWorkTripEmployee
                          ? `${selectedWorkTripEmployee.firstName} ${selectedWorkTripEmployee.lastName} — ${selectedWorkTripEmployee.department}`
                          : "Choose an employee"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search employees..." value={workTripEmployeeSearch} onValueChange={setWorkTripEmployeeSearch} />
                        <CommandList>
                          <CommandEmpty>No employees found.</CommandEmpty>
                          <CommandGroup>
                            {filteredWorkTripEmployees.map(emp => (
                              <CommandItem
                                key={emp.id}
                                value={emp.id}
                                onSelect={() => {
                                  setWorkTripForm(prev => ({ ...prev, userId: emp.id }))
                                  setWorkTripEmployeeOpen(false)
                                  setWorkTripEmployeeSearch("")
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", workTripForm.userId === emp.id ? "opacity-100" : "opacity-0")} />
                                {emp.firstName} {emp.lastName} — {emp.department} ({emp.email})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedWorkTripEmployee && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{selectedWorkTripEmployee.firstName} {selectedWorkTripEmployee.lastName}</span>
                        <Badge variant="outline">{selectedWorkTripEmployee.role}</Badge>
                        {selectedWorkTripEmployee.employeeId && (
                          <span className="text-xs text-muted-foreground">({selectedWorkTripEmployee.employeeId})</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedWorkTripEmployee.department} &bull; {selectedWorkTripEmployee.email}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Destination *</Label>
                  <Input
                    value={workTripForm.destination}
                    onChange={(e) => setWorkTripForm(prev => ({ ...prev, destination: e.target.value }))}
                    placeholder="e.g. Bucharest, Cluj-Napoca"
                    maxLength={200}
                  />
                </div>

                <div>
                  <Label>Purpose *</Label>
                  <Input
                    value={workTripForm.purpose}
                    onChange={(e) => setWorkTripForm(prev => ({ ...prev, purpose: e.target.value }))}
                    placeholder="e.g. Client meeting, Conference"
                    maxLength={1000}
                  />
                </div>

                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={workTripForm.startDate}
                    onChange={(e) => {
                      workTripDaysManuallyEdited.current = false
                      setWorkTripForm(prev => ({ ...prev, startDate: e.target.value }))
                    }}
                  />
                </div>

                <div>
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={workTripForm.endDate}
                    onChange={(e) => {
                      workTripDaysManuallyEdited.current = false
                      setWorkTripForm(prev => ({ ...prev, endDate: e.target.value }))
                    }}
                    min={workTripForm.startDate}
                  />
                </div>

                <div>
                  <Label>Total Days *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="366"
                    step="1"
                    value={workTripForm.totalDays}
                    onChange={(e) => {
                      workTripDaysManuallyEdited.current = true
                      setWorkTripForm(prev => ({ ...prev, totalDays: e.target.value }))
                    }}
                    placeholder="Auto-calculated from dates"
                  />
                </div>

                <div className="col-span-2">
                  <Label>Admin Notes (internal)</Label>
                  <Textarea
                    value={workTripForm.hrNotes}
                    onChange={(e) => setWorkTripForm(prev => ({ ...prev, hrNotes: e.target.value }))}
                    placeholder="Internal notes — stored in record, not shown to employee"
                    rows={2}
                    maxLength={1000}
                    className="bg-yellow-50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={resetWorkTripForm}>
                  Clear Form
                </Button>
                <Button
                  onClick={handleWorkTripSubmit}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Create Work Trip Request
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
                <p>You are about to create a manual {confirmAction === 'leave' ? 'leave' : confirmAction === 'wfh' ? 'WFH' : 'work trip'} request:</p>
                {(() => {
                  const summary = getConfirmSummary()
                  return (
                    <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                      <div><strong>Employee:</strong> {summary.employee}</div>
                      <div><strong>Type:</strong> {summary.type}</div>
                      <div><strong>Dates:</strong> {summary.dates}</div>
                      <div><strong>Days:</strong> {summary.days}</div>
                      <div className="text-sm text-muted-foreground mt-1">Request will be sent to the employee&apos;s manager for approval.</div>
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
