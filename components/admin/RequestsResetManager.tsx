"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { 
  Trash2, 
  AlertTriangle, 
  FileText, 
  Users, 
  Calendar,
  CheckCircle,
  Eye,
  RefreshCw
} from "lucide-react"
import { toast } from "sonner"

interface ResetCounts {
  leaveRequests: number
  wfhRequests: number
  approvals: number
  wfhApprovals: number
  substituteLinks: number
  documents: number
  documentSignatures: number
}

interface ResetStats {
  leaveRequests: number
  wfhRequests: number
  approvals: number
  wfhApprovals: number
  substituteLinks: number
  documents: number
  documentSignatures: number
  filesDeleted: number
  filesFailedToDelete: string[]
}

export function RequestsResetManager() {
  const [counts, setCounts] = useState<ResetCounts | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetType, setResetType] = useState<string>("FULL")
  const [confirmationText, setConfirmationText] = useState("")
  const [lastResetStats, setLastResetStats] = useState<ResetStats | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    fetchCounts()
  }, [])

  // Clear confirmation text when reset type changes
  useEffect(() => {
    setConfirmationText("")
  }, [resetType])

  const fetchCounts = async () => {
    try {
      const response = await fetch('/api/admin/reset-requests')
      if (response.ok) {
        const data = await response.json()
        setCounts(data.counts)
      }
    } catch (error) {
      console.error('Error fetching counts:', error)
      toast.error('Failed to fetch data counts')
    }
  }

  const handleReset = async () => {
    const expectedText = resetType === 'BALANCE_ONLY' ? 'RESET BALANCES' : 'DELETE ALL REQUESTS'
    if (confirmationText !== expectedText) {
      toast.error(`Please type "${expectedText}" to confirm`)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/admin/reset-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          confirmationText, 
          resetType 
        })
      })

      const data = await response.json()

      if (response.ok) {
        setLastResetStats(data.statistics)
        setConfirmationText("")
        setShowConfirmation(false)
        await fetchCounts() // Refresh counts
        toast.success('Reset completed successfully!')
      } else {
        toast.error(data.error || 'Reset failed')
      }
    } catch (error) {
      console.error('Error during reset:', error)
      toast.error('Reset failed due to an error')
    } finally {
      setLoading(false)
    }
  }

  const getResetDescription = () => {
    switch (resetType) {
      case 'LEAVE_ONLY':
        return 'Delete only leave requests and their approvals/documents'
      case 'WFH_ONLY':
        return 'Delete only work-from-home requests and their approvals'
      case 'BALANCE_ONLY':
        return 'Reset leave balances to 30 days default (entitled: 30, used: 0, pending: 0) without deleting requests'
      case 'FULL':
      default:
        return 'Delete ALL requests, approvals, and documents'
    }
  }

  const hasData = counts && (
    counts.leaveRequests > 0 || 
    counts.wfhRequests > 0 || 
    counts.documents > 0
  )

  // For balance-only reset, we don't need any requests to exist
  const canReset = resetType === 'BALANCE_ONLY' || hasData

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Reset All Requests
          </CardTitle>
          <CardDescription>
            Permanently delete leave requests, WFH requests, and associated documents. 
            <strong className="text-red-600"> This action cannot be undone.</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Data Summary */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Current Data Summary
              </h3>
              <Button variant="outline" size="sm" onClick={fetchCounts}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
            
            {counts ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <Calendar className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                  <div className="text-2xl font-bold text-blue-600">{counts.leaveRequests}</div>
                  <div className="text-xs text-gray-600">Leave Requests</div>
                </div>
                
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <Users className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <div className="text-2xl font-bold text-green-600">{counts.wfhRequests}</div>
                  <div className="text-xs text-gray-600">WFH Requests</div>
                </div>
                
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <CheckCircle className="h-8 w-8 mx-auto text-orange-500 mb-2" />
                  <div className="text-2xl font-bold text-orange-600">
                    {counts.approvals + counts.wfhApprovals}
                  </div>
                  <div className="text-xs text-gray-600">Total Approvals</div>
                </div>
                
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <FileText className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                  <div className="text-2xl font-bold text-purple-600">{counts.documents}</div>
                  <div className="text-xs text-gray-600">Documents</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">Loading data...</div>
            )}
          </div>

          <Separator />

          {/* Reset Type Selection */}
          <div>
            <Label className="text-base font-medium">Reset Type</Label>
            <RadioGroup value={resetType} onValueChange={setResetType} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="FULL" id="full" />
                <Label htmlFor="full">Full Reset - Delete everything</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="LEAVE_ONLY" id="leave" />
                <Label htmlFor="leave">Leave Requests Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="WFH_ONLY" id="wfh" />
                <Label htmlFor="wfh">WFH Requests Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="BALANCE_ONLY" id="balance" />
                <Label htmlFor="balance">Leave Balances Only</Label>
              </div>
            </RadioGroup>
            <p className="text-sm text-gray-600 mt-2">{getResetDescription()}</p>
          </div>

          <Separator />

          {/* Confirmation Section */}
          {!canReset ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No data to reset. The database appears to be clean.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> {resetType === 'BALANCE_ONLY' ? (
                    <>This will reset all leave balances to 30 days default (entitled: 30, used: 0, pending: 0, available: 30). Request data will remain intact. This action cannot be undone.</>
                  ) : (
                    <>This will permanently delete all selected data including:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All request records from the database</li>
                      <li>All approval records and workflows</li>
                      <li>All generated documents and their files</li>
                      <li>All signatures and document metadata</li>
                    </ul>
                    This action cannot be undone.</>
                  )}
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="confirmation">
                  Type <code className="bg-gray-100 px-1 rounded">{resetType === 'BALANCE_ONLY' ? 'RESET BALANCES' : 'DELETE ALL REQUESTS'}</code> to confirm:
                </Label>
                <Input
                  id="confirmation"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder={resetType === 'BALANCE_ONLY' ? 'RESET BALANCES' : 'DELETE ALL REQUESTS'}
                  className="mt-1"
                />
              </div>

              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={loading || confirmationText !== (resetType === 'BALANCE_ONLY' ? 'RESET BALANCES' : 'DELETE ALL REQUESTS')}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Reset {resetType === 'FULL' ? 'All' : resetType === 'BALANCE_ONLY' ? 'Leave Balances' : resetType.replace('_', ' ')} {resetType === 'BALANCE_ONLY' ? '' : 'Requests'}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Reset Results */}
      {lastResetStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Last Reset Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-lg font-semibold">{lastResetStats.leaveRequests}</div>
                <div className="text-sm text-gray-600">Leave Requests Deleted</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{lastResetStats.wfhRequests}</div>
                <div className="text-sm text-gray-600">WFH Requests Deleted</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{lastResetStats.documents}</div>
                <div className="text-sm text-gray-600">Documents Deleted</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{lastResetStats.filesDeleted}</div>
                <div className="text-sm text-gray-600">Files Cleaned Up</div>
              </div>
            </div>
            
            {lastResetStats.filesFailedToDelete.length > 0 && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {lastResetStats.filesFailedToDelete.length} files failed to delete from storage.
                  Document IDs: {lastResetStats.filesFailedToDelete.join(', ')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}