import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { PDFDocument } from 'pdf-lib'
import { getFromMinio } from '@/lib/minio'
import { join } from 'path'

export async function GET(
  request: Request,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const template = await prisma.documentTemplate.findUnique({
      where: { id: params.templateId },
      include: {
        fieldMappings: true
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Get form fields from PDF
    let templateBytes: Buffer
    
    if (template.fileUrl.startsWith('minio://')) {
      // New Minio storage
      const objectPath = template.fileUrl.replace('minio://leave-management-uat/', '')
      templateBytes = await getFromMinio(objectPath, 'leave-management-uat')
    } else {
      // Legacy filesystem storage (for existing templates)
      const templatePath = join(process.cwd(), 'public', template.fileUrl)
      const fs = await import('fs')
      templateBytes = fs.readFileSync(templatePath)
    }
    
    const pdfDoc = await PDFDocument.load(templateBytes)
    const form = pdfDoc.getForm()
    const fields = form.getFields()

    const formFields = fields.map(field => {
      const fieldName = field.getName()
      let fieldType = field.constructor.name.replace('PDF', '').replace('Field', '').toLowerCase()
      
      // Fix common type issues
      if (fieldType === 'text' || fieldType === '') fieldType = 'text'
      if (fieldType === 'checkbo' || fieldType === 'check') fieldType = 'checkbox'
      if (fieldType === 'combobo') fieldType = 'dropdown'
      
      return {
        name: fieldName,
        type: fieldType,
        value: fieldType // Debug: show what type was detected
      }
    })

    // Available data fields
    const availableDataFields = [
      // Employee Information
      { category: 'Employee Information', path: 'employee.firstName', label: 'First Name', type: 'text' },
      { category: 'Employee Information', path: 'employee.lastName', label: 'Last Name', type: 'text' },
      { category: 'Employee Information', path: 'employee.fullName', label: 'Full Name', type: 'text' },
      { category: 'Employee Information', path: 'employee.email', label: 'Email', type: 'text' },
      { category: 'Employee Information', path: 'employee.employeeId', label: 'Employee ID', type: 'text' },
      { category: 'Employee Information', path: 'employee.department', label: 'Department', type: 'text' },
      { category: 'Employee Information', path: 'employee.position', label: 'Position', type: 'text' },
      { category: 'Employee Information', path: 'employee.manager', label: 'Manager Name', type: 'text' },
      
      // Leave Details
      { category: 'Leave Details', path: 'leave.type', label: 'Leave Type', type: 'text' },
      { category: 'Leave Details', path: 'leave.startDate', label: 'Start Date', type: 'date' },
      { category: 'Leave Details', path: 'leave.endDate', label: 'End Date', type: 'date' },
      { category: 'Leave Details', path: 'leave.dates', label: 'Leave Dates (Range)', type: 'text' },
      { category: 'Leave Details', path: 'leave.totalDays', label: 'Total Days', type: 'number' },
      { category: 'Leave Details', path: 'leave.reason', label: 'Reason', type: 'text' },
      { category: 'Leave Details', path: 'leave.requestNumber', label: 'Request Number', type: 'text' },
      { category: 'Leave Details', path: 'leave.status', label: 'Status', type: 'text' },
      { category: 'Leave Details', path: 'leave.requestedDate', label: 'Request Date', type: 'date' },
      
      // Leave Type Checkboxes
      { category: 'Leave Type Checks', path: 'leave.isAnnualLeave', label: 'Is Annual Leave (✓)', type: 'checkbox' },
      { category: 'Leave Type Checks', path: 'leave.isSickLeave', label: 'Is Sick Leave (✓)', type: 'checkbox' },
      { category: 'Leave Type Checks', path: 'leave.isSpecialLeave', label: 'Is Special Leave (✓)', type: 'checkbox' },
      { category: 'Leave Type Checks', path: 'leave.isMaternityLeave', label: 'Is Maternity Leave (✓)', type: 'checkbox' },
      
      // Manager Information
      { category: 'Manager Information', path: 'manager.name', label: 'Manager Name', type: 'text' },
      { category: 'Manager Information', path: 'manager.email', label: 'Manager Email', type: 'text' },
      
      // Substitute Information
      { category: 'Substitute Information', path: 'substitute.fullName', label: 'Substitute Name', type: 'text' },
      { category: 'Substitute Information', path: 'substitute.name', label: 'Substitute Name', type: 'text' },
      { category: 'Substitute Information', path: 'substitute.email', label: 'Substitute Email', type: 'text' },
      
      // Calculated Fields
      { category: 'Calculated Fields', path: 'calculated.currentDate', label: 'Current Date', type: 'date' },
      { category: 'Calculated Fields', path: 'calculated.workingDays', label: 'Working Days', type: 'number' },
      
      // Decision Fields
      { category: 'Decision Fields', path: 'decision.manager.approved', label: 'Manager Approved', type: 'checkbox' },
      { category: 'Decision Fields', path: 'decision.manager.rejected', label: 'Manager Rejected', type: 'checkbox' },
      { category: 'Decision Fields', path: 'decision.director.approved', label: 'Director Approved', type: 'checkbox' },
      { category: 'Decision Fields', path: 'decision.director.rejected', label: 'Director Rejected', type: 'checkbox' },
      { category: 'Decision Fields', path: 'decision.comments', label: 'Comments', type: 'text' },
      
      // Signature Fields
      { category: 'Signatures', path: 'signature.employee.signature', label: 'Employee Signature', type: 'signature' },
      { category: 'Signatures', path: 'signature.employee.date', label: 'Employee Signature Date', type: 'date' },
      { category: 'Signatures', path: 'signature.employee.name', label: 'Employee Name (Printed)', type: 'text' },
      { category: 'Signatures', path: 'signature.manager.signature', label: 'Manager Signature', type: 'signature' },
      { category: 'Signatures', path: 'signature.manager.date', label: 'Manager Signature Date', type: 'date' },
      { category: 'Signatures', path: 'signature.manager.name', label: 'Manager Name (Printed)', type: 'text' },
      { category: 'Signatures', path: 'signature.director.signature', label: 'Director Signature', type: 'signature' },
      { category: 'Signatures', path: 'signature.director.date', label: 'Director Signature Date', type: 'date' },
      { category: 'Signatures', path: 'signature.director.name', label: 'Director Name (Printed)', type: 'text' },
      { category: 'Signatures', path: 'signature.hr.signature', label: 'HR Signature', type: 'signature' },
      { category: 'Signatures', path: 'signature.hr.date', label: 'HR Signature Date', type: 'date' },
      { category: 'Signatures', path: 'signature.hr.name', label: 'HR Name (Printed)', type: 'text' },
      { category: 'Signatures', path: 'signature.executive.signature', label: 'Executive Signature', type: 'signature' },
      { category: 'Signatures', path: 'signature.executive.date', label: 'Executive Signature Date', type: 'date' },
      { category: 'Signatures', path: 'signature.executive.name', label: 'Executive Name (Printed)', type: 'text' },
    ]

    // Convert existing mappings to simple format
    const existingMappings = template.fieldMappings.map(mapping => ({
      pdfField: (mapping.documentPosition as any)?.formFieldName || mapping.fieldLabel,
      dataField: mapping.fieldKey,
      required: mapping.isRequired
    }))

    return NextResponse.json({
      formFields,
      availableDataFields,
      existingMappings
    })
  } catch (error) {
    console.error('Error fetching template fields:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch template fields',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}