"use client"

import React, { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { EmployeeList } from "@/components/hr/employee-list"
import { LeaveCalendar } from "@/components/hr/leave-calendar"
import { LeaveAnalytics } from "@/components/hr/leave-analytics"
import { DocumentVerification } from "@/components/hr/DocumentVerification"
import { DocumentFileManager } from "@/components/hr/DocumentFileManager"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, FolderOpen, LogOut, Settings, User, ChevronLeft, Calendar } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function HRDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("employees")

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/login")
      return
    }

    // Allow HR, ADMIN, and EXECUTIVE roles on this page
    if (session.user.role !== "HR" && session.user.role !== "ADMIN" && session.user.role !== "EXECUTIVE") {
      router.push("/employee")
    }
  }, [session, status, router])

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!session || (session.user.role !== "HR" && session.user.role !== "ADMIN" && session.user.role !== "EXECUTIVE")) {
    return null
  }

  const userName = `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || session.user.email

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/employee")}
                title="Back to Personal Dashboard"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
                <p className="text-gray-600">Manage employees, review leave requests, and generate reports</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => router.push("/employee")} 
                variant="outline" 
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                My Dashboard
              </Button>

              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={session.user.image || undefined} />
                      <AvatarFallback>{session.user.firstName?.[0]}{session.user.lastName?.[0]}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{userName}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">{session.user.email}</p>
                      <p className="text-xs text-gray-500 mt-1">HR Department</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/employee")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>My Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={() => signOut()}>
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
