import { PDFDocument, StandardFonts } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { join } from 'path'
import { getFromMinio, uploadToMinio, generateLeaveDocumentName } from '@/lib/minio'

type AnyObj = Record<string, any>

export class SmartDocumentGenerator {
  private pendingSignatures: Array<{
    fieldName: string
    signatureData: string
    field: any
  }> = []

  // Helper: clean text for WinAnsi encoding
  private cleanTextForPDF(text: string): string {
    if (!text) return ''

    const charMap: { [key: string]: string } = {
      'ă': 'a', 'Ă': 'A',
      'â': 'a', 'Â': 'A',
      'î': 'i', 'Î': 'I',
      'ș': 's', 'Ș': 'S',
      'ş': 's', 'Ş': 'S',
      'ț': 't', 'Ț': 'T',
      'ţ': 't', 'Ţ': 'T',
      'à': 'a', 'À': 'A',
      'á': 'a', 'Á': 'A',
      'ä': 'a', 'Ä': 'A',
      'è': 'e', 'È': 'E',
      'é': 'e', 'É': 'E',
      'ë': 'e', 'Ë': 'E',
      'ì': 'i', 'Ì': 'I',
      'í': 'i', 'Í': 'I',
      'ï': 'i', 'Ï': 'I',
      'ò': 'o', 'Ò': 'O',
      'ó': 'o', 'Ó': 'O',
      'ö': 'o', 'Ö': 'O',
      'ù': 'u', 'Ù': 'U',
      'ú': 'u', 'Ú': 'U',
      'ü': 'u', 'Ü': 'U',
      'ñ': 'n', 'Ñ': 'N',
      'ç': 'c', 'Ç': 'C'
    }

    return text.replace(
      /[ăâîșşțţàáäèéëìíïòóöùúüñçĂÂÎȘŞȚŢÀÁÄÈÉËÌÍÏÒÓÖÙÚÜÑÇ]/g,
      char => charMap[char] || char
    )
  }

  // === NEW helper you asked for ===
  private isTruthyCheckbox(value: unknown): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0

