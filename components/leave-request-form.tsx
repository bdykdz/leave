"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, CalendarIcon, X, User, AlertCircle, Upload, FileText } from "lucide-react"
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
  const [supportingDocuments, setSupportingDocuments] = useState<File[]>([])
  const [uploadingDocuments, setUploadingDocuments] = useState(false)
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

  // Check if selected leave type is sick leave (with safety check)
  const selectedLeaveType = leaveTypes.find(lt => lt.id === leaveType)
  const isSickLeave = selectedLeaveType?.code === 'SL' && !loadingLeaveTypes

  // Handle file upload for medical certificates
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newFiles: File[] = []
      const errors: string[] = []
      
      Array.from(files).forEach(file => {
        // Validate file type (images and PDFs)
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
        if (!allowedTypes.includes(file.type)) {
          errors.push(`"${file.name}" - Only JPEG, PNG, or PDF files are allowed.`)
          return
        }
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          errors.push(`"${file.name}" - File size must be less than 5MB.`)
          return
        }
        newFiles.push(file)
      })
      
      if (errors.length > 0) {
        showError('Invalid Files', errors.join('\n'))
        // Clear the input to allow reselection
        event.target.value = ''
        return
      }
      setSupportingDocuments(prev => [...prev, ...newFiles])
      // Clear the input to allow reselection of the same files if needed
      event.target.value = ''
    }
  }

  // Remove uploaded file
  const removeFile = (index: number) => {
    setSupportingDocuments(prev => prev.filter((_, i) => i !== index))
  }

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
        const response = await fetch('/api/employee/blocked-dates')
        if (response.ok) {
          const data = await response.json()
          setBlockedDates(data.blockedDates)
          setBlockedDateDetails(data.dateDetails)
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

    // Validate medical certificate for sick leave
    if (isSickLeave && supportingDocuments.length === 0) {
      showError(t.errors.medicalCertificateRequired, t.errors.uploadMedicalCertificate)
      return
    }

    setIsSubmitting(true)

    try {
      // Check if we have valid dates
      if (!startDate || !endDate) {
        showError(t.errors.invalidDates, t.errors.selectValidDates)
        return
      }

      let response: Response

      if (isSickLeave && supportingDocuments.length > 0) {
        // Use FormData for file upload
        const formData = new FormData()
        formData.append('leaveTypeId', leaveType)
        formData.append('startDate', toLocalDateString(startDate))
        formData.append('endDate', toLocalDateString(endDate))
        formData.append('reason', reason.trim() || " ")
        formData.append('substituteIds', JSON.stringify(selectedSubstitutes))
        formData.append('selectedDates', JSON.stringify(selectedDates.map(date => toLocalDateString(date))))
        formData.append('signature', signature)
        
        // Add files
        supportingDocuments.forEach((file, index) => {
          formData.append(`supportingDocument_${index}`, file)
        })
        
        setUploadingDocuments(true)
        response = await fetch('/api/leave-requests', {
          method: 'POST',
          body: formData,
        })
        setUploadingDocuments(false)
      } else {
        // Use JSON for regular requests
        const requestBody = {
          leaveTypeId: leaveType,
          startDate: toLocalDateString(startDate),
          endDate: toLocalDateString(endDate),
          reason: reason.trim() || " ",
          substituteIds: selectedSubstitutes,
          selectedDates: selectedDates.map(date => toLocalDateString(date)),
          signature: signature,
        }

        response = await fetch('/api/leave-requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })
      }

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
          // Handle validation service errors
          throw new Error(data.errors.join('\n'))
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
        setSupportingDocuments([])
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
                        {leaveTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{type.name}</span>
                              <Badge variant="secondary" className="ml-2">
                                {type.balance.available} {t.leaveForm.days}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {leaveType && (() => {
                      const selected = leaveTypes.find(t => t.id === leaveType)
                      return selected ? (
                        <div className="space-y-2 p-3 bg-gray-50 rounded-md text-sm">
                          {selected.description && (
                            <p className="text-gray-600">{selected.description}</p>
                          )}
                          <div className="flex items-center justify-between text-xs">
                            <span>{t.leaveForm.available}: {selected.balance.available} {t.leaveForm.days}</span>
                            {selected.balance.pending > 0 && (
                              <span className="text-amber-600">{t.leaveForm.pending}: {selected.balance.pending} {t.leaveForm.days}</span>
                            )}
                          </div>
                          {selected.requiresDocument && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1 text-amber-600">
                                <AlertCircle className="h-3 w-3" />
                                <span className="text-xs">{t.labels.supportingDocumentRequired}</span>
                              </div>
                              
                              {/* File upload for sick leave only */}
                              {isSickLeave && (
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Medical Certificate Upload</Label>
                                  
                                  {/* File upload input */}
                                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-colors">
                                    <div className="text-center">
                                      <Upload className="mx-auto h-6 w-6 text-gray-400 mb-2" />
                                      <div className="text-sm text-gray-600 mb-2">
                                        Upload medical certificate or doctor's note
                                      </div>
                                      <input
                                        type="file"
                                        multiple
                                        accept="image/*,.pdf"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="medical-documents"
                                      />
                                      <label
                                        htmlFor="medical-documents"
                                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium bg-white hover:bg-gray-50 cursor-pointer"
                                      >
                                        Choose Files
                                      </label>
                                      <div className="text-xs text-gray-500 mt-1">
                                        JPEG, PNG, PDF up to 5MB each
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Display uploaded files */}
                                  {supportingDocuments.length > 0 && (
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium">Uploaded Files:</Label>
                                      {supportingDocuments.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border">
                                          <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-gray-500" />
                                            <span className="text-sm truncate max-w-[200px]" title={file.name}>
                                              {file.name}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                            </span>
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeFile(index)}
                                            className="h-6 w-6 p-0 hover:bg-red-100"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
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
