"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DocumentViewer } from "@/components/documents/DocumentViewer"
import { ChevronLeft } from "lucide-react"

export default function DocumentSignPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const documentId = params.id as string

  const [authorized, setAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/login")
      return
    }
    // The DocumentViewer component fetches the document via /api/documents/:id
    // which already has permission checks. We just need to verify the fetch succeeds.
    checkAccess()
  }, [session, status, documentId])

  const checkAccess = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}`)
      setAuthorized(res.ok)
    } catch {
      setAuthorized(false)
    }
  }

  const handleBack = () => {
    // Navigate back to the appropriate dashboard based on user role
    const role = session?.user?.role
    if (role === "MANAGER" || role === "DEPARTMENT_DIRECTOR") {
      router.push("/manager")
    } else if (role === "HR") {
      router.push("/hr")
    } else {
      router.push("/employee")
    }
  }

  if (status === "loading" || authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    )
  }

  if (!session) return null

  if (authorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg text-gray-600">You do not have permission to view this document.</p>
          <Button onClick={handleBack}>Go Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-4 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <DocumentViewer
          documentId={documentId}
          currentUserId={session.user.id}
          currentUserRole={session.user.role}
          onDocumentUpdate={handleBack}
        />
      </div>
    </div>
  )
}