    const s = String(value ?? '').trim()
    if (s && typeof s === 'string' && s.length > 0) {
      // Case-insensitive comparison without toLowerCase()
      return ['true', '1', 'x', '✓', 'yes', 'checked', 'TRUE', 'True', 'X', 'YES', 'Yes', 'CHECKED', 'Checked'].includes(s)
    }
    return false
  }

  async generateDocument(leaveRequestId: string, templateId: string): Promise<string> {
    console.log('Starting smart document generation:', { leaveRequestId, templateId })

    try {
      // 1) Load Leave Request
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        include: {
          user: { include: { manager: true } },
          leaveType: true,
          substitute: true,
          substitutes: { include: { user: true } },
          generatedDocument: {
            include: {
              signatures: { include: { signer: true } }
            }
          },
          approvals: { include: { approver: true } }
        }
      })
      if (!leaveRequest) throw new Error('Leave request not found')

      // 2) Load Template
      const template = await prisma.documentTemplate.findUnique({
        where: { id: templateId },
        include: { fieldMappings: true, signaturePlacements: true }
      })
      if (!template) throw new Error('Template not found')

      // 3) Load PDF bytes (Minio or FS)
      let templateBytes: Buffer
      if (template.fileUrl.startsWith('minio://')) {
        const objectPath = template.fileUrl.replace('minio://leave-management-uat/', '')
        templateBytes = await getFromMinio(objectPath, 'leave-management-uat')
      } else {
        const templatePath = join(process.cwd(), 'public', template.fileUrl)
        const fs = await import('fs')
        templateBytes = fs.readFileSync(templatePath)
      }

      const pdfDoc = await PDFDocument.load(templateBytes)
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

      // 4) PDF form
      const form = pdfDoc.getForm()
      const formFields = form.getFields()
      if (formFields.length === 0) {
        throw new Error('Template PDF does not contain any form fields. Please upload a PDF with form fields.')
      }
      console.log(`Found ${formFields.length} form fields in template`)

      // 5) Prepare data
      const fieldData = await this.prepareFieldData(leaveRequest as AnyObj)
      console.log('Prepared field data:', JSON.stringify(fieldData, null, 2))
      console.log('Substitute data:', { substitute: fieldData.substitute, substitutes: fieldData.substitutes })
      console.log('Decision data:', fieldData.decision)
      console.log('Signature data:', fieldData.signature)

      // 6) Fill mapped fields
      console.log(`Processing ${template.fieldMappings.length} field mappings`)
      console.log('Available field data keys:', Object.keys(fieldData))
      console.log('Decision data:', JSON.stringify(fieldData.decision, null, 2))
      console.log('Substitutes data:', {
        substitutes: fieldData.substitutes,
        substitute: fieldData.substitute,
        rawSubstitutes: leaveRequest.substitutes,
        rawSubstitute: leaveRequest.substitute
      })

      for (const mapping of template.fieldMappings as AnyObj[]) {
        try {
          const formFieldName =
            (mapping.documentPosition as AnyObj)?.formFieldName || mapping.fieldLabel
          const dataPath = mapping.fieldKey as string

          // Skip if formFieldName is not valid
          if (!formFieldName || typeof formFieldName !== 'string') {
            console.warn(`Skipping mapping with invalid formFieldName: ${formFieldName}`)
            continue
          }

          const value = this.getFieldValue(fieldData, dataPath)
          console.log(`Mapping ${formFieldName} <- ${dataPath}: "${value}"`)

          if (!value) continue

          let fieldType =
            (mapping.documentPosition as AnyObj)?.type || 'text'
          if (!fieldType && dataPath.includes('signature')) fieldType = 'signature'
          
          // Detect checkbox fields by name patterns (case-insensitive without toLowerCase)
          const isCheckboxField = (formFieldName && (
            formFieldName.includes('check') || formFieldName.includes('Check') || formFieldName.includes('CHECK') ||
            formFieldName.includes('approved') || formFieldName.includes('Approved') || formFieldName.includes('APPROVED')
          )) || dataPath.includes('.approved') || dataPath.includes('.rejected')
          
          if (isCheckboxField) {
            fieldType = 'checkbox'
          }

          if (fieldType === 'checkbox') {
            try {
              const checkbox = form.getCheckBox(formFieldName)
              // === Using the new helper here ===
              const truthy = this.isTruthyCheckbox(value)

              console.log(
                `Checkbox field ${formFieldName}: value="${value}" -> ${truthy ? 'check' : 'uncheck'}`
              )

              if (truthy) checkbox.check()
              else checkbox.uncheck()
            } catch (e) {
              console.warn(`Could not set checkbox ${formFieldName}:`, e)
            }
          } else {
            // Check if it's signature data first
            const isSignatureField = dataPath.includes('signature') || fieldType === 'signature'
            if (isSignatureField && typeof value === 'string' && value.startsWith('data:image')) {
              // Handle image signatures
              console.log(`Processing signature field ${formFieldName} with image data`)
              if (!this.pendingSignatures) this.pendingSignatures = []
              this.pendingSignatures.push({
                fieldName: formFieldName,
                signatureData: value,
                field: (form as AnyObj).getField(formFieldName)
              })
            } else {
              // Regular text field
              try {
                const textField = form.getTextField(formFieldName)
                const cleanedText = this.cleanTextForPDF(String(value))
                textField.setText(cleanedText)
                textField.updateAppearances(helveticaFont)
              } catch (e) {
                console.warn(`Could not set text field ${formFieldName}:`, e)
                
                // Try as generic field if text field fails
                try {
                  const field = (form as AnyObj).getField(formFieldName)
                  if (field && 'setText' in field) {
                    const cleanedText = this.cleanTextForPDF(String(value))
                    ;(field as AnyObj).setText(cleanedText)
                    if ('updateAppearances' in field) {
                      ;(field as AnyObj).updateAppearances(helveticaFont)
                    }
                  }
                } catch (sigError) {
                  console.warn(`Could not set field ${formFieldName}:`, sigError)
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing field mapping ${mapping.fieldKey}:`, error)
        }
      }

      // 7) Draw pending signature images (before saving)
      if (this.pendingSignatures && this.pendingSignatures.length > 0) {
        console.log(`Processing ${this.pendingSignatures.length} signature images`)
        const pages = pdfDoc.getPages()

        for (const sig of this.pendingSignatures) {
          try {
            const field: any = sig.field
            const widgets = field?.acroField?.getWidgets?.() || []
            if (widgets.length === 0) continue

            const widget = widgets[0] as any
            const rect = widget.getRectangle ? widget.getRectangle() : widget.getRect?.()
            const pageRef = widget.getP ? widget.getP() : widget.P?.()
            const pageIndex = pages.findIndex((p: any) => p.ref === pageRef || p.node === pageRef)

            if (pageIndex >= 0 && typeof sig.signatureData === 'string' && sig.signatureData.startsWith('data:image')) {
              const base64Data = sig.signatureData.split(',')[1]
              const imageBytes = Buffer.from(base64Data, 'base64') // Node-safe (no atob)

              let image: any
              if (sig.signatureData.includes('image/png')) {
                image = await pdfDoc.embedPng(imageBytes)
              } else if (sig.signatureData.includes('image/jpeg') || sig.signatureData.includes('image/jpg')) {
                image = await pdfDoc.embedJpg(imageBytes)
              } else {
                console.warn(`Unsupported image format for signature: ${sig.fieldName}`)
                continue
              }

              const page = pages[pageIndex]
              let x = 0, y = 0, width = 0, height = 0
              if (rect && typeof rect === 'object' && 'x' in rect) {
                ({ x, y, width, height } = rect)
              } else if (Array.isArray(rect) && rect.length === 4) {
                const [x1, y1, x2, y2] = rect
                x = Math.min(x1, x2)
                y = Math.min(y1, y2)
                width = Math.abs(x2 - x1)
                height = Math.abs(y2 - y1)
              } else {
                console.warn(`Could not resolve rectangle for signature field ${sig.fieldName}`)
                continue
              }

              const imgW = image.width
              const imgH = image.height
              const scale = Math.min(width / imgW, height / imgH) * 0.9 // 90% padding

              page.drawImage(image, {
                x: x + (width - imgW * scale) / 2,
                y: y + (height - imgH * scale) / 2,
                width: imgW * scale,
                height: imgH * scale
              })

              console.log(`Drew signature image for field ${sig.fieldName}`)
            }
          } catch (error) {
            console.error(`Error processing signature for field ${sig.fieldName}:`, error)
          }
        }
      }

      // Clear pending signature placeholders
      this.pendingSignatures = []

      // 8) Light appearance cleanup for text fields (keep fields live)
      for (const field of form.getFields()) {
        try {
          const fieldName = field.getName()
          const ctor = (field as any).constructor?.name
          // Case-insensitive signature field check without toLowerCase
          const isSignatureField = fieldName && typeof fieldName === 'string' && (
            fieldName.includes('signature') || fieldName.includes('Signature') || fieldName.includes('SIGNATURE')
          )
          
          if (ctor === 'PDFTextField' && fieldName && typeof fieldName === 'string' && !isSignatureField) {
            if ('updateAppearances' in (field as any)) {
              ;(field as AnyObj).updateAppearances(helveticaFont)
            }
          }
        } catch (e) {
          console.warn(`Could not clean field appearance: ${e}`)
        }
      }

      // 9) Replace existing generated doc metadata, upload new PDF
      const existingSignatures = leaveRequest.generatedDocument?.signatures || []

      await prisma.generatedDocument.deleteMany({ where: { leaveRequestId } })

      const pdfBytes = await pdfDoc.save()
      
      // Determine if document should go to generated or draft folder based on approval status
      const hasApprovedStatus = leaveRequest.status === 'APPROVED'
      const hasApprovals = leaveRequest.approvals?.some((a: AnyObj) => a.status === 'APPROVED')
      const isFullyApproved = hasApprovedStatus || hasApprovals
      
      const folderType = isFullyApproved ? 'generated' : 'draft'
      const folderPath = isFullyApproved ? 'documents/generated' : 'documents/draft'
      
      const fileName = generateLeaveDocumentName(
        leaveRequest.requestNumber,
        leaveRequest.user.email,
        leaveRequest.leaveType,
        folderType
      )

      const fileUrl = await uploadToMinio(
        Buffer.from(pdfBytes),
        fileName,
        'application/pdf',
        'leave-management-uat',
        folderPath
      )

      const hasRequiredSignatures = template.signaturePlacements.some(s => s.isRequired)
      const initialStatus = hasRequiredSignatures ? 'PENDING_SIGNATURES' : 'COMPLETED'

      const generatedDoc = await prisma.generatedDocument.create({
        data: {
          templateId,
          leaveRequestId,
          fileUrl,
          status: initialStatus,
          templateSnapshot: {
            templateId: template.id,
            templateName: template.name,
            fieldMappingsCount: template.fieldMappings.length,
            signaturePlacementsCount: template.signaturePlacements.length,
            formFieldBased: true
          },
          completedAt: hasRequiredSignatures ? null : new Date()
        }
      })

      // 10) Restore previous signatures metadata (DB) and complete if all required present
      if (existingSignatures.length > 0) {
        console.log(`Restoring ${existingSignatures.length} signatures`)
        for (const sig of existingSignatures) {
          await prisma.documentSignature.create({
            data: {
              documentId: generatedDoc.id,
              signerId: sig.signerId,
              signerRole: sig.signerRole,
              signatureData: sig.signatureData,
              signedAt: sig.signedAt
            }
          })
        }

        const required = template.signaturePlacements.filter(s => s.isRequired)
        const allSigned = required.every(req =>
          existingSignatures.some(sig => sig.signerRole === req.signerRole)
        )

        if (allSigned) {
          await prisma.generatedDocument.update({
            where: { id: generatedDoc.id },
            data: { status: 'COMPLETED', completedAt: new Date() }
          })
        }
      }

      return generatedDoc.id
    } catch (error) {
      console.error('Error generating document:', error)
      throw error
    }
  }

  // --- Helpers --------------------------------------------------------------

  private prepareSignatureData(leaveRequest: AnyObj) {
    // Return a NESTED object: signature.manager.signature / .date / .name
    const sig = {
      employee: { name: '', date: '', signature: '' },
      manager:  { name: '', date: '', signature: '' },
      director: { name: '', date: '', signature: '' },
      hr:       { name: '', date: '', signature: '' },
      executive:{ name: '', date: '', signature: '' }
    }

    sig.employee.name = `${leaveRequest.user.firstName || ''} ${leaveRequest.user.lastName || ''}`.trim()

    if (leaveRequest.generatedDocument?.signatures) {
      for (const s of leaveRequest.generatedDocument.signatures) {
        if (!s?.signerRole) continue
        const roleStr = String(s.signerRole)
        if (!roleStr || typeof roleStr !== 'string' || roleStr.length === 0) continue
        
        // Map role to lowercase equivalent without using toLowerCase()
        let role = ''
        if (roleStr === 'EMPLOYEE' || roleStr === 'employee' || roleStr === 'Employee') role = 'employee'
        else if (roleStr === 'MANAGER' || roleStr === 'manager' || roleStr === 'Manager') role = 'manager'
        else if (roleStr === 'DIRECTOR' || roleStr === 'director' || roleStr === 'Director') role = 'director'
        else if (roleStr === 'HR' || roleStr === 'hr' || roleStr === 'Hr') role = 'hr'
        else if (roleStr === 'EXECUTIVE' || roleStr === 'executive' || roleStr === 'Executive') role = 'executive'
        
        if (!role || !(role in sig)) continue

        let signerName = ''
        if (s.signer) {
          signerName = `${s.signer.firstName || ''} ${s.signer.lastName || ''}`.trim()
        } else if (role === 'employee') {
          signerName = sig.employee.name
        } else if (leaveRequest.approvals) {
          const approval = leaveRequest.approvals.find((a: AnyObj) => a.approver && a.status === 'APPROVED')
          if (approval?.approver) {
            signerName = `${approval.approver.firstName || ''} ${approval.approver.lastName || ''}`.trim()
          }
        }

        sig[role as keyof typeof sig] = {
          name: signerName,
          date: s.signedAt ? format(new Date(s.signedAt), 'dd.MM.yyyy') : '',
          signature: s.signatureData || 'SIGNED'
        }
      }
    }

    if (leaveRequest.approvals) {
      for (const approval of leaveRequest.approvals) {
        if (approval.status !== 'APPROVED' || !approval.approver) continue
        
        const approverRoleStr = String(approval.approver.role || '')
        if (!approverRoleStr) continue
        
        // Map role to lowercase equivalent without using toLowerCase()
        let approverRole = ''
        if (approverRoleStr === 'EMPLOYEE' || approverRoleStr === 'employee' || approverRoleStr === 'Employee') approverRole = 'employee'
        else if (approverRoleStr === 'MANAGER' || approverRoleStr === 'manager' || approverRoleStr === 'Manager') approverRole = 'manager'
        else if (approverRoleStr === 'DEPARTMENT_DIRECTOR' || approverRoleStr === 'department_director' || approverRoleStr === 'Department_Director') approverRole = 'department_director'
        else if (approverRoleStr === 'HR' || approverRoleStr === 'hr' || approverRoleStr === 'Hr') approverRole = 'hr'
        else if (approverRoleStr === 'EXECUTIVE' || approverRoleStr === 'executive' || approverRoleStr === 'Executive') approverRole = 'executive'

        let role: keyof typeof sig | null = null
        if (approverRole === 'executive') role = 'executive'
        else if (approverRole === 'department_director') role = 'director'
        else if (approverRole === 'hr') role = 'hr'
        else if (approverRole === 'manager') role = 'manager'

        if (role) {
          const approverName = `${approval.approver.firstName || ''} ${approval.approver.lastName || ''}`.trim()
          const signatureDate = approval.signedAt
            ? format(new Date(approval.signedAt), 'dd.MM.yyyy')
            : (approval.approvedAt ? format(new Date(approval.approvedAt), 'dd.MM.yyyy') : '')
          
          // Use actual signature data if available, otherwise mark as APPROVED
          const signatureData = approval.signature || 'APPROVED'
          
          sig[role] = {
            name: approverName,
            date: signatureDate,
            signature: signatureData
          }
          
          console.log(`Mapped approval signature: ${role} -> ${approverName} (${signatureDate})`)
        }
      }
    }

    return sig
  }

  private async prepareFieldData(leaveRequest: AnyObj) {
    const startDate = new Date(leaveRequest.startDate)
    const endDate = new Date(leaveRequest.endDate)
    
    // Fetch actual leave balance for the user
    const currentYear = new Date().getFullYear()
    let leaveBalance = null
    try {
      leaveBalance = await prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId: leaveRequest.userId,
            leaveTypeId: leaveRequest.leaveTypeId,
            year: currentYear
          }
        }
      })
    } catch (error) {
      console.error('Error fetching leave balance:', error)
    }

    let dateRange = ''
    let selectedDates = leaveRequest.selectedDates || []

    if ((!selectedDates || selectedDates.length === 0) && leaveRequest.supportingDocuments) {
      const supportingDocs =
        typeof leaveRequest.supportingDocuments === 'string'
          ? JSON.parse(leaveRequest.supportingDocuments)
          : leaveRequest.supportingDocuments
      selectedDates = supportingDocs?.selectedDates || []
    }

    console.log('Selected dates:', selectedDates)

    if (selectedDates && selectedDates.length > 0) {
      const dates = selectedDates
        .map((d: string | Date) => new Date(d))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime())

      const groups: string[] = []
      let currentGroup: Date[] = [dates[0]]

      for (let i = 1; i < dates.length; i++) {
        const prevDate = dates[i - 1]
        const currDate = dates[i]
        const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)

        if (dayDiff === 1) {
          currentGroup.push(currDate)
        } else {
          if (currentGroup.length === 1) {
            groups.push(format(currentGroup[0], 'dd.MM.yyyy'))
          } else if (currentGroup.length === 2) {
            groups.push(`${format(currentGroup[0], 'dd.MM.yyyy')}, ${format(currentGroup[1], 'dd.MM.yyyy')}`)
          } else {
            groups.push(`${format(currentGroup[0], 'dd.MM')}-${format(currentGroup[currentGroup.length - 1], 'dd.MM.yyyy')}`)
          }
          currentGroup = [currDate]
        }
      }

      if (currentGroup.length === 1) {
        groups.push(format(currentGroup[0], 'dd.MM.yyyy'))
      } else if (currentGroup.length === 2) {
        groups.push(`${format(currentGroup[0], 'dd.MM.yyyy')}, ${format(currentGroup[1], 'dd.MM.yyyy')}`)
      } else {
        groups.push(`${format(currentGroup[0], 'dd.MM')}-${format(currentGroup[currentGroup.length - 1], 'dd.MM.yyyy')}`)
      }

      dateRange = groups.join(', ')
    } else {
      dateRange =
        startDate.toDateString() === endDate.toDateString()
          ? format(startDate, 'dd.MM.yyyy')
          : `${format(startDate, 'dd.MM.yyyy')} - ${format(endDate, 'dd.MM.yyyy')}`
    }

    let approverName = ''
    let approverEmail = ''

    if (leaveRequest.approvals && leaveRequest.approvals.length > 0) {
      const primaryApproval = leaveRequest.approvals.find((a: AnyObj) => a.level === 1)
      if (primaryApproval?.approver) {
        approverName = `${primaryApproval.approver.firstName} ${primaryApproval.approver.lastName}`
        approverEmail = primaryApproval.approver.email
      }
    }

    const signatureData = this.prepareSignatureData(leaveRequest)

    const decisions: AnyObj = {
      manager: { approved: '', rejected: '' },
      director: { approved: '', rejected: '' },
      hr: { approved: '', rejected: '' },
      executive: { approved: '', rejected: '' },
      comments: ''
    }

    if (signatureData.manager.signature || signatureData.manager.date) decisions.manager.approved = 'X'
    if (signatureData.director.signature || signatureData.director.date) decisions.director.approved = 'X'
    if (signatureData.hr.signature || signatureData.hr.date) decisions.hr.approved = 'X'
    if (signatureData.executive.signature || signatureData.executive.date) decisions.executive.approved = 'X'

    if (leaveRequest.approvals) {
      console.log(`Processing ${leaveRequest.approvals.length} approvals`)
      for (const approval of leaveRequest.approvals) {
        console.log('Approval:', {
          status: approval.status,
          level: approval.level,
          approverRole: approval.approver?.role,
          approverId: approval.approverId,
          approverName: approval.approver ? `${approval.approver.firstName} ${approval.approver.lastName}` : 'Unknown'
        })

        if (approval.approver || approval.level === 1) {
          let decisionRole: keyof typeof decisions = 'manager'

          if (approval.level === 1) {
            decisionRole = 'manager'
          } else if (approval.approver && approval.approver.role) {
            const approverRoleStr = String(approval.approver.role)
            if (approverRoleStr && typeof approverRoleStr === 'string' && approverRoleStr.length > 0) {
              // Map role to lowercase equivalent without using toLowerCase()
              let approverRole = ''
              if (approverRoleStr === 'EMPLOYEE' || approverRoleStr === 'employee' || approverRoleStr === 'Employee') approverRole = 'employee'
              else if (approverRoleStr === 'MANAGER' || approverRoleStr === 'manager' || approverRoleStr === 'Manager') approverRole = 'manager'
              else if (approverRoleStr === 'DEPARTMENT_DIRECTOR' || approverRoleStr === 'department_director' || approverRoleStr === 'Department_Director') approverRole = 'department_director'
              else if (approverRoleStr === 'HR' || approverRoleStr === 'hr' || approverRoleStr === 'Hr') approverRole = 'hr'
              else if (approverRoleStr === 'EXECUTIVE' || approverRoleStr === 'executive' || approverRoleStr === 'Executive') approverRole = 'executive'
              
              if (approverRole === 'executive') decisionRole = 'executive'
              else if (approverRole === 'department_director') decisionRole = 'director'
              else if (approverRole === 'hr') decisionRole = 'hr'
            }
          }

          console.log(`  -> Setting decision for role: ${decisionRole}`)
          if (approval.status === 'APPROVED') {
            decisions[decisionRole].approved = 'X'
            decisions[decisionRole].rejected = ''
          } else if (approval.status === 'REJECTED') {
            decisions[decisionRole].approved = ''
            decisions[decisionRole].rejected = 'X'
          }

          if (approval.comments) {
            decisions.comments = decisions.comments
              ? `${decisions.comments}\n${approval.comments}`
              : approval.comments
          }
        }
      }
    }

    console.log('Final decisions state:', decisions)

    return {
      employee: {
        firstName: leaveRequest.user.firstName || '',
        lastName: leaveRequest.user.lastName || '',
        fullName: `${leaveRequest.user.firstName || ''} ${leaveRequest.user.lastName || ''}`.trim(),
        email: leaveRequest.user.email || '',
        employeeId: leaveRequest.user.employeeId || '',
        department: leaveRequest.user.department || 'Unassigned',
        position: leaveRequest.user.position || '',
        manager:
          approverName ||
          (leaveRequest.user.manager?.firstName && leaveRequest.user.manager?.lastName
            ? `${leaveRequest.user.manager.firstName} ${leaveRequest.user.manager.lastName}`
            : '')
      },
      leave: {
        type: leaveRequest.leaveType.name,
        startDate: format(startDate, 'dd.MM.yyyy'),
        endDate: format(endDate, 'dd.MM.yyyy'),
        dates: dateRange,
        totalDays: String(leaveRequest.totalDays),
        reason: leaveRequest.reason || ' ',
        requestNumber: leaveRequest.requestNumber || '',
        status: String(leaveRequest.status),
        requestedDate: format(new Date(leaveRequest.createdAt), 'dd.MM.yyyy'),
        // Leave Type Checkboxes
        isAnnualLeave: leaveRequest.leaveType.name.includes('Annual') ? 'X' : '',
        isSickLeave: leaveRequest.leaveType.name.includes('Sick') ? 'X' : '',
        isSpecialLeave: leaveRequest.leaveType.name.includes('Special') ? 'X' : '',
        isMaternityLeave: leaveRequest.leaveType.name.includes('Maternity') ? 'X' : ''
      },
      manager: {
        name:
          approverName ||
          (leaveRequest.user.manager?.firstName && leaveRequest.user.manager?.lastName
            ? `${leaveRequest.user.manager.firstName} ${leaveRequest.user.manager.lastName}`
            : ''),
        email: approverEmail || leaveRequest.user.manager?.email || ''
      },
      substitute: {
        fullName: this.getSubstitutesString(leaveRequest),
        name: this.getSubstitutesString(leaveRequest),
        email: this.getSubstitutesEmails(leaveRequest)
      },
      substitutes: {
        fullName: this.getSubstitutesString(leaveRequest),
        email: this.getSubstitutesEmails(leaveRequest)
      },
      calculated: {
        currentDate: format(new Date(), 'dd.MM.yyyy'),
        workingDays: String(leaveRequest.totalDays)
      },
      balance: {
        entitled: String(leaveBalance?.entitled || 0),
        used: String(leaveBalance?.used || 0),
        pending: String(leaveBalance?.pending || 0),
        available: String(leaveBalance?.available || 0),
        afterApproval: String((leaveBalance?.available || 0) - leaveRequest.totalDays)
      },
      decision: decisions,
      signature: signatureData // nested
    }
  }

  private getSubstitutesString(leaveRequest: AnyObj): string {
    // Check if this is an executive request
    if (leaveRequest.supportingDocuments?.isExecutiveRequest) {
      console.log('Executive request - no substitute needed')
      return 'N/A (Executive Request)'
    }
    
    if (leaveRequest.substitutes && leaveRequest.substitutes.length > 0) {
      console.log(
        `Found ${leaveRequest.substitutes.length} substitutes:`,
        leaveRequest.substitutes.map((sub: AnyObj) => ({
          id: sub.id,
          userId: sub.userId,
          firstName: sub.user?.firstName,
          lastName: sub.user?.lastName
        }))
      )
      const names = leaveRequest.substitutes
        .map((sub: AnyObj) => `${sub.user.firstName || ''} ${sub.user.lastName || ''}`.trim())
        .filter((name: string) => name)
      console.log('Substitute names:', names)
      return names.join(', ')
    }
    if (leaveRequest.substitute) {
      console.log('Using single substitute:', {
        id: leaveRequest.substitute.id,
        firstName: leaveRequest.substitute.firstName,
        lastName: leaveRequest.substitute.lastName
      })
      return `${leaveRequest.substitute.firstName || ''} ${leaveRequest.substitute.lastName || ''}`.trim()
    }
    console.log('No substitutes found')
    return 'Not specified'
  }

  private getSubstitutesEmails(leaveRequest: AnyObj): string {
    // Check if this is an executive request
    if (leaveRequest.supportingDocuments?.isExecutiveRequest) {
      return 'N/A (Executive Request)'
    }
    
    if (leaveRequest.substitutes && leaveRequest.substitutes.length > 0) {
      return leaveRequest.substitutes
        .map((sub: AnyObj) => sub.user.email)
        .filter((email: string) => email)
        .join(', ')
    }
    return leaveRequest.substitute?.email || 'Not specified'
  }

  private getFieldValue(data: AnyObj, fieldKey: string): string {
    const keys = fieldKey.split('.')
    let value: any = data

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        return ''
      }
    }

    if (Array.isArray(value)) {
      return value
        .map(item => (typeof item === 'object' && item?.name ? item.name : String(item)))
        .join(', ')
    }

    if (value && typeof value === 'object' && 'name' in value) {
      return (value as AnyObj).name
    }

    return String(value ?? '')
  }

  // Signature methods remain the same
  async addSignature(documentId: string, signerId: string, signerRole: string, signatureData: string): Promise<void> {
    try {
      await prisma.documentSignature.create({
        data: {
          documentId,
          signerId,
          signerRole,
          signatureData,
          signedAt: new Date()
        }
      })

      const document = await prisma.generatedDocument.findUnique({
        where: { id: documentId },
        include: {
          signatures: true,
          template: { include: { signaturePlacements: true } },
          leaveRequest: true
        }
      })

      if (document) {
        const requiredSignatures = document.template.signaturePlacements.filter(s => s.isRequired)
        const completedSignatures = document.signatures

        const allSigned = requiredSignatures.every(req =>
          completedSignatures.some(comp => comp.signerRole === req.signerRole)
        )

        if (allSigned) {
          await prisma.generatedDocument.update({
            where: { id: documentId },
            data: { status: 'COMPLETED', completedAt: new Date() }
          })
        }

        // Regenerate the document to include the new signature
        if (document.leaveRequest && document.template) {
          await this.generateDocument(document.leaveRequest.id, document.template.id)
        }
      }
    } catch (error) {
      console.error('Error adding signature:', error)
      throw error
    }
  }

  private async updatePDFWithSignatures(documentId: string): Promise<void> {
    // This method is called during document generation
    console.log('PDF signatures will be included in current generation:', documentId)
  }
}
