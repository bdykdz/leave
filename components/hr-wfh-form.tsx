"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Home, X, Shield } from "lucide-react"
import { LeaveCalendar } from "@/components/leave-calendar"
import { Badge } from "@/components/ui/badge"
import { SuccessDialog } from "@/components/success-dialog"
import { ErrorDialog } from "@/components/error-dialog"
import { format, isSameDay } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmployeePicker } from "@/components/employee-picker"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/components/language-provider"

interface HRRemoteWorkFormProps {
  onBack: () => void
}

export function HRRemoteWorkForm({ onBack }: HRRemoteWorkFormProps) {
  const t = useTranslations()
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState("")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDetails, setErrorDetails] = useState({ title: "", message: "" })
  const [skipApproval, setSkipApproval] = useState(false)
  const [hrNotes, setHrNotes] = useState("")
  const [location, setLocation] = useState("")

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

    if (!selectedEmployee) {
      showError("Employee Required", "Please select an employee for this Remote Work request.")
      return
    }

    if (selectedDates.length === 0) {
      showError("No Dates Selected", "Please select at least one date for the Remote Work request.")
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
        "There was an error adding the Remote Work request. Please check your connection and try again.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSuccessClose = () => {
    setShowSuccessDialog(false)
    // Reset form
    setSelectedDates([])
    setSelectedEmployee("")
    setReason("")
    setHrNotes("")
    setSkipApproval(false)
    setLocation("")
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

  const getSelectedEmployeeData = () => {
    // Mock employee data - in real app this would come from the employee picker
    if (selectedEmployee === "sarah_johnson") {
      return {
        name: "Sarah Johnson",
        avatar: "SJ",
        department: "Engineering",
        role: "Senior Developer",
        manager: "Michael Chen",
      }
    }
    return null
  }

  const selectedEmployeeData = getSelectedEmployeeData()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Button variant="ghost" onClick={onBack} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to HR Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Add Remote Work (HR)</h1>
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
                  <Home className="h-5 w-5 text-blue-600" />
                  Select Remote Work Days
                </CardTitle>
                <CardDescription>
                  Click on individual days to select when the employee will work remotely.
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
                  <p className="text-gray-500 text-center py-4">{t.leaveForm.noDaysSelected}</p>
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

            {/* HR WFH Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  HR Remote Work Request
                </CardTitle>
                <CardDescription>Add remote work on behalf of an employee</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Employee Selection */}
                  <div className="space-y-2">
                    <Label>Employee *</Label>
                    <EmployeePicker selectedEmployee={selectedEmployee} onEmployeeChange={setSelectedEmployee} />
                    {selectedEmployeeData && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              
                            />
                            <AvatarFallback>{selectedEmployeeData.avatar}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{selectedEmployeeData.name}</p>
                            <p className="text-xs text-gray-600">
                              {selectedEmployeeData.role} • {selectedEmployeeData.department}
                            </p>
                            <p className="text-xs text-gray-500">Manager: {selectedEmployeeData.manager}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Remote Work</Label>
                    <Textarea
                      id="reason"
                      placeholder="Provide reason for the remote work request (e.g., office maintenance, team event, focus time, etc.)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Select onValueChange={setLocation}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="home">Home</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hr-notes">HR Notes (Internal)</Label>
                    <Textarea
                      id="hr-notes"
                      placeholder="Internal HR notes (not visible to employee)..."
                      value={hrNotes}
                      onChange={(e) => setHrNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {/* HR Options */}
                  <div className="space-y-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <h4 className="font-medium text-yellow-800">HR Options</h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="skip-approval"
                          checked={skipApproval}
                          onCheckedChange={(checked) => setSkipApproval(checked as boolean)}
                        />
                        <Label htmlFor="skip-approval" className="text-sm">
                          Skip manager approval (auto-approve)
                        </Label>
                      </div>
                    </div>
                    <p className="text-xs text-yellow-700">
                      This option is only available to HR personnel and overrides normal approval workflows.
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Remote Work Guidelines</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Ensure employee has reliable internet connection</li>
                      <li>• Employee should be available during core business hours</li>
                      <li>• All scheduled meetings should be attended via video call</li>
                      <li>• Regular communication with team should be maintained</li>
                    </ul>
                  </div>

                  <div className="flex flex-col gap-2 pt-4 border-t">
                    <Button
                      type="submit"
                      disabled={isSubmitting || selectedDates.length === 0 || !selectedEmployee}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting ? "Adding Remote Work..." : `Add Remote Work (${getTotalDays()} days)`}
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
          manager: "HR Department",
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
