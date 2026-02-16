"use client"

import React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { SimpleFieldMapper } from '@/components/admin/SimpleFieldMapper'
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function HRSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!session) {
    router.push("/login")
    return null
  }

  const isHREmployee = session.user.role === "EMPLOYEE" && (session.user.department?.toLowerCase() === "hr" || session.user.department?.toLowerCase() === "human resources")
  if (session.user.role !== "HR" && session.user.role !== "ADMIN" && session.user.role !== "EXECUTIVE" && !isHREmployee) {
    router.push("/employee")
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/hr')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">HR Settings</h1>
              <p className="text-gray-600">Configure field mappings and import settings</p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <SimpleFieldMapper />
      </div>
    </div>
  )
}
