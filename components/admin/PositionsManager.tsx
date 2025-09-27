"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Briefcase, 
  Plus,
  Search,
  Edit,
  Power,
  Trash2,
  MoreHorizontal,
  Users,
  AlertCircle,
  Building,
} from "lucide-react"
import { toast } from "sonner"

interface Position {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  users?: { id: string }[]
}

export function PositionsManager() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
  })
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    fetchPositions()
  }, [])

  const fetchPositions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/positions/detailed')
      if (response.ok) {
        const data = await response.json()
        setPositions(data.positions)
      }
    } catch (error) {
      console.error('Failed to fetch positions:', error)
      toast.error('Failed to load positions')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setIsNew(true)
    setFormData({
      name: "",
      code: "",
      description: "",
    })
    setEditDialogOpen(true)
  }

  const handleEdit = (position: Position) => {
    setIsNew(false)
    setSelectedPosition(position)
    setFormData({
      name: position.name,
      code: position.code,
      description: position.description || "",
    })
    setEditDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      const url = isNew 
        ? '/api/admin/positions' 
        : `/api/admin/positions`
      
      const method = isNew ? 'POST' : 'PUT'
      
      const body = isNew 
        ? formData 
        : { ...formData, id: selectedPosition?.id }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        toast.success(`Position ${isNew ? 'created' : 'updated'} successfully`)
        fetchPositions()
        setEditDialogOpen(false)
      } else {
        const data = await response.json()
        toast.error(data.error || `Failed to ${isNew ? 'create' : 'update'} position`)
      }
    } catch (error) {
      console.error('Error saving position:', error)
      toast.error('An error occurred')
    }
  }

  const handleToggleStatus = async (position: Position) => {
    try {
      const response = await fetch('/api/admin/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: position.id,
          name: position.name,
          code: position.code,
          description: position.description,
          isActive: !position.isActive
        })
      })

      if (response.ok) {
        toast.success(`Position ${position.isActive ? 'deactivated' : 'activated'} successfully`)
        fetchPositions()
      } else {
        toast.error('Failed to update position status')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('An error occurred')
    }
  }

  const handleDelete = async () => {
    if (!selectedPosition) return

    try {
      const response = await fetch(`/api/admin/positions/${selectedPosition.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Position deleted successfully')
        fetchPositions()
        setDeleteDialogOpen(false)
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete position')
      }
    } catch (error) {
      console.error('Error deleting position:', error)
      toast.error('An error occurred while deleting the position')
    }
  }

  const filteredPositions = positions.filter(position => {
    const matchesSearch = 
      position.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      position.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (position.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    return matchesSearch
  })

  const stats = {
    total: positions.length,
    active: positions.filter(p => p.isActive).length,
    inactive: positions.filter(p => !p.isActive).length,
    withUsers: positions.filter(p => p.users && p.users.length > 0).length,
  }

  if (loading) {
    return <div className="text-center py-8">Loading positions...</div>
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Positions</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                Organizational positions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Power className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
              <p className="text-xs text-muted-foreground">Currently in use</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inactive}</div>
              <p className="text-xs text-muted-foreground">Archived positions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.withUsers}</div>
              <p className="text-xs text-muted-foreground">Have employees</p>
            </CardContent>
          </Card>
        </div>

        {/* Positions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Positions</CardTitle>
                <CardDescription>Manage organizational positions and job titles</CardDescription>
              </div>
              <Button size="sm" onClick={handleCreate} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Position
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search positions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Positions Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPositions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No positions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPositions.map((position) => (
                      <TableRow key={position.id}>
                        <TableCell className="font-medium">{position.name}</TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {position.code}
                          </code>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {position.description || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {position.users?.length || 0} users
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={position.isActive ? "default" : "secondary"}>
                            {position.isActive ? "Active" : "Inactive"}
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
                              <DropdownMenuItem onClick={() => handleEdit(position)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(position)}>
                                <Power className="mr-2 h-4 w-4" />
                                {position.isActive ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedPosition(position)
                                  setDeleteDialogOpen(true)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? "Create Position" : "Edit Position"}</DialogTitle>
            <DialogDescription>
              {isNew ? "Add a new position to your organization" : "Update position details"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Position Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Position Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., SWE"
              />
              <p className="text-sm text-muted-foreground">
                A unique identifier for this position
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the position..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isNew ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Position</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this position?
            </DialogDescription>
          </DialogHeader>
          {selectedPosition && (
            <div className="py-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{selectedPosition.name}</strong> ({selectedPosition.code})
                  {selectedPosition.users && selectedPosition.users.length > 0 && (
                    <div className="mt-2">
                      This position has {selectedPosition.users.length} assigned user(s). 
                      You must reassign them before deleting this position.
                    </div>
                  )}
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground mt-4">
                This action cannot be undone.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={selectedPosition?.users && selectedPosition.users.length > 0}
            >
              Delete Position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}