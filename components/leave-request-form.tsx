"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, CalendarIcon, X, User, AlertCircle, Info } from "lucide-react"
import { LeaveCalendar } from "@/components/leave-calendar"
import { SignaturePad } from "@/components/signature-pad"
import { Badge } from "@/components/ui/badge"
import { SuccessDialog } from "@/components/success-dialog"
import { ErrorDialog } from "@/components/error-dialog"
import { format } from "date-fns/format"
import { isSameDay } from "date-fns/isSameDay"
import { BasicSubstitutePicker } from "@/components/basic-substitute-picker"
import { ConflictResolutionWizard } from "@/components/conflict-resolution-wizard"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSession } from "next-auth/react"
import { useTranslations } from "@/components/language-provider"

interface LeaveType {
  id: string
  name: string
  code: string
  description: string
  requiresDocument: boolean
  maxDaysPerRequest: number | null
  category?: 'STANDARD' | 'PERSONAL' | 'PROVISIONAL'
  dateRestriction?: { type?: string; windowDays?: number; beforeDays?: number; afterDays?: number } | null
  sortOrder?: number
  balance: {
    entitled: number
    used: number
    pending: number
    available: number
  }
}

interface LeaveRequestFormProps {
  onBack: () => void
}

interface Approver {
  id: string
  name: string
  email: string
  role: string
  position?: string
}

