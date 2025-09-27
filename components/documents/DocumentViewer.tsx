"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  Circle, 
  AlertCircle,
  Signature,
  User,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SignatureModal } from "@/components/signature/SignatureModal"
import { toast } from "sonner"
import { format } from "date-fns"

interface SignatureRequirement {
  role: string
  label: string
  isRequired: boolean
  requiredSigner: {
    id: string
    name: string
    email: string
  } | null
  isSigned: boolean
  signature: {
    signedBy: string
    signedAt: string
  } | null
}

interface DocumentViewerProps {
  documentId: string
  currentUserId: string
  currentUserRole: string
  onDocumentUpdate?: () => void
}

export function DocumentViewer({
  documentId,
  currentUserId,
  currentUserRole,
  onDocumentUpdate,
}: DocumentViewerProps) {
  const [document, setDocument] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>("")

  useEffect(() => {
    fetchDocument()
  }, [documentId])

  const fetchDocument = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/documents/${documentId}`)
      if (response.ok) {
        const data = await response.json()
        setDocument(data.document)
      } else {
        toast.error('Failed to load document')
      }
    } catch (error) {
      console.error('Error fetching document:', error)
      toast.error('Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  const handleSign = async (signatureData: string, approved: boolean, comments?: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData,
          signerRole: selectedRole,
          approved,
          comments,
        }),
      })

      if (response.ok) {
        toast.success(
          approved 
            ? 'Document approved and signed successfully' 
            : 'Document rejected and signed'
        )
        await fetchDocument()
        onDocumentUpdate?.()
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to sign document')
      }
    } catch (error) {
      console.error('Signing error:', error)
      throw error
    }
  }

  const canSignAs = (requirement: SignatureRequirement): boolean => {
    if (!requirement.isRequired || requirement.isSigned) {
      return false
    }

    // Check if current user is the required signer
    if (requirement.requiredSigner?.id === currentUserId) {
      return true
    }

    // HR can sign HR role
    if (requirement.role === 'hr' && currentUserRole === 'HR') {
      return true
    }

    // Executive can sign executive role
    if (requirement.role === 'executive' && currentUserRole === 'EXECUTIVE') {
      return true
    }

    return false
  }

  const openSignatureModal = (role: string) => {
    setSelectedRole(role)
    setSignatureModalOpen(true)
  }

  if (loading) {
    return <div className="text-center py-8">Loading document...</div>
  }

  if (!document) {
    return <div className="text-center py-8">Document not found</div>
  }

  const allRequiredSigned = document.signatureRequirements
    .filter((r: SignatureRequirement) => r.isRequired)
    .every((r: SignatureRequirement) => r.isSigned)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {document.template.name}
              </CardTitle>
              <CardDescription>
                Leave Request #{document.leaveRequest.requestNumber}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={document.status === 'COMPLETED' ? 'default' : 'secondary'}>
                {document.status.replace('_', ' ')}
              </Badge>
              {document.fileUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(document.fileUrl, '_blank')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Document Preview */}
          {document.fileUrl && (
            <div className="border rounded-lg overflow-hidden bg-gray-50">
              <iframe
                src={document.fileUrl}
                className="w-full h-[600px]"
                title="Document Preview"
              />
            </div>
          )}

          <Separator />

          {/* Signature Status */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Signature className="h-5 w-5" />
              Signature Status
            </h3>
            <div className="space-y-3">
              {document.signatureRequirements.map((req: SignatureRequirement) => (
                <div
                  key={req.role}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {req.isSigned ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : req.isRequired ? (
                      <Circle className="h-5 w-5 text-orange-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-300" />
                    )}
                    <div>
                      <p className="font-medium">{req.label}</p>
                      {req.requiredSigner ? (
                        <p className="text-sm text-muted-foreground">
                          {req.requiredSigner.name} ({req.requiredSigner.email})
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {req.isRequired ? 'Required' : 'Optional'}
                        </p>
                      )}
                      {req.signature && (
                        <p className="text-xs text-green-600 mt-1">
                          Signed by {req.signature.signedBy} on {format(new Date(req.signature.signedAt), 'PPp')}
                        </p>
                      )}
                    </div>
                  </div>
                  {canSignAs(req) && (
                    <Button
                      size="sm"
                      onClick={() => openSignatureModal(req.role)}
                    >
                      Sign Now
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {allRequiredSigned && (
              <Alert className="mt-4">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  All required signatures have been collected. The document is complete.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Signature Modal */}
      <SignatureModal
        open={signatureModalOpen}
        onOpenChange={setSignatureModalOpen}
        title={`Sign as ${document.signatureRequirements.find((r: SignatureRequirement) => r.role === selectedRole)?.label}`}
        description="Please provide your signature to approve this document"
        signerRole={selectedRole}
        onSign={handleSign}
      />
    </>
  )
}