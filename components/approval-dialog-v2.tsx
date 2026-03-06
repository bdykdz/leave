"use client"

import { useState } from "react"
import { CheckCircle, XCircle, User, Calendar, Home, Clock, PenTool } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SignaturePadSimple } from "@/components/signature-pad-simple"
import { useTranslations } from "@/components/language-provider"

interface ApprovalDialogProps {
  isOpen: boolean
  onClose: () => void
  action: "approve" | "deny"
  request: {
    employeeName: string
    type: string
    dates: string
    days: number
  }
  onConfirm?: (comment: string, signature?: string) => Promise<boolean | void> | void
}

export function ApprovalDialogV2({ isOpen, onClose, action, request, onConfirm }: ApprovalDialogProps) {
  const t = useTranslations()
  const isApproval = action === "approve"
  const [signature, setSignature] = useState("")
  const [comment, setComment] = useState("")
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (isApproval && !signature) {
      setError("Please provide your signature")
      return
    }

    setSubmitting(true)
    try {
      if (onConfirm) {
        // Send signature as a separate argument — never embed in comment
        const result = await onConfirm(comment, isApproval ? signature || undefined : undefined)
        // If onConfirm explicitly returns false, it means the API call failed
        if (result === false) {
          setSubmitting(false)
          return
        }
      }
      // Only show success confirmation AFTER the API call succeeds
      setShowConfirmation(true)
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setSignature("")
    setComment("")
    setError("")
    setShowConfirmation(false)
    onClose()
  }

  if (showConfirmation) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-6">
            <div
              className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                isApproval ? "bg-green-100" : "bg-red-100"
              }`}
            >
              {isApproval ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
            </div>
            <h3 className={`text-xl font-semibold mb-2 ${isApproval ? "text-green-900" : "text-red-900"}`}>
              {isApproval ? t.approval.requestApproved : t.approval.requestDenied}
            </h3>
            
            <p className="text-gray-600 mb-4">
              {request.employeeName}&apos;s {request.type.toLowerCase()} request has been{" "}
              {isApproval ? t.status.approved.toLowerCase() : t.status.rejected.toLowerCase()}.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-left mb-4">
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-blue-600" />
                <span className="font-medium">{request.employeeName}</span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                {request.type === "Work from Home" ? (
                  <Home className="h-4 w-4 text-blue-600" />
                ) : (
                  <Calendar className="h-4 w-4 text-blue-600" />
                )}
                <span className="text-gray-600">
                  {request.type} - {request.days} {request.days > 1 ? t.common.days : t.common.day}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">{request.dates}</span>
              </div>

              {isApproval && (
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs text-green-600 font-medium">✓ {t.approval.digitallySigned}</p>
                  <p className="text-xs text-gray-500">
                    {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-500">
              {request.employeeName} {t.approval.emailNotification}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApproval ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                {t.approval.approveLeaveRequest}
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                {t.approval.denyLeaveRequest}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {t.approval.reviewDescription} {request.employeeName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-sm">
              <span className="font-medium">{t.labels.employee}:</span> {request.employeeName}
            </p>
            <p className="text-sm">
              <span className="font-medium">{t.labels.type}:</span> {request.type}
            </p>
            <p className="text-sm">
              <span className="font-medium">{t.labels.duration}:</span> {request.dates} ({request.days} {request.days > 1 ? t.common.days : t.common.day})
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">{t.approval.commentOptional}</Label>
            <Textarea
              id="comment"
              placeholder={isApproval ? t.approval.approvalNotesPlaceholder : t.approval.denialReasonPlaceholder}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          {isApproval && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <PenTool className="h-4 w-4" />
                {t.signature.digitalSignature} <span className="text-red-500">*</span>
              </Label>
              <SignaturePadSimple 
                signature={signature}
                onSignatureChange={(sig) => {
                  setSignature(sig)
                  setError("")
                }}
              />
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
              <p className="text-xs text-gray-500">
                {t.approval.signingNotice}
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>{t.common.cancel}</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className={isApproval ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
          >
            {submitting ? (isApproval ? "Approving..." : "Denying...") : (isApproval ? t.buttons.approveRequest : t.buttons.denyRequest)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}