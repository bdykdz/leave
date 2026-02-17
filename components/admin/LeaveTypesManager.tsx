"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
  Calendar,
  Plus,
  Edit,
  FileText,
  Shield,
  AlertCircle,
  Trash2,
  Filter,
} from "lucide-react"
import { toast } from "sonner"

type LeaveTypeCategory = 'STANDARD' | 'PERSONAL' | 'PROVISIONAL'

interface LeaveType {
  id: string
  name: string
  code: string
  daysAllowed: number
  carryForward: boolean
  maxCarryForward: number | null
  requiresApproval: boolean
  requiresDocument: boolean
  description: string | null
  isSpecialLeave: boolean
  requiresHRVerification: boolean
  documentTypes: string[]
  isActive: boolean
  maxDaysPerRequest: number | null
  category: LeaveTypeCategory
  dateRestriction: { type?: string; windowDays?: number } | null
  sortOrder: number
  isHROnly: boolean
}

const COMMON_DOCUMENT_TYPES = [
  'Medical Certificate',
  'Death Certificate',
  'Marriage Certificate',
  'Birth Certificate',
  'Hospital Discharge Summary',
  'Doctor\'s Note',
  'Legal Documents',
  'Travel Documents',
  'Other Supporting Documents',
]

const CATEGORY_LABELS: Record<LeaveTypeCategory, string> = {
  STANDARD: 'Standard',
  PERSONAL: 'Personal (Collective Contract)',
  PROVISIONAL: 'Provisional (Conditional)',
}

const CATEGORY_BADGE_VARIANT: Record<LeaveTypeCategory, 'default' | 'secondary' | 'outline'> = {
  STANDARD: 'default',
  PERSONAL: 'secondary',
  PROVISIONAL: 'outline',
}

