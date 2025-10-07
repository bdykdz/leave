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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users, 
  Plus,
  Search,
  Edit,
  Power,
  Trash2,
  Save,
  X,
  UserCog,
  Building,
  Mail,
  Phone,
  Calendar,
  Shield,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  department: string
  position: string
  phoneNumber?: string
  hireDate?: string
  isActive: boolean
  createdAt: string
  managerId?: string | null
  departmentDirectorId?: string | null
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
  leaveBalances?: any[]
}

export function UserManagementEnhanced() {
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRole, setFilterRole] = useState("ALL")
  const [filterDepartment, setFilterDepartment] = useState("ALL")
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "EMPLOYEE",
    department: "",
    position: "",
    phoneNumber: "",
    hireDate: "",
    managerId: "",
    departmentDirectorId: "",
    isActive: true,
  })

  useEffect(() => {
    fetchUsers()
    fetchDepartments()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/admin/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments?.map((d: any) => d.name) || [])
      }
    } catch (error) {
      console.error('Failed to load departments')
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      department: user.department || "",
      position: user.position || "",
      phoneNumber: user.phoneNumber || "",
      hireDate: user.hireDate ? format(new Date(user.hireDate), 'yyyy-MM-dd') : "",
      managerId: user.managerId || "",
      departmentDirectorId: user.departmentDirectorId || "",
      isActive: user.isActive,
    })
    setIsEditDialogOpen(true)
  }

  const handleNewUser = () => {
    setEditingUser(null)
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      role: "EMPLOYEE",
      department: "",
      position: "",
      phoneNumber: "",
      hireDate: "",
      managerId: "",
      departmentDirectorId: "",
      isActive: true,
    })
    setIsNewUserDialogOpen(true)
  }

  const handleSaveUser = async () => {
    try {
      const url = editingUser 
        ? `/api/admin/users/${editingUser.id}`
        : '/api/admin/users'
      
      const method = editingUser ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast.success(editingUser ? 'User updated successfully' : 'User created successfully')
        fetchUsers()
        setIsEditDialogOpen(false)
        setIsNewUserDialogOpen(false)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to save user')
      }
    } catch (error) {
      toast.error('An error occurred while saving')
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
        fetchUsers()
      } else {
        toast.error('Failed to delete user')
      }
    } catch (error) {
      toast.error('An error occurred')
    }
  }

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      })

      if (response.ok) {
        toast.success(`User ${currentStatus ? 'deactivated' : 'activated'}`)
        fetchUsers()
      }
    } catch (error) {
      toast.error('Failed to update user status')
    }
  }

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = filterRole === "ALL" || user.role === filterRole
    const matchesDepartment = filterDepartment === "ALL" || user.department === filterDepartment
    
    return matchesSearch && matchesRole && matchesDepartment
  })

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: "bg-red-100 text-red-800",
      HR: "bg-purple-100 text-purple-800",
      EXECUTIVE: "bg-yellow-100 text-yellow-800",
      DEPARTMENT_DIRECTOR: "bg-blue-100 text-blue-800",
      MANAGER: "bg-green-100 text-green-800",
      EMPLOYEE: "bg-gray-100 text-gray-800",
    }
    return <Badge className={colors[role] || "bg-gray-100 text-gray-800"}>{role}</Badge>
  }

  const managers = users.filter(u => ['MANAGER', 'DEPARTMENT_DIRECTOR', 'EXECUTIVE'].includes(u.role))
  const directors = users.filter(u => ['DEPARTMENT_DIRECTOR', 'EXECUTIVE'].includes(u.role))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage all users, their roles, departments, and permissions
              </CardDescription>
            </div>
            <Button onClick={handleNewUser} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add New User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="EXECUTIVE">Executive</SelectItem>
                <SelectItem value="DEPARTMENT_DIRECTOR">Director</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{user.department || '-'}</TableCell>
                      <TableCell>{user.position || '-'}</TableCell>
                      <TableCell>
                        {user.manager ? 
                          `${user.manager.firstName} ${user.manager.lastName}` : 
                          '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleStatus(user.id, user.isActive)}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="role">Role & Department</TabsTrigger>
              <TabsTrigger value="hierarchy">Reporting</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name</Label>
                  <Input 
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input 
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input 
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Hire Date</Label>
                  <Input 
                    type="date"
                    value={formData.hireDate}
                    onChange={(e) => setFormData({...formData, hireDate: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select 
                    value={formData.isActive.toString()}
                    onValueChange={(value) => setFormData({...formData, isActive: value === 'true'})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="role" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="EXECUTIVE">Executive</SelectItem>
                      <SelectItem value="DEPARTMENT_DIRECTOR">Department Director</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Department</Label>
                  <Select value={formData.department} onValueChange={(value) => setFormData({...formData, department: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Position</Label>
                  <Input 
                    value={formData.position}
                    onChange={(e) => setFormData({...formData, position: e.target.value})}
                    placeholder="e.g., Senior Developer, HR Manager, etc."
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="hierarchy" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>Direct Manager</Label>
                  <Select value={formData.managerId} onValueChange={(value) => setFormData({...formData, managerId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Manager</SelectItem>
                      {managers.filter(m => m.id !== editingUser?.id).map(manager => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.firstName} {manager.lastName} ({manager.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Department Director</Label>
                  <Select value={formData.departmentDirectorId} onValueChange={(value) => setFormData({...formData, departmentDirectorId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select director" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Director</SelectItem>
                      {directors.filter(d => d.id !== editingUser?.id).map(director => (
                        <SelectItem key={director.id} value={director.id}>
                          {director.firstName} {director.lastName} ({director.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New User Dialog */}
      <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input 
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input 
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input 
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                />
              </div>
              <div>
                <Label>Role *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="EXECUTIVE">Executive</SelectItem>
                    <SelectItem value="DEPARTMENT_DIRECTOR">Department Director</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department *</Label>
                <Select value={formData.department} onValueChange={(value) => setFormData({...formData, department: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Position</Label>
                <Input 
                  value={formData.position}
                  onChange={(e) => setFormData({...formData, position: e.target.value})}
                  placeholder="e.g., Senior Developer"
                />
              </div>
              <div>
                <Label>Hire Date</Label>
                <Input 
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => setFormData({...formData, hireDate: e.target.value})}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}