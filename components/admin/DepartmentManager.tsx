"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Building, 
  Plus,
  Edit,
  Trash2,
  Users,
  UserCog,
  ChevronRight,
  AlertCircle,
  Save,
  X,
  UserPlus,
  UserMinus,
  Network,
  FolderTree,
} from "lucide-react"
import { toast } from "sonner"

interface Department {
  id: string
  name: string
  code: string
  description?: string
  isActive: boolean
  order?: number
  createdAt?: string
  _count?: {
    users: number
    childDepartments: number
  }
}

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  employeeId: string
  role: string
  department?: string
  position?: string
  isActive: boolean
}

export function DepartmentManager() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [isAssignUsersDialogOpen, setIsAssignUsersDialogOpen] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  
  // Form data
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    order: 0,
    isActive: true,
  })

  useEffect(() => {
    fetchDepartments()
    fetchUsers()
  }, [])

  const fetchDepartments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data)
      } else {
        toast.error('Failed to load departments')
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
      toast.error('Error loading departments')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setAllUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleNewDepartment = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      order: 0,
      isActive: true,
    })
    setIsNewDialogOpen(true)
  }

  const handleEditDepartment = (dept: Department) => {
    setSelectedDepartment(dept)
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || "",
      order: dept.order || 0,
      isActive: dept.isActive,
    })
    setIsEditDialogOpen(true)
  }

  const handleSaveDepartment = async () => {
    try {
      const url = selectedDepartment 
        ? `/api/admin/departments/${selectedDepartment.id}`
        : '/api/admin/departments'
      
      const method = selectedDepartment ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast.success(selectedDepartment ? 'Department updated successfully' : 'Department created successfully')
        fetchDepartments()
        setIsEditDialogOpen(false)
        setIsNewDialogOpen(false)
        setSelectedDepartment(null)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save department')
      }
    } catch (error) {
      console.error('Error saving department:', error)
      toast.error('Failed to save department')
    }
  }

  const handleDeleteDepartment = async (deptId: string) => {
    if (!confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/departments/${deptId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Department deleted successfully')
        fetchDepartments()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete department')
      }
    } catch (error) {
      console.error('Error deleting department:', error)
      toast.error('Failed to delete department')
    }
  }

  const handleAssignUsers = (dept: Department) => {
    setSelectedDepartment(dept)
    // Pre-select users already in this department
    const deptUsers = allUsers
      .filter(user => user.department === dept.name)
      .map(user => user.id)
    setSelectedUsers(deptUsers)
    setIsAssignUsersDialogOpen(true)
  }

  const handleSaveUserAssignments = async () => {
    if (!selectedDepartment) return

    try {
      // First, remove users no longer selected
      const currentDeptUsers = allUsers.filter(u => u.department === selectedDepartment.name)
      const usersToRemove = currentDeptUsers
        .filter(u => !selectedUsers.includes(u.id))
        .map(u => u.id)

      if (usersToRemove.length > 0) {
        await fetch(`/api/admin/departments/${selectedDepartment.id}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: usersToRemove,
            action: 'remove'
          })
        })
      }

      // Then, add newly selected users
      const newUsers = selectedUsers.filter(
        userId => !currentDeptUsers.some(u => u.id === userId)
      )

      if (newUsers.length > 0) {
        // Update users to set their department
        for (const userId of newUsers) {
          await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              department: selectedDepartment.name
            })
          })
        }
      }

      toast.success('User assignments updated successfully')
      fetchDepartments()
      fetchUsers()
      setIsAssignUsersDialogOpen(false)
      setSelectedUsers([])
    } catch (error) {
      console.error('Error updating user assignments:', error)
      toast.error('Failed to update user assignments')
    }
  }

  const getUsersInDepartment = (deptName: string) => {
    return allUsers.filter(user => user.department === deptName)
  }

  const getDepartmentBadgeColor = (userCount: number) => {
    if (userCount === 0) return "secondary"
    if (userCount < 5) return "default"
    if (userCount < 10) return "outline"
    return "default"
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Department Management
              </CardTitle>
              <CardDescription>
                Manage organizational departments and their assignments
              </CardDescription>
            </div>
            <Button onClick={handleNewDepartment} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Department
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{departments.length}</div>
                  <div className="text-sm text-gray-600">Total Departments</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {departments.filter(d => d.isActive).length}
                  </div>
                  <div className="text-sm text-gray-600">Active</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{allUsers.length}</div>
                  <div className="text-sm text-gray-600">Total Employees</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {allUsers.filter(u => !u.department || u.department === "").length}
                  </div>
                  <div className="text-sm text-gray-600">Unassigned</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Departments Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading departments...
                    </TableCell>
                  </TableRow>
                ) : departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No departments found
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((dept) => {
                    const userCount = dept._count?.users || 0
                    return (
                      <TableRow key={dept.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{dept.name}</div>
                            {dept.description && (
                              <div className="text-sm text-gray-600">{dept.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{dept.code}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getDepartmentBadgeColor(userCount)}>
                            {userCount} {userCount === 1 ? 'employee' : 'employees'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={dept.isActive ? "default" : "secondary"}>
                            {dept.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAssignUsers(dept)}
                              title="Manage Users"
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditDepartment(dept)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => handleDeleteDepartment(dept.id)}
                              disabled={userCount > 0}
                              title={userCount > 0 ? "Cannot delete department with employees" : "Delete department"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Department Dialog */}
      <Dialog open={isNewDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsNewDialogOpen(false)
          setIsEditDialogOpen(false)
          setSelectedDepartment(null)
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDepartment ? 'Edit Department' : 'Create New Department'}
            </DialogTitle>
            <DialogDescription>
              {selectedDepartment ? 'Update department information' : 'Add a new department to your organization'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Department Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Engineering"
                />
              </div>
              <div>
                <Label htmlFor="code">Department Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  placeholder="e.g., ENG"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Brief description of the department"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="order">Display Order</Label>
                <Input
                  id="order"
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({...formData, order: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsNewDialogOpen(false)
              setIsEditDialogOpen(false)
              setSelectedDepartment(null)
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveDepartment}>
              {selectedDepartment ? 'Update' : 'Create'} Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Users Dialog */}
      <Dialog open={isAssignUsersDialogOpen} onOpenChange={setIsAssignUsersDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Users to {selectedDepartment?.name}</DialogTitle>
            <DialogDescription>
              Select users to assign to this department
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Selected: {selectedUsers.length} users
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedUsers.length === allUsers.filter(u => u.isActive).length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedUsers(allUsers.filter(u => u.isActive).map(u => u.id))
                          } else {
                            setSelectedUsers([])
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Current Department</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers
                    .filter(user => user.isActive)
                    .map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUsers([...selectedUsers, user.id])
                              } else {
                                setSelectedUsers(selectedUsers.filter(id => id !== user.id))
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {user?.firstName || ''} {user?.lastName || ''}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.department === selectedDepartment?.name ? "default" : "outline"}>
                            {user.department || 'Unassigned'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge>{user.role}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAssignUsersDialogOpen(false)
              setSelectedUsers([])
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveUserAssignments}>
              Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}