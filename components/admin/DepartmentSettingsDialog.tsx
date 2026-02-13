"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Plus, MoreHorizontal, Edit, Trash2, Building, Briefcase, ChevronDown, ChevronRight, Users } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

interface DepartmentMember {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

interface Department {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  order: number
  _count?: { users: number }
}

interface Position {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  order: number
}

interface DepartmentSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DepartmentSettingsDialog({ open, onOpenChange }: DepartmentSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState("departments")
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  
  // Form states
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [editingPos, setEditingPos] = useState<Position | null>(null)
  const [deptForm, setDeptForm] = useState({ name: "", code: "", description: "" })
  const [posForm, setPosForm] = useState({ name: "", code: "", description: "" })
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [showPosForm, setShowPosForm] = useState(false)
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [deptMembers, setDeptMembers] = useState<DepartmentMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  useEffect(() => {
    if (open) {
      // Reset forms when opening
      setShowDeptForm(false)
      setShowPosForm(false)
      setEditingDept(null)
      setEditingPos(null)
      setDeptForm({ name: "", code: "", description: "" })
      setPosForm({ name: "", code: "", description: "" })
      
      // Fetch fresh data
      fetchDepartments()
      fetchPositions()
    }
  }, [open])

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/admin/departments', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched departments:', data.length)
        console.log('Departments:', data)
        setDepartments(data)
      } else {
        console.error('Failed to fetch departments:', response.status)
        const errorData = await response.json()
        console.error('Error details:', errorData)
        toast.error('Failed to fetch departments: ' + (errorData.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
      toast.error('Failed to fetch departments')
    }
  }

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/admin/positions')
      if (response.ok) {
        const data = await response.json()
        setPositions(data)
      }
    } catch (error) {
      toast.error('Failed to fetch positions')
    }
  }

  const toggleDeptMembers = async (dept: Department) => {
    if (expandedDept === dept.id) {
      setExpandedDept(null)
      setDeptMembers([])
      return
    }
    setExpandedDept(dept.id)
    setLoadingMembers(true)
    try {
      const response = await fetch(`/api/admin/departments/${dept.id}/members`)
      if (response.ok) {
        const data = await response.json()
        setDeptMembers(data)
      } else {
        setDeptMembers([])
      }
    } catch {
      setDeptMembers([])
    } finally {
      setLoadingMembers(false)
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

      const data = await response.json()
      
      if (response.ok) {
        console.log('Department saved successfully:', data)
        toast.success(editingDept ? 'Department updated' : 'Department created')
        
        // Reset form
        setDeptForm({ name: "", code: "", description: "" })
        setEditingDept(null)
        setShowDeptForm(false)
        
        // Fetch fresh data immediately
        await fetchDepartments()
      } else {
        console.error('Failed to save department:', data)
        toast.error(data.error || 'Failed to save department')
      }
    } catch (error) {
      console.error('Error saving department:', error)
      toast.error('Failed to save department: ' + (error instanceof Error ? error.message : 'Unknown error'))
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

  const handleToggleDepartmentStatus = async (dept: Department) => {
    try {
      const response = await fetch('/api/admin/departments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dept,
          isActive: !dept.isActive
        })
      })

      if (response.ok) {
        toast.success(`Department ${!dept.isActive ? 'activated' : 'deactivated'}`)
        fetchDepartments()
      }
    } catch (error) {
      toast.error('Failed to update department status')
    }
  }

  const handleTogglePositionStatus = async (pos: Position) => {
    try {
      const response = await fetch('/api/admin/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pos,
          isActive: !pos.isActive
        })
      })

      if (response.ok) {
        toast.success(`Position ${!pos.isActive ? 'activated' : 'deactivated'}`)
        fetchPositions()
      }
    } catch (error) {
      toast.error('Failed to update position status')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Departments & Positions Management</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="departments" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="positions" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Positions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="departments" className="flex-1 overflow-hidden flex flex-col">
            <Card className="flex-1 overflow-hidden flex flex-col">
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
              <CardContent className="flex-1 overflow-auto">
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
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((dept) => (
                      <>
                        <TableRow key={dept.id}>
                          <TableCell className="w-8 pr-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleDeptMembers(dept)}
                            >
                              {expandedDept === dept.id
                                ? <ChevronDown className="h-4 w-4" />
                                : <ChevronRight className="h-4 w-4" />
                              }
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{dept.name}</TableCell>
                          <TableCell>{dept.code}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {dept._count?.users ?? 0}
                            </span>
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
                                <DropdownMenuItem onClick={() => handleToggleDepartmentStatus(dept)}>
                                  {dept.isActive ? "Deactivate" : "Activate"}
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
                        {expandedDept === dept.id && (
                          <TableRow key={`${dept.id}-members`}>
                            <TableCell colSpan={6} className="bg-muted/50 p-0">
                              <div className="px-8 py-3">
                                {loadingMembers ? (
                                  <p className="text-sm text-muted-foreground">Loading members...</p>
                                ) : deptMembers.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No members in this department</p>
                                ) : (
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Department Members</p>
                                    {deptMembers.map(member => (
                                      <div key={member.id} className="flex items-center gap-3 text-sm py-1">
                                        <span className="font-medium">{member.firstName} {member.lastName}</span>
                                        <span className="text-muted-foreground">{member.email}</span>
                                        <Badge variant="outline" className="text-xs">{member.role}</Badge>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="positions" className="flex-1 overflow-hidden flex flex-col">
            <Card className="flex-1 overflow-hidden flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Positions</CardTitle>
                    <CardDescription>Manage employee positions</CardDescription>
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
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
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
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((pos) => (
                      <TableRow key={pos.id}>
                        <TableCell className="font-medium">{pos.name}</TableCell>
                        <TableCell>{pos.code}</TableCell>
                        <TableCell className="max-w-xs truncate">{pos.description || '-'}</TableCell>
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
                              <DropdownMenuItem onClick={() => handleTogglePositionStatus(pos)}>
                                {pos.isActive ? "Deactivate" : "Activate"}
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
      </DialogContent>
    </Dialog>
  )
}