"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RotateCcw, PenTool, Check } from "lucide-react"

interface SignaturePadSimpleProps {
  onSignatureChange: (signature: string) => void
  signature: string
}

export function SignaturePadSimple({ onSignatureChange, signature }: SignaturePadSimpleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // Set drawing styles
    ctx.strokeStyle = "#1e40af" // Blue color
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    // Load existing signature if any
    if (signature) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
        setIsEmpty(false)
      }
      img.src = signature
    }
  }, [signature])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsDrawing(true)
    setIsEmpty(false)

    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let x, y
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let x, y
    if ("touches" in e) {
      e.preventDefault()
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)

    const canvas = canvasRef.current
    if (!canvas) return

    // Save signature as base64
    const signatureData = canvas.toDataURL()
    onSignatureChange(signatureData)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
    onSignatureChange("")
  }

  return (
    <>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-32 border border-gray-200 rounded cursor-crosshair bg-gray-50"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-500">
            {isEmpty ? "Please sign above" : "Signature captured"}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearSignature} disabled={isEmpty}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear
            </Button>
            {!isEmpty && (
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <Check className="h-3 w-3" />
                Signed
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}