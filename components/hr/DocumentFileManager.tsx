"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  FileText,
  Download,
  Search,
  Calendar,
  User,
  Filter,
  Archive,
  FolderOpen,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface DocumentRecord {
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
  }
  startDate: string
  endDate: string
  totalDays: number
  status: string
  supportingDocuments: string[] | null
  hrDocumentVerified: boolean
  hrVerifiedBy?: {
    firstName: string
    lastName: string
  }
  hrVerifiedAt?: string
  hrVerificationNotes?: string
  createdAt: string
  updatedAt: string
}

export function DocumentFileManager() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [documentFilter, setDocumentFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/hr/document-manager')
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Document fetch error:', errorData)
        
        if (response.status === 401) {
          toast.error(errorData.message || 'Please log in to view documents')
        } else if (response.status === 403) {
          toast.error(errorData.message || 'You do not have permission to view HR documents')
        } else {
          toast.error(errorData.message || 'Failed to load documents')
        }
        return
      }
      
      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast.error('Failed to connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const generateDocument = async (leaveRequestId: string) => {
    try {
      const response = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leaveRequestId }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Document generated successfully')
        // Refresh the documents list to show the new document
        await fetchDocuments()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to generate document')
      }
    } catch (error) {
      console.error('Error generating document:', error)
      toast.error('Failed to generate document')
    }
  }

  const downloadAllDocuments = async (documentUrls: string[], requestNumber: string) => {
    try {
      // Download supporting documents through our API
      if (documentUrls.length > 0) {
        for (let i = 0; i < documentUrls.length; i++) {
          const url = documentUrls[i]
          const fileName = `${requestNumber}_supporting_${i + 1}.pdf`
          
          // Use our API endpoint to fetch the document
          const apiUrl = `/api/hr/documents/supporting?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fileName)}`
          
          const response = await fetch(apiUrl)
          if (response.ok) {
            const blob = await response.blob()
            const downloadUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = fileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(downloadUrl)
          }
        }
        toast.success('Documents downloaded successfully')
      }
    } catch (error) {
      console.error('Error downloading documents:', error)
      toast.error('Failed to download documents')
    }
  }

  const downloadDocument = async (url: string, filename: string) => {
    try {
      // Use our API endpoint to fetch the document
      const apiUrl = `/api/hr/documents/supporting?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
      
      const response = await fetch(apiUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch document')
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
      toast.success('Document downloaded')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download document')
    }
  }

  const viewSupportingDocuments = (documentUrls: string[], requestNumber: string) => {
    // Open the first supporting document in a new tab for viewing
    if (documentUrls.length > 0) {
      const url = documentUrls[0]
      const fileName = `${requestNumber}_supporting_1.pdf`
      const viewUrl = `/api/hr/documents/supporting?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fileName)}`
      window.open(viewUrl, '_blank')
      
      if (documentUrls.length > 1) {
        toast.info(`Viewing first document. ${documentUrls.length - 1} more documents available for download.`)
      }
    }
  }


  const exportToCSV = () => {
    const headers = [
      'Request Number',
      'Employee Name',
      'Department',
      'Leave Type',
      'Start Date',
      'End Date',
      'Days',
      'Status',
      'Documents',
      'HR Verified',
      'Verified By',
      'Verified Date',
      'Notes',
    ]

    const rows = filteredDocuments.map(doc => [
      doc.requestNumber,
      `${doc.user.firstName} ${doc.user.lastName}`,
      doc.user.department,
      doc.leaveType.name,
      format(new Date(doc.startDate), 'yyyy-MM-dd'),
      format(new Date(doc.endDate), 'yyyy-MM-dd'),
      doc.totalDays,
      doc.status,
      doc.supportingDocuments ? `${doc.supportingDocuments.length} files` : 'No documents',
      doc.hrDocumentVerified ? 'Yes' : 'No',
      doc.hrVerifiedBy ? `${doc.hrVerifiedBy.firstName} ${doc.hrVerifiedBy.lastName}` : '',
      doc.hrVerifiedAt ? format(new Date(doc.hrVerifiedAt), 'yyyy-MM-dd HH:mm') : '',
      doc.hrVerificationNotes || '',
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `document_audit_${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    toast.success('Audit log exported')
  }

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      (doc.requestNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.user?.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.user?.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.user?.email || '').toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || doc.status === statusFilter

    const matchesDocuments = 
      documentFilter === "all" ||
      (documentFilter === "with_docs" && doc.supportingDocuments && doc.supportingDocuments.length > 0) ||
      (documentFilter === "no_docs" && (!doc.supportingDocuments || doc.supportingDocuments.length === 0)) ||
      (documentFilter === "verified" && doc.hrDocumentVerified) ||
      (documentFilter === "pending_verification" && doc.supportingDocuments && !doc.hrDocumentVerified)

    let matchesDate = true
    if (dateFilter !== "all") {
      const date = new Date(doc.createdAt)
      const now = new Date()
      const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
      
      matchesDate = 
        (dateFilter === "last_7_days" && daysDiff <= 7) ||
        (dateFilter === "last_30_days" && daysDiff <= 30) ||
        (dateFilter === "last_90_days" && daysDiff <= 90) ||
        (dateFilter === "older_90_days" && daysDiff > 90)
    }

    return matchesSearch && matchesStatus && matchesDocuments && matchesDate
  })

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedDocuments = filteredDocuments.slice(startIndex, startIndex + itemsPerPage)

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, documentFilter, dateFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading document records...</div>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Document File Manager
            </CardTitle>
            <CardDescription>
              Access and manage all leave request documents and audit history
            </CardDescription>
          </div>
          <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Audit Log
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This shows all leave requests including those with deleted documents. 
            Entries marked "[Documents removed per retention policy]" had their files deleted but the audit trail remains.
          </AlertDescription>
        </Alert>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by request number, name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>

          <Select value={documentFilter} onValueChange={setDocumentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Documents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Documents</SelectItem>
              <SelectItem value="with_docs">With Documents</SelectItem>
              <SelectItem value="no_docs">No Documents</SelectItem>
              <SelectItem value="verified">HR Verified</SelectItem>
              <SelectItem value="pending_verification">Pending Verification</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="last_7_days">Last 7 Days</SelectItem>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="older_90_days">Older than 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              Total Records
            </div>
            <div className="text-2xl font-semibold">{documents.length}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Archive className="h-4 w-4" />
              With Documents
            </div>
            <div className="text-2xl font-semibold">
              {documents.filter(d => d.supportingDocuments && d.supportingDocuments.length > 0).length}
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              HR Verified
            </div>
            <div className="text-2xl font-semibold">
              {documents.filter(d => d.hrDocumentVerified).length}
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Trash2 className="h-4 w-4 text-red-600" />
              Docs Deleted
            </div>
            <div className="text-2xl font-semibold">
              {documents.filter(d => d.hrVerificationNotes?.includes('[Documents removed')).length}
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>HR Verification</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No document records found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div>
                        <p className="font-mono text-sm">{doc.requestNumber.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{doc.user.firstName} {doc.user.lastName}</p>
                        <p className="text-sm text-muted-foreground">{doc.user.department}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.leaveType.name}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{format(new Date(doc.startDate), 'MMM d')} - {format(new Date(doc.endDate), 'MMM d')}</p>
                        <p className="text-muted-foreground">{doc.totalDays} days</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(doc.status)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {/* Supporting Documents */}
                        {doc.supportingDocuments && doc.supportingDocuments.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm">{doc.supportingDocuments.length} support files</span>
                          </div>
                        ) : doc.hrVerificationNotes?.includes('[Documents removed') ? (
                          <div className="flex items-center gap-1">
                            <Trash2 className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-muted-foreground">Support docs deleted</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No support docs</span>
                        )}
                        
                        {/* Generated Documents */}
                        {doc.generatedDocument ? (
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">Generated ({doc.generatedDocument?.status})</span>
                          </div>
                        ) : (
                          doc.status === 'APPROVED' && (
                            <span className="text-sm text-amber-600">Can generate</span>
                          )
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {doc.hrDocumentVerified ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">Verified</span>
                          </div>
                          {doc.hrVerifiedBy && (
                            <p className="text-xs text-muted-foreground mt-1">
                              by {doc.hrVerifiedBy?.firstName || ''} {doc.hrVerifiedBy?.lastName || ''}
                            </p>
                          )}
                          {doc.hrVerifiedAt && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(doc.hrVerifiedAt), 'MMM d, HH:mm')}
                            </p>
                          )}
                        </div>
                      ) : doc.supportingDocuments && doc.supportingDocuments.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-amber-600" />
                          <span className="text-sm text-amber-600">Pending</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {/* Supporting Documents */}
                        {doc.supportingDocuments && doc.supportingDocuments.length > 0 && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewSupportingDocuments(doc.supportingDocuments!, doc.requestNumber)}
                              className="flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadAllDocuments(doc.supportingDocuments!, doc.requestNumber)}
                              className="flex items-center gap-1"
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </Button>
                          </>
                        )}
                        
                        {/* Generated Documents */}
                        {doc.generatedDocument ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/api/hr/documents/view/${doc.generatedDocument?.id}`, '_blank')}
                            className="flex items-center gap-1"
                          >
                            <FileText className="h-3 w-3" />
                            View Generated
                          </Button>
                        ) : (
                          doc.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => generateDocument(doc.id)}
                              className="flex items-center gap-1"
                            >
                              <FileText className="h-3 w-3" />
                              Generate
                            </Button>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredDocuments.length)} of {filteredDocuments.length} records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page = i + 1
                  if (totalPages > 5) {
                    if (currentPage <= 3) {
                      page = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i
                    } else {
                      page = currentPage - 2 + i
                    }
                  }
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}