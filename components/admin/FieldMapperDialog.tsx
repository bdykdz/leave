'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Save,
  RefreshCw,
  Link,
  ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'

interface FormField {
  name: string
  type: string
}

interface DataField {
  category: string
  path: string
  label: string
  type: string
}

interface FieldMapping {
  pdfField: string
  dataField: string
  type: string
  required: boolean
}

interface Template {
  id: string
  name: string
  fileUrl: string
}

interface FieldMapperDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: Template | null
  onSave?: () => void
}

export function FieldMapperDialog({
  open,
  onOpenChange,
  template,
  onSave
}: FieldMapperDialogProps) {
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [dataFields, setDataFields] = useState<DataField[]>([])
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && template) {
      loadTemplateFields()
    }
  }, [open, template])

  const loadTemplateFields = async () => {
    if (!template) return
    
    setLoading(true)
    try {
      // Get template fields and existing mappings
      const response = await fetch(`/api/admin/templates/${template.id}/fields-info`)
      if (response.ok) {
        const data = await response.json()
        
        setFormFields(data.formFields || [])
        setDataFields(data.availableDataFields || [])
        
        // Initialize mappings
        const existingMappings = data.existingMappings || []
        const mappingMap = new Map(existingMappings.map((m: any) => [m.pdfField, m]))
        
        const initialMappings = (data.formFields || []).map((field: FormField) => {
          const existing = mappingMap.get(field.name)
          return {
            pdfField: field.name,
            dataField: existing?.dataField || 'unmapped',
            type: field.type,
            required: existing?.required || false
          }
        })
        
        setMappings(initialMappings)
      }
    } catch (error) {
      console.error('Failed to load template fields:', error)
      toast.error('Failed to load template fields')
    } finally {
      setLoading(false)
    }
  }

  const handleMappingChange = (pdfField: string, dataField: string) => {
    setMappings(prev => 
      prev.map(m => 
        m.pdfField === pdfField 
          ? { ...m, dataField }
          : m
      )
    )
  }

  const handleRequiredChange = (pdfField: string, required: boolean) => {
    setMappings(prev => 
      prev.map(m => 
        m.pdfField === pdfField 
          ? { ...m, required }
          : m
      )
    )
  }

  const saveMappings = async () => {
    if (!template) return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/save-field-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          mappings: mappings.filter(m => m.dataField && m.dataField !== 'unmapped')
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save mappings')
      }

      toast.success('Field mappings saved successfully!')
      onSave?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save mappings')
    } finally {
      setSaving(false)
    }
  }

  // Group data fields by category
  const groupedDataFields = dataFields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = []
    }
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, DataField[]>)

  const mappedCount = mappings.filter(m => m.dataField && m.dataField !== 'unmapped').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Field Mappings</DialogTitle>
          <DialogDescription>
            Map PDF form fields to system data fields for {template?.name}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>Loading template fields...</p>
          </div>
        ) : formFields.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Form Fields Found</AlertTitle>
            <AlertDescription>
              This PDF template doesn't contain any form fields. Please upload a PDF with form fields to enable field mapping.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Template Fields Detected</AlertTitle>
              <AlertDescription>
                Found {formFields.length} form fields. {mappedCount} of {formFields.length} fields mapped.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Field Mappings</CardTitle>
                <CardDescription>
                  Match each PDF field with the corresponding system field
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mappings.map((mapping) => (
                    <div key={mapping.pdfField} className="grid grid-cols-12 gap-4 items-center p-3 rounded-lg bg-gray-50">
                      <div className="col-span-4 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-sm">{mapping.pdfField}</span>
                        <Badge variant="outline" className="text-xs">{mapping.type}</Badge>
                      </div>
                      
                      <div className="col-span-1 flex justify-center">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                      
                      <div className="col-span-5">
                        <Select
                          value={mapping.dataField}
                          onValueChange={(value) => handleMappingChange(mapping.pdfField, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select field to map" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unmapped">
                              <span className="text-gray-500">Don't map this field</span>
                            </SelectItem>
                            {Object.entries(groupedDataFields).map(([category, fields]) => (
                              <div key={category}>
                                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                                  {category}
                                </div>
                                {fields.map((field) => (
                                  <SelectItem key={field.path} value={field.path}>
                                    <div className="flex items-center gap-2">
                                      <span>{field.label}</span>
                                      <code className="text-xs text-gray-500">{field.path}</code>
                                    </div>
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <Checkbox
                          id={`required-${mapping.pdfField}`}
                          checked={mapping.required}
                          onCheckedChange={(checked) => 
                            handleRequiredChange(mapping.pdfField, checked as boolean)
                          }
                        />
                        <Label htmlFor={`required-${mapping.pdfField}`} className="text-sm cursor-pointer">
                          Required
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {mappedCount > 0 ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        {mappedCount} fields mapped
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        No fields mapped yet
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={saveMappings} 
                      disabled={saving || mappedCount === 0}
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Mappings
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}