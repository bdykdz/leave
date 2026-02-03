"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Database, 
  AlertTriangle, 
  CheckCircle,
  Eye,
  RefreshCw,
  ArrowRight
} from "lucide-react"
import { toast } from "sonner"

interface MigrationStats {
  totalFound: number
  migrated: number
  failed: number
  failedRequests: string[]
}

interface DryRunRequest {
  id: string
  user: string
  dateRange: string
  selectedDatesCount: number
}

export function SelectedDatesMigration() {
  const [loading, setLoading] = useState(false)
  const [dryRunLoading, setDryRunLoading] = useState(false)
  const [dryRunResults, setDryRunResults] = useState<{count: number, requests: DryRunRequest[]} | null>(null)
  const [migrationResults, setMigrationResults] = useState<MigrationStats | null>(null)

  const fetchDryRun = async () => {
    try {
      setDryRunLoading(true)
      const response = await fetch('/api/admin/migrate-selected-dates')
      if (response.ok) {
        const data = await response.json()
        setDryRunResults(data)
      } else {
        toast.error('Failed to fetch migration preview')
      }
    } catch (error) {
      console.error('Error fetching dry run:', error)
      toast.error('Failed to fetch migration preview')
    } finally {
      setDryRunLoading(false)
    }
  }

  const runMigration = async () => {
    if (!confirm('Are you sure you want to migrate selectedDates for existing leave requests? This will update the database.')) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/admin/migrate-selected-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (response.ok) {
        setMigrationResults(data.statistics)
        setDryRunResults(null) // Clear dry run results after migration
        toast.success('Migration completed successfully!')
      } else {
        toast.error(data.error || 'Migration failed')
      }
    } catch (error) {
      console.error('Error during migration:', error)
      toast.error('Migration failed due to an error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-600">
          <Database className="h-5 w-5" />
          Calendar selectedDates Migration
        </CardTitle>
        <CardDescription>
          Migrate existing leave requests to populate the selectedDates field for proper calendar display.
          This fixes requests created before the calendar fix was deployed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Migration Info */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Purpose:</strong> This migration fixes existing leave requests so they display correctly on the calendar.
            Requests created before the recent calendar fix don't have the selectedDates field populated, 
            causing them to show only on the end date instead of all selected dates.
          </AlertDescription>
        </Alert>

        {/* Dry Run Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview Migration
            </h3>
            <Button variant="outline" size="sm" onClick={fetchDryRun} disabled={dryRunLoading}>
              {dryRunLoading ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Eye className="h-3 w-3 mr-1" />
              )}
              Check
            </Button>
          </div>
          
          {dryRunResults && (
            <div className="border rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-blue-100">
                  {dryRunResults.count} requests found
                </Badge>
                <span className="text-sm text-gray-600">that need migration</span>
              </div>
              
              {dryRunResults.count > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {dryRunResults.requests.map((req) => (
                    <div key={req.id} className="text-sm bg-white p-2 rounded border">
                      <div className="font-medium">{req.user}</div>
                      <div className="text-gray-600">{req.dateRange}</div>
                      <div className="text-xs text-blue-600">{req.selectedDatesCount} selected dates</div>
                    </div>
                  ))}
                </div>
              )}
              
              {dryRunResults.count === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p>No requests need migration. All requests are up to date!</p>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Migration Action */}
        {dryRunResults && dryRunResults.count > 0 && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This will update {dryRunResults.count} leave requests in the database.
                The migration is safe and only populates missing selectedDates fields.
              </AlertDescription>
            </Alert>

            <Button
              onClick={runMigration}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Run Migration ({dryRunResults.count} requests)
                </>
              )}
            </Button>
          </div>
        )}

        {/* Migration Results */}
        {migrationResults && (
          <div className="border rounded-lg p-4 bg-green-50">
            <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Migration Results
            </h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-green-600">{migrationResults.migrated}</div>
                <div className="text-xs text-gray-600">Migrated</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-600">{migrationResults.totalFound}</div>
                <div className="text-xs text-gray-600">Total Found</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-600">{migrationResults.failed}</div>
                <div className="text-xs text-gray-600">Failed</div>
              </div>
            </div>
            
            {migrationResults.failedRequests.length > 0 && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {migrationResults.failedRequests.length} requests failed to migrate.
                  Request IDs: {migrationResults.failedRequests.join(', ')}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}