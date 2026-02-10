"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { 
  UserCheck,
  UserX,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  User,
  Building
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { useTranslations } from "@/components/language-provider"

interface SubstituteRequest {
  id: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  createdAt: string
  responseDate?: string
  responseReason?: string
  leaveRequest: {
    id: string
    requestNumber: string
    startDate: string
    endDate: string
    totalDays: number
    reason: string
    user: {
      id: string
      firstName: string
      lastName: string
      email: string
      department?: {
        name: string
      }
    }
    leaveType: {
      name: string
    }
  }
}

export function SubstituteRequestManager() {
  const t = useTranslations()
  const [requests, setRequests] = useState<{
    pending: SubstituteRequest[]
    accepted: SubstituteRequest[]
    declined: SubstituteRequest[]
  }>({
    pending: [],
    accepted: [],
    declined: []
  })
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<SubstituteRequest | null>(null)
  const [responseDialogOpen, setResponseDialogOpen] = useState(false)
  const [responseAction, setResponseAction] = useState<'accept' | 'decline'>('accept')
  const [responseReason, setResponseReason] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/substitute/requests')
      if (response.ok) {
        const data = await response.json()
        setRequests(data)
      } else {
        toast.error('Failed to fetch substitute requests')
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
      toast.error('Error fetching requests')
    } finally {
      setLoading(false)
    }
  }

  const handleResponse = (request: SubstituteRequest, action: 'accept' | 'decline') => {
    setSelectedRequest(request)
    setResponseAction(action)
    setResponseReason('')
    setResponseDialogOpen(true)
  }

  const submitResponse = async () => {
    if (!selectedRequest) return

    setProcessingId(selectedRequest.id)
    try {
      const response = await fetch('/api/substitute/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action: responseAction,
          reason: responseReason || undefined
        })
      })

      if (response.ok) {
        toast.success(`Request ${responseAction}ed successfully`)
        fetchRequests() // Refresh the list
        setResponseDialogOpen(false)
      } else {
        const error = await response.json()
        toast.error(error.error || `Failed to ${responseAction} request`)
      }
    } catch (error) {
      console.error('Error responding to request:', error)
      toast.error('Error responding to request')
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'ACCEPTED':
        return <Badge className="bg-green-100 text-green-800">Accepted</Badge>
      case 'DECLINED':
        return <Badge className="bg-red-100 text-red-800">Declined</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const RequestCard = ({ request }: { request: SubstituteRequest }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">
              {request.leaveRequest?.user?.firstName || ''} {request.leaveRequest?.user?.lastName || ''}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Building className="h-3 w-3" />
              {request.leaveRequest.user.department?.name || 'N/A'}
            </CardDescription>
          </div>
          {getStatusBadge(request.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">{t.labels.leaveType}:</span>
            <p className="font-medium">{request.leaveRequest.leaveType.name}</p>
          </div>
          <div>
            <span className="text-gray-600">{t.labels.requestNumber}:</span>
            <p className="font-medium">{request.leaveRequest.requestNumber}</p>
          </div>
          <div>
            <span className="text-gray-600">{t.labels.period}:</span>
            <p className="font-medium">
              {format(new Date(request.leaveRequest.startDate), 'MMM d, yyyy')} - 
              {format(new Date(request.leaveRequest.endDate), 'MMM d, yyyy')}
            </p>
          </div>
          <div>
            <span className="text-gray-600">{t.labels.duration}:</span>
            <p className="font-medium">{request.leaveRequest.totalDays} days</p>
          </div>
        </div>

        {request.leaveRequest.reason && (
          <div className="text-sm">
            <span className="text-gray-600">{t.labels.reason}:</span>
            <p className="mt-1 p-2 bg-gray-50 rounded">{request.leaveRequest.reason}</p>
          </div>
        )}

        {request.responseReason && (
          <div className="text-sm">
            <span className="text-gray-600">{t.labels.yourResponse}:</span>
            <p className="mt-1 p-2 bg-gray-50 rounded">{request.responseReason}</p>
          </div>
        )}

        {request.status === 'PENDING' && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleResponse(request, 'accept')}
              disabled={processingId === request.id}
            >
              <UserCheck className="h-4 w-4 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => handleResponse(request, 'decline')}
              disabled={processingId === request.id}
            >
              <UserX className="h-4 w-4 mr-1" />
              Decline
            </Button>
          </div>
        )}

        {request.responseDate && (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Responded on {format(new Date(request.responseDate), 'MMM d, yyyy h:mm a')}
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">{t.loading.loadingSubstituteRequests}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Substitute Requests
          </CardTitle>
          <CardDescription>
            Manage requests where you've been selected as a substitute
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.pending.length > 0 && (
            <Alert className="mb-4 border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                You have {requests.pending.length} pending substitute request{requests.pending.length > 1 ? 's' : ''} waiting for your response.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="relative">
                Pending
                {requests.pending.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                    {requests.pending.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="accepted">
                Accepted ({requests.accepted.length})
              </TabsTrigger>
              <TabsTrigger value="declined">
                Declined ({requests.declined.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4 mt-4">
              {requests.pending.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    No pending substitute requests at this time.
                  </AlertDescription>
                </Alert>
              ) : (
                requests.pending.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))
              )}
            </TabsContent>

            <TabsContent value="accepted" className="space-y-4 mt-4">
              {requests.accepted.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  No accepted substitute requests.
                </p>
              ) : (
                requests.accepted.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))
              )}
            </TabsContent>

            <TabsContent value="declined" className="space-y-4 mt-4">
              {requests.declined.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  No declined substitute requests.
                </p>
              ) : (
                requests.declined.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Response Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {responseAction === 'accept' ? 'Accept' : 'Decline'} Substitute Request
            </DialogTitle>
            <DialogDescription>
              {responseAction === 'accept' 
                ? 'By accepting, you agree to cover for this employee during their absence.'
                : 'Please provide a reason for declining (optional).'}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded text-sm">
                <p><strong>Employee:</strong> {selectedRequest?.leaveRequest?.user?.firstName || ''} {selectedRequest?.leaveRequest?.user?.lastName || ''}</p>
                <p><strong>Period:</strong> {format(new Date(selectedRequest.leaveRequest.startDate), 'MMM d, yyyy')} - {format(new Date(selectedRequest.leaveRequest.endDate), 'MMM d, yyyy')}</p>
                <p><strong>Duration:</strong> {selectedRequest.leaveRequest.totalDays} days</p>
              </div>

              {responseAction === 'decline' && (
                <div>
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Textarea
                    id="reason"
                    value={responseReason}
                    onChange={(e) => setResponseReason(e.target.value)}
                    placeholder="e.g., I have prior commitments during this period"
                    rows={3}
                  />
                </div>
              )}

              {responseAction === 'accept' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please ensure you are available during this period and not planning any leave yourself.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResponseDialogOpen(false)}
              disabled={processingId === selectedRequest?.id}
            >
              Cancel
            </Button>
            <Button
              onClick={submitResponse}
              disabled={processingId === selectedRequest?.id}
              className={responseAction === 'accept' ? '' : 'bg-red-600 hover:bg-red-700'}
            >
              {processingId === selectedRequest?.id ? 'Processing...' : 
                responseAction === 'accept' ? 'Accept Request' : 'Decline Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}