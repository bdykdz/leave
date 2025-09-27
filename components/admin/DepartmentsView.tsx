"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { 
  Building, 
  Users, 
  UserCog, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Briefcase,
  ChevronRight,
  User,
  Shield,
  AlertCircle,
  Search
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Department {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  order: number
  _count?: {
    users: number
  }
  director?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  managers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
  }>
  employees?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    position: string
    role: string
  }>
}

interface Position {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  order: number
  _count?: {
    users: number
  }
}

export function DepartmentsView() {
  const [activeTab, setActiveTab] = useState("overview")
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [departmentDetailsOpen, setDepartmentDetailsOpen] = useState(false)
  
  // Form states
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [editingPos, setEditingPos] = useState<Position | null>(null)
  const [deptForm, setDeptForm] = useState({ name: "", code: "", description: "" })
  const [posForm, setPosForm] = useState({ name: "", code: "", description: "" })
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [showPosForm, setShowPosForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchDepartments()
    fetchPositions()
  }, [])

  // Refresh data when tab changes to ensure latest data
  useEffect(() => {
    if (activeTab === "departments" || activeTab === "overview") {
      fetchDepartments()
    }
    if (activeTab === "positions") {
      fetchPositions()
    }
  }, [activeTab])

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/admin/departments/detailed', {
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched departments in DepartmentsView:', data.length)
        setDepartments(data)
      } else {
        const errorData = await response.json()
        console.error('Failed to fetch departments:', errorData)
        toast.error(errorData.error || 'Failed to fetch departments')
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
      toast.error('Failed to fetch departments')
    }
  }

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/admin/positions/detailed')
      if (response.ok) {
        const data = await response.json()
        setPositions(data.positions || [])
      }
    } catch (error) {
      toast.error('Failed to fetch positions')
    }
  }

  const handleSaveDepartment = async () => {
    if (!deptForm.name || !deptForm.code) {
      toast.error('Name and code are required')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/departments', {
        method: editingDept ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDept?.id,
          ...deptForm,
          isActive: editingDept ? editingDept.isActive : true
        })
      })

      if (response.ok) {
        toast.success(editingDept ? 'Department updated' : 'Department created')
        fetchDepartments()
        setDeptForm({ name: "", code: "", description: "" })
        setEditingDept(null)
        setShowDeptForm(false)
      } else {
        const error = await response.json()
        toast.error(error.error)
      }
    } catch (error) {
      toast.error('Failed to save department')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePosition = async () => {
    if (!posForm.name || !posForm.code) {
      toast.error('Name and code are required')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/positions', {
        method: editingPos ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPos?.id,
          ...posForm,
          isActive: editingPos ? editingPos.isActive : true
        })
      })

      if (response.ok) {
        toast.success(editingPos ? 'Position updated' : 'Position created')
        fetchPositions()
        setPosForm({ name: "", code: "", description: "" })
        setEditingPos(null)
        setShowPosForm(false)
      } else {
        const error = await response.json()
        toast.error(error.error)
      }
    } catch (error) {
      toast.error('Failed to save position')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return

    try {
      const response = await fetch(`/api/admin/departments?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Department deleted')
        fetchDepartments()
      } else {
        const error = await response.json()
        toast.error(error.error)
      }
    } catch (error) {
      toast.error('Failed to delete department')
    }
  }

  const handleDeletePosition = async (id: string) => {
    if (!confirm('Are you sure you want to delete this position?')) return

    try {
      const response = await fetch(`/api/admin/positions?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Position deleted')
        fetchPositions()
      } else {
        const error = await response.json()
        toast.error(error.error)
      }
    } catch (error) {
      toast.error('Failed to delete position')
    }
  }

  const viewDepartmentDetails = async (dept: Department) => {
    try {
      const response = await fetch(`/api/admin/departments/${dept.id}/details`)
      if (response.ok) {
        const data = await response.json()
        setSelectedDepartment(data)
        setDepartmentDetailsOpen(true)
      }
    } catch (error) {
      toast.error('Failed to fetch department details')
    }
  }

  const filteredPositions = positions.filter(pos => 
    pos.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pos.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
          <TabsTrigger value="overview">Department Overview</TabsTrigger>
          <TabsTrigger value="departments">Manage Departments</TabsTrigger>
          <TabsTrigger value="positions">Manage Positions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Department Cards Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <Card 
                key={dept.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => viewDepartmentDetails(dept)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{dept.name}</CardTitle>
                    </div>
                    <Badge variant={dept.isActive ? "default" : "secondary"}>
                      {dept.code}
                    </Badge>
                  </div>
                  <CardDescription>{dept.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Employees:</span>
                      <span className="font-medium">{dept._count?.users || 0}</span>
                    </div>
                    {dept.director && (
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <span className="text-muted-foreground">Director:</span>
                        <span className="font-medium">
                          {dept.director.firstName} {dept.director.lastName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <UserCog className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">Managers:</span>
                      <span className="font-medium">{dept.managers?.length || 0}</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="w-full mt-4 justify-between"
                    onClick={(e) => {
                      e.stopPropagation()
                      viewDepartmentDetails(dept)
                    }}
                  >
                    View Details
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Statistics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Departments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{departments.length}</div>
                <p className="text-xs text-muted-foreground">
                  {departments.filter(d => d.isActive).length} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Positions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{positions.length}</div>
                <p className="text-xs text-muted-foreground">
                  {positions.filter(p => p.isActive).length} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Department Directors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {departments.filter(d => d.director).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {departments.length} departments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {departments.reduce((sum, d) => sum + (d._count?.users || 0), 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  across all departments
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="departments" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Departments</CardTitle>
                  <CardDescription>Manage organizational departments</CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowDeptForm(true)
                    setEditingDept(null)
                    setDeptForm({ name: "", code: "", description: "" })
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showDeptForm && (
                <div className="mb-6 p-4 border rounded-lg space-y-4">
                  <h3 className="font-medium">{editingDept ? 'Edit Department' : 'New Department'}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dept-name">Name</Label>
                      <Input
                        id="dept-name"
                        value={deptForm.name}
                        onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                        placeholder="e.g., Human Resources"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dept-code">Code</Label>
                      <Input
                        id="dept-code"
                        value={deptForm.code}
                        onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                        placeholder="e.g., HR"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dept-desc">Description</Label>
                    <Textarea
                      id="dept-desc"
                      value={deptForm.description}
                      onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                      placeholder="Department description..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveDepartment} disabled={loading}>
                      {editingDept ? 'Update' : 'Create'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeptForm(false)
                        setEditingDept(null)
                        setDeptForm({ name: "", code: "", description: "" })
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Director</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell>{dept.code}</TableCell>
                      <TableCell>{dept._count?.users || 0}</TableCell>
                      <TableCell>
                        {dept.director ? (
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-600" />
                            {dept.director.firstName} {dept.director.lastName}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={dept.isActive ? "default" : "secondary"}>
                          {dept.isActive ? "Active" : "Inactive"}
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
                            <DropdownMenuItem onClick={() => viewDepartmentDetails(dept)}>
                              <Users className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingDept(dept)
                                setDeptForm({
                                  name: dept.name,
                                  code: dept.code,
                                  description: dept.description || ""
                                })
                                setShowDeptForm(true)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteDepartment(dept.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Positions</CardTitle>
                  <CardDescription>Manage employee positions</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search positions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowPosForm(true)
                      setEditingPos(null)
                      setPosForm({ name: "", code: "", description: "" })
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Position
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showPosForm && (
                <div className="mb-6 p-4 border rounded-lg space-y-4">
                  <h3 className="font-medium">{editingPos ? 'Edit Position' : 'New Position'}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pos-name">Name</Label>
                      <Input
                        id="pos-name"
                        value={posForm.name}
                        onChange={(e) => setPosForm({ ...posForm, name: e.target.value })}
                        placeholder="e.g., Software Engineer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pos-code">Code</Label>
                      <Input
                        id="pos-code"
                        value={posForm.code}
                        onChange={(e) => setPosForm({ ...posForm, code: e.target.value.toUpperCase() })}
                        placeholder="e.g., SE"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pos-desc">Description</Label>
                    <Textarea
                      id="pos-desc"
                      value={posForm.description}
                      onChange={(e) => setPosForm({ ...posForm, description: e.target.value })}
                      placeholder="Position description..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSavePosition} disabled={loading}>
                      {editingPos ? 'Update' : 'Create'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPosForm(false)
                        setEditingPos(null)
                        setPosForm({ name: "", code: "", description: "" })
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPositions.map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell className="font-medium">{pos.name}</TableCell>
                      <TableCell>{pos.code}</TableCell>
                      <TableCell className="max-w-xs truncate">{pos.description || '-'}</TableCell>
                      <TableCell>{pos._count?.users || 0}</TableCell>
                      <TableCell>
                        <Badge variant={pos.isActive ? "default" : "secondary"}>
                          {pos.isActive ? "Active" : "Inactive"}
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
                                setEditingPos(pos)
                                setPosForm({
                                  name: pos.name,
                                  code: pos.code,
                                  description: pos.description || ""
                                })
                                setShowPosForm(true)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeletePosition(pos.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Department Details Dialog */}
      <Dialog open={departmentDetailsOpen} onOpenChange={setDepartmentDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              {selectedDepartment?.name}
            </DialogTitle>
            <DialogDescription>
              Department details and employee list
            </DialogDescription>
          </DialogHeader>
          
          {selectedDepartment && (
            <div className="space-y-8 mt-6">
              {/* Department Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Department Code</Label>
                    <div className="text-lg font-semibold">{selectedDepartment.code}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Status</Label>
                    <div>
                      <Badge variant={selectedDepartment.isActive ? "default" : "secondary"}>
                        {selectedDepartment.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
                {selectedDepartment.description && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Description</Label>
                    <div className="text-sm">
                      {selectedDepartment.description}
                    </div>
                  </div>
                )}
              </div>

              {/* Director Section */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Department Director</Label>
                {selectedDepartment.director ? (
                  <div className="p-3 border rounded-lg flex items-center gap-3">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium">
                        {selectedDepartment.director.firstName} {selectedDepartment.director.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {selectedDepartment.director.email}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 border border-dashed rounded-lg text-muted-foreground text-sm">
                    Not allocated
                  </div>
                )}
              </div>

              {/* Managers Section */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Managers {selectedDepartment.managers && selectedDepartment.managers.length > 0 && 
                    `(${selectedDepartment.managers.length})`}
                </Label>
                {selectedDepartment.managers && selectedDepartment.managers.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDepartment.managers.map((manager) => (
                      <div key={manager.id} className="p-3 border rounded-lg flex items-center gap-3">
                        <UserCog className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="font-medium">
                            {manager.firstName} {manager.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {manager.email}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 border border-dashed rounded-lg text-muted-foreground text-sm">
                    No managers allocated
                  </div>
                )}
              </div>

              {/* Employees Table */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Employees ({selectedDepartment._count?.users || 0})
                </Label>
                {selectedDepartment._count?.users > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDepartment.employees?.map((employee) => (
                          <TableRow key={employee.id}>
                            <TableCell className="font-medium">
                              {employee.firstName} {employee.lastName}
                            </TableCell>
                            <TableCell>{employee.email}</TableCell>
                            <TableCell>{employee.position}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{employee.role}</Badge>
                            </TableCell>
                          </TableRow>
                        )) || (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              No employees in this department
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-3 border border-dashed rounded-lg text-muted-foreground text-sm">
                    No employees in this department
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}