export function LeaveRequestForm({ onBack }: LeaveRequestFormProps) {
  const { data: session } = useSession()
  const t = useTranslations()
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [leaveType, setLeaveType] = useState("")
  const [reason, setReason] = useState("")
  const [signature, setSignature] = useState("")
  const [isValidSignature, setIsValidSignature] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDetails, setErrorDetails] = useState({ title: "", message: "" })
  const [submittedDetails, setSubmittedDetails] = useState<{
    requestType: string
    days: number
    dates: string
    manager: string
  } | null>(null)
  const [selectedSubstitutes, setSelectedSubstitutes] = useState<string[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(true)
  const [approvers, setApprovers] = useState<{ manager?: Approver; departmentHead?: Approver }>({})
  const [loadingApprovers, setLoadingApprovers] = useState(false)
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [blockedDateDetails, setBlockedDateDetails] = useState<Record<string, { status: string; leaveType: string }>>({})
  const [loadingBlockedDates, setLoadingBlockedDates] = useState(true)
  const [showConflictWizard, setShowConflictWizard] = useState(false)

  // Handle conflict check button click
  const handleCheckConflicts = () => {
    if (selectedDates.length === 0) {
      showError(t.errors.noDatesSelected, t.errors.selectDatesForConflictCheck)
      return
    }
    if (!approvers.manager?.id) {
      showError(t.errors.managerNotAvailable, t.errors.managerInfoUnavailable)
      return
    }
    setShowConflictWizard(true)
  }

  // Handle date suggestion from conflict wizard
  const handleDateSuggestionSelect = (newDates: Date[]) => {
    setSelectedDates(newDates)
    setShowConflictWizard(false)
  }

  // Helper to format date as YYYY-MM-DD in local time
  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Calculate start and end dates from selected dates
  const sortedDates = selectedDates.sort((a, b) => a.getTime() - b.getTime())
  const startDate = sortedDates.length > 0 ? sortedDates[0] : undefined
  const endDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : undefined

  const selectedLeaveType = leaveTypes.find(lt => lt.id === leaveType)

  // Fetch leave types on component mount
  useEffect(() => {
    const fetchLeaveTypes = async () => {
      try {
        const response = await fetch('/api/leave-types')
        if (response.ok) {
          const data = await response.json()
          setLeaveTypes(data.leaveTypes)
        }
      } catch (error) {
        console.error('Failed to fetch leave types:', error)
      } finally {
        setLoadingLeaveTypes(false)
      }
    }
    
    fetchLeaveTypes()
  }, [])

  // Fetch blocked dates on component mount
  useEffect(() => {
    const fetchBlockedDates = async () => {
      try {
        const response = await fetch('/api/employee/blocked-dates', { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          // Only include PENDING and APPROVED dates - cancelled/rejected should NOT block
          const filteredDates = (data.blockedDates || []).filter((dateStr: string) => {
            const detail = data.dateDetails?.[dateStr]
            return detail && (detail.status === 'PENDING' || detail.status === 'APPROVED')
          })
          const filteredDetails: Record<string, { status: string; leaveType: string }> = {}
          for (const dateStr of filteredDates) {
            if (data.dateDetails?.[dateStr]) {
              filteredDetails[dateStr] = data.dateDetails[dateStr]
            }
          }
          setBlockedDates(filteredDates)
          setBlockedDateDetails(filteredDetails)
        }
      } catch (error) {
        console.error('Failed to fetch blocked dates:', error)
      } finally {
        setLoadingBlockedDates(false)
      }
    }
    
    fetchBlockedDates()
  }, [])

  // Fetch approvers when user session is available
  useEffect(() => {
    if (session?.user) {
      const fetchApprovers = async () => {
        setLoadingApprovers(true)
        try {
          const response = await fetch('/api/users/approvers')
          if (response.ok) {
            const data = await response.json()
            setApprovers(data.approvers)
          }
        } catch (error) {
          console.error('Failed to fetch approvers:', error)
        } finally {
          setLoadingApprovers(false)
        }
      }
      
      fetchApprovers()
    }
  }, [session])

  const handleDateSelect = (date: Date) => {
    setSelectedDates((prev) => {
      const isAlreadySelected = prev.some((selectedDate) => isSameDay(selectedDate, date))

      if (isAlreadySelected) {
        // Remove the date if it's already selected
        return prev.filter((selectedDate) => !isSameDay(selectedDate, date))
      } else {
        // Add the date if it's not selected
        return [...prev, date].sort((a, b) => a.getTime() - b.getTime())
      }
    })
  }

  const handleRemoveDate = (dateToRemove: Date) => {
    setSelectedDates((prev) => prev.filter((date) => !isSameDay(date, dateToRemove)))
  }

  const handleClearAll = () => {
    setSelectedDates([])
  }

  const showError = (title: string, message: string) => {
    setErrorDetails({ title, message })
    setShowErrorDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedDates.length === 0) {
      showError(t.errors.noDatesSelected, t.errors.selectDateForLeaveRequest)
      return
    }

    if (!leaveType) {
      showError(t.errors.leaveTypeRequired, t.errors.selectLeaveType)
      return
    }

    // Reason is optional, no validation needed

    if (selectedSubstitutes.length === 0) {
      showError(
        t.errors.coverageRequired,
        t.errors.selectTeamMemberForCoverage,
      )
      return
    }

    if (!signature || !isValidSignature) {
      showError(t.errors.invalidSignature, t.errors.signatureValidationMessage)
      return
    }

    setIsSubmitting(true)

    try {
      // Check if we have valid dates
      if (!startDate || !endDate) {
        showError(t.errors.invalidDates, t.errors.selectValidDates)
        return
      }

      const requestBody = {
        leaveTypeId: leaveType,
        startDate: toLocalDateString(startDate),
        endDate: toLocalDateString(endDate),
        reason: reason.trim() || " ",
        substituteIds: selectedSubstitutes,
        selectedDates: selectedDates.map(date => toLocalDateString(date)),
        signature: signature,
      }

      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle validation errors with detailed messages
        if (data.details && Array.isArray(data.details)) {
          const errorMessages = data.details.map((d: any) => 
            `${d.field}: ${d.message}`
          ).join('\n')
          throw new Error(`Validation failed:\n${errorMessages}`)
        } else if (data.message) {
          // Handle specific error messages (like date conflicts)
          throw new Error(data.message)
        } else if (data.errors && Array.isArray(data.errors)) {
          // Handle validation service errors (objects with { field, message, code })
          const errorMessages = data.errors.map((e: any) =>
            typeof e === 'string' ? e : e.message || String(e)
          ).join('\n')
          throw new Error(errorMessages)
        } else {
          throw new Error(data.error || 'Failed to submit leave request')
        }
      }

      // Capture details before showing success dialog
      const successDetails = {
        requestType: leaveTypes.find(t => t.id === leaveType)?.name || "Leave",
        days: selectedDates.length,
        dates: formatDateGroups(groupConsecutiveDates(selectedDates)),
        manager: approvers.manager?.name || "your manager",
      }
      setSubmittedDetails(successDetails)
      
      // Show success dialog
      setShowSuccessDialog(true)
      
      // Auto-redirect to dashboard after 3 seconds (good UX)
      setTimeout(() => {
        setShowSuccessDialog(false)
        setSubmittedDetails(null)
        // Reset form
        setSelectedDates([])
        setLeaveType("")
        setReason("")
        setSignature("")
        setSelectedSubstitutes([])
        onBack()
      }, 3000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      showError(
        "Submission Failed",
        errorMessage,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSuccessClose = () => {
    setShowSuccessDialog(false)
    setSubmittedDetails(null)
    // Reset form
    setSelectedDates([])
    setLeaveType("")
    setReason("")
    setSignature("")
    setSelectedSubstitute("")
    // Go back to dashboard
    onBack()
  }

  const getTotalDays = () => {
    return selectedDates.length
  }

  const groupConsecutiveDates = (dates: Date[]) => {
    if (dates.length === 0) return []

    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime())
    const groups: Date[][] = []
    let currentGroup = [sortedDates[0]]

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = sortedDates[i - 1]
      const currentDate = sortedDates[i]
      const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)

      if (dayDiff === 1) {
        currentGroup.push(currentDate)
      } else {
        groups.push(currentGroup)
        currentGroup = [currentDate]
      }
    }
    groups.push(currentGroup)

    return groups
  }

  const formatDateGroups = (groups: Date[][]) => {
    return groups
      .map((group) => {
        if (group.length === 1) {
          return format(group[0], "MMM d")
        } else {
          return `${format(group[0], "MMM d")} - ${format(group[group.length - 1], "MMM d")}`
        }
      })
      .join(", ")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Button variant="ghost" onClick={onBack} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t.common.back}
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">{t.leaveForm.title}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  {t.leaveForm.selectDates}
                </CardTitle>
                <CardDescription>
                  {t.leaveForm.selectDates}. {t.leaveForm.selectDatesDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeaveCalendar 
                  selectedDates={selectedDates} 
                  onDateSelect={handleDateSelect}
                  blockedDates={blockedDates}
                  blockedDateDetails={blockedDateDetails}
                />
              </CardContent>
            </Card>
          </div>

          {/* Form Section */}
          <div className="space-y-6">
            {/* Selected Dates Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{t.leaveForm.selectDates}</CardTitle>
                  {selectedDates.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleClearAll}>
                      {t.common.clear}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedDates.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">{t.leaveForm.noDaysSelected}</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t.leaveForm.totalDays}:</span>
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {getTotalDays()}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <span className="text-sm font-medium">{t.labels.dates}:</span>
                      <p className="text-sm text-gray-600">{formatDateGroups(groupConsecutiveDates(selectedDates))}</p>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      <span className="text-sm font-medium">{t.labels.individualDays}:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedDates.map((date, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-red-50"
                            onClick={() => handleRemoveDate(date)}
                          >
                            {format(date, "MMM d")}
                            <X className="h-3 w-3 ml-1" />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Leave Request Form */}
            <Card>
              <CardHeader>
                <CardTitle>{t.leaveForm.title} {t.leaveForm.details}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="leave-type">{t.leaveForm.leaveType} *</Label>
                    <Select value={leaveType} onValueChange={setLeaveType} required disabled={loadingLeaveTypes}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingLeaveTypes ? t.common.loading : t.leaveForm.selectLeaveType} />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const grouped: Record<string, LeaveType[]> = {}
                          const categoryOrder = ['STANDARD', 'PERSONAL', 'PROVISIONAL']
                          const categoryLabels: Record<string, string> = {
                            STANDARD: 'Standard Leave',
                            PERSONAL: 'Collective Contract Leave',
                            PROVISIONAL: 'Provisional Leave',
                          }
                          for (const type of leaveTypes) {
                            const cat = type.category || 'STANDARD'
                            if (!grouped[cat]) grouped[cat] = []
                            grouped[cat].push(type)
                          }
                          const categories = categoryOrder.filter(c => grouped[c]?.length > 0)
                          const hasMultipleCategories = categories.length > 1
                          return categories.map((cat, idx) => (
                            <SelectGroup key={cat}>
                              {hasMultipleCategories && (
                                <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {categoryLabels[cat] || cat}
                                </SelectLabel>
                              )}
                              {grouped[cat].map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  <div className="flex items-center justify-between w-full">
                                    <span>{type.name}</span>
                                    <Badge variant="secondary" className="ml-2">
                                      {type.balance.available} {t.leaveForm.days}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                              {idx < categories.length - 1 && <SelectSeparator />}
                            </SelectGroup>
                          ))
                        })()}
                      </SelectContent>
                    </Select>
                    {leaveType && (() => {
                      const selected = leaveTypes.find(t => t.id === leaveType)
                      return selected ? (
                        <div className="space-y-2 p-3 bg-gray-50 rounded-md text-sm">
                          {selected.description && (
                            <p className="text-gray-600">{selected.description}</p>
                          )}
                          {selected.dateRestriction?.type === 'BIRTHDAY_WINDOW' && (
                            <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 p-2 rounded text-xs">
                              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>This leave can be taken from {selected.dateRestriction.beforeDays ?? 10} days before to {selected.dateRestriction.afterDays ?? 20} days after your birthday.</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs">
                            <span>{t.leaveForm.available}: {selected.balance.available} {t.leaveForm.days}</span>
                            {selected.balance.pending > 0 && (
                              <span className="text-amber-600">{t.leaveForm.pending}: {selected.balance.pending} {t.leaveForm.days}</span>
                            )}
                          </div>
                          {selected.requiresDocument && (
                            <div className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                              <span>
                                This leave type requires supporting documents. Please send them to HR directly (email or in person) for verification.
                              </span>
                            </div>
                          )}
                          {selected.maxDaysPerRequest && selectedDates.length > selected.maxDaysPerRequest && (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="h-3 w-3" />
                              <span className="text-xs">{t.labels.maximumDaysPerRequest} {selected.maxDaysPerRequest}</span>
                            </div>
                          )}
                        </div>
                      ) : null
                    })()}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">{t.leaveForm.reason} ({t.common.optional})</Label>
                    <Textarea
                      id="reason"
                      placeholder={t.leaveForm.reasonPlaceholder}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {session?.user && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {t.leaveForm.approvalWorkflow}
                      </Label>
                      <div className="p-3 bg-gray-50 rounded-md border space-y-3">
                        {loadingApprovers ? (
                          <p className="text-sm text-gray-500">{t.loading.loadingApprovers}</p>
                        ) : (
                          <>
                            {/* Manager */}
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0">
                                <Avatar className="h-8 w-8">
                                  {approvers.manager ? (
                                    <>
                                      <AvatarImage src={undefined} />
                                      <AvatarFallback>{(approvers.manager?.name || 'U').split(' ').map((n: string) => n?.[0] || '').join('')}</AvatarFallback>
                                    </>
                                  ) : (
                                    <AvatarFallback>?</AvatarFallback>
                                  )}
                                </Avatar>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {t.leaveForm.manager}: {approvers.manager ? approvers.manager.name : <span className="text-red-600">{t.labels.notAssigned}</span>}
                                </p>
                              </div>
                              <Badge variant={approvers.manager ? "secondary" : "destructive"} className="text-xs">
                                {t.leaveForm.level} 1
                              </Badge>
                            </div>

                            {/* Department Head - Only show if it exists (not when manager is executive) */}
                            {approvers.departmentHead && (
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={undefined} />
                                    <AvatarFallback>{(approvers.departmentHead?.name || 'U').split(' ').map((n: string) => n?.[0] || '').join('')}</AvatarFallback>
                                  </Avatar>
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium">
                                    {t.leaveForm.departmentHead}: {approvers.departmentHead.name}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {t.leaveForm.level} 2
                                </Badge>
                              </div>
                            )}

                            {!approvers.manager && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                                <p className="text-xs text-amber-800">
                                  <AlertCircle className="h-3 w-3 inline mr-1" />
                                  Manager not assigned. Your request may require HR intervention.
                                </p>
                              </div>
                            )}
                          </>
                        )}
                        
                        <p className="text-xs text-gray-500 pt-2 border-t">
                          {t.leaveForm.additionalApprovers}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Substitute Picker - Now Required */}
                  <div className="border-t pt-4">
                    <BasicSubstitutePicker
                      startDate={startDate ? toLocalDateString(startDate) : undefined}
                      endDate={endDate ? toLocalDateString(endDate) : undefined}
                      selectedSubstitutes={selectedSubstitutes}
                      onSubstitutesChange={setSelectedSubstitutes}
                    />
                  </div>

                  {/* Signature Pad */}
                  <div className="border-t pt-4">
                    <SignaturePad 
                      signature={signature} 
                      onSignatureChange={(sig, isValid) => {
                        setSignature(sig)
                        setIsValidSignature(isValid)
                      }} 
                    />
                  </div>

                  <div className="flex flex-col gap-2 pt-4 border-t">
                    {/* Conflict Check Button */}
                    {selectedDates.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCheckConflicts}
                        disabled={isSubmitting}
                        className="w-full flex items-center gap-2"
                      >
                        <AlertCircle className="h-4 w-4" />
                        {t.buttons.checkConflicts}
                      </Button>
                    )}
                    
                    <Button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        selectedDates.length === 0 ||
                        !signature ||
                        !isValidSignature ||
                        !leaveType ||
                        selectedSubstitutes.length === 0
                      }
                      className="w-full"
                    >
                      {isSubmitting ? t.common.submitting : `Submit Request (${getTotalDays()} days)`}
                    </Button>
                    <Button type="button" variant="outline" onClick={onBack} className="w-full">
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      {submittedDetails && (
        <SuccessDialog
          isOpen={showSuccessDialog}
          onClose={handleSuccessClose}
          type="leave"
          details={submittedDetails}
        />
      )}

      {/* Error Dialog */}
      <ErrorDialog
        isOpen={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        title={errorDetails.title}
        message={errorDetails.message}
      />

      {/* Conflict Resolution Wizard */}
      <ConflictResolutionWizard
        isOpen={showConflictWizard}
        onClose={() => setShowConflictWizard(false)}
        requestedDates={selectedDates}
        onDateSuggestionSelect={handleDateSuggestionSelect}
        managerId={approvers.manager?.id}
      />
    </div>
  )
}
