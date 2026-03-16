"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, X, Briefcase } from "lucide-react"
import { LeaveCalendar } from "@/components/leave-calendar"
import { SignaturePad } from "@/components/signature-pad"
import { Badge } from "@/components/ui/badge"
import { SuccessDialog } from "@/components/success-dialog"
import { ErrorDialog } from "@/components/error-dialog"
import { format } from "date-fns/format"
import { isSameDay } from "date-fns/isSameDay"
import { Input } from "@/components/ui/input"
import { useTranslations } from "@/components/language-provider"
import { useSession } from "next-auth/react"

interface WorkTripRequestFormProps {
  onBack: () => void
}

export function WorkTripRequestForm({ onBack }: WorkTripRequestFormProps) {
  const t = useTranslations()
  const { data: session } = useSession()
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [signature, setSignature] = useState("")
  const [isValidSignature, setIsValidSignature] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDetails, setErrorDetails] = useState({ title: "", message: "" })
  const [destination, setDestination] = useState("")
  const [purpose, setPurpose] = useState("")
  const [managerInfo, setManagerInfo] = useState<{ name: string; id: string } | null>(null)
  const [loadingManager, setLoadingManager] = useState(true)
  const [existingLeaveRequests, setExistingLeaveRequests] = useState<Array<{
    startDate: string
    endDate: string
    selectedDates: string[]
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    leaveType: string
  }>>([])
  const [loadingLeaveRequests, setLoadingLeaveRequests] = useState(true)

  useEffect(() => {
    const fetchManagerInfo = async () => {
      if (!session?.user?.id) {
        setLoadingManager(false)
        return
      }

      try {
        const response = await fetch('/api/user/manager')
        if (response.ok) {
          const data = await response.json()
          if (data.manager) {
            setManagerInfo({
              name: `${data.manager?.firstName || ''} ${data.manager?.lastName || ''}`,
              id: data.manager.id
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch manager info:', error)
      } finally {
        setLoadingManager(false)
      }
    }

    const fetchExistingRequests = async () => {
      if (!session?.user?.id) {
        setLoadingLeaveRequests(false)
        return
      }

      try {
        const [leaveRes, pendingWfhRes, approvedWfhRes, pendingWtRes, approvedWtRes] = await Promise.all([
          fetch('/api/user/leave-requests', { cache: 'no-store' }),
          fetch('/api/wfh-requests?status=PENDING', { cache: 'no-store' }),
          fetch('/api/wfh-requests?status=APPROVED', { cache: 'no-store' }),
          fetch('/api/work-trip-requests?status=PENDING', { cache: 'no-store' }),
          fetch('/api/work-trip-requests?status=APPROVED', { cache: 'no-store' })
        ])

        const allBlocked: typeof existingLeaveRequests = []

        if (leaveRes.ok) {
          const data = await leaveRes.json()
          const activeRequests = (data.requests || []).filter((req: any) =>
            req.status === 'PENDING' || req.status === 'APPROVED'
          )
          allBlocked.push(...activeRequests)
        }

        // Merge WFH requests
        const wfhRequests: any[] = []
        if (pendingWfhRes.ok) {
          const data = await pendingWfhRes.json()
          wfhRequests.push(...(data.wfhRequests || []))
        }
        if (approvedWfhRes.ok) {
          const data = await approvedWfhRes.json()
          wfhRequests.push(...(data.wfhRequests || []))
        }
        const activeWfh = wfhRequests
          .filter((req: any) => req.status === 'PENDING' || req.status === 'APPROVED')
          .map((req: any) => ({
            startDate: req.startDate?.split('T')[0] || '',
            endDate: req.endDate?.split('T')[0] || '',
            selectedDates: (req.selectedDates || []).map((d: string) =>
              typeof d === 'string' ? d.split('T')[0] : String(d).split('T')[0]
            ),
            status: req.status,
            leaveType: 'WFH'
          }))
        allBlocked.push(...activeWfh)

        // Merge work trip requests
        const wtRequests: any[] = []
        if (pendingWtRes.ok) {
          const data = await pendingWtRes.json()
          wtRequests.push(...(data.workTripRequests || []))
        }
        if (approvedWtRes.ok) {
          const data = await approvedWtRes.json()
          wtRequests.push(...(data.workTripRequests || []))
        }
        const activeWt = wtRequests
          .filter((req: any) => req.status === 'PENDING' || req.status === 'APPROVED')
          .map((req: any) => ({
            startDate: req.startDate?.split('T')[0] || '',
            endDate: req.endDate?.split('T')[0] || '',
            selectedDates: (req.selectedDates || []).map((d: string) =>
              typeof d === 'string' ? d.split('T')[0] : String(d).split('T')[0]
            ),
            status: req.status,
            leaveType: 'Work Trip'
          }))
        allBlocked.push(...activeWt)

        setExistingLeaveRequests(allBlocked)
      } catch (error) {
        console.error('Failed to fetch existing requests:', error)
      } finally {
        setLoadingLeaveRequests(false)
      }
    }

    fetchManagerInfo()
    fetchExistingRequests()
  }, [session])

  const handleDateSelect = (date: Date) => {
    setSelectedDates((prev) => {
      const isAlreadySelected = prev.some((selectedDate) => isSameDay(selectedDate, date))
      if (isAlreadySelected) {
        return prev.filter((selectedDate) => !isSameDay(selectedDate, date))
      } else {
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
      showError("No Dates Selected", "Please select at least one date for your work trip.")
      return
    }

    if (!destination.trim()) {
      showError("Destination Required", "Please provide a destination for your work trip.")
      return
    }

    if (!purpose.trim()) {
      showError("Purpose Required", "Please describe the purpose of your work trip.")
      return
    }

    if (!signature || !isValidSignature) {
      showError(t.errors.invalidSignature, t.errors.signatureValidationMessage)
      return
    }

    setIsSubmitting(true)

    try {
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime())
      const startDate = sortedDates[0]
      const endDate = sortedDates[sortedDates.length - 1]

      const toLocalDateString = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      const response = await fetch('/api/work-trip-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: toLocalDateString(startDate),
          endDate: toLocalDateString(endDate),
          selectedDates: selectedDates.map(d => toLocalDateString(d)),
          destination: destination.trim(),
          purpose: purpose.trim(),
          signature,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.errors) {
          const errorMessages = data.errors.map((e: any) => e.message).join(', ')
          showError("Conflict", errorMessages)
        } else {
          showError(
            "Conflict",
            data.message || data.error || t.workTripForm.submissionFailed
          )
        }
        return
      }

      setShowSuccessDialog(true)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred while submitting your request'
      showError("Submission Failed", msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSuccessClose = () => {
    setShowSuccessDialog(false)
    setSelectedDates([])
    setDestination("")
    setPurpose("")
    setSignature("")
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
            <div className="flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">{t.workTripForm.title}</h1>
            </div>
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
                  <Briefcase className="h-5 w-5 text-green-600" />
                  {t.leaveForm.selectDates}
                </CardTitle>
                <CardDescription>
                  {t.workTripForm.selectDatesDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeaveCalendar
                  selectedDates={selectedDates}
                  onDateSelect={handleDateSelect}
                  isWFHCalendar={false}
                  showExistingRequests={true}
                  existingLeaveRequests={existingLeaveRequests}
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
                      <Badge variant="secondary" className="text-lg px-3 py-1 bg-green-100 text-green-800">
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
                            className="text-xs cursor-pointer hover:bg-red-50 border-green-300 text-green-700"
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

            {/* Work Trip Request Form */}
            <Card>
              <CardHeader>
                <CardTitle>{t.workTripForm.title} {t.leaveForm.details}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">

                  <div className="space-y-2">
                    <Label htmlFor="destination">{t.workTripForm.destination}</Label>
                    <Input
                      type="text"
                      id="destination"
                      placeholder={t.workTripForm.destinationPlaceholder}
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purpose">{t.workTripForm.purpose}</Label>
                    <Textarea
                      id="purpose"
                      placeholder={t.workTripForm.purposePlaceholder}
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      rows={3}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Manager</Label>
                    <div className="p-3 bg-gray-50 rounded-md">
                      {loadingManager ? (
                        <p className="text-sm text-gray-500">{t.loading.loadingManagerInfo}</p>
                      ) : managerInfo ? (
                        <>
                          <p className="font-medium">{managerInfo.name}</p>
                          <p className="text-sm text-gray-600">{t.workTripForm.yourRequestWillBeSent}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-500">{t.labels.noManagerAssigned}</p>
                          <p className="text-sm text-gray-600">{t.labels.contactHrForManager}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Signature Pad */}
                  <SignaturePad
                    signature={signature}
                    onSignatureChange={(sig, isValid) => {
                      setSignature(sig)
                      setIsValidSignature(isValid)
                    }}
                  />

                  <div className="flex flex-col gap-2 pt-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting || selectedDates.length === 0 || !destination.trim() || !purpose.trim() || !signature || !isValidSignature || !managerInfo}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {isSubmitting ? "Submitting..." :
                        !managerInfo ? "No Manager Assigned" :
                        `${t.workTripForm.submitRequest} (${getTotalDays()} ${getTotalDays() === 1 ? t.common.day : t.common.days})`}
                    </Button>
                    <Button type="button" variant="outline" onClick={onBack} className="w-full">
                      {t.common.cancel}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <SuccessDialog
        isOpen={showSuccessDialog}
        onClose={handleSuccessClose}
        type="workTrip"
        details={{
          days: selectedDates.length,
          dates: formatDateGroups(groupConsecutiveDates(selectedDates)),
          manager: managerInfo?.name || "No Manager",
        }}
      />

      {/* Error Dialog */}
      <ErrorDialog
        isOpen={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        title={errorDetails.title}
        message={errorDetails.message}
      />
    </div>
  )
}
