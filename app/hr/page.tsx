"use client"

import { useState } from "react"
import { EmployeeList } from "@/components/hr/employee-list"
import { LeaveCalendar } from "@/components/hr/leave-calendar"
import { LeaveAnalytics } from "@/components/hr/leave-analytics"
import { DocumentVerification } from "@/components/hr/DocumentVerification"
import { DocumentFileManager } from "@/components/hr/DocumentFileManager"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, FolderOpen, LogOut, Settings, User } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function HRDashboard() {
  const [activeTab, setActiveTab] = useState("employees")


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
              <p className="text-gray-600">Manage employees, review leave requests, and generate reports</p>
            </div>
            <div className="flex items-center gap-3">

              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="/placeholder.svg?height=40&width=40&text=HR" />
                      <AvatarFallback>HR</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">HR Manager</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">hr@company.com</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="verification" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Verification
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3" />
            Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <EmployeeList />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <LeaveCalendar />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <LeaveAnalytics />
        </TabsContent>

        <TabsContent value="verification" className="space-y-4">
          <DocumentVerification />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <DocumentFileManager />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  )
}
