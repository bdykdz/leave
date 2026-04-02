"use client"

import { useState, useEffect, useCallback } from "react"
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
  Download,
  RefreshCw,
  Archive,
  FileText,
  FolderOpen,
  HardDrive,
  Calendar,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import { toast } from "sonner"

interface ExportStats {
  totalFiles: number
  totalSize: number
  lastSync: string | null
  byStatus: Record<string, number>
  byMonth: Record<string, number>
}

interface SyncResult {
  success: boolean
  newFiles: number
  skippedFiles: number
  errors: string[]
  totalFiles: number
  timestamp: string
}

export function DocumentExportPanel() {
  const [stats, setStats] = useState<ExportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)

  // Filter state
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [employeeFilter, setEmployeeFilter] = useState("")
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("")

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/document-export")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Failed to fetch export stats:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleSync = async () => {
    setSyncing(true)
    setLastSyncResult(null)
    try {
      const response = await fetch("/api/admin/document-export", { method: "POST" })
      const data = await response.json()
      if (response.ok) {
        setLastSyncResult(data)
        toast.success(`Sync complete: ${data.newFiles} new files exported`)
        fetchStats()
      } else {
        toast.error(data.error || "Sync failed")
      }
    } catch (error) {
      toast.error("Failed to trigger sync")
    } finally {
      setSyncing(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter)
      if (employeeFilter) params.set("employee", employeeFilter)
      if (leaveTypeFilter) params.set("leaveType", leaveTypeFilter)

      const response = await fetch(`/api/admin/document-export/download?${params}`)
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Download failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `document-export-${new Date().toISOString().split("T")[0]}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success("Export downloaded successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download export")
    } finally {
      setDownloading(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (iso: string) => {
    if (!iso) return "Never"
    const d = new Date(iso)
    return d.toLocaleString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Archive className="h-6 w-6" />
          Document Export
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Sync MinIO documents to local storage and download filtered exports
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalFiles || 0}</p>
                <p className="text-sm text-gray-500">Total Files</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{formatSize(stats?.totalSize || 0)}</p>
                <p className="text-sm text-gray-500">Total Size</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.byStatus?.generated || 0}</p>
                <p className="text-sm text-gray-500">Generated</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.byStatus?.draft || 0}</p>
                <p className="text-sm text-gray-500">Drafts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync from MinIO
          </CardTitle>
          <CardDescription>
            Last sync: {stats?.lastSync ? formatDate(stats.lastSync) : "Never"}
            {" "} | Automatic sync runs daily at 01:00 UTC
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={handleSync} disabled={syncing} className="flex items-center gap-2">
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
            {lastSyncResult && (
              <div className="flex items-center gap-2 text-sm">
                {lastSyncResult.errors.length === 0 ? (
                  <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {lastSyncResult.newFiles} new, {lastSyncResult.skippedFiles} skipped
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    {lastSyncResult.errors.length} errors
                  </Badge>
                )}
                <span className="text-gray-500">
                  Total: {lastSyncResult.totalFiles} files
                </span>
              </div>
            )}
          </div>
          {lastSyncResult?.errors && lastSyncResult.errors.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm font-medium mb-1">
                <AlertCircle className="h-4 w-4" />
                Sync Errors
              </div>
              {lastSyncResult.errors.map((err, i) => (
                <p key={i} className="text-sm text-red-600 dark:text-red-400 ml-6">{err}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      {stats?.byMonth && Object.keys(stats.byMonth).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Files by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byMonth)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([month, count]) => (
                  <Badge key={month} variant="outline" className="text-sm py-1 px-3">
                    {month}: {count} files
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Download Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Export
          </CardTitle>
          <CardDescription>
            Filter and download documents as a ZIP archive with manifest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="generated">Generated (Approved)</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Employee (name filter)</Label>
              <Input
                placeholder="e.g. florentin.trache"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Input
                placeholder="e.g. concediu-odihna"
                value={leaveTypeFilter}
                onChange={(e) => setLeaveTypeFilter(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading || !stats?.totalFiles}
            className="flex items-center gap-2"
          >
            {downloading ? (
              <>
                <Download className="h-4 w-4 animate-pulse" />
                Generating ZIP...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download ZIP
              </>
            )}
          </Button>
          {!stats?.totalFiles && (
            <p className="text-sm text-amber-600 mt-2">
              No files exported yet. Run a sync first.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
