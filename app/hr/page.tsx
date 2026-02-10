"use client"

import React, { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { EmployeeList } from "@/components/hr/employee-list"
import { LeaveCalendar } from "@/components/hr/leave-calendar"
import { LeaveAnalytics } from "@/components/hr/leave-analytics"
import { DocumentVerification } from "@/components/hr/DocumentVerification"
import { DocumentFileManager } from "@/components/hr/DocumentFileManager"
import { DashboardSummary } from "@/components/dashboard-summary"
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
import { toast } from "sonner"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { useTranslations } from "@/components/language-provider"

export default function HRDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("employees")
  const t = useTranslations()

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/login")
      return
    }

    // Allow HR, ADMIN, and EXECUTIVE roles, or EMPLOYEE role with HR department
    const isHREmployee = session.user.role === "EMPLOYEE" && session.user.department?.toLowerCase().includes("hr")
    if (session.user.role !== "HR" && session.user.role !== "ADMIN" && session.user.role !== "EXECUTIVE" && !isHREmployee) {
      router.push("/employee")
    }
  }, [session, status, router])

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">{t.common.loading}</div>
  }

  const isHREmployee = session.user.role === "EMPLOYEE" && session.user.department?.toLowerCase().includes("hr")
  if (!session || (session.user.role !== "HR" && session.user.role !== "ADMIN" && session.user.role !== "EXECUTIVE" && !isHREmployee)) {
    return null
  }

  const userName = `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || session.user.email

  // Helper function to get the correct personal dashboard route
  const getDashboardRoute = () => {
    // Return the appropriate dashboard based on the user's actual role
    switch (session?.user.role) {
      case "EXECUTIVE":
        return "/executive"
      case "MANAGER":
        return "/manager"
      case "HR":
        // HR role users go to employee dashboard for their personal requests
        return "/employee"
      case "EMPLOYEE":
      default:
        return "/employee"
    }
  }

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
                onClick={() => router.push(getDashboardRoute())}
                title={t.nav.backToPersonalDashboard}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t.hr.hrDashboard}</h1>
                <p className="text-gray-600">{t.hr.hrDashboardDescription}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => router.push(getDashboardRoute())} 
                variant="outline" 
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                {t.nav.myDashboard}
              </Button>

              <NotificationBell />

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
                      <p className="text-xs text-gray-500 mt-1">{t.labels.hrDepartment}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(getDashboardRoute())}>
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>{t.nav.myDashboard}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t.common.logOut}</span>
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
          <TabsTrigger value="employees">{t.tabs.employees}</TabsTrigger>
          <TabsTrigger value="calendar">{t.tabs.calendar}</TabsTrigger>
          <TabsTrigger value="analytics">{t.tabs.analytics}</TabsTrigger>
          <TabsTrigger value="verification" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {t.tabs.verification}
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3" />
            {t.tabs.documents}
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Summary - shown on all tabs */}
        <DashboardSummary userRole="HR" />

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
