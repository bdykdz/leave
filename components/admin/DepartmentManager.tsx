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
} from "lucide-react"
import { toast } from "sonner"

interface Department {
  id: string
  name: string
  description?: string
  managerId?: string | null
  directorId?: string | null
  parentDepartmentId?: string | null
  manager?: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
  director?: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
  parentDepartment?: {
    id: string
    name: string
  } | null
  employees: {
    id: string
    firstName: string
    lastName: string
    email: string
    position: string
    role: string
  }[]
  _count?: {
    employees: number
    childDepartments: number
  }
}

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  department?: string
}

export function DepartmentManager() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>([])
  
  // Form data
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    managerId: "",
    directorId: "",
    parentDepartmentId: "",
  })

  const [assignData, setAssignData] = useState({
    userId: "",
    role: "EMPLOYEE",
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
        setDepartments(data.departments || [])
      }
    } catch (error) {
      toast.error('Failed to load departments')
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
      console.error('Failed to load users')
    }
  }

  const handleNewDepartment = () => {
    setFormData({
      name: "",
      description: "",
      managerId: "",
      directorId: "",
      parentDepartmentId: "",
    })
    setIsNewDialogOpen(true)
  }

  const handleEditDepartment = (dept: Department) => {
    setSelectedDepartment(dept)
    setFormData({
      name: dept.name,
      description: dept.description || "",
      managerId: dept.managerId || "",
      directorId: dept.directorId || "",
      parentDepartmentId: dept.parentDepartmentId || "",
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
        toast.success(selectedDepartment ? 'Department updated' : 'Department created')
        fetchDepartments()
        setIsEditDialogOpen(false)
        setIsNewDialogOpen(false)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to save department')
      }
    } catch (error) {
      toast.error('An error occurred')
    }
  }

  const handleDeleteDepartment = async (deptId: string) => {
    if (!confirm('Are you sure? This will remove the department and reassign all employees.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/departments/${deptId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Department deleted')
        fetchDepartments()
      } else {
        toast.error('Failed to delete department')
      }
    } catch (error) {
      toast.error('An error occurred')
    }
  }

  const handleAssignPeople = (dept: Department) => {
    setSelectedDepartment(dept)
    setAssignData({ userId: "", role: "EMPLOYEE" })
    setIsAssignDialogOpen(true)
  }

  const handleAssignUser = async () => {
    if (!selectedDepartment || !assignData.userId) return

    try {
      const response = await fetch(`/api/admin/departments/${selectedDepartment.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: assignData.userId,
          role: assignData.role,
        })
      })

      if (response.ok) {
        toast.success('User assigned to department')
        fetchDepartments()
        setIsAssignDialogOpen(false)
      } else {
        toast.error('Failed to assign user')
      }
    } catch (error) {
      toast.error('An error occurred')
    }
  }

  const handleRemoveUser = async (deptId: string, userId: string) => {
    try {
      const response = await fetch(`/api/admin/departments/${deptId}/remove-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (response.ok) {
        toast.success('User removed from department')
        fetchDepartments()
      } else {
        toast.error('Failed to remove user')
      }
    } catch (error) {
      toast.error('An error occurred')
    }
  }

  const toggleExpanded = (deptId: string) => {
    setExpandedDepartments(prev =>
      prev.includes(deptId)
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    )
  }

  const managers = allUsers.filter(u => ['MANAGER', 'DEPARTMENT_DIRECTOR', 'EXECUTIVE'].includes(u.role))
  const directors = allUsers.filter(u => ['DEPARTMENT_DIRECTOR', 'EXECUTIVE'].includes(u.role))
  const availableUsers = allUsers.filter(u => !selectedDepartment?.employees.some(e => e.id === u.id))

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
                Manage departments, assign managers, directors, and employees
              </CardDescription>
            </div>
            <Button onClick={handleNewDepartment} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Department
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading departments...</div>
          ) : departments.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No departments found. Create your first department to get started.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {departments.map((dept) => (
                <Card key={dept.id} className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{dept.name}</h3>
                          <Badge variant="outline">
                            {dept.employees?.length || 0} employees
                          </Badge>
                        </div>
                        {dept.description && (
                          <p className="text-sm text-gray-600 mb-2">{dept.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm">
                          {dept.manager && (
                            <div className="flex items-center gap-1">
                              <UserCog className="h-4 w-4 text-green-600" />
                              <span>Manager: {dept.manager.firstName} {dept.manager.lastName}</span>
                            </div>
                          )}
                          {dept.director && (
                            <div className="flex items-center gap-1">
                              <UserCog className="h-4 w-4 text-blue-600" />
                              <span>Director: {dept.director.firstName} {dept.director.lastName}</span>
                            </div>
                          )}
                          {dept.parentDepartment && (
                            <div className="flex items-center gap-1">
                              <Building className="h-4 w-4 text-gray-600" />
                              <span>Parent: {dept.parentDepartment.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignPeople(dept)}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          Assign
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
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {dept.employees && dept.employees.length > 0 && (
                    <CardContent>
                      <div className="space-y-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(dept.id)}
                          className="mb-2"
                        >
                          <ChevronRight 
                            className={`h-4 w-4 mr-1 transition-transform ${
                              expandedDepartments.includes(dept.id) ? 'rotate-90' : ''
                            }`}
                          />
                          View Employees ({dept.employees.length})
                        </Button>
                        
                        {expandedDepartments.includes(dept.id) && (
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Position</TableHead>
                                  <TableHead>Role</TableHead>
                                  <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {dept.employees.map((emp) => (
                                  <TableRow key={emp.id}>
                                    <TableCell>{emp.firstName} {emp.lastName}</TableCell>
                                    <TableCell>{emp.email}</TableCell>
                                    <TableCell>{emp.position || '-'}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{emp.role}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-red-600"
                                        onClick={() => handleRemoveUser(dept.id, emp.id)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Department Dialog */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Department</DialogTitle>
            <DialogDescription>
              Set up a new department in your organization
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Department Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Engineering, Sales, HR"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Brief description of the department"
                rows={3}
              />
            </div>
            
            <div>
              <Label>Department Manager</Label>
              <Select value={formData.managerId} onValueChange={(value) => setFormData({...formData, managerId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Manager</SelectItem>
                  {managers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Department Director</Label>
              <Select value={formData.directorId} onValueChange={(value) => setFormData({...formData, directorId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select director" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Director</SelectItem>
                  {directors.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Parent Department</Label>
              <Select value={formData.parentDepartmentId} onValueChange={(value) => setFormData({...formData, parentDepartmentId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Parent (Top Level)</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDepartment}>
              Create Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>
              Update department information
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Department Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
              />
            </div>
            
            <div>
              <Label>Department Manager</Label>
              <Select value={formData.managerId} onValueChange={(value) => setFormData({...formData, managerId: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Manager</SelectItem>
                  {managers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Department Director</Label>
              <Select value={formData.directorId} onValueChange={(value) => setFormData({...formData, directorId: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Director</SelectItem>
                  {directors.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDepartment}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign People Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to {selectedDepartment?.name}</DialogTitle>
            <DialogDescription>
              Add a user to this department
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Select User</Label>
              <Select value={assignData.userId} onValueChange={(value) => setAssignData({...assignData, userId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} - {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Role in Department</Label>
              <Select value={assignData.role} onValueChange={(value) => setAssignData({...assignData, role: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="DEPARTMENT_DIRECTOR">Director</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignUser}>
              Assign User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}