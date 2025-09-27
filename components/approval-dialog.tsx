"use client"

import { useState } from "react"
import { CheckCircle, XCircle, User, Calendar, Home, Clock, PenTool } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SignaturePadSimple } from "@/components/signature-pad-simple"

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
  onConfirm?: (comment: string) => void
}

export function ApprovalDialog({ isOpen, onClose, action, request, onConfirm }: ApprovalDialogProps) {
  const isApproval = action === "approve"
  const [signature, setSignature] = useState("")
  const [comment, setComment] = useState("")
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = () => {
    if (isApproval && !signature) {
      setError("Please provide your signature")
      return
    }
    
    setShowConfirmation(true)
    if (onConfirm) {
      const finalComment = isApproval 
        ? `${comment ? comment + '\n\n' : ''}[Digital Signature Applied]`
        : comment
      onConfirm(finalComment)
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
      <AlertDialog open={isOpen} onOpenChange={handleClose}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader className="text-center">
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
            <AlertDialogTitle className={`text-xl font-semibold ${isApproval ? "text-green-900" : "text-red-900"}`}>
              Request {isApproval ? "Approved" : "Denied"}
            </AlertDialogTitle>
          </AlertDialogHeader>
          
          <div className="space-y-3 text-center">
            <div className="text-gray-600">
              {request.employeeName}'s {request.type.toLowerCase()} request has been{" "}
              {isApproval ? "approved" : "denied"}.
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
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
                  {request.type} - {request.days} day{request.days > 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">{request.dates}</span>
              </div>
              
              {isApproval && (
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs text-green-600 font-medium">✓ Digitally signed and approved</p>
                  <p className="text-xs text-gray-500">
                    {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-500">
              {request.employeeName} will receive an email notification about this decision.
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleClose}
              className={`w-full ${isApproval ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isApproval ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Approve Leave Request
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                Deny Leave Request
              </>
            )}
          </AlertDialogTitle>
        </AlertDialogHeader>
        
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-sm">
              <span className="font-medium">Employee:</span> {request.employeeName}
            </p>
            <p className="text-sm">
              <span className="font-medium">Type:</span> {request.type}
            </p>
            <p className="text-sm">
              <span className="font-medium">Duration:</span> {request.dates} ({request.days} day{request.days > 1 ? 's' : ''})
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Comment (Optional)</Label>
            <Textarea
              id="comment"
              placeholder={isApproval ? "Add any approval notes..." : "Reason for denial (recommended)"}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          {isApproval && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <PenTool className="h-4 w-4" />
                Digital Signature <span className="text-red-500">*</span>
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
                By signing above, you are electronically approving this request
              </p>
            </div>
          )}
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            className={isApproval ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
          >
            {isApproval ? "Approve Request" : "Deny Request"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}