"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Search, UserPlus, Mail, Phone, Calendar, ChevronLeft, ChevronRight, RefreshCw, Download, Filter, Loader2, Edit, Save } from "lucide-react"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  employeeId: string
  department: string
  position: string
  joiningDate: string
  phoneNumber?: string
  role: string
  isActive: boolean
  leaveBalance?: {
    annual: number
    sick: number
    personal: number
  }
}

interface EmployeeResponse {
  employees: Employee[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
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
    personal: 0
  })
  const [savingBalance, setSavingBalance] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [currentPage, pageSize, departmentFilter, roleFilter])

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
      personal: employee.leaveBalance?.personal || 0
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
        personal: selectedEmployee.leaveBalance?.personal || 0
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
      case 'HR': return 'bg-green-100 text-green-800'
      case 'EMPLOYEE': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

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
            <Button>
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
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="EXECUTIVE">Executive</SelectItem>
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
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewDetails(employee)}
                      >
                        Manage
                      </Button>
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

    {/* Employee Details Dialog */}
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
            <div>
              <label className="text-sm font-medium text-gray-500">Joining Date</label>
              <p className="text-sm">{new Date(selectedEmployee.joiningDate).toLocaleDateString()}</p>
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
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="annual">Annual Leave</Label>
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
                  <div>
                    <Label htmlFor="personal">Personal Leave</Label>
                    <Input
                      id="personal"
                      type="number"
                      min="0"
                      max="365"
                      value={balanceForm.personal}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        setBalanceForm({...balanceForm, personal: Math.max(0, Math.min(365, val))})
                      }}
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 bg-blue-50 rounded">
                    <p className="text-xs text-gray-500">Annual</p>
                    <p className="text-lg font-medium">{selectedEmployee.leaveBalance?.annual || 0} days</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded">
                    <p className="text-xs text-gray-500">Sick</p>
                    <p className="text-lg font-medium">{selectedEmployee.leaveBalance?.sick || 0} days</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded">
                    <p className="text-xs text-gray-500">Personal</p>
                    <p className="text-lg font-medium">{selectedEmployee.leaveBalance?.personal || 0} days</p>
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
    </>
  )
}