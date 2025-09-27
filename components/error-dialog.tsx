"use client"

import { AlertTriangle, X } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ErrorDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: "error" | "warning"
}

export function ErrorDialog({ isOpen, onClose, title, message, type = "error" }: ErrorDialogProps) {
  const isWarning = type === "warning"

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="text-center">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              isWarning ? "bg-yellow-100" : "bg-red-100"
            }`}
          >
            {isWarning ? <AlertTriangle className="h-8 w-8 text-yellow-600" /> : <X className="h-8 w-8 text-red-600" />}
          </div>
          <AlertDialogTitle className={`text-xl font-semibold ${isWarning ? "text-yellow-900" : "text-red-900"}`}>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            <div className="text-gray-600">{message}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={onClose}
            className={`w-full ${isWarning ? "bg-yellow-600 hover:bg-yellow-700" : "bg-red-600 hover:bg-red-700"}`}
          >
            Try Again
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
