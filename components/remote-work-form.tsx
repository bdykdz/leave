"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, MapPin, X } from "lucide-react"
import { LeaveCalendar } from "@/components/leave-calendar"
import { SignaturePad } from "@/components/signature-pad"
import { Badge } from "@/components/ui/badge"
import { SuccessDialog } from "@/components/success-dialog"
import { ErrorDialog } from "@/components/error-dialog"
import { format, isSameDay } from "date-fns"
import { Input as InputComponent } from "@/components/ui/input"

interface RemoteWorkFormProps {
  onBack: () => void
}

export function RemoteWorkForm({ onBack }: RemoteWorkFormProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [location, setLocation] = useState("")
  const [customLocation, setCustomLocation] = useState("")
  const [reason, setReason] = useState("")
  const [signature, setSignature] = useState("")
  const [isValidSignature, setIsValidSignature] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDetails, setErrorDetails] = useState({ title: "", message: "" })

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
      showError("No Dates Selected", "Please select at least one date for your remote work request.")
      return
    }

    if (!location) {
      showError("Location Required", "Please select where you'll be working remotely from.")
      return
    }

    if (location === "other" && !customLocation.trim()) {
      showError("Custom Location Required", "Please specify your remote work location.")
      return
    }

    if (!reason.trim()) {
      showError("Reason Required", "Please provide a reason for your remote work request.")
      return
    }

    if (!signature || !isValidSignature) {
      showError("Invalid Signature", "Please provide a valid signature with at least 2 strokes and 25 pixels of drawing.")
      return
    }

    setIsSubmitting(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Show success dialog
      setShowSuccessDialog(true)
    } catch (error) {
      showError(
        "Submission Failed",
        "There was an error submitting your remote work request. Please check your connection and try again.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSuccessClose = () => {
    setShowSuccessDialog(false)
    // Reset form
    setSelectedDates([])
    setLocation("")
    setCustomLocation("")
    setReason("")
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

  const getLocationDisplay = () => {
    if (location === "other") {
      return customLocation || "Other location"
    }
    const locationMap: Record<string, string> = {
      home: "Home",
      client_site: "Client Site",
      partner_office: "Partner Office",
      other_office: "Other Office Location",
    }
    return locationMap[location] || location
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Button variant="ghost" onClick={onBack} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <MapPin className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Request Remote Work</h1>
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
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Select Remote Work Days
                </CardTitle>
                <CardDescription>
                  Click on individual days to select when you'd like to work remotely. You can select multiple
                  individual days or consecutive periods.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeaveCalendar selectedDates={selectedDates} onDateSelect={handleDateSelect} />
              </CardContent>
            </Card>
          </div>

          {/* Form Section */}
          <div className="space-y-6">
            {/* Selected Dates Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Selected Days</CardTitle>
                  {selectedDates.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleClearAll}>
                      Clear All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedDates.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No days selected</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Days:</span>
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

            {/* Remote Work Request Form */}
            <Card>
              <CardHeader>
                <CardTitle>Request Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Remote Work Location *</Label>
                    <Select value={location} onValueChange={setLocation} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select where you'll be working from" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="home">🏠 Home</SelectItem>
                        <SelectItem value="client_site">🏢 Client Site</SelectItem>
                        <SelectItem value="partner_office">🤝 Partner Office</SelectItem>
                        <SelectItem value="other_office">🏬 Other Office Location</SelectItem>
                        <SelectItem value="other">📍 Other Location</SelectItem>
                      </SelectContent>
                    </Select>
                    {location === "other" && (
                      <InputComponent
                        placeholder="Please specify your remote work location"
                        value={customLocation}
                        onChange={(e) => setCustomLocation(e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Remote Work *</Label>
                    <Textarea
                      id="reason"
                      placeholder="Please provide a reason for your remote work request (e.g., client meeting, focus time, home repairs, etc.)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                      required
                    />
                    <p className="text-xs text-gray-500">
                      Help your manager understand why you need to work remotely on these days
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Manager</Label>
                    <div className="p-3 bg-gray-50 rounded-md">
                      <p className="font-medium">Michael Chen</p>
                      <p className="text-sm text-gray-600">Your request will be sent for approval</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Remote Work Guidelines</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Ensure you have reliable internet connection</li>
                      <li>• Be available during core business hours</li>
                      <li>• Attend all scheduled meetings via video call</li>
                      <li>• Maintain regular communication with your team</li>
                      <li>• Notify team of your remote location if relevant</li>
                    </ul>
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
                      disabled={isSubmitting || selectedDates.length === 0 || !signature || !isValidSignature || !location}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting ? "Submitting..." : `Submit Remote Work Request (${getTotalDays()} days)`}
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
          location: getLocationDisplay(),
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
