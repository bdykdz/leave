"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { TemplateManager } from "./TemplateManager"
import { LeaveTypesManager } from "./LeaveTypesManager"
import { DocumentRetentionSettings } from "./DocumentRetentionSettings"
import { DepartmentsView } from "./DepartmentsView"
import { OrgChart } from "./OrgChart"
import { WorkflowRulesManager } from "./WorkflowRulesManager"
import { PositionsManager } from "./PositionsManager"
import { UserManagementEnhanced } from "./UserManagementEnhanced"
import { DepartmentManager } from "./DepartmentManager"
import { ManualRequestEntry } from "./ManualRequestEntry"
import { OverlapManager } from "./OverlapManager"
import { SystemSettings } from "./SystemSettings"
import { HolidaysManager } from "./HolidaysManager"
import { EscalationSettings } from "./EscalationSettings"
import { AuditLogViewer } from "./AuditLogViewer"
import { 
  FileText,
  Calendar,
  Settings,
  Users,
  Building,
  Briefcase,
  Archive,
  ChevronLeft,
  Shield,
  GitBranch,
  Network,
  LogOut,
  User,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  History,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { signOut } from "next-auth/react"

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState("templates")
  const router = useRouter()
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/employee")}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield className="h-6 w-6" />
                  Admin Panel
                </h1>
                <p className="text-gray-600 dark:text-gray-400">System administration and management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={session?.user?.image || undefined} />
                      <AvatarFallback>{session?.user?.firstName?.[0]}{session?.user?.lastName?.[0]}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{session?.user?.firstName} {session?.user?.lastName}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">{session?.user?.email}</p>
                      <Badge variant="secondary" className="mt-1">Admin</Badge>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/employee")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Employee View</span>
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 lg:grid-cols-14">
            <TabsTrigger value="overlaps" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span className="hidden sm:inline">Overlaps</span>
            </TabsTrigger>
            <TabsTrigger value="manual-requests" className="flex items-center gap-1">
              <ClipboardList className="h-3 w-3" />
              <span className="hidden sm:inline">Manual Entry</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="departments" className="flex items-center gap-1">
              <Building className="h-3 w-3" />
              <span className="hidden sm:inline">Departments</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="leave-types" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className="hidden sm:inline">Leave Types</span>
            </TabsTrigger>
            <TabsTrigger value="workflows" className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              <span className="hidden sm:inline">Workflows</span>
            </TabsTrigger>
            <TabsTrigger value="escalation" className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span className="hidden sm:inline">Escalation</span>
            </TabsTrigger>
            <TabsTrigger value="retention" className="flex items-center gap-1">
              <Archive className="h-3 w-3" />
              <span className="hidden sm:inline">Retention</span>
            </TabsTrigger>
            <TabsTrigger value="positions" className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              <span className="hidden sm:inline">Positions</span>
            </TabsTrigger>
            <TabsTrigger value="orgchart" className="flex items-center gap-1">
              <Network className="h-3 w-3" />
              <span className="hidden sm:inline">Org Chart</span>
            </TabsTrigger>
            <TabsTrigger value="holidays" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className="hidden sm:inline">Holidays</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings className="h-3 w-3" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-1">
              <History className="h-3 w-3" />
              <span className="hidden sm:inline">Audit Logs</span>
            </TabsTrigger>
          </TabsList>

        <TabsContent value="overlaps" className="space-y-4">
          <OverlapManager />
        </TabsContent>

        <TabsContent value="manual-requests" className="space-y-4">
          <ManualRequestEntry />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserManagementEnhanced />
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <DepartmentManager />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <TemplateManager />
        </TabsContent>

        <TabsContent value="leave-types" className="space-y-4">
          <LeaveTypesManager />
        </TabsContent>

        <TabsContent value="retention" className="space-y-4">
          <DocumentRetentionSettings />
        </TabsContent>

          <TabsContent value="workflows" className="space-y-4">
            <WorkflowRulesManager />
          </TabsContent>

          <TabsContent value="escalation" className="space-y-4">
            <EscalationSettings />
          </TabsContent>

          <TabsContent value="positions" className="space-y-4">
            <PositionsManager />
          </TabsContent>

          <TabsContent value="orgchart" className="space-y-4">
            <OrgChart />
          </TabsContent>

          <TabsContent value="holidays" className="space-y-4">
            <HolidaysManager />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <SystemSettings />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AuditLogViewer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}