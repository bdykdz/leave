"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { LeaveBalanceSettings } from "./LeaveBalanceSettings"
import { RequestsResetManager } from "./RequestsResetManager"
import { SelectedDatesMigration } from "./SelectedDatesMigration"
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
  Calculator,
  Trash2,
  Database,
  ChevronDown,
  ChevronRight,
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
  const [activePage, setActivePage] = useState("overlaps")
  const [expandedSections, setExpandedSections] = useState({
    operations: true,
    organization: false,
    leaveManagement: false,
    configuration: false,
    monitoring: false
  })
  const router = useRouter()
  const { data: session } = useSession()

  // Helper function to get the correct dashboard route based on user role
  const getDashboardRoute = () => {
    switch (session?.user.role) {
      case "EXECUTIVE":
        return "/executive"
      case "MANAGER":
      case "DEPARTMENT_DIRECTOR":
        return "/manager"
      case "HR":
        return "/hr"
      case "EMPLOYEE":
      default:
        return "/employee"
    }
  }

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev]
    }))
  }

  // Navigation structure
  const navigationSections = [
    {
      id: 'operations',
      title: 'Operations Management',
      icon: ClipboardList,
      items: [
        { id: 'overlaps', title: 'Overlaps', icon: AlertTriangle },
        { id: 'manual-requests', title: 'Manual Entry', icon: ClipboardList }
      ]
    },
    {
      id: 'organization',
      title: 'User & Organization',
      icon: Users,
      items: [
        { id: 'users', title: 'Users', icon: Users },
        { id: 'departments', title: 'Departments', icon: Building },
        { id: 'positions', title: 'Positions', icon: Briefcase },
        { id: 'orgchart', title: 'Org Chart', icon: Network }
      ]
    },
    {
      id: 'leaveManagement',
      title: 'Leave Management',
      icon: Calendar,
      items: [
        { id: 'templates', title: 'Templates', icon: FileText },
        { id: 'leave-types', title: 'Leave Types', icon: Calendar },
        { id: 'leave-balance', title: 'Balance', icon: Calculator },
        { id: 'holidays', title: 'Holidays', icon: Calendar }
      ]
    },
    {
      id: 'configuration',
      title: 'System Configuration',
      icon: Settings,
      items: [
        { id: 'workflows', title: 'Workflows', icon: GitBranch },
        { id: 'escalation', title: 'Escalation', icon: TrendingUp },
        { id: 'settings', title: 'Settings', icon: Settings },
        { id: 'retention', title: 'Retention', icon: Archive }
      ]
    },
    {
      id: 'monitoring',
      title: 'Monitoring & Maintenance',
      icon: History,
      items: [
        { id: 'audit', title: 'Audit Logs', icon: History },
        { id: 'migration', title: 'Migration', icon: Database },
        { id: 'reset', title: 'Reset', icon: Trash2 }
      ]
    }
  ]

  // Render content based on active page
  const renderContent = () => {
    switch (activePage) {
      case 'overlaps':
        return <OverlapManager />
      case 'manual-requests':
        return <ManualRequestEntry />
      case 'users':
        return <UserManagementEnhanced />
      case 'departments':
        return <DepartmentManager />
      case 'templates':
        return <TemplateManager />
      case 'leave-types':
        return <LeaveTypesManager />
      case 'leave-balance':
        return <LeaveBalanceSettings />
      case 'retention':
        return <DocumentRetentionSettings />
      case 'positions':
        return <PositionsManager />
      case 'orgchart':
        return <OrgChart />
      case 'workflows':
        return <WorkflowRulesManager />
      case 'escalation':
        return <EscalationSettings />
      case 'holidays':
        return <HolidaysManager />
      case 'settings':
        return <SystemSettings />
      case 'audit':
        return <AuditLogViewer />
      case 'migration':
        return <SelectedDatesMigration />
      case 'reset':
        return <RequestsResetManager />
      default:
        return <OverlapManager />
    }
  }

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
                onClick={() => router.push(getDashboardRoute())}
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
                  <DropdownMenuItem onClick={() => router.push(getDashboardRoute())}>
                    <User className="mr-2 h-4 w-4" />
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

      {/* Main Content with Sidebar */}
      <div className="flex h-[calc(100vh-120px)]">
        {/* Sidebar */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex-shrink-0">
          <ScrollArea className="h-full p-4">
            <nav className="space-y-2">
              {navigationSections.map((section) => {
                const SectionIcon = section.icon
                const isExpanded = expandedSections[section.id as keyof typeof expandedSections]
                
                return (
                  <div key={section.id}>
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <SectionIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {section.title}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    
                    {/* Section Items */}
                    {isExpanded && (
                      <div className="ml-4 mt-2 space-y-1">
                        {section.items.map((item) => {
                          const ItemIcon = item.icon
                          const isActive = activePage === item.id
                          
                          return (
                            <button
                              key={item.id}
                              onClick={() => setActivePage(item.id)}
                              className={`w-full flex items-center gap-3 p-2 text-left rounded-md transition-colors ${
                                isActive
                                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                              } ${
                                item.id === 'reset' ? 'text-red-600 dark:text-red-400' : ''
                              } ${
                                item.id === 'migration' ? 'text-blue-600 dark:text-blue-400' : ''
                              }`}
                            >
                              <ItemIcon className="h-4 w-4" />
                              <span className="text-sm">{item.title}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </ScrollArea>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}