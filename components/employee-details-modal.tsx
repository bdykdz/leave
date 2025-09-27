"use client"

import { X, Mail, Phone, Calendar, TrendingUp, Clock, CheckCircle, XCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
}

interface EmployeeDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  employeeId: string
  employees: Employee[]
}

export function EmployeeDetailsModal({ isOpen, onClose, employeeId, employees }: EmployeeDetailsModalProps) {
  const employee = employees.find((emp) => emp.id === employeeId)

  if (!employee) return null

  // Mock additional employee data
  const employeeDetails = {
    email: `${employee.name.toLowerCase().replace(" ", ".")}@company.com`,
    phone: "+1 (555) 123-4567",
    startDate: "January 15, 2022",
    employeeId: `EMP${employee.id.toString().slice(-4).padStart(4, "0").toUpperCase()}`,
    location: "San Francisco, CA",
    totalVacationDays: 20,
    totalPersonalDays: 5,
  }

  // Mock recent leave history
  const recentLeaveHistory = [
    {
      id: 1,
      type: "Vacation",
      dates: "Dec 23-27, 2024",
      days: 5,
      status: "approved",
      submittedDate: "Dec 1, 2024",
    },
    {
      id: 2,
      type: "Personal",
      dates: "Nov 15, 2024",
      days: 1,
      status: "approved",
      submittedDate: "Nov 10, 2024",
    },
    {
      id: 3,
      type: "Work from Home",
      dates: "Oct 25, 2024",
      days: 1,
      status: "approved",
      submittedDate: "Oct 20, 2024",
    },
  ]

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

  const getLeaveStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "denied":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  const getLeaveStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800"
      case "denied":
        return "bg-red-100 text-red-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Employee Details</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee Header */}
          <div className="flex items-start gap-6 p-6 bg-gray-50 rounded-lg">
            <Avatar className="h-16 w-16">
              <AvatarImage src={`/placeholder.svg?height=64&width=64&text=${employee.avatar}`} />
              <AvatarFallback className="text-lg">{employee.avatar}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold">{employee.name}</h2>
                <Badge className={getStatusColor(employee.status)}>{employee.status.replace("_", " ")}</Badge>
              </div>
              <p className="text-gray-600 mb-1">{employee.role}</p>
              <p className="text-gray-500 text-sm mb-3">{employee.department}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{employeeDetails.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{employeeDetails.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>Started: {employeeDetails.startDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">ID:</span>
                  <span>{employeeDetails.employeeId}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leave Balances */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leave Balances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium text-blue-900">Vacation Days</p>
                    <p className="text-sm text-blue-600">
                      {employee.leaveBalance.vacation} remaining of {employeeDetails.totalVacationDays}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{employee.leaveBalance.vacation}</div>
                    <div className="w-16 bg-blue-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(employee.leaveBalance.vacation / employeeDetails.totalVacationDays) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-medium text-green-900">Personal Days</p>
                    <p className="text-sm text-green-600">
                      {employee.leaveBalance.personal} remaining of {employeeDetails.totalPersonalDays}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">{employee.leaveBalance.personal}</div>
                    <div className="w-16 bg-green-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${(employee.leaveBalance.personal / employeeDetails.totalPersonalDays) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {employee.leaveBalance.medical > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium text-red-900">Medical Leave</p>
                      <p className="text-sm text-red-600">Days used this year</p>
                    </div>
                    <div className="text-2xl font-bold text-red-600">{employee.leaveBalance.medical}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Leave History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Leave History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentLeaveHistory.map((leave) => (
                    <div key={leave.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getLeaveStatusIcon(leave.status)}
                        <div>
                          <p className="font-medium text-sm">{leave.type}</p>
                          <p className="text-xs text-gray-600">{leave.dates}</p>
                          <p className="text-xs text-gray-500">Submitted: {leave.submittedDate}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={`text-xs ${getLeaveStatusColor(leave.status)}`}>{leave.status}</Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {leave.days} day{leave.days > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Management Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Management & Reporting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Reports To</p>
                  <p className="font-medium">{employee.manager}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Department</p>
                  <p className="font-medium">{employee.department}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="font-medium">{employeeDetails.location}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button className="flex-1">
              <Calendar className="h-4 w-4 mr-2" />
              Add Leave
            </Button>
            <Button variant="outline" className="flex-1">
              <TrendingUp className="h-4 w-4 mr-2" />
              Adjust Balance
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
