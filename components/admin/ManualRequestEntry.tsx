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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Calendar,
  Plus,
  Save,
  AlertCircle,
  FileText,
  Home,
  CheckCircle,
  User,
} from "lucide-react"
import { toast } from "sonner"
import { format, differenceInDays, parseISO, addDays } from "date-fns"

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  department: string
  role: string
}

interface LeaveType {
  id: string
  name: string
  code: string
  maxDaysPerYear: number
  requiresDocument: boolean
}

export function ManualRequestEntry() {
  const [users, setUsers] = useState<User[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  
  // Leave Request Form
  const [leaveForm, setLeaveForm] = useState({
    userId: "",
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
    status: "APPROVED",
    totalDays: 0,
    isHalfDay: false,
    supportingDocuments: [] as string[],
    hrNotes: "",
  })

  // WFH Request Form
  const [wfhForm, setWfhForm] = useState({
    userId: "",
    startDate: "",
    endDate: "",
    reason: "",
    location: "",
    status: "APPROVED",
    contactNumber: "",
    hrNotes: "",
  })

  useEffect(() => {
    fetchUsers()
    fetchLeaveTypes()
  }, [])

  useEffect(() => {
    // Calculate total days for leave request
    if (leaveForm.startDate && leaveForm.endDate) {
      const start = parseISO(leaveForm.startDate)
      const end = parseISO(leaveForm.endDate)
      let days = differenceInDays(end, start) + 1
      if (leaveForm.isHalfDay) days = 0.5
      setLeaveForm(prev => ({ ...prev, totalDays: days }))
    }
  }, [leaveForm.startDate, leaveForm.endDate, leaveForm.isHalfDay])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      toast.error('Failed to load users')
    }
  }

  const fetchLeaveTypes = async () => {
    try {
      const response = await fetch('/api/admin/leave-types')
      if (response.ok) {
        const data = await response.json()
        setLeaveTypes(data.leaveTypes || [])
      }
    } catch (error) {
      console.error('Failed to load leave types')
    }
  }

  const handleLeaveSubmit = async () => {
    if (!leaveForm.userId || !leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/manual-leave-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leaveForm,
          bypassApproval: true,
          createdByAdmin: true,
        })
      })

      if (response.ok) {
        toast.success('Leave request created successfully')
        // Reset form
        setLeaveForm({
          userId: "",
          leaveTypeId: "",
          startDate: "",
          endDate: "",
          reason: "",
          status: "APPROVED",
          totalDays: 0,
          isHalfDay: false,
          supportingDocuments: [],
          hrNotes: "",
        })
        setSelectedUser(null)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to create leave request')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleWFHSubmit = async () => {
    if (!wfhForm.userId || !wfhForm.startDate || !wfhForm.endDate) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/manual-wfh-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...wfhForm,
          bypassApproval: true,
          createdByAdmin: true,
        })
      })

      if (response.ok) {
        toast.success('Work from home request created successfully')
        // Reset form
        setWfhForm({
          userId: "",
          startDate: "",
          endDate: "",
          reason: "",
          location: "",
          status: "APPROVED",
          contactNumber: "",
          hrNotes: "",
        })
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to create WFH request')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const selectedLeaveType = leaveTypes.find(lt => lt.id === leaveForm.leaveTypeId)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Manual Request Entry
              </CardTitle>
              <CardDescription>
                Create leave or work from home requests directly without approval flow
              </CardDescription>
            </div>
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Admin Only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Manual entries bypass the normal approval workflow. 
              These requests will be immediately marked as approved and will affect the user's leave balance.
              Use this feature only for legitimate administrative purposes.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="leave" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="leave" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Leave Request
              </TabsTrigger>
              <TabsTrigger value="wfh" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Work From Home
              </TabsTrigger>
            </TabsList>

            {/* Leave Request Tab */}
            <TabsContent value="leave" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Select Employee *</Label>
                  <Select 
                    value={leaveForm.userId} 
                    onValueChange={(value) => {
                      setLeaveForm({...leaveForm, userId: value})
                      const user = users.find(u => u.id === value)
                      setSelectedUser(user || null)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} - {user.department} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedUser && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</span>
                        <Badge variant="outline">{selectedUser.role}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedUser.department} • {selectedUser.email}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Leave Type *</Label>
                  <Select 
                    value={leaveForm.leaveTypeId} 
                    onValueChange={(value) => setLeaveForm({...leaveForm, leaveTypeId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} ({type.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLeaveType?.requiresDocument && (
                    <p className="text-xs text-amber-600 mt-1">
                      This leave type normally requires supporting documents
                    </p>
                  )}
                </div>

                <div>
                  <Label>Status *</Label>
                  <Select 
                    value={leaveForm.status} 
                    onValueChange={(value) => setLeaveForm({...leaveForm, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Start Date *</Label>
                  <Input 
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({...leaveForm, startDate: e.target.value})}
                  />
                </div>

                <div>
                  <Label>End Date *</Label>
                  <Input 
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({...leaveForm, endDate: e.target.value})}
                    min={leaveForm.startDate}
                  />
                </div>

                <div>
                  <Label>Total Days</Label>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="number"
                      value={leaveForm.totalDays}
                      readOnly
                      className="bg-gray-50"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={leaveForm.isHalfDay}
                        onChange={(e) => setLeaveForm({...leaveForm, isHalfDay: e.target.checked})}
                      />
                      Half Day
                    </label>
                  </div>
                </div>

                <div>
                  <Label>Supporting Documents (URLs)</Label>
                  <Input 
                    placeholder="Document URL (optional)"
                    onBlur={(e) => {
                      if (e.target.value) {
                        setLeaveForm({
                          ...leaveForm, 
                          supportingDocuments: [...leaveForm.supportingDocuments, e.target.value]
                        })
                        e.target.value = ""
                      }
                    }}
                  />
                  {leaveForm.supportingDocuments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {leaveForm.supportingDocuments.map((doc, idx) => (
                        <div key={idx} className="text-xs text-blue-600">{doc}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  <Label>Reason for Leave</Label>
                  <Textarea
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})}
                    placeholder="Enter reason for leave"
                    rows={3}
                  />
                </div>

                <div className="col-span-2">
                  <Label>HR/Admin Notes</Label>
                  <Textarea
                    value={leaveForm.hrNotes}
                    onChange={(e) => setLeaveForm({...leaveForm, hrNotes: e.target.value})}
                    placeholder="Internal notes (not visible to employee)"
                    rows={2}
                    className="bg-yellow-50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setLeaveForm({
                      userId: "",
                      leaveTypeId: "",
                      startDate: "",
                      endDate: "",
                      reason: "",
                      status: "APPROVED",
                      totalDays: 0,
                      isHalfDay: false,
                      supportingDocuments: [],
                      hrNotes: "",
                    })
                    setSelectedUser(null)
                  }}
                >
                  Clear Form
                </Button>
                <Button 
                  onClick={handleLeaveSubmit}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Create Leave Request
                </Button>
              </div>
            </TabsContent>

            {/* Work From Home Tab */}
            <TabsContent value="wfh" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Select Employee *</Label>
                  <Select 
                    value={wfhForm.userId} 
                    onValueChange={(value) => setWfhForm({...wfhForm, userId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} - {user.department} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Start Date *</Label>
                  <Input 
                    type="date"
                    value={wfhForm.startDate}
                    onChange={(e) => setWfhForm({...wfhForm, startDate: e.target.value})}
                  />
                </div>

                <div>
                  <Label>End Date *</Label>
                  <Input 
                    type="date"
                    value={wfhForm.endDate}
                    onChange={(e) => setWfhForm({...wfhForm, endDate: e.target.value})}
                    min={wfhForm.startDate}
                  />
                </div>

                <div>
                  <Label>Work Location</Label>
                  <Input 
                    value={wfhForm.location}
                    onChange={(e) => setWfhForm({...wfhForm, location: e.target.value})}
                    placeholder="e.g., Home, Coffee shop"
                  />
                </div>

                <div>
                  <Label>Contact Number</Label>
                  <Input 
                    value={wfhForm.contactNumber}
                    onChange={(e) => setWfhForm({...wfhForm, contactNumber: e.target.value})}
                    placeholder="Phone number during WFH"
                  />
                </div>

                <div>
                  <Label>Status *</Label>
                  <Select 
                    value={wfhForm.status} 
                    onValueChange={(value) => setWfhForm({...wfhForm, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Reason for Work From Home</Label>
                  <Textarea
                    value={wfhForm.reason}
                    onChange={(e) => setWfhForm({...wfhForm, reason: e.target.value})}
                    placeholder="Enter reason for work from home"
                    rows={3}
                  />
                </div>

                <div className="col-span-2">
                  <Label>HR/Admin Notes</Label>
                  <Textarea
                    value={wfhForm.hrNotes}
                    onChange={(e) => setWfhForm({...wfhForm, hrNotes: e.target.value})}
                    placeholder="Internal notes (not visible to employee)"
                    rows={2}
                    className="bg-yellow-50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setWfhForm({
                      userId: "",
                      startDate: "",
                      endDate: "",
                      reason: "",
                      location: "",
                      status: "APPROVED",
                      contactNumber: "",
                      hrNotes: "",
                    })
                  }}
                >
                  Clear Form
                </Button>
                <Button 
                  onClick={handleWFHSubmit}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Create WFH Request
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}