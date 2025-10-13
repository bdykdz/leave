"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Calendar, ArrowLeft, CheckCircle, AlertTriangle, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SignaturePad } from "@/components/signature-pad"
import { CalendarPicker } from "@/components/calendar-picker"
import { ExecutiveApproverPicker } from "@/components/executive-approver-picker"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { useTranslations } from "@/components/language-provider"

interface ExecutiveLeaveRequestFormProps {
  onBack: () => void
}

interface LeaveType {
  id: string
  name: string
  description?: string
  requiresDocument: boolean
}

export function ExecutiveLeaveRequestForm({ onBack }: ExecutiveLeaveRequestFormProps) {
  const { data: session } = useSession()
  const t = useTranslations()
  
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [leaveType, setLeaveType] = useState<string>("")
  const [reason, setReason] = useState<string>("")
  const [signature, setSignature] = useState<string>("")
  const [selectedApprover, setSelectedApprover] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDetails, setErrorDetails] = useState({ title: "", message: "" })
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(true)

  useEffect(() => {
    fetchLeaveTypes()
  }, [])

  const fetchLeaveTypes = async () => {
    try {
      const response = await fetch('/api/leave-types')
      if (response.ok) {
        const data = await response.json()
        setLeaveTypes(data.leaveTypes || [])
      }
    } catch (error) {
      console.error('Error fetching leave types:', error)
    } finally {
      setLoadingLeaveTypes(false)
    }
  }

  const showError = (title: string, message: string) => {
    setErrorDetails({ title, message })
    setShowErrorDialog(true)
  }

  const handleSubmit = async () => {
    // Validation
    if (selectedDates.length === 0) {
      showError(
        "No Dates Selected",
        "Please select at least one date for your leave request."
      )
      return
    }

    if (!leaveType) {
      showError(
        "Leave Type Required",
        "Please select the type of leave you're requesting."
      )
      return
    }

    if (!selectedApprover) {
      showError(
        "Approver Required",
        "Please select an executive colleague to approve your leave request."
      )
      return
    }

    if (!signature) {
      showError(
        "Signature Required",
        "Please provide your digital signature to submit the request."
      )
      return
    }

    setIsSubmitting(true)

    try {
      // Sort dates to get start and end
      const sortedDates = selectedDates.sort((a, b) => a.getTime() - b.getTime())
      const startDate = sortedDates[0]
      const endDate = sortedDates[sortedDates.length - 1]

      // Helper to format date as YYYY-MM-DD in local time
      const toLocalDateString = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      // Prepare request body for executive leave
      const requestBody = {
        leaveTypeId: leaveType,
        startDate: toLocalDateString(startDate),
        endDate: toLocalDateString(endDate),
        reason: reason.trim() || " ",
        selectedDates: selectedDates.map(date => toLocalDateString(date)),
        signature: signature,
        executiveApproverId: selectedApprover, // Single executive approver
        isExecutiveRequest: true, // Flag to identify executive requests
      }

      // Submit to API
      const response = await fetch('/api/executive/leave-request', {
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
          throw new Error(data.message)
        } else if (data.errors && Array.isArray(data.errors)) {
          throw new Error(data.errors.join('\n'))
        } else {
          throw new Error(data.error || 'Failed to submit leave request')
        }
      }

      // Show success dialog
      setShowSuccessDialog(true)
      
      // Reset form after a delay
      setTimeout(() => {
        setSelectedDates([])
        setLeaveType("")
        setReason("")
        setSignature("")
        setSelectedApprover("")
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
    // Reset form
    setSelectedDates([])
    setLeaveType("")
    setReason("")
    setSignature("")
    setSelectedApprover("")
    // Go back to dashboard
    onBack()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            onClick={onBack}
            variant="ghost"
            className="mb-4 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Executive Leave Request</h1>
              <p className="text-gray-600">Submit a leave request for executive approval</p>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Calendar */}
          <Card>
            <CardHeader>
              <CardTitle>{t.leaveForm.selectDates}</CardTitle>
              <CardDescription>
                {t.leaveForm.selectDatesDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarPicker
                selectedDates={selectedDates}
                onDateSelect={setSelectedDates}
                displayMode="month"
              />
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700 font-medium">
                    {t.leaveForm.totalDays}
                  </span>
                  <span className="text-lg font-bold text-blue-900">
                    {selectedDates.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Form Fields */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.leaveForm.requestDetails}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Leave Type */}
                <div className="space-y-2">
                  <Label htmlFor="leave-type">
                    {t.leaveForm.leaveType} <span className="text-red-500">*</span>
                  </Label>
                  <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger id="leave-type">
                      <SelectValue placeholder={loadingLeaveTypes ? "Loading..." : t.leaveForm.selectLeaveType} />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="reason">
                    {t.leaveForm.reason} <span className="text-gray-400 text-sm">(Optional)</span>
                  </Label>
                  <Textarea
                    id="reason"
                    placeholder={t.leaveForm.reasonPlaceholder}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                {/* Executive Approver Selection */}
                <div className="border-t pt-4">
                  <ExecutiveApproverPicker
                    selectedApprover={selectedApprover}
                    onApproverChange={setSelectedApprover}
                  />
                </div>

                {/* Signature */}
                <div className="border-t pt-4">
                  <SignaturePad signature={signature} onSignatureChange={setSignature} />
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      isSubmitting ||
                      selectedDates.length === 0 ||
                      !signature ||
                      !leaveType ||
                      !selectedApprover
                    }
                    className="w-full"
                  >
                    {isSubmitting ? t.leaveForm.submitting : t.leaveForm.submitRequest}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Info Alert */}
            <Alert className="border-purple-200 bg-purple-50">
              <Shield className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-800">
                <strong>Executive Leave Process:</strong> Your leave request will be sent directly 
                to the selected executive for approval. Once approved, HR will be notified automatically.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">
              {t.leaveForm.requestSubmitted}
            </DialogTitle>
            <DialogDescription className="text-center">
              {t.leaveForm.requestSubmittedDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <Button onClick={handleSuccessClose} className="w-full">
              {t.leaveForm.backToDashboard}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-red-100 p-3">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">{errorDetails.title}</DialogTitle>
            <DialogDescription className="text-center whitespace-pre-line">
              {errorDetails.message}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <Button onClick={() => setShowErrorDialog(false)} className="w-full">
              Try Again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}