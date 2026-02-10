"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  Menu, 
  Home, 
  Calendar, 
  Users, 
  Clock, 
  BarChart3, 
  Settings, 
  LogOut,
  Check,
  X,
  Building,
  UserCheck
} from "lucide-react"
import { signOut } from "next-auth/react"
import { useTranslations } from "@/components/language-provider"

interface MobileNavProps {
  pendingCount?: number
}

export function MobileNav({ pendingCount = 0 }: MobileNavProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const t = useTranslations()

  if (!session) return null

  const userRole = session.user?.role || 'EMPLOYEE'
  const userName = session.user?.name || 'User'
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase()

  const mainNavItems = [
    {
      label: t.nav.dashboard,
      icon: Home,
      href: getDashboardRoute(),
      show: true
    },
    {
      label: t.nav.myLeave,
      icon: Calendar,
      href: "/employee",
      show: true
    },
    {
      label: t.nav.managerDashboard,
      icon: UserCheck,
      href: "/manager",
      show: ['MANAGER', 'DIRECTOR', 'EXECUTIVE'].includes(userRole),
      badge: pendingCount > 0 ? pendingCount : undefined
    },
    {
      label: t.nav.hrDashboard,
      icon: Building,
      href: "/hr",
      show: userRole === 'HR' || session.user?.department?.includes('HR')
    },
    {
      label: t.nav.analytics,
      icon: BarChart3,
      href: "/analytics",
      show: ['MANAGER', 'DIRECTOR', 'HR', 'EXECUTIVE'].includes(userRole)
    }
  ]

  const planningNavItems = [
    {
      label: t.nav.myHolidayPlanning,
      icon: Calendar,
      href: "/holiday-planning",
      show: true
    },
    {
      label: t.nav.teamHolidayPlans,
      icon: Users,
      href: "/team-calendar",
      show: true
    },
  ]

  function getDashboardRoute() {
    switch (userRole) {
      case 'EXECUTIVE': return '/executive'
      case 'MANAGER':
      case 'DEPARTMENT_DIRECTOR': return '/manager'
      case 'HR': return '/hr'
      default: return '/employee'
    }
  }

  const handleNavigation = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const handleSignOut = async () => {
    setOpen(false)
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="text-left">{t.nav.navigation}</SheetTitle>
          <SheetDescription className="text-left">
            {t.nav.quickAccessToAllFeatures}
          </SheetDescription>
        </SheetHeader>

        {/* User Info */}
        <div className="flex items-center space-x-3 py-4 border-b">
          <Avatar className="h-10 w-10">
            <AvatarImage src={session.user?.image || ''} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-gray-600">{userRole}</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-6 space-y-2">
          {mainNavItems.filter(item => item.show).map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`
                  w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors
                  ${isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {item.badge && (
                  <Badge variant="destructive" className="text-xs">
                    {item.badge}
                  </Badge>
                )}
              </button>
            )
          })}

          {/* Planning Section */}
          <div className="pt-2 mt-2 border-t">
            <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">{t.nav.planning}</p>
            {planningNavItems.filter(item => item.show).map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon

              return (
                <button
                  key={item.href}
                  onClick={() => handleNavigation(item.href)}
                  className={`
                    w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Quick Actions */}
        <div className="mt-8 border-t pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">{t.mobile.quickActions}</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNavigation('/leave-request')}
              className="text-xs"
            >
              <Calendar className="h-3 w-3 mr-1" />
              {t.common.requestLeave}
            </Button>
            <Button
              variant="outline"
              size="sm" 
              onClick={() => handleNavigation('/wfh-request')}
              className="text-xs"
            >
              <Home className="h-3 w-3 mr-1" />
              {t.common.workFromHome}
            </Button>
          </div>
        </div>

        {/* Settings & Logout */}
        <div className="absolute bottom-6 left-6 right-6 space-y-2 border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => handleNavigation('/settings')}
            className="w-full justify-start text-sm"
          >
            <Settings className="h-4 w-4 mr-3" />
            {t.nav.settings}
          </Button>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 mr-3" />
            {t.common.signOut}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}