"use client"

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from '@/components/language-provider'

function getDashboardRoute(role: string) {
  switch (role) {
    case 'EXECUTIVE': return '/executive'
    case 'MANAGER':
    case 'DEPARTMENT_DIRECTOR': return '/manager'
    case 'HR': return '/hr'
    default: return '/employee'
  }
}

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const t = useTranslations()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!session) return null

  const userRole = (session.user as any)?.role || 'EMPLOYEE'

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-12">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(getDashboardRoute(userRole))}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.nav?.backToDashboard || 'Back to Dashboard'}
          </Button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  )
}
