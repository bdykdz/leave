"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { 
  AlertTriangle,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Overlap {
  type: 'LEAVE_LEAVE' | 'WFH_WFH' | 'LEAVE_WFH'
  user: {
    id: string
    name: string
    email: string
  }
  request1: {
    id: string
    requestNumber: string
    startDate: string
    endDate: string
    status: string
    type: 'LEAVE' | 'WFH'
  }
  request2: {
    id: string
    requestNumber: string
    startDate: string
    endDate: string
    status: string
    type: 'LEAVE' | 'WFH'
  }
}

export function OverlapManager() {
  const [overlaps, setOverlaps] = useState<Overlap[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({
    total: 0,
    leaveToLeave: 0,
    wfhToWfh: 0,
    leaveToWfh: 0,
    affectedUsers: 0
  })
  const [selectedOverlap, setSelectedOverlap] = useState<Overlap | null>(null)
  const [fixDialogOpen, setFixDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<'cancel1' | 'cancel2' | null>(null)

  useEffect(() => {
    checkOverlaps()
  }, [])

  const checkOverlaps = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/check-overlaps')
      if (response.ok) {
        const data = await response.json()
        setOverlaps(data.overlaps || [])
        setSummary(data.summary || {
          total: 0,
          leaveToLeave: 0,
          wfhToWfh: 0,
          leaveToWfh: 0,
          affectedUsers: 0
        })
      } else {
        toast.error('Failed to check overlaps')
      }
    } catch (error) {
      console.error('Error checking overlaps:', error)
      toast.error('Error checking overlaps')
    } finally {
      setLoading(false)
    }
  }

  const handleFixOverlap = (overlap: Overlap) => {
    setSelectedOverlap(overlap)
    setFixDialogOpen(true)
    setActionType(null)
  }

  const cancelRequest = async (requestId: string, type: 'LEAVE' | 'WFH') => {
    try {
      const endpoint = type === 'LEAVE' 
        ? `/api/leave-requests/${requestId}/cancel`
        : `/api/wfh-requests/${requestId}/cancel`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reason: 'Cancelled by admin due to date conflict',
          byAdmin: true 
        })
      })

      if (response.ok) {
        toast.success(`${type} request cancelled successfully`)
        checkOverlaps() // Refresh the list
        setFixDialogOpen(false)
      } else {
        const error = await response.json()
        toast.error(error.message || `Failed to cancel ${type} request`)
      }
    } catch (error) {
      console.error('Error cancelling request:', error)
      toast.error('Error cancelling request')
    }
  }

  const getOverlapBadge = (type: string) => {
    switch(type) {
      case 'LEAVE_WFH':
        return <Badge variant="destructive">Critical: Leave + WFH</Badge>
      case 'LEAVE_LEAVE':
        return <Badge variant="secondary">Leave Overlap</Badge>
      case 'WFH_WFH':
        return <Badge variant="outline">WFH Overlap</Badge>
      default:
        return <Badge>{type}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Group overlaps by user
  const overlapsByUser = overlaps.reduce((acc, overlap) => {
    const userId = overlap.user.id
    if (!acc[userId]) {
      acc[userId] = {
        user: overlap.user,
        overlaps: []
      }
    }
    acc[userId].overlaps.push(overlap)
    return acc
  }, {} as Record<string, { user: any, overlaps: Overlap[] }>)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Overlapping Requests Manager
              </CardTitle>
              <CardDescription>
                Detect and resolve conflicting leave and WFH requests
              </CardDescription>
            </div>
            <Button onClick={checkOverlaps} disabled={loading} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
                  <div className="text-sm text-gray-600">Total Overlaps</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{summary.leaveToWfh}</div>
                  <div className="text-sm text-gray-600">Leave + WFH</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{summary.leaveToLeave}</div>
                  <div className="text-sm text-gray-600">Leave Overlaps</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{summary.wfhToWfh}</div>
                  <div className="text-sm text-gray-600">WFH Overlaps</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{summary.affectedUsers}</div>
                  <div className="text-sm text-gray-600">Affected Users</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {summary.leaveToWfh > 0 && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Critical Issues Found:</strong> {summary.leaveToWfh} users have both leave and work from home requests for the same dates. 
                These must be resolved immediately as they affect attendance and payroll records.
              </AlertDescription>
            </Alert>
          )}

          {/* Overlaps by User */}
          {loading ? (
            <div className="text-center py-8">Checking for overlaps...</div>
          ) : Object.keys(overlapsByUser).length === 0 ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                No overlapping requests found. All leave and WFH requests have valid, non-conflicting dates.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {Object.values(overlapsByUser).map(({ user, overlaps }) => (
                <Card key={user.id} className="border-l-4 border-l-amber-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{user.name}</h3>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <Badge variant="secondary">{overlaps.length} conflicts</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {overlaps.map((overlap, idx) => (
                        <div key={idx} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            {getOverlapBadge(overlap.type)}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFixOverlap(overlap)}
                            >
                              Fix Conflict
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="space-y-1">
                              <div className="font-medium">Request 1: {overlap.request1.type}</div>
                              <div className="text-gray-600">#{overlap.request1.requestNumber}</div>
                              <div className="text-gray-600">
                                {format(new Date(overlap.request1.startDate), 'MMM d, yyyy')} - 
                                {format(new Date(overlap.request1.endDate), 'MMM d, yyyy')}
                              </div>
                              {getStatusBadge(overlap.request1.status)}
                            </div>
                            
                            <div className="space-y-1">
                              <div className="font-medium">Request 2: {overlap.request2.type}</div>
                              <div className="text-gray-600">#{overlap.request2.requestNumber}</div>
                              <div className="text-gray-600">
                                {format(new Date(overlap.request2.startDate), 'MMM d, yyyy')} - 
                                {format(new Date(overlap.request2.endDate), 'MMM d, yyyy')}
                              </div>
                              {getStatusBadge(overlap.request2.status)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fix Conflict Dialog */}
      <Dialog open={fixDialogOpen} onOpenChange={setFixDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resolve Date Conflict</DialogTitle>
            <DialogDescription>
              Choose which request to keep and which to cancel
            </DialogDescription>
          </DialogHeader>
          
          {selectedOverlap && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{selectedOverlap.user.name}</strong> has conflicting requests. 
                  {selectedOverlap.type === 'LEAVE_WFH' && 
                    " This is a critical conflict - the employee cannot be on leave and working from home simultaneously."
                  }
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <Card className={actionType === 'cancel2' ? 'border-green-500' : actionType === 'cancel1' ? 'border-red-500' : ''}>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      {selectedOverlap.request1.type} Request
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p><strong>Number:</strong> {selectedOverlap.request1.requestNumber}</p>
                      <p><strong>Dates:</strong> {format(new Date(selectedOverlap.request1.startDate), 'MMM d, yyyy')} - {format(new Date(selectedOverlap.request1.endDate), 'MMM d, yyyy')}</p>
                      <p><strong>Status:</strong> {getStatusBadge(selectedOverlap.request1.status)}</p>
                    </div>
                    <Button
                      variant={actionType === 'cancel2' ? "default" : "destructive"}
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => setActionType('cancel1')}
                    >
                      {actionType === 'cancel2' ? 'Keep This' : 'Cancel This'}
                    </Button>
                  </CardContent>
                </Card>

                <Card className={actionType === 'cancel1' ? 'border-green-500' : actionType === 'cancel2' ? 'border-red-500' : ''}>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      {selectedOverlap.request2.type} Request
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p><strong>Number:</strong> {selectedOverlap.request2.requestNumber}</p>
                      <p><strong>Dates:</strong> {format(new Date(selectedOverlap.request2.startDate), 'MMM d, yyyy')} - {format(new Date(selectedOverlap.request2.endDate), 'MMM d, yyyy')}</p>
                      <p><strong>Status:</strong> {getStatusBadge(selectedOverlap.request2.status)}</p>
                    </div>
                    <Button
                      variant={actionType === 'cancel1' ? "default" : "destructive"}
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => setActionType('cancel2')}
                    >
                      {actionType === 'cancel1' ? 'Keep This' : 'Cancel This'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              disabled={!actionType}
              onClick={() => {
                if (selectedOverlap && actionType) {
                  const requestToCancel = actionType === 'cancel1' 
                    ? selectedOverlap.request1 
                    : selectedOverlap.request2
                  cancelRequest(requestToCancel.id, requestToCancel.type)
                }
              }}
            >
              Apply Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}