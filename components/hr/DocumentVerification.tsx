"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  AlertCircle,
  Shield,
  Calendar,
  User,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface LeaveRequestForVerification {
  id: string
  requestNumber: string
  user: {
    firstName: string
    lastName: string
    email: string
    department: string
  }
  leaveType: {
    name: string
    code: string
    documentTypes: string[]
  }
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  supportingDocuments: string[]
  createdAt: string
  hrDocumentVerified: boolean
  hrVerifiedBy?: string
  hrVerifiedAt?: string
  hrVerificationNotes?: string
  status: string
}

export function DocumentVerification() {
  const [requests, setRequests] = useState<LeaveRequestForVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestForVerification | null>(null)
  const [verificationNotes, setVerificationNotes] = useState("")
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    fetchPendingVerifications()
  }, [])

  const fetchPendingVerifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/hr/document-verification')
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests)
      } else {
        toast.error('Failed to load pending verifications')
      }
    } catch (error) {
      console.error('Error fetching verifications:', error)
      toast.error('Failed to load pending verifications')
    } finally {
      setLoading(false)
    }
  }

  const handleVerification = async (approved: boolean) => {
    if (!selectedRequest) return

    try {
      setVerifying(true)
      const response = await fetch(`/api/hr/document-verification/${selectedRequest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved,
          notes: verificationNotes,
        }),
      })

      if (response.ok) {
        toast.success(approved ? 'Documents verified and approved' : 'Documents rejected')
        setSelectedRequest(null)
        setVerificationNotes("")
        fetchPendingVerifications()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to process verification')
      }
    } catch (error) {
      console.error('Verification error:', error)
      toast.error('Failed to process verification')
    } finally {
      setVerifying(false)
    }
  }

  const downloadDocument = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download document')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading pending verifications...</div>
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                HR Document Verification
              </CardTitle>
              <CardDescription>
                Review and verify supporting documents for special leave requests
              </CardDescription>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {requests.filter(r => !r.hrDocumentVerified).length} Pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900 mb-1">Document Privacy Notice</p>
                <p className="text-amber-800">
                  These documents contain sensitive information. Only HR personnel can view them.
                  After verification, managers will only see "HR Verified" status, not the actual documents.
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Documents are retained according to the configured retention policy and may be 
                  automatically deleted after approval or based on age.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-center">Documents</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No pending document verifications
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-mono text-sm">
                        {request.requestNumber.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {request.user.firstName} {request.user.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {request.user.department}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{request.leaveType.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{format(new Date(request.startDate), 'MMM d, yyyy')}</p>
                          <p className="text-muted-foreground">
                            {request.totalDays} day{request.totalDays !== 1 && 's'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {request.supportingDocuments.length} file{request.supportingDocuments.length !== 1 && 's'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {request.hrDocumentVerified ? (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">Verified</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="h-4 w-4 text-amber-600" />
                            <span className="text-sm text-amber-600">Pending</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRequest(request)}
                          className="flex items-center gap-1"
                          disabled={request.status === 'APPROVED'}
                        >
                          <Eye className="h-3 w-3" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Verification Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Verification</DialogTitle>
            <DialogDescription>
              Review supporting documents for this special leave request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Request Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">Employee</span>
                  </div>
                  <p className="text-sm">
                    {selectedRequest.user.firstName} {selectedRequest.user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedRequest.user.email}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">Leave Period</span>
                  </div>
                  <p className="text-sm">
                    {format(new Date(selectedRequest.startDate), 'MMM d')} - 
                    {format(new Date(selectedRequest.endDate), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedRequest.totalDays} day{selectedRequest.totalDays !== 1 && 's'}
                  </p>
                </div>
              </div>

              {/* Leave Details */}
              <div>
                <h4 className="font-medium mb-2">Leave Details</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge>{selectedRequest.leaveType.name}</Badge>
                    <Badge variant="secondary" className="text-xs">
                      Requires: {selectedRequest.leaveType.documentTypes.join(', ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedRequest.reason}</p>
                </div>
              </div>

              {/* Supporting Documents */}
              <div>
                <h4 className="font-medium mb-2">Supporting Documents</h4>
                <div className="space-y-2">
                  {selectedRequest.supportingDocuments.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Document {index + 1}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadDocument(doc, `document_${index + 1}.pdf`)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification Notes */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Verification Notes (Optional)
                </label>
                <Textarea
                  placeholder="Add any notes about the document verification..."
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  These notes are internal and won't be visible to the employee or managers
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedRequest(null)}
              disabled={verifying}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleVerification(false)}
              disabled={verifying}
              className="flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Reject Documents
            </Button>
            <Button
              variant="default"
              onClick={() => handleVerification(true)}
              disabled={verifying}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Verify & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}