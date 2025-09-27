"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  FileText,
  Trash2,
  AlertCircle,
  Shield,
  Clock,
  Archive,
} from "lucide-react"
import { toast } from "sonner"

interface RetentionPolicy {
  retentionDays: number
  autoDelete: boolean
  deleteAfterApproval: boolean
  deleteAfterApprovalDays: number
  enableAnonymization: boolean
  anonymizeAfterDays: number
}

export function DocumentRetentionSettings() {
  const [policy, setPolicy] = useState<RetentionPolicy>({
    retentionDays: 90,
    autoDelete: false,
    deleteAfterApproval: false,
    deleteAfterApprovalDays: 60,
    enableAnonymization: false,
    anonymizeAfterDays: 365,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPolicy()
  }, [])

  const fetchPolicy = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/document-retention')
      if (response.ok) {
        const data = await response.json()
        setPolicy(data.policy)
      } else {
        toast.error('Failed to load retention policy')
      }
    } catch (error) {
      console.error('Error fetching policy:', error)
      toast.error('Failed to load retention policy')
    } finally {
      setLoading(false)
    }
  }

  const savePolicy = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/admin/document-retention', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      })

      if (response.ok) {
        toast.success('Document retention policy updated')
      } else {
        toast.error('Failed to update policy')
      }
    } catch (error) {
      console.error('Error saving policy:', error)
      toast.error('Failed to update policy')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading retention settings...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Document Retention Policy
        </CardTitle>
        <CardDescription>
          Configure how supporting documents are retained and disposed of
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Document retention policies help maintain privacy compliance and reduce storage costs.
            Deleted documents cannot be recovered.
          </AlertDescription>
        </Alert>

        {/* Delete After Approval */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-600" />
                <Label htmlFor="deleteAfterApproval" className="text-base font-medium">
                  Delete Documents After Approval
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically remove supporting documents after leave request is approved
              </p>
            </div>
            <Switch
              id="deleteAfterApproval"
              checked={policy.deleteAfterApproval}
              onCheckedChange={(checked) => 
                setPolicy({ ...policy, deleteAfterApproval: checked })
              }
            />
          </div>
          {policy.deleteAfterApproval && (
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="deleteAfterApprovalDays">Days to retain after approval</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="deleteAfterApprovalDays"
                    type="number"
                    value={policy.deleteAfterApprovalDays}
                    onChange={(e) => 
                      setPolicy({ ...policy, deleteAfterApprovalDays: parseInt(e.target.value) || 60 })
                    }
                    min="1"
                    max="365"
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">
                    Documents will be deleted {policy.deleteAfterApprovalDays} days after approval
                  </span>
                </div>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Documents will be permanently deleted {policy.deleteAfterApprovalDays} days after approval. 
                  HR verification notes will be preserved with deletion timestamp.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Auto-Delete Old Documents */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-600" />
                <Label htmlFor="autoDelete" className="text-base font-medium">
                  Auto-Delete Old Documents
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Remove documents older than specified retention period
              </p>
            </div>
            <Switch
              id="autoDelete"
              checked={policy.autoDelete}
              onCheckedChange={(checked) => 
                setPolicy({ ...policy, autoDelete: checked })
              }
            />
          </div>
          {policy.autoDelete && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="retentionDays">Retention Period (days)</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="retentionDays"
                  type="number"
                  value={policy.retentionDays}
                  onChange={(e) => 
                    setPolicy({ ...policy, retentionDays: parseInt(e.target.value) || 90 })
                  }
                  min="30"
                  max="730"
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">
                  Documents older than {policy.retentionDays} days will be deleted
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Anonymization */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <Label htmlFor="enableAnonymization" className="text-base font-medium">
                  Data Anonymization
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Anonymize old leave request details for privacy compliance
              </p>
            </div>
            <Switch
              id="enableAnonymization"
              checked={policy.enableAnonymization}
              onCheckedChange={(checked) => 
                setPolicy({ ...policy, enableAnonymization: checked })
              }
            />
          </div>
          {policy.enableAnonymization && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="anonymizeAfterDays">Anonymize After (days)</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="anonymizeAfterDays"
                  type="number"
                  value={policy.anonymizeAfterDays}
                  onChange={(e) => 
                    setPolicy({ ...policy, anonymizeAfterDays: parseInt(e.target.value) || 365 })
                  }
                  min="180"
                  max="3650"
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">
                  Request details will be anonymized after {policy.anonymizeAfterDays} days
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Anonymization replaces personal details and reasons with "[Anonymized]"
              </p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium mb-2">Current Policy Summary</h4>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground">•</span>
              {policy.deleteAfterApproval ? (
                <span>Documents deleted {policy.deleteAfterApprovalDays} days after approval</span>
              ) : (
                <span className="text-muted-foreground">Documents retained after approval</span>
              )}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground">•</span>
              {policy.autoDelete ? (
                <span>Documents deleted after {policy.retentionDays} days</span>
              ) : (
                <span className="text-muted-foreground">No automatic deletion based on age</span>
              )}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground">•</span>
              {policy.enableAnonymization ? (
                <span>Data anonymized after {policy.anonymizeAfterDays} days</span>
              ) : (
                <span className="text-muted-foreground">Data anonymization disabled</span>
              )}
            </li>
          </ul>
        </div>

        <div className="flex justify-end">
          <Button onClick={savePolicy} disabled={saving}>
            {saving ? 'Saving...' : 'Save Policy'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}