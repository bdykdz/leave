"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Save, Send, AlertCircle, CheckCircle, Clock } from "lucide-react"
import { format } from "date-fns"
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
          const dates = data.dates
            .filter((d: HolidayPlanDate) => d && d.date) // Filter out null/undefined dates
            .map((d: HolidayPlanDate) => {
              const parsed = parseDateLocal(d.date)
              // Only include valid dates
              return isNaN(parsed.getTime()) ? null : parsed
            })
            .filter(d => d !== null) // Remove any null dates
          setSelectedDates(dates as Date[])
        }
      }
    } catch (error) {
      console.error('Error loading plan:', error)
      toast.error('Failed to load holiday plan')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to format date in local timezone to avoid UTC shift
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Helper function to parse date string as local date (not UTC)
  const parseDateLocal = (dateString: string): Date => {
    // Handle null/undefined/empty strings
    if (!dateString) {
      console.warn('parseDateLocal received empty date string')
      return new Date() // Return current date as fallback
    }
    
    // Handle ISO date strings (with time component)
    if (dateString.includes('T')) {
      dateString = dateString.split('T')[0]
    }
    
    const parts = dateString.split('-')
    if (parts.length !== 3) {
      console.error('Invalid date format:', dateString)
      return new Date() // Return current date as fallback
    }
    
    const [year, month, day] = parts.map(Number)
    
    // Validate the parsed values
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      console.error('Invalid date components:', { year, month, day, original: dateString })
      return new Date() // Return current date as fallback
    }
    
    const date = new Date(year, month - 1, day)
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date created from:', dateString)
      return new Date() // Return current date as fallback
    }
    
    return date
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

    // Check if adding these dates would exceed the 30-day limit
    const currentDayCount = plan?.dates?.length || 0
    const trulyNewDates = selectedDates.filter(selectedDate => 
      !plan?.dates?.some(existingDate => 
        parseDateLocal(existingDate.date).toDateString() === selectedDate.toDateString()
      )
    )
    const newDayCount = currentDayCount + trulyNewDates.length
    
    if (newDayCount > 30) {
      toast.error(`Cannot add ${selectedDates.length} days. This would exceed the 30-day annual limit (currently ${currentDayCount}/30)`)
      return
    }

    // Only add truly new dates, preserve existing ones
    const existingDates = plan?.dates || []
    const newDates = selectedDates.filter(selectedDate => 
      !existingDates.some(existingDate => 
        parseDateLocal(existingDate.date).toDateString() === selectedDate.toDateString()
      )
    )

    // Create new plan dates only for truly new dates
    const newPlanDates: Partial<HolidayPlanDate>[] = newDates.map(date => ({
      date: formatDateLocal(date), // Use local timezone formatting
      priority: currentPriority,
      reason: currentReason || undefined
    }))

    // Update plan by keeping existing dates and adding new ones
    const updatedPlan = plan ? {
      ...plan,
      dates: [...existingDates, ...newPlanDates as HolidayPlanDate[]]
    } : null

    if (updatedPlan) {
      setPlan(updatedPlan)
    }

    // Reset form
    setSelectedDates([])
    setCurrentReason('')
    
    if (newDates.length > 0) {
      toast.success(`Added ${newDates.length} new date(s) to your plan`)
    } else {
      toast.info('All selected dates were already in your plan')
    }
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
            date: d.date.includes('T') ? d.date.split('T')[0] : d.date, // Normalize to YYYY-MM-DD
            priority: d.priority,
            ...(d.reason && { reason: d.reason })
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
        toast.success('Holiday plan submitted for review! You can continue to make changes if needed.')
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
  const planIsSubmitted = plan?.status === 'SUBMITTED'
  const planIsDraft = plan?.status === 'DRAFT' || !plan?.status
  
  const canEdit = windowIsOpen && planNotLocked
  const canSubmit = windowIsOpen && planNotLocked && planIsDraft // Only submit if in draft
  const canResubmit = windowIsOpen && planNotLocked && planIsSubmitted // Allow resubmit if already submitted

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
                    <p className="text-sm text-gray-600">Holiday Days</p>
                    <p className={`text-lg font-semibold ${(plan?.dates?.length || 0) > 30 ? 'text-red-600' : (plan?.dates?.length || 0) > 25 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {plan?.dates?.length || 0} / 30
                    </p>
                    {(plan?.dates?.length || 0) > 30 && (
                      <p className="text-xs text-red-600">Exceeds maximum limit</p>
                    )}
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
                  <br />
                  <span className={`font-medium ${(plan?.dates?.length || 0) > 25 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {30 - (plan?.dates?.length || 0)} days remaining out of 30 annual limit
                  </span>
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
                  modifiers={{
                    essential: plan?.dates?.filter(d => d.priority === 'ESSENTIAL').map(d => parseDateLocal(d.date)) || [],
                    preferred: plan?.dates?.filter(d => d.priority === 'PREFERRED').map(d => parseDateLocal(d.date)) || [],
                    niceToHave: plan?.dates?.filter(d => d.priority === 'NICE_TO_HAVE').map(d => parseDateLocal(d.date)) || []
                  }}
                  modifiersClassNames={{
                    essential: "!border-red-500 !border-2 !bg-red-50 hover:!bg-red-100 !text-red-900",
                    preferred: "!border-blue-500 !border-2 !bg-blue-50 hover:!bg-blue-100 !text-blue-900", 
                    niceToHave: "!border-green-500 !border-2 !bg-green-50 hover:!bg-green-100 !text-green-900"
                  }}
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Holiday Plan {planningYear}</CardTitle>
                    <CardDescription>
                      {plan?.dates?.length ? 
                        `${plan.dates.length} dates selected` : 
                        'No dates selected yet'
                      }
                    </CardDescription>
                  </div>
                  {plan?.status && (
                    <Badge 
                      variant={
                        plan.status === 'SUBMITTED' ? 'default' :
                        plan.status === 'REVIEWED' ? 'secondary' :
                        plan.status === 'FINALIZED' ? 'success' :
                        plan.status === 'LOCKED' ? 'destructive' :
                        'outline'
                      }
                      className="text-sm"
                    >
                      {plan.status === 'SUBMITTED' ? 'Submitted - Awaiting Review' :
                       plan.status === 'REVIEWED' ? 'Reviewed' :
                       plan.status === 'FINALIZED' ? 'Finalized' :
                       plan.status === 'LOCKED' ? 'Locked' :
                       'Draft'}
                    </Badge>
                  )}
                </div>
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
                                  {(() => {
                                    try {
                                      const parsedDate = parseDateLocal(date.date)
                                      if (isNaN(parsedDate.getTime())) {
                                        return 'Invalid date'
                                      }
                                      return format(parsedDate, 'EEEE, MMMM d, yyyy')
                                    } catch (e) {
                                      console.error('Error formatting date:', date.date, e)
                                      return 'Invalid date'
                                    }
                                  })()}
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
            {plan && canEdit && (
              <div className="space-y-3 mt-4">
                <div className="flex gap-3">
                  <Button 
                    onClick={savePlan} 
                    disabled={saving} 
                    variant={planIsSubmitted ? "default" : "outline"}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : planIsSubmitted ? 'Save Changes' : 'Save Draft'}
                  </Button>
                  
                  {canSubmit && plan.dates.length > 0 && (
                    <Button 
                      onClick={submitPlan} 
                      disabled={submitting} 
                      variant="default"
                      className="flex items-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {submitting ? 'Submitting...' : 'Submit for Review'}
                    </Button>
                  )}
                  
                  {canResubmit && plan.dates.length > 0 && (
                    <Button 
                      onClick={submitPlan} 
                      disabled={submitting} 
                      variant="default"
                      className="flex items-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {submitting ? 'Resubmitting...' : 'Resubmit for Review'}
                    </Button>
                  )}
                </div>
                
                {planIsSubmitted && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Your plan has been submitted.</strong> You can still make changes and save them. 
                      Your manager will see the latest version when reviewing.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}