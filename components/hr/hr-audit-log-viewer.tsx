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
  Clock,
  TrendingUp,
  BarChart3,
  Users,
  CheckCircle,
  XCircle
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface HRAuditLog {
  id: string
  timestamp: string
  user: {
    firstName: string
    lastName: string
    email: string
    department: string
    role: string
  }
  action: string
  entity: string
  entityId: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  details?: Record<string, unknown>
}

interface AuditLogSummary {
  todayCount: number
  weekCount: number
  monthCount: number
  recentActions: Array<{ action: string; count: number }>
}

// HR-focused action labels
const HR_ACTION_LABELS: Record<string, string> = {
  'APPROVE_LEAVE': 'Leave Approved',
  'REJECT_LEAVE': 'Leave Rejected',
  'CANCEL_LEAVE': 'Leave Cancelled',
  'CREATE_LEAVE': 'Leave Created',
  'EDIT_LEAVE': 'Leave Modified',
  'APPROVE_WFH': 'WFH Approved',
  'REJECT_WFH': 'WFH Rejected',
  'CREATE_WFH': 'WFH Created',
  'CREATE_EMPLOYEE': 'Employee Created',
  'UPDATE_EMPLOYEE': 'Employee Updated',
  'DEACTIVATE_EMPLOYEE': 'Employee Deactivated',
  'REACTIVATE_EMPLOYEE': 'Employee Reactivated',
  'VERIFY_DOCUMENT': 'Document Verified',
  'REJECT_DOCUMENT': 'Document Rejected',
  'GENERATE_DOCUMENT': 'Document Generated',
  'EXPORT_EMPLOYEE_DATA': 'Data Exported',
  'BULK_APPROVE': 'Bulk Approval',
  'UPDATE_LEAVE_BALANCE': 'Leave Balance Updated',
  'MANAGE_HOLIDAYS': 'Holiday Management',
}

const HR_ENTITY_LABELS: Record<string, string> = {
  'LEAVE_REQUEST': 'Leave Request',
  'WFH_REQUEST': 'WFH Request',
  'USER': 'Employee',
  'DOCUMENT': 'Document',
  'HOLIDAY': 'Holiday',
  'LEAVE_BALANCE': 'Leave Balance',
}

const ACTION_ICONS: Record<string, any> = {
  'APPROVE': CheckCircle,
  'REJECT': XCircle,
  'CREATE': FileText,
  'UPDATE': Settings,
  'DEACTIVATE': UserX,
  'REACTIVATE': UserCheck,
  'VERIFY': CheckCircle,
  'EXPORT': Download,
  'BULK': Users,
  'MANAGE': Settings,
}

