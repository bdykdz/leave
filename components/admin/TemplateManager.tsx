"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  FileText, 
  Upload, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  FileCode,
  Download,
  Plus,
  Search,
  Filter,
  MapPin,
  Signature,
  Shield,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { FieldMapperDialog } from "./FieldMapperDialog"

interface DocumentTemplate {
  id: string
  name: string
  description: string
  fileUrl: string
  fileType: string
  category: string
  version: number
  isActive: boolean
  leaveTypeId?: string
  leaveType?: {
    id: string
    name: string
    code: string
  }
  createdAt: string
  updatedAt: string
  _count: {
    fieldMappings: number
    signaturePlacements: number
    generatedDocuments: number
  }
}

interface LeaveType {
  id: string
  name: string
  code: string
}

export function TemplateManager() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [fieldMapperOpen, setFieldMapperOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  
  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    name: "",
    description: "",
    leaveTypeId: "",
    file: null as File | null,
  })

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    leaveTypeId: "",
    isActive: true,
  })

  useEffect(() => {
    fetchTemplates()
    fetchLeaveTypes()
  }, [])

  const fetchLeaveTypes = async () => {
    try {
      const response = await fetch('/api/admin/leave-types')
      if (response.ok) {
        const data = await response.json()
        console.log('Leave types loaded:', data.leaveTypes)
        setLeaveTypes(data.leaveTypes || [])
      } else {
        toast.error('Failed to load leave types')
      }
    } catch (error) {
      console.error('Error fetching leave types:', error)
      toast.error('Failed to load leave types')
    }
  }

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates)
      } else {
        toast.error('Failed to load templates')
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async () => {
    if (!uploadForm.file || !uploadForm.name || !uploadForm.leaveTypeId) {
      toast.error('Please provide a name, select a leave type, and select a file')
      return
    }

    const formData = new FormData()
    formData.append('file', uploadForm.file)
    formData.append('name', uploadForm.name)
    formData.append('description', uploadForm.description)
    if (uploadForm.leaveTypeId) {
      formData.append('leaveTypeId', uploadForm.leaveTypeId)
    }

    try {
      const response = await fetch('/api/admin/templates/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        toast.success('Template uploaded successfully')
        setUploadDialogOpen(false)
        setUploadForm({
          name: "",
          description: "",
          leaveTypeId: "",
          file: null,
        })
        fetchTemplates()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to upload template')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload template')
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }

    try {
      const response = await fetch('/api/admin/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })

      if (response.ok) {
        toast.success('Template deleted successfully')
        fetchTemplates()
      } else {
        toast.error('Failed to delete template')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete template')
    }
  }

  const handleEditTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template)
    setEditForm({
      name: template.name,
      description: template.description || "",
      leaveTypeId: template.leaveTypeId || "",
      isActive: template.isActive,
    })
    setEditDialogOpen(true)
  }

  const handleUpdateTemplate = async () => {
    if (!selectedTemplate) return

    try {
      const payload = {
        ...editForm,
        leaveTypeId: editForm.leaveTypeId || null
      }
      
      const response = await fetch(`/api/admin/templates/${selectedTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast.success('Template updated successfully')
        setEditDialogOpen(false)
        fetchTemplates()
      } else {
        toast.error('Failed to update template')
      }
    } catch (error) {
      console.error('Update error:', error)
      toast.error('Failed to update template')
    }
  }

  const handleRegenerateAll = async () => {
    if (!confirm('This will regenerate all existing documents with the current templates and formatting. This may take a while. Continue?')) {
      return
    }

    try {
      toast.info('Starting document regeneration...')
      
      const response = await fetch('/api/admin/regenerate-documents', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Regenerated ${data.stats.successful} documents successfully. ${data.stats.failed} failed.`)
        
        if (data.errors && data.errors.length > 0) {
          console.error('Regeneration errors:', data.errors)
          // Show first few errors in toast
          const errorMessages = data.errors.slice(0, 3).map((e: any) => 
            `${e.requestNumber}: ${e.error}`
          ).join('\n')
          toast.error(`Some documents failed:\n${errorMessages}`)
        }
      } else {
        toast.error('Failed to regenerate documents')
      }
    } catch (error) {
      console.error('Regeneration error:', error)
      toast.error('Failed to regenerate documents')
    }
  }

  const handleToggleStatus = async (templateId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (response.ok) {
        toast.success(`Template ${currentStatus ? 'deactivated' : 'activated'} successfully`)
        fetchTemplates()
      } else {
        toast.error('Failed to update template status')
      }
    } catch (error) {
      console.error('Toggle status error:', error)
      toast.error('Failed to update template status')
    }
  }

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "ALL" || template.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return <div className="text-center py-8">Loading templates...</div>
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Document Templates</CardTitle>
              <CardDescription>
                Upload and manage document templates with field mapping for automatic filling
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleRegenerateAll}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate All
              </Button>
              <Button onClick={() => setUploadDialogOpen(true)} className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="leave_request">Leave Request</SelectItem>
                <SelectItem value="sick_leave">Sick Leave</SelectItem>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="remote_work">Remote Work</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Templates Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template Name</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-center">Fields</TableHead>
                  <TableHead className="text-center">Signatures</TableHead>
                  <TableHead className="text-center">Documents</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No templates found. Upload your first template to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          {template.description && (
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {template.leaveType ? (
                          <Badge variant="outline">
                            {template.leaveType.name}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">No type assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm uppercase">PDF</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {template._count.fieldMappings}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {template._count.signaturePlacements}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={template._count.generatedDocuments > 0 ? "default" : "secondary"}>
                          {template._count.generatedDocuments}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.isActive ? "default" : "secondary"}>
                          {template.isActive ? "Active" : "Inactive"}
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
                              onClick={() => handleEditTemplate(template)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Template
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedTemplate(template)
                                setFieldMapperOpen(true)
                              }}
                            >
                              <MapPin className="mr-2 h-4 w-4" />
                              Configure Fields
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(template.id, template.isActive)}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              {template.isActive ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteTemplate(template.id)}
                              disabled={template._count.generatedDocuments > 0}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Template
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

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document Template</DialogTitle>
            <DialogDescription>
              Upload a PDF file that will be used as a template for generating documents
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="e.g., Annual Leave Request Form"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                placeholder="Brief description of when this template should be used"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leaveType">Leave Type *</Label>
              <Select
                value={uploadForm.leaveTypeId}
                onValueChange={(value) => setUploadForm({ ...uploadForm, leaveTypeId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.length === 0 ? (
                    <SelectItem value="loading" disabled>Loading leave types...</SelectItem>
                  ) : (
                    leaveTypes.map((leaveType) => (
                      <SelectItem key={leaveType.id} value={leaveType.id}>
                        {leaveType.name} ({leaveType.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Select which leave type this template is for
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Document File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    if (file.type !== 'application/pdf') {
                      toast.error('Please upload a PDF file')
                      e.target.value = ''
                      return
                    }
                    setUploadForm({ ...uploadForm, file })
                  }
                }}
              />
              <p className="text-sm text-muted-foreground">
                Accepted format: PDF only (Max size: 10MB)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleFileUpload}>
              Upload Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update template information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Template Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="e.g., Annual Leave Request Form"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Brief description of when this template should be used"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-leaveType">Leave Type *</Label>
              <Select
                value={editForm.leaveTypeId}
                onValueChange={(value) => setEditForm({ ...editForm, leaveTypeId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.length === 0 ? (
                    <SelectItem value="loading" disabled>Loading leave types...</SelectItem>
                  ) : (
                    leaveTypes.map((leaveType) => (
                      <SelectItem key={leaveType.id} value={leaveType.id}>
                        {leaveType.name} ({leaveType.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Select which leave type this template is for
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-active"
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
              />
              <Label htmlFor="edit-active">Active (Template can be used)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTemplate}>
              Update Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Mapper Dialog */}
      <FieldMapperDialog
        open={fieldMapperOpen}
        onOpenChange={setFieldMapperOpen}
        template={selectedTemplate}
        onSave={() => {
          fetchTemplates()
          setFieldMapperOpen(false)
        }}
      />
    </>
  )
}