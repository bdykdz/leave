"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { 
  FileText, 
  Move, 
  Save, 
  X, 
  Plus,
  Type,
  Calendar,
  Hash,
  User,
  Briefcase,
  MapPin,
  Calculator,
  Signature,
  GripVertical,
  Settings,
  Eye,
  CheckCircle,
  XCircle,
  Shield,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface DocumentTemplate {
  id: string
  name: string
  fileUrl: string
  fileType: string
}

interface FieldMapping {
  id: string
  fieldKey: string
  fieldLabel: string
  documentPosition: {
    x: number
    y: number
    page: number
    width?: number
    height?: number
  }
  fieldStyle?: {
    fontSize?: number
    fontFamily?: string
    align?: string
    color?: string
  }
  isRequired: boolean
  isLocked?: boolean
}

interface SignaturePlacement {
  id: string
  signerRole: string
  label: string
  documentPosition: {
    x: number
    y: number
    page: number
    width: number
    height: number
  }
  isRequired: boolean
  orderIndex: number
  isLocked?: boolean
}

interface TemplateDesignerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: DocumentTemplate
  onSave: () => void
}

// Available fields grouped by category
const FIELD_CATEGORIES = {
  employee: {
    label: "Employee Information",
    icon: User,
    fields: [
      { key: 'employee.firstName', label: 'First Name', icon: Type },
      { key: 'employee.lastName', label: 'Last Name', icon: Type },
      { key: 'employee.fullName', label: 'Full Name', icon: Type },
      { key: 'employee.employeeId', label: 'Employee ID', icon: Hash },
      { key: 'employee.email', label: 'Email', icon: Type },
      { key: 'employee.phoneNumber', label: 'Phone Number', icon: Type },
      { key: 'employee.department', label: 'Department', icon: Briefcase },
      { key: 'employee.position', label: 'Position', icon: Briefcase },
      { key: 'employee.joiningDate', label: 'Joining Date', icon: Calendar },
      { key: 'employee.manager', label: 'Manager Name', icon: User },
      { key: 'employee.managerEmail', label: 'Manager Email', icon: Type },
    ],
  },
  leave: {
    label: "Leave Request Details",
    icon: Calendar,
    fields: [
      { key: 'leave.type', label: 'Leave Type', icon: Type },
      { key: 'leave.dates', label: 'Leave Dates (All)', icon: Calendar },
      { key: 'leave.startDate', label: 'Start Date', icon: Calendar },
      { key: 'leave.endDate', label: 'End Date', icon: Calendar },
      { key: 'leave.totalDays', label: 'Total Days', icon: Hash },
      { key: 'leave.reason', label: 'Reason', icon: Type },
      { key: 'leave.requestNumber', label: 'Request Number', icon: Hash },
      { key: 'leave.status', label: 'Status', icon: Type },
      { key: 'leave.requestedDate', label: 'Request Date', icon: Calendar },
    ],
  },
  balance: {
    label: "Leave Balance",
    icon: Calculator,
    fields: [
      { key: 'balance.entitled', label: 'Entitled Days', icon: Hash },
      { key: 'balance.used', label: 'Used Days', icon: Hash },
      { key: 'balance.pending', label: 'Pending Days', icon: Hash },
      { key: 'balance.available', label: 'Available Days', icon: Hash },
      { key: 'balance.afterApproval', label: 'Balance After Approval', icon: Hash },
    ],
  },
  substitute: {
    label: "Substitute/Replacement",
    icon: User,
    fields: [
      { key: 'substitute.fullName', label: 'Substitute Name(s)', icon: User },
    ],
  },
  decision: {
    label: "Decision Fields",
    icon: CheckCircle,
    fields: [
      { key: 'decision.manager.approved', label: 'Manager - Approved ☑', icon: CheckCircle },
      { key: 'decision.manager.rejected', label: 'Manager - Rejected ☑', icon: XCircle },
      { key: 'decision.director.approved', label: 'Director - Approved ☑', icon: CheckCircle },
      { key: 'decision.director.rejected', label: 'Director - Rejected ☑', icon: XCircle },
      { key: 'decision.hr.approved', label: 'HR - Approved ☑', icon: CheckCircle },
      { key: 'decision.hr.rejected', label: 'HR - Rejected ☑', icon: XCircle },
      { key: 'decision.executive.approved', label: 'Executive - Approved ☑', icon: CheckCircle },
      { key: 'decision.executive.rejected', label: 'Executive - Rejected ☑', icon: XCircle },
      { key: 'decision.comments', label: 'Decision Comments', icon: Type },
    ],
  },
}

