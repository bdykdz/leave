import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const leaveTypeId = formData.get('leaveTypeId') as string

    if (!file || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Load PDF and detect form fields
    const pdfDoc = await PDFDocument.load(buffer)
    const form = pdfDoc.getForm()
    const fields = form.getFields()

    // Extract form field information
    const formFields = fields.map(field => {
      const fieldName = field.getName()
      let fieldType = 'text'
      
      if (field.constructor.name === 'PDFCheckBox') {
        fieldType = 'checkbox'
      } else if (field.constructor.name === 'PDFDropdown') {
        fieldType = 'dropdown'
      } else if (field.constructor.name === 'PDFRadioGroup') {
        fieldType = 'radio'
      }

      return {
        name: fieldName,
        type: fieldType
      }
    })

    if (formFields.length === 0) {
      return NextResponse.json({ 
        error: 'No form fields detected in PDF', 
        details: 'Please upload a PDF with form fields'
      }, { status: 400 })
    }

    // Save the file
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'templates')
    await mkdir(uploadsDir, { recursive: true })
    
    const fileName = `template-${Date.now()}-${file.name}`
    const filePath = join(uploadsDir, fileName)
    await writeFile(filePath, buffer)

    // Create template in database
    const template = await prisma.documentTemplate.create({
      data: {
        name,
        description: description || null,
        fileUrl: `/uploads/templates/${fileName}`,
        fileType: 'application/pdf',
        category: 'LEAVE_REQUEST',
        leaveTypeId: leaveTypeId || null,
        createdBy: session.user.id,
        isActive: true
      }
    })

    // Get available data fields that can be mapped
    const availableDataFields = [
      // Employee fields
      { category: 'Employee Information', path: 'employee.fullName', label: 'Employee Full Name', type: 'text' },
      { category: 'Employee Information', path: 'employee.firstName', label: 'Employee First Name', type: 'text' },
      { category: 'Employee Information', path: 'employee.lastName', label: 'Employee Last Name', type: 'text' },
      { category: 'Employee Information', path: 'employee.email', label: 'Employee Email', type: 'text' },
      { category: 'Employee Information', path: 'employee.employeeId', label: 'Employee ID', type: 'text' },
      { category: 'Employee Information', path: 'employee.department', label: 'Department', type: 'text' },
      { category: 'Employee Information', path: 'employee.position', label: 'Position', type: 'text' },
      { category: 'Employee Information', path: 'employee.manager', label: 'Manager Name', type: 'text' },
      
      // Leave request fields
      { category: 'Leave Details', path: 'leave.requestNumber', label: 'Request Number', type: 'text' },
      { category: 'Leave Details', path: 'leave.type', label: 'Leave Type', type: 'text' },
      { category: 'Leave Details', path: 'leave.startDate', label: 'Start Date', type: 'text' },
      { category: 'Leave Details', path: 'leave.endDate', label: 'End Date', type: 'text' },
      { category: 'Leave Details', path: 'leave.dates', label: 'Date Range', type: 'text' },
      { category: 'Leave Details', path: 'leave.totalDays', label: 'Total Days', type: 'text' },
      { category: 'Leave Details', path: 'leave.reason', label: 'Reason', type: 'text' },
      { category: 'Leave Details', path: 'leave.status', label: 'Status', type: 'text' },
      { category: 'Leave Details', path: 'leave.requestedDate', label: 'Request Date', type: 'text' },
      
      // Substitute fields
      { category: 'Substitute', path: 'substitute.fullName', label: 'Substitute Full Name', type: 'text' },
      { category: 'Substitute', path: 'substitute.name', label: 'Substitute Name', type: 'text' },
      { category: 'Substitute', path: 'substitute.email', label: 'Substitute Email', type: 'text' },
      { category: 'Substitute', path: 'substitutes.fullName', label: 'All Substitutes Names', type: 'text' },
      { category: 'Substitute', path: 'substitutes.email', label: 'All Substitutes Emails', type: 'text' },
      
      // Manager fields
      { category: 'Approver', path: 'manager.name', label: 'Approver Name', type: 'text' },
      { category: 'Approver', path: 'manager.email', label: 'Approver Email', type: 'text' },
      
      // Decision fields
      { category: 'Decision', path: 'decision.manager.approved', label: 'Manager Approved', type: 'checkbox' },
      { category: 'Decision', path: 'decision.manager.rejected', label: 'Manager Rejected', type: 'checkbox' },
      { category: 'Decision', path: 'decision.director.approved', label: 'Director Approved', type: 'checkbox' },
      { category: 'Decision', path: 'decision.director.rejected', label: 'Director Rejected', type: 'checkbox' },
      { category: 'Decision', path: 'decision.hr.approved', label: 'HR Approved', type: 'checkbox' },
      { category: 'Decision', path: 'decision.hr.rejected', label: 'HR Rejected', type: 'checkbox' },
      { category: 'Decision', path: 'decision.executive.approved', label: 'Executive Approved', type: 'checkbox' },
      { category: 'Decision', path: 'decision.executive.rejected', label: 'Executive Rejected', type: 'checkbox' },
      { category: 'Decision', path: 'decision.comments', label: 'Comments', type: 'text' },
      
      // Calculated fields
      { category: 'Other', path: 'calculated.currentDate', label: 'Current Date', type: 'text' },
      { category: 'Other', path: 'calculated.workingDays', label: 'Working Days', type: 'text' },
      
      // Signature fields
      { category: 'Signatures', path: 'signature.employee', label: 'Employee Signature', type: 'signature' },
      { category: 'Signatures', path: 'signature.employee.date', label: 'Employee Signature Date', type: 'text' },
      { category: 'Signatures', path: 'signature.employee.name', label: 'Employee Name (Printed)', type: 'text' },
      { category: 'Signatures', path: 'signature.manager', label: 'Manager Signature', type: 'signature' },
      { category: 'Signatures', path: 'signature.manager.date', label: 'Manager Signature Date', type: 'text' },
      { category: 'Signatures', path: 'signature.manager.name', label: 'Manager Name (Printed)', type: 'text' },
      { category: 'Signatures', path: 'signature.director', label: 'Director Signature', type: 'signature' },
      { category: 'Signatures', path: 'signature.director.date', label: 'Director Signature Date', type: 'text' },
      { category: 'Signatures', path: 'signature.director.name', label: 'Director Name (Printed)', type: 'text' },
      { category: 'Signatures', path: 'signature.hr', label: 'HR Signature', type: 'signature' },
      { category: 'Signatures', path: 'signature.hr.date', label: 'HR Signature Date', type: 'text' },
      { category: 'Signatures', path: 'signature.hr.name', label: 'HR Name (Printed)', type: 'text' },
      { category: 'Signatures', path: 'signature.executive', label: 'Executive Signature', type: 'signature' },
      { category: 'Signatures', path: 'signature.executive.date', label: 'Executive Signature Date', type: 'text' },
      { category: 'Signatures', path: 'signature.executive.name', label: 'Executive Name (Printed)', type: 'text' }
    ]

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        fileUrl: template.fileUrl
      },
      formFields,
      availableDataFields,
      message: `Template uploaded successfully. Found ${formFields.length} form fields.`
    })
  } catch (error) {
    console.error('Error uploading template:', error)
    return NextResponse.json({ 
      error: 'Failed to upload template',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}