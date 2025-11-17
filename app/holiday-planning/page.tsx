"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Save, Send, AlertCircle, CheckCircle, Clock } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface HolidayPlanDate {
  id: string
  date: string
  priority: 'ESSENTIAL' | 'PREFERRED' | 'NICE_TO_HAVE'
  reason?: string
}

interface HolidayPlan {
  id: string
  year: number
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'FINALIZED' | 'LOCKED'
  submittedAt?: string
  dates: HolidayPlanDate[]
  window: {
    stage: 'CLOSED' | 'DRAFT' | 'SUBMISSION' | 'COORDINATION' | 'FINALIZATION' | 'LOCKED'
  }
}

const PRIORITY_OPTIONS = [
  { value: 'ESSENTIAL', label: 'Essential', color: 'bg-red-500' },
  { value: 'PREFERRED', label: 'Preferred', color: 'bg-blue-500' },
  { value: 'NICE_TO_HAVE', label: 'Nice to Have', color: 'bg-green-500' }
]

export default function HolidayPlanningPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [plan, setPlan] = useState<HolidayPlan | null>(null)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [currentPriority, setCurrentPriority] = useState<'ESSENTIAL' | 'PREFERRED' | 'NICE_TO_HAVE'>('PREFERRED')
  const [currentReason, setCurrentReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [holidays, setHolidays] = useState<Date[]>([])

  const currentYear = new Date().getFullYear()
  const planningYear = currentYear + 1

  // Load user's holiday plan and holidays
  useEffect(() => {
    if (session) {
      loadPlan()
      loadHolidays()
    }
  }, [session])

  const loadHolidays = async () => {
    try {
      const response = await fetch(`/api/holidays?year=${planningYear}`)
      if (response.ok) {
        const data = await response.json()
        const holidayDates = data.holidays.map((holiday: any) => new Date(holiday.date))
        setHolidays(holidayDates)
      }
    } catch (error) {
      console.error('Error loading holidays:', error)
    }
  }

  const loadPlan = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/holiday-planning/my-plan?year=${planningYear}`)
      
      if (response.ok) {
        const data = await response.json()
        setPlan(data)
        
        if (data && data.dates) {
          const dates = data.dates.map((d: HolidayPlanDate) => parseISO(d.date))
          setSelectedDates(dates)
        }
      }
    } catch (error) {
      console.error('Error loading plan:', error)
      toast.error('Failed to load holiday plan')
    } finally {
      setLoading(false)
    }
  }

  const isWeekend = (date: Date) => {
    const day = date.getDay()
    return day === 0 || day === 6 // Sunday = 0, Saturday = 6
  }

  const isHoliday = (date: Date) => {
    return holidays.some(holiday => 
      holiday.getFullYear() === date.getFullYear() &&
      holiday.getMonth() === date.getMonth() &&
      holiday.getDate() === date.getDate()
    )
  }

  const isDateDisabled = (date: Date) => {
    return isWeekend(date) || isHoliday(date)
  }

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (dates) {
      // Filter out any disabled dates that might have been selected
      const validDates = dates.filter(date => !isDateDisabled(date))
      setSelectedDates(validDates)
      
      // Show warning if some dates were filtered out
      if (validDates.length !== dates.length) {
        toast.error('Weekends and holidays cannot be selected for holiday planning')
      }
    }
  }

  const addSelectedDates = () => {
    if (selectedDates.length === 0) {
      toast.error('Please select at least one date')
      return
    }

    // Create new plan dates
    const newPlanDates: Partial<HolidayPlanDate>[] = selectedDates.map(date => ({
      date: date.toISOString(),
      priority: currentPriority,
      reason: currentReason || undefined
    }))

    // Update plan
    const updatedPlan = plan ? {
      ...plan,
      dates: [...plan.dates.filter(d => 
        !selectedDates.some(sd => sd.toDateString() === parseISO(d.date).toDateString())
      ), ...newPlanDates as HolidayPlanDate[]]
    } : null

    if (updatedPlan) {
      setPlan(updatedPlan)
    }

    // Reset form
    setSelectedDates([])
    setCurrentReason('')
    
    toast.success(`Added ${selectedDates.length} date(s) to your plan`)
  }

  const removePlanDate = (dateToRemove: string) => {
    if (!plan) return

    const updatedPlan = {
      ...plan,
      dates: plan.dates.filter(d => d.date !== dateToRemove)
    }
    setPlan(updatedPlan)
    toast.success('Date removed from plan')
  }

  const savePlan = async () => {
    if (!plan) return

    try {
      setSaving(true)
      
      const response = await fetch('/api/holiday-planning/my-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          year: planningYear,
          dates: plan.dates.map(d => ({
            date: d.date,
            priority: d.priority,
            reason: d.reason
          }))
        })
      })

      if (response.ok) {
        const updatedPlan = await response.json()
        setPlan(updatedPlan)
        toast.success('Holiday plan saved successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save plan')
      }
    } catch (error) {
      console.error('Error saving plan:', error)
      toast.error('Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  const submitPlan = async () => {
    if (!plan) return

    try {
      setSubmitting(true)
      
      const response = await fetch('/api/holiday-planning/my-plan', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          year: planningYear,
          action: 'submit'
        })
      })

      if (response.ok) {
        const updatedPlan = await response.json()
        setPlan(updatedPlan)
        toast.success('Holiday plan submitted for review')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to submit plan')
      }
    } catch (error) {
      console.error('Error submitting plan:', error)
      toast.error('Failed to submit plan')
    } finally {
      setSubmitting(false)
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please log in to access holiday planning</p>
          <Button onClick={() => router.push('/login')}>Go to Login</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading holiday planning...</p>
        </div>
      </div>
    )
  }

  // Simplified logic: Allow editing and submission anytime during Oct-Dec (when window is active)
  const windowIsOpen = plan?.window?.stage === 'DRAFT' || plan?.window?.stage === 'SUBMISSION' || plan?.window?.stage === 'COORDINATION' || plan?.window?.stage === 'FINALIZATION'
  const planNotLocked = plan?.status !== 'LOCKED'
  
  const canEdit = windowIsOpen && planNotLocked
  const canSubmit = windowIsOpen && planNotLocked

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Holiday Planning {planningYear}</h1>
              <p className="text-gray-600">Plan your holidays for next year</p>
            </div>
            <Button variant="outline" onClick={() => router.push('/employee')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Planning Status */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Planning Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Planning Window</p>
                    <Badge variant={windowIsOpen ? 'default' : 'secondary'}>
                      {windowIsOpen ? 'OPEN' : 'CLOSED'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Plan Status</p>
                    <Badge variant={plan?.status === 'DRAFT' ? 'default' : 'secondary'}>
                      {plan?.status || 'NOT_CREATED'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Days</p>
                    <p className="text-lg font-semibold">
                      {plan?.dates?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Date Selection */}
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Add Holiday Dates</CardTitle>
                <CardDescription>
                  Select dates for your {planningYear} holiday plan. Weekends and holidays are automatically blocked.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CalendarComponent
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={handleDateSelect}
                  fromDate={new Date(planningYear, 0, 1)}
                  toDate={new Date(planningYear, 11, 31)}
                  disabled={isDateDisabled}
                  className="rounded-md border"
                />

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <Select value={currentPriority} onValueChange={(value: any) => setCurrentPriority(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Reason (Optional)</label>
                    <Textarea 
                      value={currentReason}
                      onChange={(e) => setCurrentReason(e.target.value)}
                      placeholder="Family vacation, wedding, etc."
                      rows={2}
                    />
                  </div>


                  <Button onClick={addSelectedDates} className="w-full">
                    Add Selected Dates ({selectedDates.length})
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Plan */}
          <div className={canEdit ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <Card>
              <CardHeader>
                <CardTitle>Your Holiday Plan {planningYear}</CardTitle>
                <CardDescription>
                  {plan?.dates?.length ? 
                    `${plan.dates.length} dates selected` : 
                    'No dates selected yet'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!plan?.dates?.length ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No holiday dates planned yet</p>
                    {canEdit && <p className="text-sm text-gray-500">Use the calendar to add dates</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {plan.dates
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((date, index) => {
                        const priority = PRIORITY_OPTIONS.find(p => p.value === date.priority)
                        return (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${priority?.color}`}></div>
                              <div>
                                <p className="font-medium">
                                  {format(parseISO(date.date), 'EEEE, MMMM d, yyyy')}
                                </p>
                                {date.reason && (
                                  <p className="text-sm text-gray-600">{date.reason}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{priority?.label}</Badge>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removePlanDate(date.date)}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {plan && (canEdit || canSubmit) && (
              <div className="flex gap-3 mt-4">
                {canEdit && (
                  <Button onClick={savePlan} disabled={saving} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Draft'}
                  </Button>
                )}
                {canSubmit && plan.dates.length > 0 && (
                  <Button onClick={submitPlan} disabled={submitting} className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    {submitting ? 'Submitting...' : 'Submit Plan'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}