// Signature roles
const SIGNATURE_ROLES = [
  { role: 'employee', label: 'Employee Signature' },
  { role: 'manager', label: 'Manager Signature' },
  { role: 'department_manager', label: 'Department Manager Signature' },
  { role: 'hr', label: 'HR Signature' },
  { role: 'executive', label: 'Executive Signature' },
]

export function TemplateDesigner({
  open,
  onOpenChange,
  template,
  onSave,
}: TemplateDesignerProps) {
  const [activeTab, setActiveTab] = useState("fields")
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [signaturePlacements, setSignaturePlacements] = useState<SignaturePlacement[]>([])
  const [selectedField, setSelectedField] = useState<FieldMapping | null>(null)
  const [selectedSignature, setSelectedSignature] = useState<SignaturePlacement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedItem, setDraggedItem] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [isMoving, setIsMoving] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [draggedElement, setDraggedElement] = useState<{ id: string, type: 'field' | 'signature' } | null>(null)
  
  const documentPreviewRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 })
  const resizeRef = useRef({ startX: 0, startY: 0, initialWidth: 0, initialHeight: 0 })

  useEffect(() => {
    if (open && template) {
      fetchExistingMappings()
      // Generate preview URL for the document
      if (template.fileUrl) {
        // For development, we'll use the file URL directly
        // In production, you might want to use a proper document preview service
        setDocumentPreviewUrl(template.fileUrl)
      }
    }
  }, [open, template])

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (!isMoving && !isResizing) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const scale = zoomLevel / 100
      
      if (isMoving && draggedElement) {
        const deltaX = (e.clientX - dragRef.current.startX) / scale
        const deltaY = (e.clientY - dragRef.current.startY) / scale
        
        const newX = dragRef.current.initialX + deltaX
        const newY = dragRef.current.initialY + deltaY
        
        const element = document.getElementById(`${draggedElement.type}-${draggedElement.id}`)
        if (element) {
          element.style.left = `${newX}px`
          element.style.top = `${newY}px`
        }
      } else if (isResizing && draggedElement) {
        const deltaX = (e.clientX - resizeRef.current.startX) / scale
        const deltaY = (e.clientY - resizeRef.current.startY) / scale
        
        const newWidth = Math.max(100, resizeRef.current.initialWidth + deltaX)
        const newHeight = Math.max(30, resizeRef.current.initialHeight + deltaY)
        
        const element = document.getElementById(`${draggedElement.type}-${draggedElement.id}`)
        if (element) {
          element.style.width = `${newWidth}px`
          element.style.height = `${newHeight}px`
        }
      }
    }

    const handleGlobalMouseUp = (e: MouseEvent) => {
      const scale = zoomLevel / 100
      
      if (isMoving && draggedElement) {
        const deltaX = (e.clientX - dragRef.current.startX) / scale
        const deltaY = (e.clientY - dragRef.current.startY) / scale
        
        const newX = dragRef.current.initialX + deltaX
        const newY = dragRef.current.initialY + deltaY
        
        if (draggedElement.type === 'field') {
          setFieldMappings(prev => prev.map(f => 
            f.id === draggedElement.id 
              ? { ...f, documentPosition: { ...f.documentPosition, x: newX, y: newY } }
              : f
          ))
          if (selectedField?.id === draggedElement.id) {
            setSelectedField(prev => prev ? { ...prev, documentPosition: { ...prev.documentPosition, x: newX, y: newY } } : null)
          }
        } else {
          setSignaturePlacements(prev => prev.map(s => 
            s.id === draggedElement.id 
              ? { ...s, documentPosition: { ...s.documentPosition, x: newX, y: newY } }
              : s
          ))
          if (selectedSignature?.id === draggedElement.id) {
            setSelectedSignature(prev => prev ? { ...prev, documentPosition: { ...prev.documentPosition, x: newX, y: newY } } : null)
          }
        }
      } else if (isResizing && draggedElement) {
        const deltaX = (e.clientX - resizeRef.current.startX) / scale
        const deltaY = (e.clientY - resizeRef.current.startY) / scale
        
        const newWidth = Math.max(100, resizeRef.current.initialWidth + deltaX)
        const newHeight = Math.max(30, resizeRef.current.initialHeight + deltaY)
        
        if (draggedElement.type === 'field') {
          setFieldMappings(prev => prev.map(f => 
            f.id === draggedElement.id 
              ? { ...f, documentPosition: { ...f.documentPosition, width: newWidth, height: newHeight } }
              : f
          ))
          if (selectedField?.id === draggedElement.id) {
            setSelectedField(prev => prev ? { ...prev, documentPosition: { ...prev.documentPosition, width: newWidth, height: newHeight } } : null)
          }
        } else {
          setSignaturePlacements(prev => prev.map(s => 
            s.id === draggedElement.id 
              ? { ...s, documentPosition: { ...s.documentPosition, width: newWidth, height: newHeight } }
              : s
          ))
          if (selectedSignature?.id === draggedElement.id) {
            setSelectedSignature(prev => prev ? { ...prev, documentPosition: { ...prev.documentPosition, width: newWidth, height: newHeight } } : null)
          }
        }
      }
      
      setIsMoving(false)
      setIsResizing(false)
      setDraggedElement(null)
    }

    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isMoving, isResizing, draggedElement, zoomLevel])

  const fetchExistingMappings = async () => {
    try {
      setLoading(true)
      
      // Fetch field mappings
      const fieldsResponse = await fetch(`/api/admin/templates/${template.id}/fields`)
      if (fieldsResponse.ok) {
        const fieldsData = await fieldsResponse.json()
        setFieldMappings(fieldsData.fieldMappings || [])
      }
      
      // Fetch signature placements
      const signaturesResponse = await fetch(`/api/admin/templates/${template.id}/signatures`)
      if (signaturesResponse.ok) {
        const signaturesData = await signaturesResponse.json()
        setSignaturePlacements(signaturesData.signaturePlacements || [])
      }

      // Fetch template preview
      const previewResponse = await fetch(`/api/admin/templates/${template.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (previewResponse.ok) {
        const previewData = await previewResponse.json()
        if (previewData.preview?.template?.fileUrl) {
          setDocumentPreviewUrl(previewData.preview.template.fileUrl)
        }
      }
    } catch (error) {
      console.error('Error fetching mappings:', error)
      toast.error('Failed to load template configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, item: any, type: 'field' | 'signature') => {
    console.log('Drag started', item, type)
    setIsDragging(true)
    setDraggedItem({ ...item, type })
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', JSON.stringify({ ...item, type }))
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDraggedItem(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('Drop event fired', draggedItem)
    
    if (!draggedItem || !documentPreviewRef.current) return
    
    const rect = documentPreviewRef.current.getBoundingClientRect()
    // Adjust for zoom level
    const scale = zoomLevel / 100
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    
    if (draggedItem.type === 'field') {
      const newMapping: FieldMapping = {
        id: `field-${Date.now()}`,
        fieldKey: draggedItem.key,
        fieldLabel: draggedItem.label,
        documentPosition: {
          x: x,
          y: y,
          page: 1, // TODO: Calculate actual page
          width: 200,
          height: 30,
        },
        fieldStyle: {
          fontSize: 12,
          fontFamily: 'Arial',
          align: 'left',
        },
        isRequired: true,
      }
      setFieldMappings([...fieldMappings, newMapping])
    } else if (draggedItem.type === 'signature') {
      const newSignature: SignaturePlacement = {
        id: `sig-${Date.now()}`,
        signerRole: draggedItem.role,
        label: draggedItem.label,
        documentPosition: {
          x: x,
          y: y,
          page: 1, // TODO: Calculate actual page
          width: 200,
          height: 80,
        },
        isRequired: true,
        orderIndex: signaturePlacements.length + 1,
      }
      setSignaturePlacements([...signaturePlacements, newSignature])
    }
    
    handleDragEnd()
  }

  const handleDeleteField = (fieldId: string) => {
    setFieldMappings(fieldMappings.filter(f => f.id !== fieldId))
    setSelectedField(null)
  }

  const handleDeleteSignature = (signatureId: string) => {
    setSignaturePlacements(signaturePlacements.filter(s => s.id !== signatureId))
    setSelectedSignature(null)
  }

  const toggleFieldLock = (fieldId: string) => {
    setFieldMappings(fieldMappings.map(f => 
      f.id === fieldId ? { ...f, isLocked: !f.isLocked } : f
    ))
    const field = fieldMappings.find(f => f.id === fieldId)
    if (field && selectedField?.id === fieldId) {
      setSelectedField({ ...field, isLocked: !field.isLocked })
    }
  }

  const toggleSignatureLock = (signatureId: string) => {
    setSignaturePlacements(signaturePlacements.map(s => 
      s.id === signatureId ? { ...s, isLocked: !s.isLocked } : s
    ))
    const sig = signaturePlacements.find(s => s.id === signatureId)
    if (sig && selectedSignature?.id === signatureId) {
      setSelectedSignature({ ...sig, isLocked: !sig.isLocked })
    }
  }

  // Handle field/signature movement
  const handleMouseDown = (e: React.MouseEvent, item: FieldMapping | SignaturePlacement, type: 'move' | 'resize', itemType: 'field' | 'signature') => {
    e.preventDefault()
    e.stopPropagation()
    
    // Don't allow moving/resizing if this item is locked
    if (item.isLocked) {
      toast.info('This item is locked. Click the lock icon to unlock it.')
      return
    }
    
    const rect = documentPreviewRef.current?.getBoundingClientRect()
    if (!rect) return

    const scale = zoomLevel / 100
    
    if (type === 'move') {
      setIsMoving(true)
      setDraggedElement({ id: item.id, type: itemType })
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialX: item.documentPosition.x,
        initialY: item.documentPosition.y
      }
      
      // Update the moving element's style directly for smooth movement
      const element = document.getElementById(`${itemType}-${item.id}`)
      if (element) {
        element.style.transition = 'none'
      }
    } else {
      setIsResizing(true)
      setDraggedElement({ id: item.id, type: itemType })
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialWidth: item.documentPosition.width || (itemType === 'field' ? 200 : 200),
        initialHeight: item.documentPosition.height || (itemType === 'field' ? 30 : 80)
      }
    }
  }


  const handleSave = async () => {
    try {
      setSaving(true)
      
      // Save field mappings
      const fieldsResponse = await fetch(`/api/admin/templates/${template.id}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fieldMappings }),
      })
      
      if (!fieldsResponse.ok) {
        throw new Error('Failed to save field mappings')
      }
      
      // Save signature placements
      const signaturesResponse = await fetch(`/api/admin/templates/${template.id}/signatures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatures: signaturePlacements }),
      })
      
      if (!signaturesResponse.ok) {
        throw new Error('Failed to save signature placements')
      }
      
      toast.success('Template configuration saved successfully')
      onSave()
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save template configuration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Template Designer - {template.name}</DialogTitle>
          <DialogDescription>
            Drag and drop fields and signature boxes onto the document to create your template
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Field Palette */}
          <div className="w-80 border-r bg-muted/10">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <TabsList className="w-full rounded-none">
                <TabsTrigger value="fields" className="flex-1">Fields</TabsTrigger>
                <TabsTrigger value="signatures" className="flex-1">Signatures</TabsTrigger>
              </TabsList>
              
              <TabsContent value="fields" className="m-0 h-[calc(100%-40px)]">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-6">
                    {Object.entries(FIELD_CATEGORIES).map(([categoryKey, category]) => (
                      <div key={categoryKey}>
                        <div className="flex items-center gap-2 mb-3">
                          <category.icon className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold text-sm">{category.label}</h3>
                        </div>
                        <div className="space-y-2">
                          {category.fields.map((field) => (
                            <div
                              key={field.key}
                              draggable
                              onDragStart={(e) => handleDragStart(e, field, 'field')}
                              onDragEnd={handleDragEnd}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-md border bg-background cursor-move hover:bg-accent transition-colors",
                                isDragging && draggedItem?.key === field.key && "opacity-50"
                              )}
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <field.icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm flex-1">{field.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="signatures" className="m-0 h-[calc(100%-40px)]">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-2">
                    {SIGNATURE_ROLES.map((sig) => (
                      <div
                        key={sig.role}
                        draggable
                        onDragStart={(e) => handleDragStart(e, sig, 'signature')}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-md border bg-background cursor-move hover:bg-accent transition-colors",
                          isDragging && draggedItem?.role === sig.role && "opacity-50"
                        )}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <Signature className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1">{sig.label}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Center - Document Preview */}
          <div className="flex-1 overflow-auto bg-gray-100 p-8 relative">
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-30 bg-white rounded-lg shadow-md p-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                disabled={zoomLevel <= 50}
              >
                <span className="text-lg">−</span>
              </Button>
              <span className="text-sm font-medium w-12 text-center">{zoomLevel}%</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
                disabled={zoomLevel >= 200}
              >
                <span className="text-lg">+</span>
              </Button>
            </div>
            
            <div 
              className="mx-auto"
              style={{ 
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center',
              }}
            >
              <div
                ref={documentPreviewRef}
                className="bg-white shadow-lg relative"
                style={{ 
                  width: '816px', 
                  minHeight: '1056px',
                  cursor: isMoving ? 'grabbing' : isResizing ? 'nwse-resize' : 'default'
                }}
              >
              {/* Drop zone - always on top to capture drag events */}
              <div 
                className="absolute inset-0" 
                style={{ 
                  zIndex: 30,
                  backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  border: isDragging ? '3px dashed rgb(59, 130, 246)' : 'none',
                  pointerEvents: isDragging ? 'auto' : 'none'
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnter={(e) => e.preventDefault()}
                onDragLeave={(e) => e.preventDefault()}
              />
              
              {/* Document preview */}
              {documentPreviewUrl ? (
                <>
                  {/* PDF in iframe */}
                  <iframe
                    src={`${documentPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="absolute inset-0 w-full h-full"
                    style={{ 
                      border: 'none',
                      pointerEvents: 'none',
                      zIndex: 1
                    }}
                  />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto mb-4" />
                    <p className="text-lg font-medium">No Document Preview Available</p>
                    <p className="text-sm">Please upload a document template first</p>
                  </div>
                </div>
              )}
              
              {/* Render field mappings */}
              {fieldMappings.map((field) => (
                <div
                  id={`field-${field.id}`}
                  key={field.id}
                  className={cn(
                    "absolute border-2 z-20 group",
                    selectedField?.id === field.id 
                      ? field.isLocked 
                        ? "border-solid border-blue-600 bg-blue-100/70"
                        : "border-solid border-blue-600 bg-blue-100/90"
                      : field.isLocked
                        ? "border-solid border-gray-400 bg-gray-50/70"
                        : "border-dashed border-blue-400 bg-blue-50/90 hover:border-blue-600",
                    field.isLocked ? "cursor-not-allowed" : "cursor-move"
                  )}
                  style={{
                    position: 'absolute',
                    left: `${field.documentPosition.x}px`,
                    top: `${field.documentPosition.y}px`,
                    width: `${field.documentPosition.width || 200}px`,
                    height: `${field.documentPosition.height || 30}px`,
                    pointerEvents: 'auto',
                    willChange: field.isLocked ? 'auto' : 'transform',
                  }}
                  onClick={() => setSelectedField(field)}
                  onMouseDown={(e) => !field.isLocked && handleMouseDown(e, field, 'move', 'field')}
                >
                  <div className="flex items-center justify-between h-full px-2">
                    <span className="text-xs font-medium truncate flex items-center gap-1">
                      {field.fieldKey.includes('.approved') || field.fieldKey.includes('.rejected') ? (
                        <>
                          {field.fieldKey.includes('.approved') ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-600" />
                          )}
                          {field.fieldLabel}
                        </>
                      ) : (
                        field.fieldLabel
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      {/* Lock/Unlock button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-4 w-4",
                          field.isLocked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFieldLock(field.id)
                        }}
                      >
                        <Shield className={cn("h-3 w-3", field.isLocked ? "text-gray-600" : "text-gray-400")} />
                      </Button>
                      {/* Delete button */}
                      {!field.isLocked && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteField(field.id)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Resize handle */}
                  {selectedField?.id === field.id && !field.isLocked && (
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 bg-blue-600 cursor-nwse-resize"
                      style={{ transform: 'translate(50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        handleMouseDown(e, field, 'resize', 'field')
                      }}
                    />
                  )}
                </div>
              ))}
              
              {/* Render signature placements */}
              {signaturePlacements.map((signature) => (
                <div
                  id={`signature-${signature.id}`}
                  key={signature.id}
                  className={cn(
                    "absolute border-2 z-20 group",
                    selectedSignature?.id === signature.id 
                      ? signature.isLocked 
                        ? "border-solid border-green-600 bg-green-100/70"
                        : "border-solid border-green-600 bg-green-100/90"
                      : signature.isLocked
                        ? "border-solid border-gray-400 bg-gray-50/70"
                        : "border-dashed border-green-400 bg-green-50/90 hover:border-green-600",
                    signature.isLocked ? "cursor-not-allowed" : "cursor-move"
                  )}
                  style={{
                    position: 'absolute',
                    left: `${signature.documentPosition.x}px`,
                    top: `${signature.documentPosition.y}px`,
                    width: `${signature.documentPosition.width}px`,
                    height: `${signature.documentPosition.height}px`,
                    pointerEvents: 'auto',
                    willChange: signature.isLocked ? 'auto' : 'transform',
                  }}
                  onClick={() => setSelectedSignature(signature)}
                  onMouseDown={(e) => !signature.isLocked && handleMouseDown(e, signature, 'move', 'signature')}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <Signature className="h-6 w-6 text-green-600 mb-1" />
                    <span className="text-xs font-medium">{signature.label}</span>
                    {/* Lock button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-4 w-4 absolute top-1 right-1",
                        signature.isLocked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSignatureLock(signature.id)
                      }}
                    >
                      <Shield className={cn("h-3 w-3", signature.isLocked ? "text-gray-600" : "text-gray-400")} />
                    </Button>
                    {/* Delete button */}
                    {!signature.isLocked && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4 absolute top-1 left-1 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSignature(signature.id)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {/* Resize handle */}
                  {selectedSignature?.id === signature.id && !signature.isLocked && (
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 bg-green-600 cursor-nwse-resize"
                      style={{ transform: 'translate(50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        handleMouseDown(e, signature, 'resize', 'signature')
                      }}
                    />
                  )}
                </div>
              ))}
              </div>
            </div>
          </div>
          
          {/* Right Sidebar - Properties */}
          <div className="w-80 border-l bg-muted/10 p-4">
            <h3 className="font-semibold mb-4">Properties</h3>
            
            {selectedField && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm flex items-center gap-2">
                    Field
                    {selectedField.isLocked && <Shield className="h-3 w-3 text-gray-500" />}
                  </Label>
                  <p className="text-sm font-medium">{selectedField.fieldLabel}</p>
                  <p className="text-xs text-muted-foreground">{selectedField.fieldKey}</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Size</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Width</Label>
                      <Input 
                        type="number" 
                        value={Math.round(selectedField.documentPosition.width || 200)}
                        onChange={(e) => {
                          const newWidth = parseInt(e.target.value) || 200
                          setFieldMappings(fieldMappings.map(f => 
                            f.id === selectedField.id 
                              ? { ...f, documentPosition: { ...f.documentPosition, width: newWidth } }
                              : f
                          ))
                          setSelectedField({ ...selectedField, documentPosition: { ...selectedField.documentPosition, width: newWidth } })
                        }}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Height</Label>
                      <Input 
                        type="number" 
                        value={Math.round(selectedField.documentPosition.height || 30)}
                        onChange={(e) => {
                          const newHeight = parseInt(e.target.value) || 30
                          setFieldMappings(fieldMappings.map(f => 
                            f.id === selectedField.id 
                              ? { ...f, documentPosition: { ...f.documentPosition, height: newHeight } }
                              : f
                          ))
                          setSelectedField({ ...selectedField, documentPosition: { ...selectedField.documentPosition, height: newHeight } })
                        }}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedField.isLocked 
                      ? "This field is locked. Unlock to move or resize."
                      : "Drag the field to move it, or drag the corner handle to resize"}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Button 
                    variant={selectedField.isLocked ? "outline" : "default"}
                    size="sm" 
                    onClick={() => toggleFieldLock(selectedField.id)}
                    className="w-full flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    {selectedField.isLocked ? "Unlock Field" : "Lock Field"}
                  </Button>
                  
                  {!selectedField.isLocked && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDeleteField(selectedField.id)}
                      className="w-full"
                    >
                      Remove Field
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {selectedSignature && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm flex items-center gap-2">
                    Signature
                    {selectedSignature.isLocked && <Shield className="h-3 w-3 text-gray-500" />}
                  </Label>
                  <p className="text-sm font-medium">{selectedSignature.label}</p>
                  <Badge variant="outline">{selectedSignature.signerRole}</Badge>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Size</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Width</Label>
                      <Input 
                        type="number" 
                        value={Math.round(selectedSignature.documentPosition.width)}
                        onChange={(e) => {
                          const newWidth = parseInt(e.target.value) || 200
                          setSignaturePlacements(signaturePlacements.map(s => 
                            s.id === selectedSignature.id 
                              ? { ...s, documentPosition: { ...s.documentPosition, width: newWidth } }
                              : s
                          ))
                          setSelectedSignature({ ...selectedSignature, documentPosition: { ...selectedSignature.documentPosition, width: newWidth } })
                        }}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Height</Label>
                      <Input 
                        type="number" 
                        value={Math.round(selectedSignature.documentPosition.height)}
                        onChange={(e) => {
                          const newHeight = parseInt(e.target.value) || 80
                          setSignaturePlacements(signaturePlacements.map(s => 
                            s.id === selectedSignature.id 
                              ? { ...s, documentPosition: { ...s.documentPosition, height: newHeight } }
                              : s
                          ))
                          setSelectedSignature({ ...selectedSignature, documentPosition: { ...selectedSignature.documentPosition, height: newHeight } })
                        }}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedSignature.isLocked 
                      ? "This signature is locked. Unlock to move or resize."
                      : "Drag the signature to move it, or drag the corner handle to resize"}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Button 
                    variant={selectedSignature.isLocked ? "outline" : "default"}
                    size="sm" 
                    onClick={() => toggleSignatureLock(selectedSignature.id)}
                    className="w-full flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    {selectedSignature.isLocked ? "Unlock Signature" : "Lock Signature"}
                  </Button>
                  
                  {!selectedSignature.isLocked && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDeleteSignature(selectedSignature.id)}
                      className="w-full"
                    >
                      Remove Signature
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {!selectedField && !selectedSignature && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Select a field or signature to view properties
              </p>
            )}
          </div>
        </div>
        
        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{fieldMappings.length} fields</Badge>
              <Badge variant="outline">{signaturePlacements.length} signatures</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}