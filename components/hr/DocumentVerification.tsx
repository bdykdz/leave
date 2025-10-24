"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  ChevronDown,
  SelectAll,
  Loader2,
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
  supportingDocuments: {
    uploadedDocuments?: string[]
    selectedDates?: string[]
    formattedDates?: string
    substituteNames?: string
    employeeSignature?: string
    employeeSignatureDate?: string
    documentUploadDate?: string
  } | string[]  // Keep backward compatibility
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

  // Helper function to extract document URLs from supportingDocuments
  const getDocumentUrls = (supportingDocs: any): { url: string; name: string }[] => {
    try {
      if (Array.isArray(supportingDocs)) {
        // Backward compatibility: treat as string array
        return supportingDocs
          .filter(doc => typeof doc === 'string' && doc.trim().length > 0)
          .map((doc, index) => ({
            url: doc,
            name: `Document ${index + 1}`
          }))
      } else if (supportingDocs?.uploadedDocuments && Array.isArray(supportingDocs.uploadedDocuments)) {
        // New format: extract from uploadedDocuments
        return supportingDocs.uploadedDocuments
          .filter((url: any) => typeof url === 'string' && url.trim().length > 0)
          .map((url: string, index: number) => {
            try {
              const fileName = url.split('/').pop() || `document_${index + 1}`
              // Safely remove prefix and sanitize display name
              const displayName = fileName
                .replace(/^[^-]+-[^-]+-[^-]+-/, '') // Remove prefix
                .replace(/[<>"/\\|?*]/g, '_') // Sanitize potentially dangerous characters
                .substring(0, 50) // Limit length
              
              return {
                url,
                name: displayName || `Document ${index + 1}`
              }
            } catch (error) {
              console.warn('Error processing document URL:', url, error)
              return {
                url,
                name: `Document ${index + 1}`
              }
            }
          })
      }
    } catch (error) {
      console.error('Error extracting document URLs:', error)
    }
    return []
  }

  // Helper function to get document count for display
  const getDocumentCount = (supportingDocs: any): number => {
    return getDocumentUrls(supportingDocs).length
  }
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestForVerification | null>(null)
  const [verificationNotes, setVerificationNotes] = useState("")
  const [verifying, setVerifying] = useState(false)
  
  // Bulk verification state
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set())
  const [bulkVerifying, setBulkVerifying] = useState(false)
  const [bulkNotes, setBulkNotes] = useState("")
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject'>('approve')

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
      // Convert MinIO URL to API endpoint
      const apiUrl = url.startsWith('minio://') 
        ? `/api/documents/${url.replace('minio://', '').replace('leave-management/', '')}`
        : url

      const response = await fetch(apiUrl)
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`)
      }
      
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

  // Bulk verification functions
  const handleSelectRequest = (requestId: string, checked: boolean) => {
    const newSelected = new Set(selectedRequests)
    if (checked) {
      newSelected.add(requestId)
    } else {
      newSelected.delete(requestId)
    }
    setSelectedRequests(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const eligibleRequests = requests.filter(r => !r.hrDocumentVerified && r.status === 'PENDING')
      setSelectedRequests(new Set(eligibleRequests.map(r => r.id)))
    } else {
      setSelectedRequests(new Set())
    }
  }

  const initiateBulkVerification = (action: 'approve' | 'reject') => {
    setBulkAction(action)
    setShowBulkDialog(true)
  }

  const handleBulkVerification = async () => {
    if (selectedRequests.size === 0) return

    try {
      setBulkVerifying(true)
      const response = await fetch('/api/hr/document-verification/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestIds: Array.from(selectedRequests),
          action: bulkAction,
          notes: bulkNotes.trim() || undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        setSelectedRequests(new Set())
        setBulkNotes("")
        setShowBulkDialog(false)
        fetchPendingVerifications()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to process bulk verification')
      }
    } catch (error) {
      console.error('Bulk verification error:', error)
      toast.error('Failed to process bulk verification')
    } finally {
      setBulkVerifying(false)
    }
  }

  const eligibleRequests = requests.filter(r => !r.hrDocumentVerified && r.status === 'PENDING')
  const isAllSelected = eligibleRequests.length > 0 && eligibleRequests.every(r => selectedRequests.has(r.id))

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
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {requests.filter(r => !r.hrDocumentVerified).length} Pending
              </Badge>
              {selectedRequests.size > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <SelectAll className="h-3 w-3" />
                  {selectedRequests.size} Selected
                </Badge>
              )}
            </div>
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

          {/* Bulk Actions */}
          {eligibleRequests.length > 0 && (
            <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  className="data-[state=checked]:bg-blue-600"
                />
                <span className="text-sm font-medium">
                  Select All ({eligibleRequests.length} requests)
                </span>
              </div>
              
              {selectedRequests.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedRequests.size} selected
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={bulkVerifying}>
                        {bulkVerifying ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <SelectAll className="h-4 w-4 mr-1" />
                        )}
                        Bulk Actions
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => initiateBulkVerification('approve')}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Verify & Approve All
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => initiateBulkVerification('reject')}
                        className="flex items-center gap-2 text-red-600"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject All
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <span className="sr-only">Select</span>
                  </TableHead>
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
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No pending document verifications
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((request) => {
                    const isEligible = !request.hrDocumentVerified && request.status === 'PENDING'
                    const isSelected = selectedRequests.has(request.id)
                    
                    return (
                    <TableRow key={request.id} className={isSelected ? 'bg-blue-50' : ''}>
                      <TableCell>
                        {isEligible && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectRequest(request.id, checked as boolean)}
                            className="data-[state=checked]:bg-blue-600"
                          />
                        )}
                      </TableCell>
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
                          {getDocumentCount(request.supportingDocuments)} file{getDocumentCount(request.supportingDocuments) !== 1 && 's'}
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
                    )
                  })
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
                  {getDocumentUrls(selectedRequest.supportingDocuments).map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm" title={doc.name}>{doc.name}</span>
                        {selectedRequest.leaveType.code === 'SL' && (
                          <Badge variant="outline" className="text-xs">Medical Certificate</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadDocument(doc.url, doc.name)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(doc.url, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                  {getDocumentUrls(selectedRequest.supportingDocuments).length === 0 && (
                    <p className="text-sm text-gray-500 italic">No documents uploaded</p>
                  )}
                </div>
                
                {/* Show upload date for sick leave */}
                {selectedRequest.leaveType.code === 'SL' && 
                 typeof selectedRequest.supportingDocuments === 'object' && 
                 selectedRequest.supportingDocuments.documentUploadDate && (() => {
                   try {
                     const uploadDate = new Date(selectedRequest.supportingDocuments.documentUploadDate)
                     if (isNaN(uploadDate.getTime())) {
                       return null // Invalid date
                     }
                     return (
                       <div className="mt-2 text-xs text-gray-500">
                         Documents uploaded: {format(uploadDate, 'PPp')}
                       </div>
                     )
                   } catch (error) {
                     console.warn('Error parsing upload date:', error)
                     return null
                   }
                 })()}
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

      {/* Bulk Verification Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'approve' ? 'Bulk Verify & Approve' : 'Bulk Reject'} Documents
            </DialogTitle>
            <DialogDescription>
              You are about to {bulkAction === 'approve' ? 'verify and approve' : 'reject'} {selectedRequests.size} document verification requests.
              {bulkAction === 'reject' && ' This action will also reject the associated leave requests.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Selected Requests ({selectedRequests.size})</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {Array.from(selectedRequests).map(id => {
                  const request = requests.find(r => r.id === id)
                  return request ? (
                    <div key={id} className="text-sm flex justify-between">
                      <span>{request.user.firstName} {request.user.lastName}</span>
                      <span className="text-muted-foreground">{request.leaveType.name}</span>
                    </div>
                  ) : null
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {bulkAction === 'approve' ? 'Verification Notes (Optional)' : 'Rejection Reason'}
              </label>
              <Textarea
                placeholder={bulkAction === 'approve' 
                  ? "Add notes about the bulk verification..." 
                  : "Explain why these documents are being rejected..."}
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {bulkAction === 'approve' 
                  ? 'These notes are internal and help with audit trails'
                  : 'This reason will be visible to employees and managers'}
              </p>
            </div>

            {bulkAction === 'reject' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-red-900">Warning</p>
                    <p className="text-red-800">
                      Rejecting documents will also reject the associated leave requests. 
                      Employees will need to resubmit their requests with proper documentation.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDialog(false)}
              disabled={bulkVerifying}
            >
              Cancel
            </Button>
            <Button
              variant={bulkAction === 'approve' ? 'default' : 'destructive'}
              onClick={handleBulkVerification}
              disabled={bulkVerifying || (bulkAction === 'reject' && !bulkNotes.trim())}
              className="flex items-center gap-2"
            >
              {bulkVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : bulkAction === 'approve' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {bulkAction === 'approve' ? 'Verify & Approve All' : 'Reject All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}