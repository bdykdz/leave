"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Shield,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  User,
  Activity,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  FileText,
  UserCheck,
  UserX,
  Settings,
  Database,
  Clock
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface AuditLog {
  id: string
  userId: string
  user: {
    firstName: string
    lastName: string
    email: string
    department: string
  }
  action: string
  entityType: string
  entityId: string
  details: any
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  // User actions
  'USER_LOGIN': 'User Login',
  'USER_LOGOUT': 'User Logout',
  'USER_CREATE': 'User Created',
  'USER_UPDATE': 'User Updated',
  'USER_DELETE': 'User Deleted',
  
  // Leave request actions
  'LEAVE_REQUEST_CREATE': 'Leave Request Created',
  'LEAVE_REQUEST_UPDATE': 'Leave Request Updated',
  'LEAVE_REQUEST_DELETE': 'Leave Request Deleted',
  'LEAVE_REQUEST_APPROVE': 'Leave Request Approved',
  'LEAVE_REQUEST_REJECT': 'Leave Request Rejected',
  'LEAVE_REQUEST_CANCEL': 'Leave Request Cancelled',
  
  // WFH request actions
  'WFH_REQUEST_CREATE': 'WFH Request Created',
  'WFH_REQUEST_UPDATE': 'WFH Request Updated',
  'WFH_REQUEST_DELETE': 'WFH Request Deleted',
  'WFH_REQUEST_APPROVE': 'WFH Request Approved',
  'WFH_REQUEST_REJECT': 'WFH Request Rejected',
  
  // Settings actions
  'SETTINGS_UPDATE': 'Settings Updated',
  'ESCALATION_SETTINGS_UPDATE': 'Escalation Settings Updated',
  'TEMPLATE_CREATE': 'Template Created',
  'TEMPLATE_UPDATE': 'Template Updated',
  'TEMPLATE_DELETE': 'Template Deleted',
  
  // Department actions
  'DEPARTMENT_CREATE': 'Department Created',
  'DEPARTMENT_UPDATE': 'Department Updated',
  'DEPARTMENT_DELETE': 'Department Deleted',
  
  // Other actions
  'DELEGATION_CREATE': 'Delegation Created',
  'DELEGATION_UPDATE': 'Delegation Updated',
  'DELEGATION_DELETE': 'Delegation Deleted',
  'DOCUMENT_UPLOAD': 'Document Uploaded',
  'DOCUMENT_DELETE': 'Document Deleted',
  'EMAIL_SENT': 'Email Sent',
  'TEST_ESCALATION': 'Escalation Test Run',
  'DATA_EXPORT': 'Data Exported',
  'BULK_IMPORT': 'Bulk Import',
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  'USER': 'User',
  'LEAVE_REQUEST': 'Leave Request',
  'WFH_REQUEST': 'WFH Request',
  'DEPARTMENT': 'Department',
  'TEMPLATE': 'Template',
  'SETTINGS': 'Settings',
  'ESCALATION_SETTINGS': 'Escalation Settings',
  'DELEGATION': 'Delegation',
  'DOCUMENT': 'Document',
  'HOLIDAY': 'Holiday',
  'LEAVE_TYPE': 'Leave Type',
}

