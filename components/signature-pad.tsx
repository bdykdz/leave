"use client"

import type React from "react"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RotateCcw, PenTool, Check, AlertCircle } from "lucide-react"
import { useTranslations } from "@/components/language-provider"

interface SignaturePadProps {
  onSignatureChange: (signature: string, isValid: boolean) => void
  signature: string
}

interface DrawingMetrics {
  totalDistance: number
  strokeCount: number
  drawingTime: number
  boundingBox: { width: number; height: number }
}

export function SignaturePad({ onSignatureChange, signature }: SignaturePadProps) {
  const t = useTranslations()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [metrics, setMetrics] = useState<DrawingMetrics>({
    totalDistance: 0,
    strokeCount: 0,
    drawingTime: 0,
    boundingBox: { width: 0, height: 0 }
  })
  const [isValidSignature, setIsValidSignature] = useState(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const drawingStartTimeRef = useRef<number>(0)
  const strokeStartTimeRef = useRef<number>(0)
  const actualDrawingTimeRef = useRef<number>(0)
  const strokeDistanceRef = useRef<number>(0)
  const minMaxRef = useRef({ minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 })

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
        // Assume loaded signatures are valid (they were validated before saving)
        setIsValidSignature(true)
        // Set some default metrics for loaded signatures
        setMetrics({
          totalDistance: 50, // Assume it was valid
          strokeCount: 2,
          drawingTime: 1,
          boundingBox: { width: 100, height: 50 }
        })
      }
      img.src = signature
    }
  }, [signature])


  // Validation function
  const validateSignature = (currentMetrics: DrawingMetrics): boolean => {
    return currentMetrics.totalDistance >= 25 && 
           currentMetrics.strokeCount >= 2 &&
           currentMetrics.drawingTime >= 0.5
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsDrawing(true)

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

    // Track stroke count
    if (isEmpty) {
      setIsEmpty(false)
      drawingStartTimeRef.current = Date.now()
      actualDrawingTimeRef.current = 0
      minMaxRef.current = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 }
      // Reset metrics when starting fresh
      setMetrics({ 
        totalDistance: 0, 
        strokeCount: 1, 
        drawingTime: 0, 
        boundingBox: { width: 0, height: 0 } 
      })
    } else {
      // Only count as a new stroke if previous stroke had some distance
      // This prevents rapid clicking exploit
      if (strokeDistanceRef.current > 5) {
        setMetrics(prev => ({ ...prev, strokeCount: prev.strokeCount + 1 }))
      }
    }
    
    // Reset stroke distance for new stroke
    strokeDistanceRef.current = 0
    strokeStartTimeRef.current = Date.now()
    lastPointRef.current = { x, y }
    
    // Update bounding box
    minMaxRef.current.minX = Math.min(minMaxRef.current.minX, x)
    minMaxRef.current.minY = Math.min(minMaxRef.current.minY, y)
    minMaxRef.current.maxX = Math.max(minMaxRef.current.maxX, x)
    minMaxRef.current.maxY = Math.max(minMaxRef.current.maxY, y)

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

    // Calculate distance traveled
    if (lastPointRef.current) {
      const distance = Math.sqrt(
        Math.pow(x - lastPointRef.current.x, 2) + 
        Math.pow(y - lastPointRef.current.y, 2)
      )
      setMetrics(prev => ({ ...prev, totalDistance: prev.totalDistance + distance }))
      strokeDistanceRef.current += distance
    }
    
    lastPointRef.current = { x, y }
    
    // Update bounding box
    minMaxRef.current.minX = Math.min(minMaxRef.current.minX, x)
    minMaxRef.current.minY = Math.min(minMaxRef.current.minY, y)
    minMaxRef.current.maxX = Math.max(minMaxRef.current.maxX, x)
    minMaxRef.current.maxY = Math.max(minMaxRef.current.maxY, y)

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    lastPointRef.current = null

    const canvas = canvasRef.current
    if (!canvas) return

    // Add this stroke's drawing time to total actual drawing time
    if (strokeStartTimeRef.current > 0) {
      actualDrawingTimeRef.current += (Date.now() - strokeStartTimeRef.current) / 1000
    }

    // Calculate final metrics
    const boundingBox = {
      width: minMaxRef.current.maxX - minMaxRef.current.minX,
      height: minMaxRef.current.maxY - minMaxRef.current.minY
    }
    
    // Use callback to ensure we have the latest metrics
    setMetrics(prevMetrics => {
      const updatedMetrics = {
        ...prevMetrics,
        drawingTime: actualDrawingTimeRef.current, // Use actual drawing time, not total elapsed
        boundingBox
      }
      
      // Validate signature
      const isValid = validateSignature(updatedMetrics)
      setIsValidSignature(isValid)

      // Save signature as base64
      const signatureData = canvas.toDataURL()
      onSignatureChange(signatureData, isValid)
      
      return updatedMetrics
    })
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Reset drawing state in case user was mid-draw
    setIsDrawing(false)
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
    setMetrics({
      totalDistance: 0,
      strokeCount: 0,
      drawingTime: 0,
      boundingBox: { width: 0, height: 0 }
    })
    setIsValidSignature(false)
    
    // Reset all refs
    minMaxRef.current = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 }
    lastPointRef.current = null
    drawingStartTimeRef.current = 0
    strokeStartTimeRef.current = 0
    actualDrawingTimeRef.current = 0
    strokeDistanceRef.current = 0
    
    onSignatureChange("", false)
  }

  // Global event handlers to fix mouse/touch release outside canvas
  useEffect(() => {
    const handleGlobalEnd = () => {
      if (isDrawing) {
        stopDrawing()
      }
    }

    // Add global listeners
    document.addEventListener('mouseup', handleGlobalEnd)
    document.addEventListener('touchend', handleGlobalEnd)
    window.addEventListener('blur', handleGlobalEnd)

    return () => {
      document.removeEventListener('mouseup', handleGlobalEnd)
      document.removeEventListener('touchend', handleGlobalEnd)
      window.removeEventListener('blur', handleGlobalEnd)
    }
  }, [isDrawing])

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <PenTool className="h-4 w-4" />
        {t.signature.digitalSignature} *
      </Label>

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
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-500">
              {isEmpty ? t.signature.pleaseSignAbove :
               isValidSignature ? "Valid signature captured" : "Signature incomplete"}
            </p>
            {!isEmpty && !isValidSignature && (
              <div className="flex items-center gap-1 text-amber-600 text-xs">
                <AlertCircle className="h-3 w-3" />
                {metrics.totalDistance < 25 && "Draw at least 25 pixels • "}
                {metrics.strokeCount < 2 && "Need at least 2 strokes • "}
                {metrics.drawingTime < 0.5 && "Draw for at least 0.5 seconds"}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearSignature} disabled={isEmpty}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear
            </Button>
            {!isEmpty && (
              <div className={`flex items-center gap-1 text-sm ${isValidSignature ? 'text-green-600' : 'text-amber-600'}`}>
                {isValidSignature ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                {isValidSignature ? 'Valid' : 'Invalid'}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        {t.signature.signingConfirmation}
      </p>

      {!isEmpty && isValidSignature && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800 mb-1">Signature Applied:</p>
          <p className="text-xs text-blue-600">
            Signed on: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Strokes: {metrics.strokeCount} • Distance: {Math.round(metrics.totalDistance)}px • Time: {metrics.drawingTime.toFixed(1)}s
          </p>
        </div>
      )}
    </div>
  )
}
