"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { 
  Settings,
  Clock,
  AlertCircle,
  CheckCircle,
  UserCheck,
  Users,
  Save,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Shield
} from "lucide-react"
import { toast } from "sonner"

interface EscalationConfig {
  // General Settings
  enabled: boolean
  escalationTimeout: number // hours before escalation
  maxEscalationLevels: number
  autoApproveAfterMaxEscalations: boolean
  
  // Notification Settings
  sendEmailNotifications: boolean
  sendReminderBeforeEscalation: boolean
  reminderTime: number // hours before escalation
  
  // Skip Settings
  skipAbsentApprovers: boolean
  skipIfDelegated: boolean
  
  // Default Escalation Chains
  defaultManagerChain: string[]
  defaultHRChain: string[]
  defaultExecutiveChain: string[]
}

export function EscalationSettings() {
  const [config, setConfig] = useState<EscalationConfig>({
    enabled: true,
    escalationTimeout: 48,
    maxEscalationLevels: 3,
    autoApproveAfterMaxEscalations: true,
    sendEmailNotifications: true,
    sendReminderBeforeEscalation: true,
    reminderTime: 24,
    skipAbsentApprovers: true,
    skipIfDelegated: true,
    defaultManagerChain: ['MANAGER', 'DEPARTMENT_DIRECTOR', 'HR'],
    defaultHRChain: ['HR', 'EXECUTIVE'],
    defaultExecutiveChain: ['EXECUTIVE']
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testMode, setTestMode] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/escalation-settings')
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          setConfig(data.settings)
        }
      }
    } catch (error) {
      console.error('Error fetching escalation settings:', error)
      toast.error('Failed to load escalation settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/escalation-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        toast.success('Escalation settings saved successfully')
      } else {
        toast.error('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const handleTestEscalation = async () => {
    setTestMode(true)
    try {
      const response = await fetch('/api/admin/escalation-settings/test', {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        toast.success('Test escalation completed. Check the logs for details.')
      } else {
        toast.error('Test escalation failed')
      }
    } catch (error) {
      console.error('Error testing escalation:', error)
      toast.error('Error running test')
    } finally {
      setTestMode(false)
    }
  }

  const escalationChainOptions = [
    { value: 'MANAGER', label: 'Direct Manager' },
    { value: 'DEPARTMENT_DIRECTOR', label: 'Department Director' },
    { value: 'HR', label: 'HR Department' },
    { value: 'EXECUTIVE', label: 'Executive' },
    { value: 'SKIP', label: 'Skip Level' }
  ]

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">Loading escalation settings...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Escalation Settings
              </CardTitle>
              <CardDescription>
                Configure automatic approval escalation rules and timeouts
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleTestEscalation}
                disabled={testMode}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${testMode ? 'animate-spin' : ''}`} />
                Test Escalation
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="timeouts">Timeouts</TabsTrigger>
              <TabsTrigger value="chains">Escalation Chains</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Enable Escalation</Label>
                    <p className="text-sm text-gray-500">
                      Automatically escalate pending approvals after timeout
                    </p>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Skip Absent Approvers</Label>
                    <p className="text-sm text-gray-500">
                      Automatically skip approvers who are on leave
                    </p>
                  </div>
                  <Switch
                    checked={config.skipAbsentApprovers}
                    onCheckedChange={(checked) => setConfig({ ...config, skipAbsentApprovers: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Honor Delegations</Label>
                    <p className="text-sm text-gray-500">
                      Route to delegate if approver has active delegation
                    </p>
                  </div>
                  <Switch
                    checked={config.skipIfDelegated}
                    onCheckedChange={(checked) => setConfig({ ...config, skipIfDelegated: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Auto-Approve After Max Escalations</Label>
                    <p className="text-sm text-gray-500">
                      Automatically approve if max escalation levels reached
                    </p>
                  </div>
                  <Switch
                    checked={config.autoApproveAfterMaxEscalations}
                    onCheckedChange={(checked) => setConfig({ ...config, autoApproveAfterMaxEscalations: checked })}
                  />
                </div>

                <div className="p-4 border rounded-lg space-y-2">
                  <Label>Maximum Escalation Levels</Label>
                  <Select
                    value={config.maxEscalationLevels.toString()}
                    onValueChange={(value) => setConfig({ ...config, maxEscalationLevels: parseInt(value) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Level</SelectItem>
                      <SelectItem value="2">2 Levels</SelectItem>
                      <SelectItem value="3">3 Levels</SelectItem>
                      <SelectItem value="4">4 Levels</SelectItem>
                      <SelectItem value="5">5 Levels</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Number of times a request can be escalated
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timeouts" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg space-y-2">
                  <Label>Escalation Timeout</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={config.escalationTimeout}
                      onChange={(e) => setConfig({ ...config, escalationTimeout: parseInt(e.target.value) || 48 })}
                      className="w-24"
                      min="1"
                      max="168"
                    />
                    <span className="text-sm text-gray-500">hours</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Time before escalating to next approver (1-168 hours)
                  </p>
                </div>

                <div className="p-4 border rounded-lg space-y-2">
                  <Label>Reminder Time</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={config.reminderTime}
                      onChange={(e) => setConfig({ ...config, reminderTime: parseInt(e.target.value) || 24 })}
                      className="w-24"
                      min="1"
                      max="48"
                      disabled={!config.sendReminderBeforeEscalation}
                    />
                    <span className="text-sm text-gray-500">hours before escalation</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Send reminder this many hours before escalating
                  </p>
                </div>

                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Current Settings:</strong><br />
                    • Requests will escalate after {config.escalationTimeout} hours<br />
                    • Reminders sent {config.reminderTime} hours before escalation<br />
                    • Total wait time: {config.escalationTimeout} hours per level
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            <TabsContent value="chains" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg space-y-3">
                  <Label className="text-base font-medium">Default Manager Escalation Chain</Label>
                  <div className="flex items-center gap-2">
                    <Badge>1. Direct Manager</Badge>
                    <span className="text-gray-400">→</span>
                    <Badge>2. Department Director</Badge>
                    <span className="text-gray-400">→</span>
                    <Badge>3. HR Department</Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    Standard escalation path for employee requests
                  </p>
                </div>

                <div className="p-4 border rounded-lg space-y-3">
                  <Label className="text-base font-medium">HR Escalation Chain</Label>
                  <div className="flex items-center gap-2">
                    <Badge>1. HR Manager</Badge>
                    <span className="text-gray-400">→</span>
                    <Badge>2. Executive</Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    Escalation path for HR-initiated requests
                  </p>
                </div>

                <div className="p-4 border rounded-lg space-y-3">
                  <Label className="text-base font-medium">Executive Escalation Chain</Label>
                  <div className="flex items-center gap-2">
                    <Badge>1. Executive Team</Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    Executive requests require executive approval only
                  </p>
                </div>

                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    Escalation chains can be customized per department or team.
                    Contact system administrator for custom configurations.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Email Notifications</Label>
                    <p className="text-sm text-gray-500">
                      Send email when requests are escalated
                    </p>
                  </div>
                  <Switch
                    checked={config.sendEmailNotifications}
                    onCheckedChange={(checked) => setConfig({ ...config, sendEmailNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Send Reminders</Label>
                    <p className="text-sm text-gray-500">
                      Remind approvers before escalating
                    </p>
                  </div>
                  <Switch
                    checked={config.sendReminderBeforeEscalation}
                    onCheckedChange={(checked) => setConfig({ ...config, sendReminderBeforeEscalation: checked })}
                  />
                </div>

                {config.sendEmailNotifications && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <strong>Email Templates:</strong><br />
                      • Escalation notification to new approver<br />
                      • Notification to requester about escalation<br />
                      • Reminder to pending approver<br />
                      • Auto-approval notification
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-gray-600" />
              <Label className="text-sm font-medium">Escalation Status</Label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Status</p>
                <p className="font-medium">{config.enabled ? 'Active' : 'Disabled'}</p>
              </div>
              <div>
                <p className="text-gray-500">Timeout</p>
                <p className="font-medium">{config.escalationTimeout} hours</p>
              </div>
              <div>
                <p className="text-gray-500">Max Levels</p>
                <p className="font-medium">{config.maxEscalationLevels}</p>
              </div>
              <div>
                <p className="text-gray-500">Auto-Approve</p>
                <p className="font-medium">{config.autoApproveAfterMaxEscalations ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}