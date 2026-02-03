"use client"

import { useState, useEffect } from "react"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { 
  Archive,
  ArchiveRestore,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  UserCheck,
  UserX,
  Building,
  Mail,
  Phone,
  Shield,
  History
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Employee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  department?: string
  position?: string
  role: string
  isActive: boolean
  joiningDate?: string
  manager?: {
    firstName: string
    lastName: string
  }
  metadata?: {
    deactivatedBy?: string
    deactivatedAt?: string
    deactivationReason?: string
    previousStatus?: Record<string, unknown>
  }
  _count?: {
    leaveRequests: number
    workFromHomeRequests: number
  }
}

interface StatusChangeHistory {
  action: string
  timestamp: string
  performedBy: {
    name: string
    email: string
  }
  reason: string
}

interface EmployeeDetails {
  employee: Employee
  history: StatusChangeHistory[]
}

export function EmployeeArchiveManager() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetails | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    employee: Employee | null
    action: 'archive' | 'restore'
  }>({ open: false, employee: null, action: 'archive' })
  
  // Action state
  const [actionReason, setActionReason] = useState("")
  const [processing, setProcessing] = useState(false)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    archived: 0,
    departments: [] as string[]
  })

  useEffect(() => {
    fetchEmployees()
  }, [statusFilter, departmentFilter, roleFilter])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (departmentFilter !== 'all') params.append('department', departmentFilter)
      if (roleFilter !== 'all') params.append('role', roleFilter)
      params.append('includeInactive', 'true') // Include archived employees

      const response = await fetch(`/api/hr/employees?${params}`)
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees)
        
        // Calculate stats
        const total = data.employees.length
        const active = data.employees.filter((emp: Employee) => emp.isActive).length
        const archived = total - active
        const departments = [...new Set(data.employees.map((emp: Employee) => emp.department).filter(Boolean))]
        
        setStats({ total, active, archived, departments })
      } else {
        toast.error('Failed to fetch employees')
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast.error('Error fetching employees')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchEmployees()
  }

  const viewEmployeeDetails = async (employee: Employee) => {
    if (detailsLoading) return // Prevent multiple concurrent requests
    
    try {
      setDetailsLoading(true)
      setSelectedEmployee(employee)
      setDetailsOpen(true) // Show dialog immediately with loading state
      setEmployeeDetails(null) // Clear previous data
      
      const response = await fetch(`/api/hr/employees/${employee.id}/status`)
      if (response.ok) {
        const data = await response.json()
        // Only update if we're still showing the same employee
        if (selectedEmployee?.id === employee.id || !selectedEmployee) {
          setEmployeeDetails(data)
        }
      } else {
        toast.error('Failed to fetch employee details')
        setDetailsOpen(false)
      }
    } catch (error) {
      console.error('Error fetching employee details:', error)
      toast.error('Error fetching employee details')
      setDetailsOpen(false)
    } finally {
      setDetailsLoading(false)
    }
  }

  const initiateAction = (employee: Employee, action: 'archive' | 'restore') => {
    setConfirmDialog({ open: true, employee, action })
    setActionReason("")
  }

  const executeAction = async () => {
    if (!confirmDialog.employee || !actionReason.trim()) return

    try {
      setProcessing(true)
      const isActivating = confirmDialog.action === 'restore'
      
      const response = await fetch(`/api/hr/employees/${confirmDialog.employee.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: isActivating,
          reason: actionReason.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        setConfirmDialog({ open: false, employee: null, action: 'archive' })
        setActionReason("")
        fetchEmployees()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update employee status')
      }
    } catch (error) {
      console.error('Error updating employee status:', error)
      toast.error('Failed to update employee status')
    } finally {
      setProcessing(false)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setDepartmentFilter("all")
    setRoleFilter("all")
    fetchEmployees()
  }

  const activeEmployees = employees.filter(emp => emp.isActive)
  const archivedEmployees = employees.filter(emp => !emp.isActive)

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Archived</CardTitle>
            <Archive className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.archived}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.departments.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Employee Archive Management
              </CardTitle>
              <CardDescription>
                Manage employee lifecycle - archive inactive employees and restore when needed
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchEmployees}
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={clearFilters}
                size="sm"
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="flex gap-2">
                  <Input
                    id="search"
                    placeholder="Name, email, ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button size="icon" onClick={handleSearch} variant="outline">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="archived">Archived Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Department</Label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {stats.departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="EXECUTIVE">Executive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Employee Tables */}
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active" className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Active Employees ({activeEmployees.length})
              </TabsTrigger>
              <TabsTrigger value="archived" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Archived Employees ({archivedEmployees.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-6">
              <EmployeeTable 
                employees={activeEmployees}
                loading={loading}
                onViewDetails={viewEmployeeDetails}
                onArchive={(emp) => initiateAction(emp, 'archive')}
                showArchiveAction
              />
            </TabsContent>

            <TabsContent value="archived" className="mt-6">
              <EmployeeTable 
                employees={archivedEmployees}
                loading={loading}
                onViewDetails={viewEmployeeDetails}
                onRestore={(emp) => initiateAction(emp, 'restore')}
                showRestoreAction
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Employee Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
            <DialogDescription>
              Complete employee information and status history
            </DialogDescription>
          </DialogHeader>

          {employeeDetails && (
            <div className="space-y-6">
              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Basic Information</Label>
                    <div className="mt-2 p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {employeeDetails.employee.firstName} {employeeDetails.employee.lastName}
                        </span>
                        <Badge variant={employeeDetails.employee.isActive ? "default" : "secondary"}>
                          {employeeDetails.employee.isActive ? "Active" : "Archived"}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>ID: {employeeDetails.employee.employeeId}</p>
                        <p>Email: {employeeDetails.employee.email}</p>
                        {employeeDetails.employee.phoneNumber && (
                          <p>Phone: {employeeDetails.employee.phoneNumber}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Work Information</Label>
                    <div className="mt-2 p-4 border rounded-lg space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">Department:</span> {employeeDetails.employee.department || 'N/A'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Position:</span> {employeeDetails.employee.position || 'N/A'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Role:</span> {employeeDetails.employee.role}
                      </p>
                      {employeeDetails.employee.joiningDate && (
                        <p className="text-sm">
                          <span className="font-medium">Joined:</span> {format(new Date(employeeDetails.employee.joiningDate), 'MMM dd, yyyy')}
                        </p>
                      )}
                      {employeeDetails.employee.manager && (
                        <p className="text-sm">
                          <span className="font-medium">Manager:</span> {employeeDetails.employee.manager.firstName} {employeeDetails.employee.manager.lastName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Archive Info */}
                  {!employeeDetails.employee.isActive && employeeDetails.employee.metadata && (
                    <div>
                      <Label className="text-sm font-medium">Archive Information</Label>
                      <div className="mt-2 p-4 border border-orange-200 bg-orange-50 rounded-lg space-y-2">
                        {employeeDetails.employee.metadata.deactivatedAt && (
                          <p className="text-sm">
                            <span className="font-medium">Archived:</span> {format(new Date(employeeDetails.employee.metadata.deactivatedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        )}
                        <p className="text-sm">
                          <span className="font-medium">Reason:</span> {employeeDetails.employee.metadata.deactivationReason || 'Not specified'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Activity Stats */}
                  {employeeDetails.employee._count && (
                    <div>
                      <Label className="text-sm font-medium">Activity Summary</Label>
                      <div className="mt-2 p-4 border rounded-lg space-y-2">
                        <p className="text-sm">
                          <span className="font-medium">Leave Requests:</span> {employeeDetails.employee._count.leaveRequests}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">WFH Requests:</span> {employeeDetails.employee._count.workFromHomeRequests}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status History */}
              <div>
                <Label className="text-sm font-medium">Status Change History</Label>
                <div className="mt-2 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeDetails.history.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-500 py-4">
                            No status changes recorded
                          </TableCell>
                        </TableRow>
                      ) : (
                        employeeDetails.history.map((entry, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Badge variant={entry.action === 'REACTIVATE_EMPLOYEE' ? 'default' : 'secondary'}>
                                {entry.action === 'REACTIVATE_EMPLOYEE' ? 'Restored' : 'Archived'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{entry.performedBy.name}</p>
                                <p className="text-xs text-gray-500">{entry.performedBy.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {format(new Date(entry.timestamp), 'MMM dd, yyyy HH:mm')}
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.reason || 'No reason provided'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => 
        setConfirmDialog({ open, employee: null, action: 'archive' })
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === 'archive' ? 'Archive Employee' : 'Restore Employee'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === 'archive' 
                ? 'This will deactivate the employee account and cancel all pending requests.'
                : 'This will reactivate the employee account and restore access.'
              }
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.employee && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium">
                  {confirmDialog.employee.firstName} {confirmDialog.employee.lastName}
                </p>
                <p className="text-sm text-gray-600">{confirmDialog.employee.email}</p>
                <p className="text-sm text-gray-500">
                  {confirmDialog.employee.department} • {confirmDialog.employee.role}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">
                  {confirmDialog.action === 'archive' ? 'Reason for archiving' : 'Reason for restoration'} *
                </Label>
                <Textarea
                  placeholder={confirmDialog.action === 'archive' 
                    ? "e.g., Employee resigned, contract ended, etc." 
                    : "e.g., Employee returned, data correction, etc."
                  }
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This reason will be logged for audit purposes and visible in status history.
                </p>
              </div>

              {confirmDialog.action === 'archive' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-900">Warning</p>
                      <p className="text-yellow-800">
                        Archiving will cancel all pending leave and WFH requests, 
                        remove the employee from approval chains, and revoke system access.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, employee: null, action: 'archive' })}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.action === 'archive' ? 'destructive' : 'default'}
              onClick={executeAction}
              disabled={processing || !actionReason.trim()}
              className="flex items-center gap-2"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirmDialog.action === 'archive' ? (
                <Archive className="h-4 w-4" />
              ) : (
                <ArchiveRestore className="h-4 w-4" />
              )}
              {confirmDialog.action === 'archive' ? 'Archive Employee' : 'Restore Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Employee Table Component
interface EmployeeTableProps {
  employees: Employee[]
  loading: boolean
  onViewDetails: (employee: Employee) => void
  onArchive?: (employee: Employee) => void
  onRestore?: (employee: Employee) => void
  showArchiveAction?: boolean
  showRestoreAction?: boolean
}

function EmployeeTable({ 
  employees, 
  loading, 
  onViewDetails, 
  onArchive, 
  onRestore, 
  showArchiveAction, 
  showRestoreAction 
}: EmployeeTableProps) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
        <p>Loading employees...</p>
      </div>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="h-6 w-6 mx-auto mb-2 text-gray-400" />
        <p className="text-gray-500">No employees found</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id} className="hover:bg-gray-50">
              <TableCell>
                <div>
                  <p className="font-medium">
                    {employee.firstName} {employee.lastName}
                  </p>
                  <p className="text-sm text-gray-500">ID: {employee.employeeId}</p>
                  {employee.position && (
                    <p className="text-xs text-gray-400">{employee.position}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Building className="h-3 w-3 text-gray-400" />
                  <span className="text-sm">{employee.department || 'N/A'}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{employee.role}</Badge>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm">
                    <Mail className="h-3 w-3 text-gray-400" />
                    <span className="truncate max-w-[150px]">{employee.email}</span>
                  </div>
                  {employee.phoneNumber && (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Phone className="h-3 w-3 text-gray-400" />
                      <span>{employee.phoneNumber}</span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={employee.isActive ? "default" : "secondary"}>
                  {employee.isActive ? "Active" : "Archived"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(employee)}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {showArchiveAction && onArchive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onArchive(employee)}
                      className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                  {showRestoreAction && onRestore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRestore(employee)}
                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}