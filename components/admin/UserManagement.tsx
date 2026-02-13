"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Users,
  Plus,
  Search,
  UserCog,
  Edit,
  Power,
  Trash2,
  MoreHorizontal,
  User,
  Shield,
  AlertCircle,
  CalendarDays,
} from "lucide-react"
import { UserSearchSelect } from "./UserSearchSelect"
import { toast } from "sonner"

interface SystemUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  department: string
  position: string
  isActive: boolean
  createdAt: string
  managerId: string | null
  departmentDirectorId: string | null
  manager?: {
    id: string
    firstName: string
    lastName: string
  } | null
  departmentDirector?: {
    id: string
    firstName: string
    lastName: string
  } | null
  subordinates: { id: string }[]
  directsReports: { id: string }[]
}

export function UserManagement() {
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRole, setSelectedRole] = useState("ALL")
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [managerDialogOpen, setManagerDialogOpen] = useState(false)
  const [selectedManagerId, setSelectedManagerId] = useState<string>("none")
  const [selectedDirectorId, setSelectedDirectorId] = useState<string>("none")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    fetchUsers()
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedRole, itemsPerPage])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      })

      if (response.ok) {
        toast.success('User role updated successfully')
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
        setEditDialogOpen(false)
      } else {
        toast.error('Failed to update user role')
      }
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error('An error occurred')
    }
  }

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      })

      if (response.ok) {
        toast.success(`User ${isActive ? 'deactivated' : 'activated'} successfully`)
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !isActive } : u))
      } else {
        toast.error('Failed to update user status')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('An error occurred')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('User deleted successfully')
        setUsers(prev => prev.filter(u => u.id !== userId))
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('An error occurred while deleting the user')
    }
  }

  const handleManagerUpdate = async () => {
    if (!selectedUser) return

    const newManagerId = selectedManagerId === "none" ? null : selectedManagerId
    const newDirectorId = selectedDirectorId === "none" ? null : selectedDirectorId

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/manager`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: newManagerId,
          departmentDirectorId: newDirectorId
        })
      })

      if (response.ok) {
        toast.success('Manager assignments updated successfully')
        // Update user in-place to avoid scroll reset
        setUsers(prev => prev.map(u => u.id === selectedUser.id
          ? {
              ...u,
              managerId: newManagerId,
              departmentDirectorId: newDirectorId,
              manager: newManagerId ? users.find(m => m.id === newManagerId) ? {
                id: newManagerId,
                firstName: users.find(m => m.id === newManagerId)!.firstName,
                lastName: users.find(m => m.id === newManagerId)!.lastName,
              } : u.manager : null,
              departmentDirector: newDirectorId ? users.find(d => d.id === newDirectorId) ? {
                id: newDirectorId,
                firstName: users.find(d => d.id === newDirectorId)!.firstName,
                lastName: users.find(d => d.id === newDirectorId)!.lastName,
              } : u.departmentDirector : null,
            }
          : u
        ))
        setManagerDialogOpen(false)
        setSelectedManagerId("none")
        setSelectedDirectorId("none")
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to update manager assignments')
      }
    } catch (error) {
      console.error('Error updating manager:', error)
      toast.error('An error occurred')
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.lastName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === "ALL" || user.role === selectedRole
    return matchesSearch && matchesRole
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  const roleStats = {
    total: users.length,
    employees: users.filter(u => u.role === "EMPLOYEE").length,
    managers: users.filter(u => u.role === "MANAGER").length,
    directors: users.filter(u => u.role === "DEPARTMENT_DIRECTOR").length,
    hr: users.filter(u => u.role === "HR").length,
    executives: users.filter(u => u.role === "EXECUTIVE").length,
    admins: users.filter(u => u.role === "ADMIN").length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
  }

  if (loading) {
    return <div className="text-center py-8">Loading users...</div>
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roleStats.total}</div>
              <p className="text-xs text-muted-foreground">
                {roleStats.active} active, {roleStats.inactive} inactive
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Employees</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roleStats.employees}</div>
              <p className="text-xs text-muted-foreground">Regular employees</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Managers</CardTitle>
              <UserCog className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roleStats.managers}</div>
              <p className="text-xs text-muted-foreground">Department managers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leadership</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roleStats.directors + roleStats.executives + roleStats.admins}</div>
              <p className="text-xs text-muted-foreground">
                {roleStats.directors} Directors, {roleStats.executives} Exec, {roleStats.admins} Admin
              </p>
            </CardContent>
          </Card>
        </div>

        {/* User Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>System Users</CardTitle>
                <CardDescription>Manage user accounts and permissions</CardDescription>
              </div>
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="DEPARTMENT_DIRECTOR">Department Director</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="EXECUTIVE">Executive</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Users Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Reports To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.department}</TableCell>
                      <TableCell>
                        <Badge variant={
                          user.role === "ADMIN" ? "destructive" :
                          user.role === "HR" ? "default" :
                          user.role === "MANAGER" ? "secondary" :
                          user.role === "DEPARTMENT_DIRECTOR" ? "outline" :
                          user.role === "EXECUTIVE" ? "outline" :
                          "secondary"
                        }>
                          {user.role === "DEPARTMENT_DIRECTOR" ? "DEPT DIR" : user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {user.manager && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Manager:</span> {user.manager.firstName} {user.manager.lastName}
                            </div>
                          )}
                          {user.departmentDirector && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Director:</span> {user.departmentDirector.firstName} {user.departmentDirector.lastName}
                            </div>
                          )}
                          {!user.manager && !user.departmentDirector && (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedUser(user)
                                setEditDialogOpen(true)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user)
                                setSelectedManagerId(user.managerId || "none")
                                setSelectedDirectorId(user.departmentDirectorId || "none")
                                setManagerDialogOpen(true)
                              }}
                            >
                              <UserCog className="mr-2 h-4 w-4" />
                              Assign Manager
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                            >
                              <Power className="mr-2 h-4 w-4" />
                              {user.isActive ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Show</Label>
                    <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label className="text-sm">entries</Label>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        )
                      }
                      if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="px-1">...</span>
                      }
                      return null
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Update role for {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select 
                  defaultValue={selectedUser.role}
                  onValueChange={(value) => handleRoleChange(selectedUser.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="DEPARTMENT_DIRECTOR">Department Director</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="EXECUTIVE">Executive</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manager Assignment Dialog */}
      <Dialog open={managerDialogOpen} onOpenChange={setManagerDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Manager & Department Director</DialogTitle>
            <DialogDescription>
              Set the reporting structure for {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Direct Manager</Label>
                <UserSearchSelect
                  users={users.filter(u =>
                    u.id !== selectedUser.id &&
                    ['MANAGER', 'DEPARTMENT_DIRECTOR', 'EXECUTIVE'].includes(u.role) &&
                    u.isActive
                  )}
                  value={selectedManagerId}
                  onValueChange={setSelectedManagerId}
                  placeholder="Search for a manager..."
                  noneLabel="No Manager"
                />
                <p className="text-sm text-muted-foreground">
                  The direct manager who approves leave requests
                </p>
              </div>

              <div className="space-y-2">
                <Label>Department Director</Label>
                <UserSearchSelect
                  users={users.filter(u =>
                    u.id !== selectedUser.id &&
                    ['DEPARTMENT_DIRECTOR', 'EXECUTIVE'].includes(u.role) &&
                    u.isActive
                  )}
                  value={selectedDirectorId}
                  onValueChange={setSelectedDirectorId}
                  placeholder="Search for a director..."
                  noneLabel="No Department Director"
                />
                <p className="text-sm text-muted-foreground">
                  The department director who oversees the department
                </p>
              </div>

              {selectedUser.subordinates.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This user manages {selectedUser.subordinates.length} other user(s). 
                    Changing their role may require reassigning their subordinates.
                  </AlertDescription>
                </Alert>
              )}

              {selectedUser.directsReports.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This user is department director for {selectedUser.directsReports.length} other user(s). 
                    Changing their role may require reassigning their department members.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setManagerDialogOpen(false)
              setSelectedManagerId("none")
              setSelectedDirectorId("none")
            }}>
              Cancel
            </Button>
            <Button onClick={handleManagerUpdate}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}