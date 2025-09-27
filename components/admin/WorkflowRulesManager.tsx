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
  GitBranch, 
  Plus, 
  Edit, 
  Trash2, 
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle,
  Users,
  Calendar,
  Building,
} from "lucide-react"
import { toast } from "sonner"

interface WorkflowRule {
  id: string
  name: string
  description: string | null
  conditions: any
  approvalLevels: any[]
  priority: number
  isActive: boolean
  skipDuplicateSignatures: boolean
  autoApproveConditions: any | null
}

export function WorkflowRulesManager() {
  const [rules, setRules] = useState<WorkflowRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<WorkflowRule | null>(null)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    conditions: {
      userRole: [] as string[],
      leaveType: [] as string[],
      daysGreaterThan: '',
      daysLessThan: '',
      department: [] as string[],
    },
    approvalLevels: [] as any[],
    priority: 0,
    skipDuplicateSignatures: true,
    autoApproveConditions: null,
  })

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/workflow-rules')
      if (response.ok) {
        const data = await response.json()
        setRules(data.rules)
      } else {
        toast.error('Failed to load workflow rules')
      }
    } catch (error) {
      console.error('Error fetching rules:', error)
      toast.error('Failed to load workflow rules')
    } finally {
      setLoading(false)
    }
  }

  const handlePriorityChange = async (ruleId: string, direction: 'up' | 'down') => {
    try {
      const response = await fetch(`/api/admin/workflow-rules/${ruleId}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      })

      if (response.ok) {
        toast.success('Priority updated')
        fetchRules()
      } else {
        toast.error('Failed to update priority')
      }
    } catch (error) {
      console.error('Priority update error:', error)
      toast.error('Failed to update priority')
    }
  }

  const handleToggleStatus = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/workflow-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (response.ok) {
        toast.success(`Rule ${isActive ? 'deactivated' : 'activated'}`)
        fetchRules()
      } else {
        toast.error('Failed to update rule status')
      }
    } catch (error) {
      console.error('Toggle status error:', error)
      toast.error('Failed to update rule status')
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this workflow rule?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/workflow-rules/${ruleId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Rule deleted successfully')
        fetchRules()
      } else {
        toast.error('Failed to delete rule')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete rule')
    }
  }

  const handleOpenDialog = (rule?: WorkflowRule) => {
    if (rule) {
      // Edit mode
      setSelectedRule(rule)
      setFormData({
        name: rule.name,
        description: rule.description || '',
        conditions: rule.conditions,
        approvalLevels: rule.approvalLevels,
        priority: rule.priority,
        skipDuplicateSignatures: rule.skipDuplicateSignatures,
        autoApproveConditions: rule.autoApproveConditions,
      })
    } else {
      // Create mode
      setSelectedRule(null)
      setFormData({
        name: '',
        description: '',
        conditions: {
          userRole: [],
          leaveType: [],
          daysGreaterThan: '',
          daysLessThan: '',
          department: [],
        },
        approvalLevels: [],
        priority: 0,
        skipDuplicateSignatures: true,
        autoApproveConditions: null,
      })
    }
    setEditDialogOpen(true)
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      
      // Validate form
      if (!formData.name.trim()) {
        toast.error('Rule name is required')
        return
      }
      
      if (formData.approvalLevels.length === 0) {
        toast.error('At least one approval level is required')
        return
      }

      // Clean up conditions
      const conditions = {
        ...formData.conditions,
        daysGreaterThan: formData.conditions.daysGreaterThan ? parseInt(formData.conditions.daysGreaterThan) : null,
        daysLessThan: formData.conditions.daysLessThan ? parseInt(formData.conditions.daysLessThan) : null,
      }

      const payload = {
        ...formData,
        conditions,
      }

      let response
      if (selectedRule) {
        // Update existing rule
        response = await fetch(`/api/admin/workflow-rules/${selectedRule.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        // Create new rule
        response = await fetch('/api/admin/workflow-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (response.ok) {
        toast.success(selectedRule ? 'Rule updated successfully' : 'Rule created successfully')
        setEditDialogOpen(false)
        fetchRules()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to save rule')
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Failed to save rule')
    } finally {
      setSubmitting(false)
    }
  }

  const addApprovalLevel = () => {
    setFormData(prev => ({
      ...prev,
      approvalLevels: [...prev.approvalLevels, { role: '', required: true }]
    }))
  }

  const removeApprovalLevel = (index: number) => {
    setFormData(prev => ({
      ...prev,
      approvalLevels: prev.approvalLevels.filter((_, i) => i !== index)
    }))
  }

  const updateApprovalLevel = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      approvalLevels: prev.approvalLevels.map((level, i) => 
        i === index ? { ...level, [field]: value } : level
      )
    }))
  }

  const formatConditions = (conditions: any): string => {
    const parts = []
    
    if (conditions.userRole?.length > 0) {
      parts.push(`Role: ${conditions.userRole.join(', ')}`)
    }
    if (conditions.leaveType?.length > 0) {
      parts.push(`Leave: ${conditions.leaveType.join(', ')}`)
    }
    if (conditions.daysGreaterThan) {
      parts.push(`Days > ${conditions.daysGreaterThan}`)
    }
    if (conditions.daysLessThan) {
      parts.push(`Days < ${conditions.daysLessThan}`)
    }
    if (conditions.department?.length > 0) {
      parts.push(`Dept: ${conditions.department.join(', ')}`)
    }
    
    return parts.join(' • ') || 'No conditions'
  }

  const formatApprovalLevels = (levels: any[]): React.ReactNode => {
    return (
      <div className="flex flex-wrap gap-1">
        {levels.map((level, index) => (
          <Badge
            key={index}
            variant={level.required ? 'default' : 'secondary'}
            className="text-xs"
          >
            {level.role}
            {!level.required && ' (opt)'}
          </Badge>
        ))}
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-8">Loading workflow rules...</div>
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Workflow Rules
              </CardTitle>
              <CardDescription>
                Define approval workflows based on user roles and request conditions
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Priority</TableHead>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Approval Levels</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No workflow rules defined. Add your first rule to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule, index) => (
                    <TableRow key={rule.id}>
                      <TableCell className="text-center font-medium">
                        {rule.priority}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          {rule.description && (
                            <p className="text-sm text-muted-foreground">{rule.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{formatConditions(rule.conditions)}</p>
                      </TableCell>
                      <TableCell>
                        {formatApprovalLevels(rule.approvalLevels)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePriorityChange(rule.id, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePriorityChange(rule.id, 'down')}
                            disabled={index === rules.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(rule.id, rule.isActive)}
                          >
                            {rule.isActive ? (
                              <XCircle className="h-4 w-4 text-orange-500" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 space-y-4">
            <div className="text-sm text-muted-foreground">
              <h4 className="font-medium mb-2">How Workflow Rules Work:</h4>
              <ul className="space-y-1 ml-4">
                <li>• Rules are evaluated in priority order (highest first)</li>
                <li>• The first matching rule determines the approval workflow</li>
                <li>• If no rules match, a default workflow is applied</li>
                <li>• Signatures are required for both approvals AND rejections</li>
                <li>• Each approver must sign the document regardless of their decision</li>
                <li>• Duplicate signatures are automatically skipped when the same person has multiple roles</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rule Editor Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRule ? 'Edit Workflow Rule' : 'Create Workflow Rule'}
            </DialogTitle>
            <DialogDescription>
              Define conditions and approval requirements for this workflow
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Basic Information */}
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Executive Leave Approval"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe when this rule should apply"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                placeholder="Higher numbers run first"
              />
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <Label>Conditions</Label>
              <div className="rounded-md border p-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">User Roles</Label>
                  <div className="flex flex-wrap gap-2">
                    {['EMPLOYEE', 'MANAGER', 'HR', 'EXECUTIVE'].map((role) => (
                      <Label key={role} className="flex items-center gap-2 font-normal">
                        <input
                          type="checkbox"
                          checked={formData.conditions.userRole.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                conditions: {
                                  ...prev.conditions,
                                  userRole: [...prev.conditions.userRole, role]
                                }
                              }))
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                conditions: {
                                  ...prev.conditions,
                                  userRole: prev.conditions.userRole.filter(r => r !== role)
                                }
                              }))
                            }
                          }}
                        />
                        {role}
                      </Label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Leave Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {['ANNUAL', 'SICK', 'COMPASSIONATE', 'MATERNITY', 'PATERNITY', 'UNPAID'].map((type) => (
                      <Label key={type} className="flex items-center gap-2 font-normal">
                        <input
                          type="checkbox"
                          checked={formData.conditions.leaveType.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                conditions: {
                                  ...prev.conditions,
                                  leaveType: [...prev.conditions.leaveType, type]
                                }
                              }))
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                conditions: {
                                  ...prev.conditions,
                                  leaveType: prev.conditions.leaveType.filter(t => t !== type)
                                }
                              }))
                            }
                          }}
                        />
                        {type}
                      </Label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Days Greater Than</Label>
                    <Input
                      type="number"
                      value={formData.conditions.daysGreaterThan}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        conditions: { ...prev.conditions, daysGreaterThan: e.target.value }
                      }))}
                      placeholder="e.g., 5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Days Less Than</Label>
                    <Input
                      type="number"
                      value={formData.conditions.daysLessThan}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        conditions: { ...prev.conditions, daysLessThan: e.target.value }
                      }))}
                      placeholder="e.g., 10"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Approval Levels */}
            <div className="space-y-2">
              <Label>Approval Levels * (Signatures Required)</Label>
              <p className="text-sm text-muted-foreground">
                All listed approvers must sign the document, whether they approve or reject the request.
              </p>
              <div className="space-y-2">
                {formData.approvalLevels.map((level, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-sm">Role</Label>
                      <Select
                        value={level.role}
                        onValueChange={(value) => updateApprovalLevel(index, 'role', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DIRECT_MANAGER">Direct Manager</SelectItem>
                          <SelectItem value="DEPARTMENT_HEAD">Department Head</SelectItem>
                          <SelectItem value="HR">HR</SelectItem>
                          <SelectItem value="EXECUTIVE">Executive</SelectItem>
                          <SelectItem value="CEO">CEO</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-normal">Required</Label>
                      <Switch
                        checked={level.required}
                        onCheckedChange={(checked) => updateApprovalLevel(index, 'required', checked)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeApprovalLevel(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addApprovalLevel}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Approval Level
                </Button>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.skipDuplicateSignatures}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, skipDuplicateSignatures: checked }))}
              />
              <Label className="font-normal">Skip duplicate signatures (when same person has multiple roles)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : (selectedRule ? 'Update Rule' : 'Create Rule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}