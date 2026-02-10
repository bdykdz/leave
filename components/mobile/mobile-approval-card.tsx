"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  FileText, 
  Check, 
  X, 
  MessageSquare,
  ChevronRight,
  Phone,
  Mail
} from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { toast } from "sonner"

interface MobileApprovalCardProps {
  request: {
    id: string
    // Original shape from direct DB queries
    user?: {
      firstName?: string
      lastName?: string
      email?: string
      position?: string
      profileImage?: string
    }
    leaveType?: {
      name?: string
      requiresDocument?: boolean
    }
    // Transformed shape from API endpoints
    employee?: {
      name?: string
      avatar?: string
      department?: string
    }
    type?: string
    days?: number
    dates?: string
    requestType?: string
    submittedDate?: string
    // Common fields
    startDate: string
    endDate: string
    totalDays?: number
    reason?: string
    status: string
    createdAt?: string
    documentUrl?: string
    substituteUser?: {
      firstName: string
      lastName: string
    }
  }
  onApproval?: (requestId: string, action: 'approve' | 'reject' | 'request_revision', comments?: string) => void
  compact?: boolean
}

export function MobileApprovalCard({ request, onApproval, compact = false }: MobileApprovalCardProps) {
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | 'request_revision' | null>(null)
  const [comments, setComments] = useState('')
  const [processing, setProcessing] = useState(false)

  // Support both data shapes: direct DB (user.firstName) and API-transformed (employee.name)
  const userName = request.user?.firstName
    ? `${request.user.firstName} ${request.user.lastName || ''}`.trim()
    : request.employee?.name || 'Unknown'
  const userInitials = request.user?.firstName
    ? `${request.user.firstName[0] || ''}${request.user.lastName?.[0] || ''}`
    : (request.employee?.name || 'U').split(' ').map((n: string) => n?.[0] || '').join('').toUpperCase().slice(0, 2) || 'U'
  const userEmail = request.user?.email || ''
  const userPosition = request.user?.position || request.employee?.department || ''
  const userProfileImage = request.user?.profileImage || request.employee?.avatar || ''
  const leaveTypeName = request.leaveType?.name || request.type || 'Unknown'
  const totalDays = request.totalDays || request.days || 0
  const createdAt = request.createdAt || request.submittedDate || new Date().toISOString()

  const startDate = new Date(request.startDate)
  const endDate = new Date(request.endDate)
  const daysUntilStart = differenceInDays(startDate, new Date())
  const isUrgent = daysUntilStart <= 3 && daysUntilStart >= 0

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500'
      case 'APPROVED': return 'bg-green-500'
      case 'REJECTED': return 'bg-red-500'
      case 'HR_REVIEW': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const handleApproval = async (action: 'approve' | 'reject' | 'request_revision') => {
    if (!onApproval) return

    setProcessing(true)
    try {
      await onApproval(request.id, action, comments)
      setSelectedAction(null)
      setComments('')
      toast.success(`Request ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'sent back for revision'}`)
    } catch (error) {
      toast.error('Failed to process request')
    } finally {
      setProcessing(false)
    }
  }

  if (compact) {
    return (
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              <Avatar className="h-8 w-8">
                <AvatarImage src={userProfileImage} />
                <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-gray-600 truncate">
                  {totalDays} days • {format(startDate, 'MMM d')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isUrgent && (
                <Badge variant="destructive" className="text-xs">Urgent</Badge>
              )}
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={userProfileImage} />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-medium">{userName}</h4>
              <p className="text-sm text-gray-600">{userPosition}</p>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <Badge className={`${getStatusColor(request.status)} text-white text-xs`}>
              {request.status}
            </Badge>
            {isUrgent && (
              <Badge variant="destructive" className="text-xs">
                Urgent
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Leave Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Type</span>
            </div>
            <p className="font-medium">{leaveTypeName}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Duration</span>
            </div>
            <p className="font-medium">{totalDays} days</p>
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600 text-sm">Dates</span>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">From</p>
                <p className="font-medium">{format(startDate, 'MMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-gray-600">To</p>
                <p className="font-medium">{format(endDate, 'MMM d, yyyy')}</p>
              </div>
            </div>
            {daysUntilStart >= 0 && (
              <p className="text-xs text-blue-600 mt-2">
                Starts in {daysUntilStart} {daysUntilStart === 1 ? 'day' : 'days'}
              </p>
            )}
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600 text-sm">Reason</span>
          </div>
          <p className="text-sm bg-gray-50 p-3 rounded-lg">{request.reason || 'No reason provided'}</p>
        </div>

        {/* Substitute */}
        {request.substituteUser && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600 text-sm">Substitute</span>
            </div>
            <p className="text-sm font-medium">
              {request.substituteUser?.firstName || ''} {request.substituteUser?.lastName || ''}
            </p>
          </div>
        )}

        {/* Contact Options */}
        {userEmail && (
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `mailto:${userEmail}`}
              className="flex-1"
            >
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
          </div>
        )}

        {/* Approval Actions */}
        {request.status === 'PENDING' && onApproval && (
          <div className="border-t pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAction('approve')}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAction('reject')}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAction('request_revision')}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Revise
              </Button>
            </div>

            {/* Comments Dialog */}
            {selectedAction && (
              <Dialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
                <DialogContent className="w-[95%] max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {selectedAction === 'approve' ? 'Approve Request' :
                       selectedAction === 'reject' ? 'Reject Request' : 'Request Revision'}
                    </DialogTitle>
                    <DialogDescription>
                      Add a comment for {userName} (optional)
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="comments">Comments</Label>
                      <Textarea
                        id="comments"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        placeholder="Add your comments here..."
                        rows={3}
                      />
                    </div>

                    {selectedAction === 'approve' && (
                      <Alert>
                        <Check className="h-4 w-4" />
                        <AlertDescription>
                          This will approve the leave request for {totalDays} days.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex space-x-2">
                      <Button
                        onClick={() => setSelectedAction(null)}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleApproval(selectedAction)}
                        disabled={processing}
                        className={`flex-1 ${
                          selectedAction === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                          selectedAction === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                          'bg-orange-600 hover:bg-orange-700'
                        }`}
                      >
                        {processing ? 'Processing...' : 
                         selectedAction === 'approve' ? 'Approve' :
                         selectedAction === 'reject' ? 'Reject' : 'Request Revision'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {/* Request Info */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          Submitted {format(new Date(createdAt), 'MMM d, yyyy HH:mm')}
        </div>
      </CardContent>
    </Card>
  )
}