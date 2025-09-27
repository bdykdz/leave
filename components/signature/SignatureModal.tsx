"use client"

import { useRef, useState } from "react"
import SignatureCanvas from "react-signature-canvas"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCcw, Save, CheckCircle, XCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface SignatureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  signerRole: string
  onSign: (signatureData: string, approved: boolean, comments?: string) => Promise<void>
  showDecision?: boolean
}

export function SignatureModal({
  open,
  onOpenChange,
  title,
  description,
  signerRole,
  onSign,
  showDecision = true,
}: SignatureModalProps) {
  const signatureRef = useRef<SignatureCanvas>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve')
  const [comments, setComments] = useState('')

  const handleClear = () => {
    signatureRef.current?.clear()
    setIsDrawing(false)
    setError(null)
  }

  const handleBegin = () => {
    setIsDrawing(true)
    setError(null)
  }

  const handleSign = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      setError("Please provide your signature")
      return
    }

    try {
      setIsSigning(true)
      setError(null)
      
      // Get signature as base64 PNG
      const signatureData = signatureRef.current.toDataURL("image/png")
      
      // Call the onSign callback with decision
      await onSign(
        signatureData, 
        decision === 'approve',
        comments.trim() || undefined
      )
      
      // Close modal on success
      onOpenChange(false)
      handleClear()
      setDecision('approve')
      setComments('')
    } catch (error) {
      console.error("Signature error:", error)
      setError(error instanceof Error ? error.message : "Failed to save signature")
    } finally {
      setIsSigning(false)
    }
  }

  const handleCancel = () => {
    handleClear()
    setDecision('approve')
    setComments('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {showDecision && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold mb-3 block">Decision</Label>
                <RadioGroup value={decision} onValueChange={(value) => setDecision(value as 'approve' | 'reject')}>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="approve" id="approve" />
                    <Label htmlFor="approve" className="flex items-center gap-2 cursor-pointer flex-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Approve this request
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="reject" id="reject" />
                    <Label htmlFor="reject" className="flex items-center gap-2 cursor-pointer flex-1">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Reject this request
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <Label htmlFor="comments">Comments (Optional)</Label>
                <Textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={decision === 'reject' ? 'Please provide a reason for rejection' : 'Add any comments about your decision'}
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Sign in the box below
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={!isDrawing || isSigning}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
            
            <div className="border border-gray-300 rounded bg-white">
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: "w-full h-48",
                  style: { width: "100%", height: "192px" }
                }}
                backgroundColor="white"
                penColor="black"
                onBegin={handleBegin}
              />
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              By signing, you acknowledge your decision on this document
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSigning}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSign}
            disabled={!isDrawing || isSigning}
            variant={decision === 'reject' ? 'destructive' : 'default'}
          >
            {isSigning ? (
              <>Signing...</>
            ) : (
              <>
                {decision === 'approve' ? (
                  <CheckCircle className="h-4 w-4 mr-1" />
                ) : (
                  <XCircle className="h-4 w-4 mr-1" />
                )}
                Sign & {decision === 'approve' ? 'Approve' : 'Reject'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}