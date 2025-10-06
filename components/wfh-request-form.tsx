"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, X, Network } from "lucide-react"
import { LeaveCalendar } from "@/components/leave-calendar"
import { SignaturePad } from "@/components/signature-pad"
import { Badge } from "@/components/ui/badge"
import { SuccessDialog } from "@/components/success-dialog"
import { ErrorDialog } from "@/components/error-dialog"
import { format } from "date-fns/format"
import { isSameDay } from "date-fns/isSameDay"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/components/language-provider"

interface WorkRemoteRequestFormProps {
  onBack: () => void
}

export function WorkRemoteRequestForm({ onBack }: WorkRemoteRequestFormProps) {
  const t = useTranslations()
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [signature, setSignature] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDetails, setErrorDetails] = useState({ title: "", message: "" })
  const [location, setLocation] = useState("home")
  const [otherLocation, setOtherLocation] = useState("")

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
      showError("No Dates Selected", "Please select at least one date for your work from home request.")
      return
    }

    const finalLocation = location === "Other" ? otherLocation : location

    if (!finalLocation.trim()) {
      showError("Location Required", "Please provide a location for your work from home request.")
      return
    }

    if (!signature) {
      showError("Signature Required", "Please provide your digital signature to submit the request.")
      return
    }

    setIsSubmitting(true)

    try {
      // Sort dates to get start and end
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime())
      const startDate = sortedDates[0]
      const endDate = sortedDates[sortedDates.length - 1]

      const response = await fetch('/api/wfh-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          selectedDates: selectedDates.map(d => d.toISOString()),
          location: finalLocation,
          signature,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.errors) {
          const errorMessages = data.errors.map((e: any) => e.message).join(', ')
          showError('Validation Error', errorMessages)
        } else {
          showError('Submission Failed', data.error || 'Failed to submit work from home request')
        }
        return
      }

      // Show success dialog
      setShowSuccessDialog(true)
    } catch (error) {
      showError(
        "Submission Failed",
        "There was an error submitting your work from home request. Please check your connection and try again.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSuccessClose = () => {
    setShowSuccessDialog(false)
    // Reset form
    setSelectedDates([])
    setLocation("home")
    setOtherLocation("")
    setSignature("")
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
            <div className="flex items-center gap-2">
              <Network className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">{t.remoteForm.title}</h1>
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
                  <Network className="h-5 w-5 text-blue-600" />
                  {t.leaveForm.selectDates}
                </CardTitle>
                <CardDescription>
                  {t.leaveForm.selectDates} when you'd like to work remote. You can select multiple individual days or consecutive periods.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeaveCalendar 
                  selectedDates={selectedDates} 
                  onDateSelect={handleDateSelect} 
                  isWFHCalendar={true}
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
                  <p className="text-gray-500 text-center py-4">No {t.leaveForm.days} selected</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t.leaveForm.totalDays}:</span>
                      <Badge variant="secondary" className="text-lg px-3 py-1 bg-blue-100 text-blue-800">
                        {getTotalDays()}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <span className="text-sm font-medium">Dates:</span>
                      <p className="text-sm text-gray-600">{formatDateGroups(groupConsecutiveDates(selectedDates))}</p>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      <span className="text-sm font-medium">Individual Days:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedDates.map((date, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-red-50 border-blue-300 text-blue-700"
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

            {/* Work Remote Request Form */}
            <Card>
              <CardHeader>
                <CardTitle>{t.remoteForm.title} Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">

                  <div className="space-y-2">
                    <Label htmlFor="location">Work From Home Location</Label>
                    <Select value={location} onValueChange={setLocation}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="home">Home</SelectItem>
                        <SelectItem value="client-site">Client Site</SelectItem>
                        <SelectItem value="partner-office">Partner Office</SelectItem>
                        <SelectItem value="other-office">Other Office Location</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {location === "Other" && (
                    <div className="space-y-2">
                      <Label htmlFor="otherLocation">Other Location</Label>
                      <Input
                        type="text"
                        id="otherLocation"
                        placeholder="Please specify the location"
                        value={otherLocation}
                        onChange={(e) => setOtherLocation(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Manager</Label>
                    <div className="p-3 bg-gray-50 rounded-md">
                      <p className="font-medium">Michael Chen</p>
                      <p className="text-sm text-gray-600">Your request will be sent for approval</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Work From Home Guidelines</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Work from home requests must be for next week or later</li>
                      <li>• Ensure you have reliable internet connection</li>
                      <li>• Be available during core business hours</li>
                      <li>• Maintain regular communication with your team</li>
                    </ul>
                  </div>

                  {/* Signature Pad */}
                  <SignaturePad signature={signature} onSignatureChange={setSignature} />

                  <div className="flex flex-col gap-2 pt-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting || selectedDates.length === 0 || !signature}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting ? "Submitting..." : `Submit Work From Home Request (${getTotalDays()} days)`}
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
      <SuccessDialog
        isOpen={showSuccessDialog}
        onClose={handleSuccessClose}
        type="remote"
        details={{
          days: selectedDates.length,
          dates: formatDateGroups(groupConsecutiveDates(selectedDates)),
          manager: "Michael Chen",
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
