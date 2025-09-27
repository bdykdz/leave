'use client'

import { useState, useEffect } from 'react'
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

export function SimpleFieldMapper() {
  const [file, setFile] = useState<File | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [description, setDescription] = useState('')
  const [leaveTypes, setLeaveTypes] = useState<any[]>([])
  const [selectedLeaveType, setSelectedLeaveType] = useState('')
  
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [dataFields, setDataFields] = useState<DataField[]>([])
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  
  const [loading, setLoading] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [templateId, setTemplateId] = useState<string | null>(null)

  // Fetch leave types on mount
  useEffect(() => {
    fetchLeaveTypes()
  }, [])

  const fetchLeaveTypes = async () => {
    try {
      const response = await fetch('/api/leave-types')
      if (response.ok) {
        const data = await response.json()
        setLeaveTypes(data.leaveTypes)
      }
    } catch (error) {
      console.error('Failed to fetch leave types:', error)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Please upload a PDF file')
        return
      }
      setFile(selectedFile)
      setUploadComplete(false)
      setFormFields([])
      setMappings([])
    }
  }

  const handleUpload = async () => {
    if (!file || !templateName) {
      toast.error('Please provide a template name and select a file')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', templateName)
      formData.append('description', description)
      if (selectedLeaveType && selectedLeaveType !== 'none') {
        formData.append('leaveTypeId', selectedLeaveType)
      }

      const response = await fetch('/api/admin/upload-template', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload template')
      }

      setTemplateId(data.template.id)
      setFormFields(data.formFields)
      setDataFields(data.availableDataFields)
      
      // Initialize mappings with unmapped values
      const initialMappings = data.formFields.map((field: FormField) => ({
        pdfField: field.name,
        dataField: 'unmapped',
        type: field.type,
        required: false
      }))
      setMappings(initialMappings)
      
      setUploadComplete(true)
      toast.success('Template uploaded successfully!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload template')
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
    if (!templateId) {
      toast.error('No template ID found')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/save-field-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          mappings: mappings.filter(m => m.dataField && m.dataField !== 'unmapped')
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save mappings')
      }

      toast.success('Field mappings saved successfully!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save mappings')
    } finally {
      setLoading(false)
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

  if (!uploadComplete) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Upload Document Template</h2>
          <p className="text-gray-600">Upload a PDF with form fields to use as a template</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                placeholder="e.g., Annual Leave Request Form"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this template"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="leave-type">Associate with Leave Type (Optional)</Label>
              <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdf-file">PDF File *</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Input
                  id="pdf-file"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Label
                  htmlFor="pdf-file"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  {file ? (
                    <>
                      <FileText className="w-12 h-12 text-blue-600" />
                      <span className="font-medium">{file.name}</span>
                      <span className="text-sm text-gray-500">Click to change file</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400" />
                      <span className="font-medium">Click to upload PDF</span>
                      <span className="text-sm text-gray-500">PDF must contain form fields</span>
                    </>
                  )}
                </Label>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                Your PDF must contain form fields. You can add form fields using Adobe Acrobat, 
                LibreOffice, or online PDF editors.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handleUpload} 
              disabled={!file || !templateName || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Template
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Map Template Fields</h2>
          <p className="text-gray-600">Connect PDF fields to system data fields</p>
        </div>
        <Button variant="outline" onClick={() => setUploadComplete(false)}>
          Upload Different Template
        </Button>
      </div>

      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle>Template Uploaded</AlertTitle>
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

          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
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
              
              <Button 
                onClick={saveMappings} 
                disabled={loading || mappedCount === 0}
              >
                {loading ? (
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

      {mappedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mapped Fields Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {mappings
                .filter(m => m.dataField && m.dataField !== 'unmapped')
                .map((mapping) => {
                  const dataField = dataFields.find(f => f.path === mapping.dataField)
                  return (
                    <div key={mapping.pdfField} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                      <Link className="w-3 h-3 text-green-600 flex-shrink-0" />
                      <span className="font-medium truncate">{mapping.pdfField}</span>
                      <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600 truncate">{dataField?.label}</span>
                      {mapping.required && (
                        <Badge variant="secondary" className="text-xs ml-auto flex-shrink-0">Required</Badge>
                      )}
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}