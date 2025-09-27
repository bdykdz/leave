"use client"

import { CheckCircle, Calendar, Home, User, Clock, MapPin } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface SuccessDialogProps {
  isOpen: boolean
  onClose: () => void
  type: "leave" | "remote"
  details: {
    requestType?: string
    days: number
    dates: string
    manager: string
    location?: string
  }
}

export function SuccessDialog({ isOpen, onClose, type, details }: SuccessDialogProps) {
  const isWFH = type === "remote"

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <AlertDialogTitle className="text-xl font-semibold text-green-900">
            {isWFH ? "Remote Work Request Submitted!" : "Leave Request Submitted!"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-center space-y-3">
              <p className="text-gray-600">
                Your {isWFH ? "remote work" : details.requestType?.toLowerCase()} request has been successfully submitted
                and is now pending approval.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                {isWFH ? <Home className="h-4 w-4 text-blue-600" /> : <Calendar className="h-4 w-4 text-blue-600" />}
                <span className="font-medium">
                  {isWFH ? "Remote Work" : details.requestType} - {details.days} day
                  {details.days > 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">{details.dates}</span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Sent to {details.manager}</span>
              </div>
              {details.location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Location: {details.location}</span>
                </div>
              )}
            </div>

              <p className="text-sm text-gray-500">
                You will receive an email notification once your manager reviews your request.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose} className="w-full bg-green-600 hover:bg-green-700">
            Continue to Dashboard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
