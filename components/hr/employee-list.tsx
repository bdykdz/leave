"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, UserPlus, Mail, Phone, Calendar, ChevronLeft, ChevronRight, RefreshCw, Download, Filter, Loader2, Edit, Save, Trash2, Power, Pencil } from "lucide-react"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { UserSearchSelect } from "@/components/admin/UserSearchSelect"

interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  employeeId: string
  department: string
  position: string
  joiningDate: string
  dateOfBirth?: string
  phoneNumber?: string
  role: string
  isActive: boolean
  managerId?: string | null
  departmentDirectorId?: string | null
  manager?: { firstName: string; lastName: string; email: string } | null
  departmentDirector?: { firstName: string; lastName: string; email: string } | null
  leaveBalance?: {
    annual: number
    sick: number
  }
}

interface EmployeeResponse {
  employees: Employee[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

interface UserOption {
  id: string
  firstName: string
  lastName: string
  role: string
}

interface DepartmentOption {
  id: string
  name: string
}

interface UserFormData {
  firstName: string
  lastName: string
  email: string
  employeeId: string
  phoneNumber: string
  position: string
  department: string
  role: string
  joiningDate: string
  dateOfBirth: string
  managerId: string
  departmentDirectorId: string
  isActive: boolean
}

const emptyFormData: UserFormData = {
  firstName: "",
  lastName: "",
  email: "",
  employeeId: "",
  phoneNumber: "",
  position: "",
  department: "",
  role: "EMPLOYEE",
  joiningDate: new Date().toISOString().split("T")[0],
  dateOfBirth: "",
  managerId: "none",
  departmentDirectorId: "none",
  isActive: true,
}

export function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [departments, setDepartments] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [editingBalance, setEditingBalance] = useState(false)
  const [balanceForm, setBalanceForm] = useState({
    annual: 0,
    sick: 0,
  })
  const [savingBalance, setSavingBalance] = useState(false)

  // CRUD state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<UserOption[]>([])
  const [allDepartments, setAllDepartments] = useState<DepartmentOption[]>([])
  const [formData, setFormData] = useState<UserFormData>(emptyFormData)
  const [savingUser, setSavingUser] = useState(false)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchEmployees()
  }, [currentPage, pageSize, departmentFilter, roleFilter])

  useEffect(() => {
    fetchAllUsers()
    fetchAllDepartments()
  }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ...(departmentFilter !== "all" && { department: departmentFilter }),
        ...(roleFilter !== "all" && { role: roleFilter }),
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`/api/hr/employees?${params}`)
      if (response.ok) {
        const data: EmployeeResponse = await response.json()
        setEmployees(data.employees || [])
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.totalCount || 0)

        // Extract unique departments for filter
        if (departments.length === 0 && data.employees.length > 0) {
          const uniqueDepts = [...new Set(data.employees.map(e => e.department).filter(Boolean))]
          setDepartments(uniqueDepts)
        }
      } else {
        toast.error('Failed to load employee list')
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast.error('Failed to load employee list')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setAllUsers((data.users || []).map((u: any) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
        })))
      }
    } catch (error) {
      console.error('Error fetching all users:', error)
    }
  }

  const fetchAllDepartments = async () => {
    try {
      const response = await fetch('/api/admin/departments')
      if (response.ok) {
        const data = await response.json()
        setAllDepartments((data || []).map((d: any) => ({
          id: d.id,
          name: d.name,
        })))
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1) // Reset to first page when searching
    fetchEmployees()
  }

  const handleRefresh = () => {
    fetchEmployees()
    toast.success('Employee list refreshed')
  }

  const handleViewDetails = (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowDetails(true)
    setEditingBalance(false)
    // Initialize balance form with current values
    setBalanceForm({
      annual: employee.leaveBalance?.annual || 0,
      sick: employee.leaveBalance?.sick || 0,
    })
  }

  const handleEditBalance = () => {
    setEditingBalance(true)
  }

  const handleCancelEdit = () => {
    setEditingBalance(false)
    if (selectedEmployee) {
      setBalanceForm({
        annual: selectedEmployee.leaveBalance?.annual || 0,
        sick: selectedEmployee.leaveBalance?.sick || 0,
      })
    }
  }

  const handleSaveBalance = async () => {
    if (!selectedEmployee) return

    setSavingBalance(true)
    try {
      const response = await fetch(`/api/hr/employees/${selectedEmployee.id}/balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(balanceForm)
      })

      if (response.ok) {
        toast.success('Leave balance updated successfully')
        // Update the local state
        const updatedEmployees = employees.map(emp =>
          emp.id === selectedEmployee.id
            ? { ...emp, leaveBalance: balanceForm }
            : emp
        )
        setEmployees(updatedEmployees)
        setSelectedEmployee({ ...selectedEmployee, leaveBalance: balanceForm })
        setEditingBalance(false)
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || errorData.message || 'Failed to update balance')
      }
    } catch (error) {
      toast.error('Failed to update leave balance')
    } finally {
      setSavingBalance(false)
    }
  }

  const exportToCSV = async () => {
    setExporting(true)
    try {
      const response = await fetch('/api/hr/employees/export?format=csv')
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Employee list exported successfully')
      } else {
        toast.error('Failed to export employee list')
      }
    } catch (error) {
      console.error('Error exporting employees:', error)
      toast.error('Failed to export employee list')
    } finally {
      setExporting(false)
    }
  }

  // CRUD handlers
  const handleCreateUser = () => {
    setFormData(emptyFormData)
    setEditingUserId(null)
    setIsCreateDialogOpen(true)
  }

  const handleEditUser = (employee: Employee) => {
    setFormData({
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      email: employee.email || "",
      employeeId: employee.employeeId || "",
      phoneNumber: employee.phoneNumber || "",
      position: employee.position || "",
      department: employee.department || "",
      role: employee.role || "EMPLOYEE",
      joiningDate: employee.joiningDate ? employee.joiningDate.split("T")[0] : "",
      dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.split("T")[0] : "",
      managerId: employee.managerId || "none",
      departmentDirectorId: employee.departmentDirectorId || "none",
      isActive: employee.isActive,
    })
    setEditingUserId(employee.id)
    setIsEditDialogOpen(true)
  }

  const handleSaveUser = async () => {
    setSavingUser(true)
    try {
      const isCreate = !editingUserId
      const url = isCreate ? '/api/admin/users' : `/api/admin/users/${editingUserId}`
      const method = isCreate ? 'POST' : 'PATCH'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast.success(isCreate ? 'User created successfully' : 'User updated successfully')
        setIsCreateDialogOpen(false)
        setIsEditDialogOpen(false)
        fetchEmployees()
        fetchAllUsers()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to save user')
      }
    } catch (error) {
      toast.error('Failed to save user')
    } finally {
      setSavingUser(false)
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this user? This will remove them from management chains.')) return

    setDeletingUser(id)
    try {
      const response = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('User deactivated successfully')
        fetchEmployees()
        fetchAllUsers()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to deactivate user')
      }
    } catch (error) {
      toast.error('Failed to deactivate user')
    } finally {
      setDeletingUser(null)
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      })

      if (response.ok) {
        toast.success(`User ${currentStatus ? 'deactivated' : 'activated'} successfully`)
        fetchEmployees()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to update user status')
      }
    } catch (error) {
      toast.error('Failed to update user status')
    }
  }

  const filteredEmployees = employees.filter(emp =>
    (emp.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'EXECUTIVE': return 'bg-purple-100 text-purple-800'
      case 'MANAGER': return 'bg-blue-100 text-blue-800'
      case 'DEPARTMENT_DIRECTOR': return 'bg-indigo-100 text-indigo-800'
      case 'HR': return 'bg-green-100 text-green-800'
      case 'ADMIN': return 'bg-orange-100 text-orange-800'
      case 'EMPLOYEE': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const roleOptions = [
    { value: "EMPLOYEE", label: "Employee" },
    { value: "MANAGER", label: "Manager" },
    { value: "DEPARTMENT_DIRECTOR", label: "Department Director" },
    { value: "HR", label: "HR" },
    { value: "EXECUTIVE", label: "Executive" },
    { value: "ADMIN", label: "Admin" },
  ]

  return (
    <>
      <Card>
        <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Employee Directory</CardTitle>
            <CardDescription>
              Total: {totalCount} employees | Page {currentPage} of {totalPages}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Export CSV
            </Button>
            <Button onClick={handleCreateUser}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-8"
              />
            </div>
            <Button variant="secondary" onClick={handleSearch}>
              Search
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="DEPARTMENT_DIRECTOR">Department Director</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="EXECUTIVE">Executive</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading employees...</span>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No employees found matching your criteria
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{employee?.firstName || ''} {employee?.lastName || ''}</div>
                        <div className="text-sm text-muted-foreground">ID: {employee.employeeId}</div>
                      </div>
                    </TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(employee.role)}>
                        {employee.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Mail className="mr-1 h-3 w-3" />
                          {employee.email}
                        </div>
                        {employee.phoneNumber && (
                          <div className="flex items-center text-sm">
                            <Phone className="mr-1 h-3 w-3" />
                            {employee.phoneNumber}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.isActive ? "default" : "secondary"}>
                        {employee.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(employee)}
                          title="View Details & Balance"
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(employee)}
                          title="Edit User"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(employee.id, employee.isActive)}
                          title={employee.isActive ? "Deactivate" : "Activate"}
                        >
                          <Power className={cn("h-3 w-3", employee.isActive ? "text-green-600" : "text-gray-400")} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(employee.id)}
                          disabled={deletingUser === employee.id}
                          title="Delete User"
                          className="text-red-600 hover:text-red-700"
                        >
                          {deletingUser === employee.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} employees
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={i}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>

    {/* Employee Details / Balance Dialog */}
    <Dialog open={showDetails} onOpenChange={setShowDetails}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Employee Details</DialogTitle>
        </DialogHeader>
        {selectedEmployee && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-sm">{selectedEmployee?.firstName || ''} {selectedEmployee?.lastName || ''}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Employee ID</label>
                <p className="text-sm">{selectedEmployee.employeeId}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-sm">{selectedEmployee.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="text-sm">{selectedEmployee.phoneNumber || 'Not provided'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Department</label>
                <p className="text-sm">{selectedEmployee.department}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Position</label>
                <p className="text-sm">{selectedEmployee.position}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Role</label>
                <p className="text-sm">{selectedEmployee.role}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <Badge variant={selectedEmployee.isActive ? "default" : "secondary"}>
                  {selectedEmployee.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Joining Date</label>
                <p className="text-sm">{selectedEmployee.joiningDate ? new Date(selectedEmployee.joiningDate).toLocaleDateString() : 'Not set'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                <p className="text-sm">{selectedEmployee.dateOfBirth ? new Date(selectedEmployee.dateOfBirth).toLocaleDateString() : 'Not set'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Manager</label>
                <p className="text-sm">
                  {selectedEmployee.manager
                    ? `${selectedEmployee.manager.firstName} ${selectedEmployee.manager.lastName}`
                    : 'Not assigned'}
                </p>
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-500">Leave Balance</label>
                {!editingBalance && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditBalance}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit Balance
                  </Button>
                )}
              </div>

              {editingBalance ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="annual">Normal Leave</Label>
                    <Input
                      id="annual"
                      type="number"
                      min="0"
                      max="365"
                      value={balanceForm.annual}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        setBalanceForm({...balanceForm, annual: Math.max(0, Math.min(365, val))})
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sick">Sick Leave</Label>
                    <Input
                      id="sick"
                      type="number"
                      min="0"
                      max="365"
                      value={balanceForm.sick}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        setBalanceForm({...balanceForm, sick: Math.max(0, Math.min(365, val))})
                      }}
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-3 bg-blue-50 rounded">
                    <p className="text-xs text-gray-500">Normal Leave</p>
                    <p className="text-lg font-medium">{selectedEmployee.leaveBalance?.annual || 0} days</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded">
                    <p className="text-xs text-gray-500">Sick Leave</p>
                    <p className="text-lg font-medium">{selectedEmployee.leaveBalance?.sick || 0} days</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {editingBalance && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={savingBalance}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBalance}
              disabled={savingBalance}
            >
              {savingBalance ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>

    {/* Create User Dialog */}
    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Employee</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-firstName">First Name *</Label>
              <Input
                id="create-firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="First name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-lastName">Last Name *</Label>
              <Input
                id="create-lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Last name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Phone Number</Label>
              <Input
                id="create-phone"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="Phone number"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger id="create-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-department">Department</Label>
              <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                <SelectTrigger id="create-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {allDepartments.map(d => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-position">Position</Label>
              <Input
                id="create-position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="Job position"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-joiningDate">Joining Date</Label>
              <Input
                id="create-joiningDate"
                type="date"
                value={formData.joiningDate}
                onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-dateOfBirth">Date of Birth</Label>
              <Input
                id="create-dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Required for birthday leave eligibility</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Manager</Label>
              <UserSearchSelect
                users={allUsers}
                value={formData.managerId}
                onValueChange={(v) => setFormData({ ...formData, managerId: v })}
                placeholder="Search manager..."
                noneLabel="No Manager"
              />
            </div>
            <div className="space-y-2">
              <Label>Department Director</Label>
              <UserSearchSelect
                users={allUsers}
                value={formData.departmentDirectorId}
                onValueChange={(v) => setFormData({ ...formData, departmentDirectorId: v })}
                placeholder="Search director..."
                noneLabel="No Director"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={savingUser}>
            Cancel
          </Button>
          <Button onClick={handleSaveUser} disabled={savingUser || !formData.firstName || !formData.lastName || !formData.email}>
            {savingUser ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Employee
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit User Dialog */}
    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="role">Role & Department</TabsTrigger>
            <TabsTrigger value="reporting">Reporting</TabsTrigger>
          </TabsList>
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input
                  id="edit-firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last Name</Label>
                <Input
                  id="edit-lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-employeeId">Employee ID</Label>
                <Input
                  id="edit-employeeId"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-joiningDate">Joining Date</Label>
                <Input
                  id="edit-joiningDate"
                  type="date"
                  value={formData.joiningDate}
                  onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dateOfBirth">Date of Birth</Label>
                <Input
                  id="edit-dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Required for birthday leave eligibility</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-position">Position</Label>
                <Input
                  id="edit-position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.isActive ? "active" : "inactive"} onValueChange={(v) => setFormData({ ...formData, isActive: v === "active" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="role" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-department">Department</Label>
                <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                  <SelectTrigger id="edit-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {allDepartments.map(d => (
                      <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="reporting" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Manager</Label>
                <UserSearchSelect
                  users={allUsers}
                  value={formData.managerId}
                  onValueChange={(v) => setFormData({ ...formData, managerId: v })}
                  placeholder="Search manager..."
                  noneLabel="No Manager"
                  excludeId={editingUserId || undefined}
                />
              </div>
              <div className="space-y-2">
                <Label>Department Director</Label>
                <UserSearchSelect
                  users={allUsers}
                  value={formData.departmentDirectorId}
                  onValueChange={(v) => setFormData({ ...formData, departmentDirectorId: v })}
                  placeholder="Search director..."
                  noneLabel="No Director"
                  excludeId={editingUserId || undefined}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={savingUser}>
            Cancel
          </Button>
          <Button onClick={handleSaveUser} disabled={savingUser}>
            {savingUser ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
