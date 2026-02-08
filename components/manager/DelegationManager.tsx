"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { 
  UserCheck,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle,
  Power,
  Users,
  Edit,
  Trash,
  Plus
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Delegation {
  id: string
  delegateId: string
  delegate: {
    id: string
    firstName: string
    lastName: string
    email: string
    department: string
    position: string
  }
  startDate: string
  endDate?: string
  reason?: string
  isActive: boolean
  createdAt: string
}

interface Manager {
  id: string
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  role: string
}

export function DelegationManager() {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDelegation, setEditingDelegation] = useState<Delegation | null>(null)
  
  // Form state
  const [selectedManagerId, setSelectedManagerId] = useState("")
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [reason, setReason] = useState("")
  const [isIndefinite, setIsIndefinite] = useState(false)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [delegationsRes, managersRes] = await Promise.all([
        fetch('/api/manager/delegations'),
        fetch('/api/manager/available-delegates')
      ])

      if (delegationsRes.ok) {
        const data = await delegationsRes.json()
        setDelegations(data.delegations || [])
      }

      if (managersRes.ok) {
        const data = await managersRes.json()
        setManagers(data.managers || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load delegation data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingDelegation(null)
    setSelectedManagerId("")
    setStartDate(new Date())
    setEndDate(undefined)
    setReason("")
    setIsIndefinite(false)
    setDialogOpen(true)
  }

  const handleEdit = (delegation: Delegation) => {
    setEditingDelegation(delegation)
    setSelectedManagerId(delegation.delegateId)
    setStartDate(new Date(delegation.startDate))
    setEndDate(delegation.endDate ? new Date(delegation.endDate) : undefined)
    setReason(delegation.reason || "")
    setIsIndefinite(!delegation.endDate)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selectedManagerId || !startDate) {
      toast.error('Please select a manager and start date')
      return
    }

    if (!isIndefinite && !endDate) {
      toast.error('Please select an end date or mark as indefinite')
      return
    }

    if (!isIndefinite && endDate && endDate < startDate) {
      toast.error('End date must be after start date')
      return
    }

    setProcessing(true)
    try {
      const method = editingDelegation ? 'PUT' : 'POST'
      const url = editingDelegation 
        ? `/api/manager/delegations/${editingDelegation.id}`
        : '/api/manager/delegations'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegateToId: selectedManagerId,
          startDate: startDate.toISOString(),
          endDate: isIndefinite ? null : endDate?.toISOString(),
          reason: reason || undefined
        })
      })

      if (response.ok) {
        toast.success(editingDelegation ? 'Delegation updated' : 'Delegation created')
        fetchData()
        setDialogOpen(false)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save delegation')
      }
    } catch (error) {
      console.error('Error saving delegation:', error)
      toast.error('Error saving delegation')
    } finally {
      setProcessing(false)
    }
  }

  const handleToggleActive = async (delegation: Delegation) => {
    try {
      const response = await fetch(`/api/manager/delegations/${delegation.id}/toggle`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.success(delegation.isActive ? 'Delegation deactivated' : 'Delegation activated')
        fetchData()
      } else {
        toast.error('Failed to toggle delegation')
      }
    } catch (error) {
      console.error('Error toggling delegation:', error)
      toast.error('Error toggling delegation')
    }
  }

  const handleDelete = async (delegationId: string) => {
    if (!confirm('Are you sure you want to delete this delegation?')) {
      return
    }

    try {
      const response = await fetch(`/api/manager/delegations/${delegationId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Delegation deleted')
        fetchData()
      } else {
        toast.error('Failed to delete delegation')
      }
    } catch (error) {
      console.error('Error deleting delegation:', error)
      toast.error('Error deleting delegation')
    }
  }

  const getActiveDelegation = () => {
    return delegations.find(d => d.isActive && new Date(d.startDate) <= new Date() && 
      (!d.endDate || new Date(d.endDate) >= new Date()))
  }

  const activeDelegation = getActiveDelegation()

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">Loading delegation settings...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Approval Delegation
              </CardTitle>
              <CardDescription>
                Delegate your approval authority when you're unavailable
              </CardDescription>
            </div>
            <Button onClick={handleCreate} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Delegation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeDelegation && (
            <Alert className="mb-6 border-blue-200 bg-blue-50">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Active Delegation:</strong> Your approval authority is currently delegated to{' '}
                <strong>{activeDelegation.delegate.firstName} {activeDelegation.delegate.lastName}</strong>
                {activeDelegation.endDate ? (
                  <> until {format(new Date(activeDelegation.endDate), 'MMM d, yyyy')}</>
                ) : (
                  <> (indefinite)</>
                )}
              </AlertDescription>
            </Alert>
          )}

          {delegations.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No delegations configured. Create a delegation to automatically forward approvals when you're away.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {delegations.map((delegation) => (
                <Card key={delegation.id} className={delegation.isActive ? 'border-blue-500' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={delegation.isActive}
                            onCheckedChange={() => handleToggleActive(delegation)}
                          />
                          <Power className={`h-4 w-4 ${delegation.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {delegation.delegate.firstName} {delegation.delegate.lastName}
                            </p>
                            <Badge variant="outline">{delegation.delegate.department}</Badge>
                            {delegation.isActive && (
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{delegation.delegate.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <CalendarIcon className="h-3 w-3 text-gray-500" />
                            <p className="text-xs text-gray-500">
                              {format(new Date(delegation.startDate), 'MMM d, yyyy')}
                              {delegation.endDate ? (
                                <> - {format(new Date(delegation.endDate), 'MMM d, yyyy')}</>
                              ) : (
                                <> - Indefinite</>
                              )}
                            </p>
                          </div>
                          {delegation.reason && (
                            <p className="text-xs text-gray-500 mt-1">Reason: {delegation.reason}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(delegation)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(delegation.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingDelegation ? 'Edit Delegation' : 'Create Delegation'}
            </DialogTitle>
            <DialogDescription>
              Select a manager to delegate your approval authority to
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="manager">Delegate To</Label>
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      <div className="flex flex-col">
                        <span>{manager.firstName} {manager.lastName}</span>
                        <span className="text-xs text-gray-500">
                          {manager.department} - {manager.position}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    // In a real app, you'd show a calendar picker here
                    const tomorrow = new Date()
                    tomorrow.setDate(tomorrow.getDate() + 1)
                    setStartDate(tomorrow)
                  }}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'MMM d, yyyy') : 'Select date'}
                </Button>
              </div>

              <div>
                <Label>End Date</Label>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={isIndefinite}
                  onClick={() => {
                    // In a real app, you'd show a calendar picker here
                    const nextWeek = new Date()
                    nextWeek.setDate(nextWeek.getDate() + 7)
                    setEndDate(nextWeek)
                  }}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {isIndefinite ? 'Indefinite' : endDate ? format(endDate, 'MMM d, yyyy') : 'Select date'}
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="indefinite"
                checked={isIndefinite}
                onCheckedChange={setIsIndefinite}
              />
              <Label htmlFor="indefinite">Indefinite delegation</Label>
            </div>

            <div>
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Annual leave, Business trip"
                rows={2}
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The selected manager will receive all your pending approvals during the delegation period.
                You can deactivate the delegation at any time.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={processing || !selectedManagerId || !startDate}
            >
              {processing ? 'Saving...' : editingDelegation ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}