export function HRAuditLogViewer() {
  const [logs, setLogs] = useState<HRAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<HRAuditLog | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [summary, setSummary] = useState<AuditLogSummary | null>(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const logsPerPage = 15

  useEffect(() => {
    fetchLogs()
  }, [currentPage, actionFilter, entityFilter, dateFrom, dateTo])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: logsPerPage.toString(),
      })
      
      if (actionFilter !== 'all') params.append('action', actionFilter)
      if (entityFilter !== 'all') params.append('entity', entityFilter)
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/hr/audit-logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.auditLogs)
        setTotalPages(data.pagination.totalPages)
        setTotalLogs(data.pagination.totalCount)
        setSummary(data.summary)
      } else {
        toast.error('Failed to fetch HR audit logs')
      }
    } catch (error) {
      console.error('Error fetching HR audit logs:', error)
      toast.error('Error fetching HR audit logs')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    fetchLogs()
  }

  const clearFilters = () => {
    setSearchTerm("")
    setActionFilter("all")
    setEntityFilter("all")
    setDateFrom("")
    setDateTo("")
    setCurrentPage(1)
    fetchLogs()
  }

  const viewDetails = (log: HRAuditLog) => {
    setSelectedLog(log)
    setDetailsOpen(true)
  }

  const getActionIcon = (action: string) => {
    const actionType = action.split('_')[0] || ''
    const Icon = ACTION_ICONS[actionType] || Activity
    return <Icon className="h-4 w-4" />
  }

  const getActionBadgeColor = (action: string) => {
    if (action.includes('APPROVE') || action.includes('VERIFY') || action.includes('REACTIVATE')) {
      return 'bg-green-100 text-green-800 border-green-200'
    }
    if (action.includes('REJECT') || action.includes('DEACTIVATE') || action.includes('CANCEL')) {
      return 'bg-red-100 text-red-800 border-red-200'
    }
    if (action.includes('CREATE') || action.includes('GENERATE')) {
      return 'bg-blue-100 text-blue-800 border-blue-200'
    }
    if (action.includes('UPDATE') || action.includes('EDIT') || action.includes('MANAGE')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
    if (action.includes('EXPORT') || action.includes('BULK')) {
      return 'bg-purple-100 text-purple-800 border-purple-200'
    }
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Activity</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.todayCount}</div>
              <p className="text-xs text-muted-foreground">HR actions today</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.weekCount}</div>
              <p className="text-xs text-muted-foreground">Actions this week</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.monthCount}</div>
              <p className="text-xs text-muted-foreground">Actions this month</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                HR Audit Trail
              </CardTitle>
              <CardDescription>
                Track HR activities, employee management, and leave processing
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchLogs}
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={clearFilters}
                size="sm"
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="flex gap-2">
                  <Input
                    id="search"
                    placeholder="Search by user, action..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button size="icon" onClick={handleSearch} variant="outline">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label>Action Type</Label>
                <Select value={actionFilter} onValueChange={(value) => {
                  setActionFilter(value)
                  setCurrentPage(1)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {Object.entries(HR_ACTION_LABELS).map(([action, label]) => (
                      <SelectItem key={action} value={action}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Entity Type</Label>
                <Select value={entityFilter} onValueChange={(value) => {
                  setEntityFilter(value)
                  setCurrentPage(1)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    {Object.entries(HR_ENTITY_LABELS).map(([entity, label]) => (
                      <SelectItem key={entity} value={entity}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateFrom">From Date</Label>
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
                <Label htmlFor="dateTo">To Date</Label>
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
              <p>Loading HR audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-6 w-6 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">No audit logs found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead className="w-[80px]">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-gray-50">
                        <TableCell className="font-mono text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <div>
                              <div>{format(new Date(log.timestamp), 'MMM dd')}</div>
                              <div className="text-gray-500">{format(new Date(log.timestamp), 'HH:mm')}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {log.user?.firstName || ''} {log.user?.lastName || ''}
                            </p>
                            <p className="text-xs text-gray-500">{log.user?.email || ''}</p>
                            <p className="text-xs text-gray-400">{log.user?.department || ''}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getActionBadgeColor(log.action)}>
                            <span className="flex items-center gap-1">
                              {getActionIcon(log.action)}
                              {HR_ACTION_LABELS[log.action] || log.action}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {HR_ENTITY_LABELS[log.entity] || log.entity}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                            {log.entityId.slice(0, 8)}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewDetails(log)}
                            className="h-8 w-8 p-0"
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
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = Math.max(1, currentPage - 2 + i)
                      if (page <= totalPages) {
                        return (
                          <Button
                            key={page}
                            variant={page === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
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
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Complete information about this HR action
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Timestamp</Label>
                  <p className="font-mono text-sm mt-1">
                    {format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Log ID</Label>
                  <p className="font-mono text-sm mt-1">{selectedLog.id}</p>
                </div>
              </div>

              {/* User & Action */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Performed By</Label>
                  <div className="mt-1 p-3 border rounded-lg">
                    <p className="font-medium">
                      {selectedLog?.user?.firstName || ''} {selectedLog?.user?.lastName || ''}
                    </p>
                    <p className="text-sm text-gray-600">{selectedLog?.user?.email || ''}</p>
                    <p className="text-sm text-gray-500">
                      {selectedLog?.user?.department || ''} • {selectedLog?.user?.role || ''}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Action</Label>
                  <div className="mt-1">
                    <Badge className={getActionBadgeColor(selectedLog.action)}>
                      <span className="flex items-center gap-1">
                        {getActionIcon(selectedLog.action)}
                        {HR_ACTION_LABELS[selectedLog.action] || selectedLog.action}
                      </span>
                    </Badge>
                    <p className="text-sm text-gray-500 mt-1">
                      Target: {HR_ENTITY_LABELS[selectedLog.entity] || selectedLog.entity}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">
                      ID: {selectedLog.entityId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Changes */}
              {(selectedLog.oldValues || selectedLog.newValues) && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Changes Made</Label>
                  <div className="grid gap-3">
                    {selectedLog.oldValues && (
                      <div>
                        <Label className="text-xs text-gray-600">Previous Values</Label>
                        <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-md">
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(selectedLog.oldValues, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                    {selectedLog.newValues && (
                      <div>
                        <Label className="text-xs text-gray-600">New Values</Label>
                        <div className="mt-1 p-3 bg-green-50 border border-green-200 rounded-md">
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(selectedLog.newValues, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Details */}
              {selectedLog.details && (
                <div>
                  <Label className="text-sm font-medium">Additional Details</Label>
                  <div className="mt-2 p-4 bg-gray-50 border rounded-md">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}