const ACTION_ICONS: Record<string, any> = {
  'CREATE': FileText,
  'UPDATE': Settings,
  'DELETE': UserX,
  'APPROVE': UserCheck,
  'REJECT': UserX,
  'LOGIN': User,
  'LOGOUT': User,
  'SETTINGS': Settings,
  'TEST': Activity,
  'EXPORT': Download,
  'IMPORT': Database,
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [entityTypeFilter, setEntityTypeFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const logsPerPage = 20

  useEffect(() => {
    fetchLogs()
  }, [currentPage, actionFilter, entityTypeFilter, dateFrom, dateTo])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: logsPerPage.toString(),
      })
      
      if (actionFilter !== 'all') params.append('action', actionFilter)
      if (entityTypeFilter !== 'all') params.append('entityType', entityTypeFilter)
      if (userFilter) params.append('userId', userFilter)
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/admin/audit-logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs)
        setTotalPages(data.totalPages)
        setTotalLogs(data.totalLogs)
      } else {
        toast.error('Failed to fetch audit logs')
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      toast.error('Error fetching audit logs')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    fetchLogs()
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv',
        action: actionFilter !== 'all' ? actionFilter : '',
        entityType: entityTypeFilter !== 'all' ? entityTypeFilter : '',
        dateFrom: dateFrom || '',
        dateTo: dateTo || '',
      })

      const response = await fetch(`/api/admin/audit-logs/export?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Audit logs exported successfully')
      } else {
        toast.error('Failed to export audit logs')
      }
    } catch (error) {
      console.error('Error exporting audit logs:', error)
      toast.error('Error exporting audit logs')
    }
  }

  const viewDetails = (log: AuditLog) => {
    setSelectedLog(log)
    setDetailsOpen(true)
  }

  const getActionIcon = (action: string) => {
    const actionType = action.split('_').pop() || ''
    const Icon = ACTION_ICONS[actionType] || Activity
    return <Icon className="h-4 w-4" />
  }

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-800'
    if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-800'
    if (action.includes('DELETE')) return 'bg-red-100 text-red-800'
    if (action.includes('APPROVE')) return 'bg-green-100 text-green-800'
    if (action.includes('REJECT')) return 'bg-red-100 text-red-800'
    if (action.includes('LOGIN')) return 'bg-gray-100 text-gray-800'
    return 'bg-gray-100 text-gray-800'
  }

  // Get unique actions and entity types for filters
  const uniqueActions = Array.from(new Set(Object.keys(ACTION_LABELS)))
  const uniqueEntityTypes = Array.from(new Set(Object.keys(ENTITY_TYPE_LABELS)))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Audit Logs
              </CardTitle>
              <CardDescription>
                View and search system audit logs
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchLogs}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                onClick={handleExport}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="flex gap-2">
                  <Input
                    id="search"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button size="icon" onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="action">Action</Label>
                <Select value={actionFilter} onValueChange={(value) => {
                  setActionFilter(value)
                  setCurrentPage(1)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {uniqueActions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {ACTION_LABELS[action]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="entityType">Entity Type</Label>
                <Select value={entityTypeFilter} onValueChange={(value) => {
                  setEntityTypeFilter(value)
                  setCurrentPage(1)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueEntityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {ENTITY_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="user">User Email</Label>
                <Input
                  id="user"
                  placeholder="Filter by user..."
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  onBlur={handleSearch}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateFrom">Date From</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>

              <div>
                <Label htmlFor="dateTo">Date To</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
            </div>
          </div>

          {/* Logs Table */}
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Loading audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-6 w-6 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">No audit logs found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead className="w-[100px]">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-gray-400" />
                            {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {log.user.firstName} {log.user.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{log.user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getActionBadgeColor(log.action)}>
                            <span className="flex items-center gap-1">
                              {getActionIcon(log.action)}
                              {ACTION_LABELS[log.action] || log.action}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">
                              {ENTITY_TYPE_LABELS[log.entityType] || log.entityType}
                            </p>
                            <p className="text-xs text-gray-500">ID: {log.entityId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDetails(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * logsPerPage + 1} to{' '}
                  {Math.min(currentPage * logsPerPage, totalLogs)} of {totalLogs} logs
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = currentPage - 2 + i
                      if (page > 0 && page <= totalPages) {
                        return (
                          <Button
                            key={page}
                            variant={page === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        )
                      }
                      return null
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Complete details of the audit log entry
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Timestamp</Label>
                  <p className="font-mono text-sm">
                    {format(new Date(selectedLog.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                  </p>
                </div>
                <div>
                  <Label>Log ID</Label>
                  <p className="font-mono text-sm">{selectedLog.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>User</Label>
                  <p className="text-sm">
                    {selectedLog.user.firstName} {selectedLog.user.lastName}
                    <br />
                    <span className="text-gray-500">{selectedLog.user.email}</span>
                    <br />
                    <span className="text-gray-500">{selectedLog.user.department}</span>
                  </p>
                </div>
                <div>
                  <Label>Action</Label>
                  <Badge className={getActionBadgeColor(selectedLog.action)}>
                    {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Entity Type</Label>
                  <p className="text-sm">
                    {ENTITY_TYPE_LABELS[selectedLog.entityType] || selectedLog.entityType}
                  </p>
                </div>
                <div>
                  <Label>Entity ID</Label>
                  <p className="font-mono text-sm">{selectedLog.entityId}</p>
                </div>
              </div>

              {selectedLog.ipAddress && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>IP Address</Label>
                    <p className="font-mono text-sm">{selectedLog.ipAddress}</p>
                  </div>
                  <div>
                    <Label>User Agent</Label>
                    <p className="text-xs font-mono break-all">
                      {selectedLog.userAgent || 'N/A'}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <Label>Details</Label>
                <div className="mt-2 p-4 bg-gray-50 rounded-md">
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}