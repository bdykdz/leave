"use client"

import { useState } from "react"
import { X, Save, Clock, User, Calendar } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Employee {
  id: string
  name: string
  avatar: string
  department: string
  role: string
  manager: string
  leaveBalance: { vacation: number; personal: number; medical: number }
  status: "active" | "on_leave" | "medical_leave"
  email?: string
  phone?: string
  startDate?: string
  workSchedule?: {
    startTime: string
    endTime: string
    workDays: string[]
  }
}

interface EmployeeManagementModalProps {
  isOpen: boolean
  onClose: () => void
  employee: Employee
  onSave: (updatedEmployee: Employee) => void
}

export function EmployeeManagementModal({ isOpen, onClose, employee, onSave }: EmployeeManagementModalProps) {
  const [editedEmployee, setEditedEmployee] = useState<Employee>({
    ...employee,
    email: employee.email || `${employee.name.toLowerCase().replace(" ", ".")}@company.com`,
    phone: employee.phone || "+1 (555) 123-4567",
    startDate: employee.startDate || "January 15, 2022",
    workSchedule: employee.workSchedule || {
      startTime: "09:00",
      endTime: "17:00",
      workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    },
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      onSave(editedEmployee)
      onClose()
    } catch (error) {
      console.error("Failed to save employee data:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLeaveBalanceChange = (type: "vacation" | "personal" | "medical", value: string) => {
    const numValue = Number.parseInt(value) || 0
    setEditedEmployee((prev) => ({
      ...prev,
      leaveBalance: {
        ...prev.leaveBalance,
        [type]: numValue,
      },
    }))
  }

  const handleWorkDayToggle = (day: string) => {
    setEditedEmployee((prev) => ({
      ...prev,
      workSchedule: {
        ...prev.workSchedule!,
        workDays: prev.workSchedule!.workDays.includes(day)
          ? prev.workSchedule!.workDays.filter((d) => d !== day)
          : [...prev.workSchedule!.workDays, day],
      },
    }))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "on_leave":
        return "bg-yellow-100 text-yellow-800"
      case "medical_leave":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const allDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Edit Employee - {employee.name}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee Header */}
          <div className="flex items-start gap-6 p-6 bg-gray-50 rounded-lg">
            <Avatar className="h-16 w-16">
              <AvatarImage  />
              <AvatarFallback className="text-lg">{employee.avatar}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={editedEmployee.name}
                    onChange={(e) => setEditedEmployee((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editedEmployee.status}
                    onValueChange={(value: "active" | "on_leave" | "medical_leave") =>
                      setEditedEmployee((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="medical_leave">Medical Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={editedEmployee.role}
                    onChange={(e) => setEditedEmployee((prev) => ({ ...prev, role: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={editedEmployee.department}
                    onValueChange={(value) => setEditedEmployee((prev) => ({ ...prev, department: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Engineering">Engineering</SelectItem>
                      <SelectItem value="Design">Design</SelectItem>
                      <SelectItem value="Product">Product</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager">Manager</Label>
                  <Input
                    id="manager"
                    value={editedEmployee.manager}
                    onChange={(e) => setEditedEmployee((prev) => ({ ...prev, manager: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editedEmployee.email}
                    onChange={(e) => setEditedEmployee((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={editedEmployee.phone}
                    onChange={(e) => setEditedEmployee((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    value={editedEmployee.startDate}
                    onChange={(e) => setEditedEmployee((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Work Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Work Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={editedEmployee.workSchedule?.startTime}
                      onChange={(e) =>
                        setEditedEmployee((prev) => ({
                          ...prev,
                          workSchedule: { ...prev.workSchedule!, startTime: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={editedEmployee.workSchedule?.endTime}
                      onChange={(e) =>
                        setEditedEmployee((prev) => ({
                          ...prev,
                          workSchedule: { ...prev.workSchedule!, endTime: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Work Days</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {allDays.map((day) => (
                      <div key={day} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={day}
                          checked={editedEmployee.workSchedule?.workDays.includes(day)}
                          onChange={() => handleWorkDayToggle(day)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={day} className="text-sm">
                          {day}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Current Schedule:</strong> {editedEmployee.workSchedule?.startTime} -{" "}
                    {editedEmployee.workSchedule?.endTime}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    Working {editedEmployee.workSchedule?.workDays.length} days per week
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Leave Balances */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Leave Balance Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="vacation">Vacation Days</Label>
                  <Input
                    id="vacation"
                    type="number"
                    min="0"
                    max="50"
                    value={editedEmployee.leaveBalance.vacation}
                    onChange={(e) => handleLeaveBalanceChange("vacation", e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Remaining vacation days</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personal">Personal Days</Label>
                  <Input
                    id="personal"
                    type="number"
                    min="0"
                    max="20"
                    value={editedEmployee.leaveBalance.personal}
                    onChange={(e) => handleLeaveBalanceChange("personal", e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Remaining personal days</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medical">Medical Leave Days</Label>
                  <Input
                    id="medical"
                    type="number"
                    min="0"
                    value={editedEmployee.leaveBalance.medical}
                    onChange={(e) => handleLeaveBalanceChange("medical", e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Days used this year</p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Changes to leave balances will be logged and require HR approval justification.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleSave} disabled={isSubmitting} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
