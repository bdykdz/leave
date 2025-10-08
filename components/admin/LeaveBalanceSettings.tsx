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
  Settings,
  Calendar,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Save,
  RefreshCw,
  Calculator,
  DollarSign,
  Clock,
  PlayCircle
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface BalanceConfig {
  // Working Days
  excludeWeekends: boolean
  excludePublicHolidays: boolean
  
  // Pro-rating
  proRateEnabled: boolean
  proRateMethod: 'DAYS_REMAINING' | 'MONTHS_REMAINING'
  
  // Carry Forward
  carryForwardEnabled: boolean
  maxCarryForwardDays: number
  carryForwardExpiryMonths: number
  autoExpireCarryForward: boolean
  
  // Balance Enforcement
  allowNegativeBalance: boolean
  maxNegativeBalanceDays: number
  requireApprovalForNegative: boolean
  
  // Year-end Processing
  yearEndProcessingAuto: boolean
  yearEndProcessingDate: string // MM-DD format
  notifyUsersBeforeYearEnd: boolean
  notificationDaysBefore: number
}

export function LeaveBalanceSettings() {
  const [config, setConfig] = useState<BalanceConfig>({
    excludeWeekends: true,
    excludePublicHolidays: true,
    proRateEnabled: true,
    proRateMethod: 'DAYS_REMAINING',
    carryForwardEnabled: true,
    maxCarryForwardDays: 10,
    carryForwardExpiryMonths: 3,
    autoExpireCarryForward: true,
    allowNegativeBalance: false,
    maxNegativeBalanceDays: 0,
    requireApprovalForNegative: true,
    yearEndProcessingAuto: true,
    yearEndProcessingDate: '12-31',
    notifyUsersBeforeYearEnd: true,
    notificationDaysBefore: 30
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [processingYearEnd, setProcessingYearEnd] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/leave-balance-settings')
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          setConfig(data.settings)
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Failed to load balance settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/leave-balance-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        toast.success('Leave balance settings saved successfully')
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

  const handleProcessYearEnd = async () => {
    if (!confirm('This will process year-end carry forward for all users. Continue?')) {
      return
    }

    setProcessingYearEnd(true)
    try {
      const response = await fetch('/api/admin/leave-balance/process-year-end', {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`Year-end processing completed. Processed ${result.processed} users.`)
      } else {
        toast.error('Year-end processing failed')
      }
    } catch (error) {
      console.error('Error processing year-end:', error)
      toast.error('Error processing year-end')
    } finally {
      setProcessingYearEnd(false)
    }
  }

  const handleRecalculateBalances = async () => {
    if (!confirm('This will recalculate all leave balances. Continue?')) {
      return
    }

    try {
      const response = await fetch('/api/admin/leave-balance/recalculate', {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('Leave balances recalculated successfully')
      } else {
        toast.error('Failed to recalculate balances')
      }
    } catch (error) {
      console.error('Error recalculating balances:', error)
      toast.error('Error recalculating balances')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">Loading balance settings...</div>
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
                <Calculator className="h-5 w-5" />
                Leave Balance Settings
              </CardTitle>
              <CardDescription>
                Configure working days calculation, pro-rating, and carry-forward rules
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRecalculateBalances}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Recalculate All
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
          <Tabs defaultValue="working-days" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="working-days">Working Days</TabsTrigger>
              <TabsTrigger value="pro-rating">Pro-rating</TabsTrigger>
              <TabsTrigger value="carry-forward">Carry Forward</TabsTrigger>
              <TabsTrigger value="enforcement">Enforcement</TabsTrigger>
            </TabsList>

            <TabsContent value="working-days" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Exclude Weekends</Label>
                    <p className="text-sm text-gray-500">
                      Don't count Saturdays and Sundays as leave days
                    </p>
                  </div>
                  <Switch
                    checked={config.excludeWeekends}
                    onCheckedChange={(checked) => setConfig({ ...config, excludeWeekends: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Exclude Public Holidays</Label>
                    <p className="text-sm text-gray-500">
                      Don't count public holidays as leave days
                    </p>
                  </div>
                  <Switch
                    checked={config.excludePublicHolidays}
                    onCheckedChange={(checked) => setConfig({ ...config, excludePublicHolidays: checked })}
                  />
                </div>

                <Alert>
                  <Calendar className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Current Calculation Method:</strong><br />
                    {config.excludeWeekends && config.excludePublicHolidays && 
                      'Only working days (excluding weekends and public holidays) are counted'}
                    {config.excludeWeekends && !config.excludePublicHolidays && 
                      'Weekdays only (excluding weekends but including public holidays)'}
                    {!config.excludeWeekends && config.excludePublicHolidays && 
                      'All days except public holidays'}
                    {!config.excludeWeekends && !config.excludePublicHolidays && 
                      'All calendar days are counted'}
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            <TabsContent value="pro-rating" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Enable Pro-rating</Label>
                    <p className="text-sm text-gray-500">
                      Calculate proportional leave for mid-year joiners
                    </p>
                  </div>
                  <Switch
                    checked={config.proRateEnabled}
                    onCheckedChange={(checked) => setConfig({ ...config, proRateEnabled: checked })}
                  />
                </div>

                {config.proRateEnabled && (
                  <div className="p-4 border rounded-lg space-y-3">
                    <Label>Pro-rating Method</Label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="DAYS_REMAINING"
                          checked={config.proRateMethod === 'DAYS_REMAINING'}
                          onChange={(e) => setConfig({ ...config, proRateMethod: 'DAYS_REMAINING' })}
                        />
                        <span>Based on days remaining in year</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="MONTHS_REMAINING"
                          checked={config.proRateMethod === 'MONTHS_REMAINING'}
                          onChange={(e) => setConfig({ ...config, proRateMethod: 'MONTHS_REMAINING' })}
                        />
                        <span>Based on complete months remaining</span>
                      </label>
                    </div>
                  </div>
                )}

                <Alert>
                  <Calculator className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Example:</strong> Employee joining on July 1st with 24 days annual leave:<br />
                    • Days method: ~12 days (50% of year remaining)<br />
                    • Months method: 12 days (6 months remaining)
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            <TabsContent value="carry-forward" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Enable Carry Forward</Label>
                    <p className="text-sm text-gray-500">
                      Allow unused leave to carry over to next year
                    </p>
                  </div>
                  <Switch
                    checked={config.carryForwardEnabled}
                    onCheckedChange={(checked) => setConfig({ ...config, carryForwardEnabled: checked })}
                  />
                </div>

                {config.carryForwardEnabled && (
                  <>
                    <div className="p-4 border rounded-lg space-y-2">
                      <Label>Maximum Carry Forward Days</Label>
                      <Input
                        type="number"
                        value={config.maxCarryForwardDays}
                        onChange={(e) => setConfig({ ...config, maxCarryForwardDays: parseInt(e.target.value) || 0 })}
                        className="w-24"
                        min="0"
                        max="30"
                      />
                      <p className="text-xs text-gray-500">
                        Maximum days that can be carried forward (0-30)
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg space-y-2">
                      <Label>Carry Forward Validity Period</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={config.carryForwardExpiryMonths}
                          onChange={(e) => setConfig({ ...config, carryForwardExpiryMonths: parseInt(e.target.value) || 3 })}
                          className="w-24"
                          min="1"
                          max="12"
                        />
                        <span className="text-sm text-gray-500">months</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        How long carried forward days remain valid (1-12 months)
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">Auto-expire Carry Forward</Label>
                        <p className="text-sm text-gray-500">
                          Automatically remove expired carry forward balance
                        </p>
                      </div>
                      <Switch
                        checked={config.autoExpireCarryForward}
                        onCheckedChange={(checked) => setConfig({ ...config, autoExpireCarryForward: checked })}
                      />
                    </div>
                  </>
                )}

                <div className="p-4 border rounded-lg space-y-4">
                  <div>
                    <Label>Year-end Processing Date</Label>
                    <Input
                      type="text"
                      value={config.yearEndProcessingDate}
                      onChange={(e) => setConfig({ ...config, yearEndProcessingDate: e.target.value })}
                      placeholder="MM-DD"
                      className="w-32"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Format: MM-DD (e.g., 12-31 for December 31)
                    </p>
                  </div>

                  <Button
                    onClick={handleProcessYearEnd}
                    disabled={processingYearEnd}
                    variant="outline"
                    className="w-full"
                  >
                    <PlayCircle className="h-4 w-4 mr-2" />
                    {processingYearEnd ? 'Processing...' : 'Run Year-end Processing Now'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="enforcement" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Allow Negative Balance</Label>
                    <p className="text-sm text-gray-500">
                      Allow leave requests that exceed available balance
                    </p>
                  </div>
                  <Switch
                    checked={config.allowNegativeBalance}
                    onCheckedChange={(checked) => setConfig({ ...config, allowNegativeBalance: checked })}
                  />
                </div>

                {config.allowNegativeBalance && (
                  <>
                    <div className="p-4 border rounded-lg space-y-2">
                      <Label>Maximum Negative Balance</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={config.maxNegativeBalanceDays}
                          onChange={(e) => setConfig({ ...config, maxNegativeBalanceDays: parseInt(e.target.value) || 0 })}
                          className="w-24"
                          min="0"
                          max="10"
                        />
                        <span className="text-sm text-gray-500">days</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Maximum days users can go into negative (0 = unlimited)
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">Require Approval</Label>
                        <p className="text-sm text-gray-500">
                          Require special approval for negative balance requests
                        </p>
                      </div>
                      <Switch
                        checked={config.requireApprovalForNegative}
                        onCheckedChange={(checked) => setConfig({ ...config, requireApprovalForNegative: checked })}
                      />
                    </div>
                  </>
                )}

                <Alert className={config.allowNegativeBalance ? 'border-yellow-200 bg-yellow-50' : ''}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Current Policy:</strong><br />
                    {!config.allowNegativeBalance && 
                      '✅ Strict enforcement - requests cannot exceed available balance'}
                    {config.allowNegativeBalance && config.maxNegativeBalanceDays > 0 &&
                      `⚠️ Negative balance allowed up to ${config.maxNegativeBalanceDays} days`}
                    {config.allowNegativeBalance && config.maxNegativeBalanceDays === 0 &&
                      '⚠️ Unlimited negative balance allowed (not recommended)'}
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="h-4 w-4 text-gray-600" />
              <Label className="text-sm font-medium">Current Configuration Summary</Label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Working Days</p>
                <p className="font-medium">
                  {config.excludeWeekends && config.excludePublicHolidays ? 'Business Days Only' : 
                   config.excludeWeekends ? 'Exclude Weekends' : 'All Days'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Pro-rating</p>
                <p className="font-medium">{config.proRateEnabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div>
                <p className="text-gray-500">Carry Forward</p>
                <p className="font-medium">
                  {config.carryForwardEnabled ? `Max ${config.maxCarryForwardDays} days` : 'Disabled'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Negative Balance</p>
                <p className="font-medium">{config.allowNegativeBalance ? 'Allowed' : 'Not Allowed'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}