export function LeaveTypesManager() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<LeaveTypeCategory | 'ALL'>('ALL')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    daysAllowed: 0,
    carryForward: false,
    maxCarryForward: 0,
    requiresApproval: true,
    requiresDocument: false,
    description: '',
    isSpecialLeave: false,
    requiresHRVerification: false,
    documentTypes: [] as string[],
    isActive: true,
    maxDaysPerRequest: null as number | null,
    category: 'STANDARD' as LeaveTypeCategory,
    dateRestriction: null as { type?: string; windowDays?: number } | null,
    sortOrder: 0,
    isHROnly: false,
  })

  useEffect(() => {
    fetchLeaveTypes()
  }, [])

  const fetchLeaveTypes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/leave-types')
      if (response.ok) {
        const data = await response.json()
        setLeaveTypes(data.leaveTypes)
      } else {
        toast.error('Failed to load leave types')
      }
    } catch (error) {
      console.error('Error fetching leave types:', error)
      toast.error('Failed to load leave types')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (leaveType: LeaveType) => {
    setSelectedLeaveType(leaveType)
    setFormData({
      name: leaveType.name,
      code: leaveType.code,
      daysAllowed: leaveType.daysAllowed,
      carryForward: leaveType.carryForward,
      maxCarryForward: leaveType.maxCarryForward || 0,
      requiresApproval: leaveType.requiresApproval,
      requiresDocument: leaveType.requiresDocument,
      description: leaveType.description || '',
      isSpecialLeave: leaveType.isSpecialLeave || false,
      requiresHRVerification: leaveType.requiresHRVerification || false,
      documentTypes: leaveType.documentTypes || [],
      isActive: leaveType.isActive,
      maxDaysPerRequest: leaveType.maxDaysPerRequest,
      category: leaveType.category || 'STANDARD',
      dateRestriction: leaveType.dateRestriction || null,
      sortOrder: leaveType.sortOrder || 0,
      isHROnly: leaveType.isHROnly || false,
    })
    setEditDialogOpen(true)
  }

  const handleCreate = () => {
    setSelectedLeaveType(null)
    setFormData({
      name: '',
      code: '',
      daysAllowed: 0,
      carryForward: false,
      maxCarryForward: 0,
      requiresApproval: true,
      requiresDocument: false,
      description: '',
      isSpecialLeave: false,
      requiresHRVerification: false,
      documentTypes: [],
      isActive: true,
      maxDaysPerRequest: null,
      category: 'STANDARD',
      dateRestriction: null,
      sortOrder: 0,
      isHROnly: false,
    })
    setEditDialogOpen(true)
  }

  const handleSubmit = async () => {
    // Client-side validation
    if (!formData.name.trim()) {
      toast.error('Leave type name is required')
      return
    }
    if (!formData.code.trim()) {
      toast.error('Leave type code is required')
      return
    }
    if (formData.daysAllowed < 0) {
      toast.error('Days allowed cannot be negative')
      return
    }

    try {
      const url = selectedLeaveType
        ? `/api/admin/leave-types/${selectedLeaveType.id}`
        : '/api/admin/leave-types'

      const method = selectedLeaveType ? 'PATCH' : 'POST'

      const payload: any = {
        name: formData.name,
        code: formData.code,
        daysAllowed: formData.daysAllowed.toString(),
        carryForward: formData.carryForward,
        maxCarryForward: formData.carryForward ? formData.maxCarryForward : null,
        requiresApproval: formData.requiresApproval,
        requiresDocument: formData.requiresDocument,
        description: formData.description || '',
        isSpecialLeave: formData.isSpecialLeave || false,
        requiresHRVerification: formData.requiresHRVerification || false,
        documentTypes: formData.documentTypes || [],
        maxDaysPerRequest: formData.maxDaysPerRequest || null,
        category: formData.category,
        dateRestriction: formData.dateRestriction,
        sortOrder: formData.sortOrder,
        isHROnly: formData.isHROnly,
      }

      // Only include isActive for updates
      if (selectedLeaveType) {
        payload.isActive = formData.isActive
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast.success(selectedLeaveType ? 'Leave type updated' : 'Leave type created')
        setEditDialogOpen(false)
        fetchLeaveTypes()
      } else {
        const data = await response.json()
        console.error('Save failed:', data)
        toast.error(data.details || data.error || 'Failed to save leave type')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save leave type')
    }
  }

  const toggleDocumentType = (docType: string) => {
    setFormData(prev => ({
      ...prev,
      documentTypes: prev.documentTypes.includes(docType)
        ? prev.documentTypes.filter(t => t !== docType)
        : [...prev.documentTypes, docType]
    }))
  }

  const handleDelete = async (leaveType: LeaveType) => {
    if (!confirm(`Are you sure you want to delete "${leaveType.name}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/leave-types/${leaveType.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Leave type deleted successfully')
        fetchLeaveTypes()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete leave type')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete leave type')
    }
  }

  const filteredLeaveTypes = categoryFilter === 'ALL'
    ? leaveTypes
    : leaveTypes.filter(lt => lt.category === categoryFilter)

  if (loading) {
    return <div className="text-center py-8">Loading leave types...</div>
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Leave Types Configuration
              </CardTitle>
              <CardDescription>
                Manage leave types, categories, and special leave requirements
              </CardDescription>
            </div>
            <Button onClick={handleCreate} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Leave Type
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Category Filter */}
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1">
              {(['ALL', 'STANDARD', 'PERSONAL', 'PROVISIONAL'] as const).map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat === 'ALL' ? 'All' : CATEGORY_LABELS[cat]}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead className="text-center">Carry Forward</TableHead>
                  <TableHead className="text-center">Documents</TableHead>
                  <TableHead className="text-center">HR Verification</TableHead>
                  <TableHead className="text-center">HR Only</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeaveTypes.map((leaveType) => (
                  <TableRow key={leaveType.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{leaveType.name}</p>
                        {leaveType.description && (
                          <p className="text-sm text-muted-foreground">{leaveType.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{leaveType.code}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={CATEGORY_BADGE_VARIANT[leaveType.category] || 'default'}>
                        {CATEGORY_LABELS[leaveType.category] || leaveType.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {leaveType.daysAllowed}
                    </TableCell>
                    <TableCell className="text-center">
                      {leaveType.carryForward ? (
                        <Badge variant="secondary">Max {leaveType.maxCarryForward}</Badge>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {leaveType.requiresDocument ? (
                        <FileText className="h-4 w-4 mx-auto text-blue-600" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {leaveType.requiresHRVerification ? (
                        <Badge variant="default" className="text-xs">Required</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {leaveType.isHROnly ? (
                        <Badge variant="destructive" className="text-xs">HR Only</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={leaveType.isActive ? "default" : "secondary"}>
                        {leaveType.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(leaveType)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(leaveType)}
                          disabled={!leaveType.isActive}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900 mb-1">Special Leave Workflow</p>
                <p className="text-amber-800">
                  When a leave type is marked as "Special Leave" with HR Verification:
                </p>
                <ul className="mt-2 space-y-1 text-amber-800 ml-4 list-disc">
                  <li>Employee/Manager/Director submits request with required documents</li>
                  <li>Request goes directly to HR for document verification</li>
                  <li>HR reviews and verifies the documents privately</li>
                  <li>After HR approval, request follows normal hierarchy (manager → director)</li>
                  <li>Managers see "HR Verified" instead of sensitive documents</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedLeaveType ? 'Edit Leave Type' : 'Create Leave Type'}
            </DialogTitle>
            <DialogDescription>
              Configure leave type settings and requirements
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-medium">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Leave Type Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Annual Leave"
                  />
                </div>
                <div>
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., AL"
                    maxLength={10}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this leave type"
                  rows={2}
                />
              </div>
            </div>

            {/* Classification */}
            <div className="space-y-4">
              <h3 className="font-medium">Classification</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: LeaveTypeCategory) => setFormData({
                      ...formData,
                      category: value,
                      // Reset date restriction when switching away from PROVISIONAL
                      dateRestriction: value !== 'PROVISIONAL' ? null : formData.dateRestriction,
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="PERSONAL">Personal (Collective Contract)</SelectItem>
                      <SelectItem value="PROVISIONAL">Provisional (Conditional)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.category === 'STANDARD' && 'Normal leave, sick leave'}
                    {formData.category === 'PERSONAL' && 'Guaranteed by collective contract: marriage, bereavement, etc.'}
                    {formData.category === 'PROVISIONAL' && 'Conditional leave triggered by events: blood donation, birthday'}
                  </p>
                </div>
                <div>
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lower numbers appear first within category
                  </p>
                </div>
              </div>

              {/* Date Restriction (only for PROVISIONAL) */}
              {formData.category === 'PROVISIONAL' && (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <Label>Date Restriction</Label>
                  <Select
                    value={formData.dateRestriction?.type || 'NONE'}
                    onValueChange={(value) => {
                      if (value === 'NONE') {
                        setFormData({ ...formData, dateRestriction: null })
                      } else if (value === 'BIRTHDAY_WINDOW') {
                        setFormData({
                          ...formData,
                          dateRestriction: { type: 'BIRTHDAY_WINDOW', windowDays: 30 },
                        })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None (requires proof only)</SelectItem>
                      <SelectItem value="BIRTHDAY_WINDOW">Birthday Window</SelectItem>
                    </SelectContent>
                  </Select>

                  {formData.dateRestriction?.type === 'BIRTHDAY_WINDOW' && (
                    <div>
                      <Label htmlFor="windowDays">Window (days around birthday)</Label>
                      <Input
                        id="windowDays"
                        type="number"
                        value={formData.dateRestriction.windowDays || 30}
                        onChange={(e) => setFormData({
                          ...formData,
                          dateRestriction: {
                            ...formData.dateRestriction!,
                            windowDays: parseInt(e.target.value) || 30,
                          },
                        })}
                        min="1"
                        max="180"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Employee must take this leave within this many days of their birthday
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Leave Allowance */}
            <div className="space-y-4">
              <h3 className="font-medium">Leave Allowance</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="daysAllowed">Days Allowed Per Year</Label>
                  <Input
                    id="daysAllowed"
                    type="number"
                    value={formData.daysAllowed}
                    onChange={(e) => setFormData({ ...formData, daysAllowed: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="carryForward"
                      checked={formData.carryForward}
                      onCheckedChange={(checked) => setFormData({ ...formData, carryForward: checked })}
                    />
                    <Label htmlFor="carryForward">Allow Carry Forward</Label>
                  </div>
                  {formData.carryForward && (
                    <Input
                      type="number"
                      value={formData.maxCarryForward}
                      onChange={(e) => setFormData({ ...formData, maxCarryForward: parseInt(e.target.value) || 0 })}
                      placeholder="Max days to carry"
                      min="0"
                    />
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="maxDaysPerRequest">Maximum Days Per Request (Optional)</Label>
                <Input
                  id="maxDaysPerRequest"
                  type="number"
                  value={formData.maxDaysPerRequest || ''}
                  onChange={(e) => setFormData({ ...formData, maxDaysPerRequest: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="No limit"
                  min="1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank for no limit, or set maximum days allowed in a single request
                </p>
              </div>
            </div>

            {/* Requirements */}
            <div className="space-y-4">
              <h3 className="font-medium">Requirements</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requiresApproval"
                    checked={formData.requiresApproval}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresApproval: checked })}
                  />
                  <Label htmlFor="requiresApproval">Requires Approval</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="requiresDocument"
                    checked={formData.requiresDocument}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresDocument: checked })}
                  />
                  <Label htmlFor="requiresDocument">Requires Supporting Documents</Label>
                </div>

                {selectedLeaveType && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                    <Label htmlFor="isActive">Active (Users can request this leave type)</Label>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isHROnly"
                    checked={formData.isHROnly}
                    onCheckedChange={(checked) => setFormData({ ...formData, isHROnly: checked })}
                  />
                  <Label htmlFor="isHROnly">HR Only (Hidden from employee self-service)</Label>
                </div>
                {formData.isHROnly && (
                  <p className="text-xs text-amber-600 ml-8">
                    Employees and managers cannot request this leave type. Only HR can record it manually.
                  </p>
                )}
              </div>
            </div>

            {/* Special Leave Configuration */}
            <div className="space-y-4">
              <h3 className="font-medium">Special Leave Configuration</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isSpecialLeave"
                    checked={formData.isSpecialLeave}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      isSpecialLeave: checked,
                      requiresHRVerification: checked, // Auto-enable HR verification
                      requiresDocument: checked, // Auto-enable document requirement
                    })}
                  />
                  <Label htmlFor="isSpecialLeave">Mark as Special Leave</Label>
                </div>

                {formData.isSpecialLeave && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="requiresHRVerification"
                        checked={formData.requiresHRVerification}
                        onCheckedChange={(checked) => setFormData({ ...formData, requiresHRVerification: checked })}
                        disabled // Always required for special leave
                      />
                      <Label htmlFor="requiresHRVerification">Requires HR Document Verification</Label>
                    </div>

                    <div>
                      <Label>Required Document Types</Label>
                      <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                        {COMMON_DOCUMENT_TYPES.map((docType) => (
                          <div key={docType} className="flex items-center space-x-2">
                            <Checkbox
                              id={docType}
                              checked={formData.documentTypes.includes(docType)}
                              onCheckedChange={() => toggleDocumentType(docType)}
                            />
                            <Label htmlFor={docType} className="text-sm font-normal cursor-pointer">
                              {docType}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {selectedLeaveType ? 'Update' : 'Create'} Leave Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
