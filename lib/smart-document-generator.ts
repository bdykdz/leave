import { PDFDocument, StandardFonts } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { join } from 'path'
import { getFromMinio, uploadToMinio } from '@/lib/minio'

export class SmartDocumentGenerator {
  private pendingSignatures: any[] = []
  
  // Helper function to clean text for WinAnsi encoding
  private cleanTextForPDF(text: string): string {
    if (!text) return ''
    
    // Map of Unicode characters to ASCII equivalents
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
    
    return text.replace(/[ăâîșşțţàáäèéëìíïòóöùúüñçĂÂÎȘŞȚŢÀÁÄÈÉËÌÍÏÒÓÖÙÚÜÑÇ]/g, 
      char => charMap[char] || char)
  }
  
  async generateDocument(leaveRequestId: string, templateId: string): Promise<string> {
    console.log('Starting smart document generation:', { leaveRequestId, templateId })
    try {
      // Get the leave request with all related data
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        include: {
          user: {
            include: {
              manager: true
            }
          },
          leaveType: true,
          substitute: true,
          substitutes: {
            include: {
              user: true
            }
          },
          generatedDocument: {
            include: {
              signatures: {
                include: {
                  signer: true
                }
              }
            }
          },
          approvals: {
            include: {
              approver: true
            }
          }
        }
      })

      if (!leaveRequest) {
        throw new Error('Leave request not found')
      }

      // Get the template with field mappings
      const template = await prisma.documentTemplate.findUnique({
        where: { id: templateId },
        include: {
          fieldMappings: true,
          signaturePlacements: true
        }
      })

      if (!template) {
        throw new Error('Template not found')
      }

      // Load the PDF template from Minio or filesystem
      let templateBytes: Buffer
      
      if (template.fileUrl.startsWith('minio://')) {
        // Load from Minio
        const objectPath = template.fileUrl.replace('minio://leave-management-uat/', '')
        templateBytes = await getFromMinio(objectPath, 'leave-management-uat')
      } else {
        // Legacy filesystem storage
        const templatePath = join(process.cwd(), 'public', template.fileUrl)
        const fs = await import('fs')
        templateBytes = fs.readFileSync(templatePath)
      }
      
      const pdfDoc = await PDFDocument.load(templateBytes)

      // Embed a font that supports Unicode characters
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

      // Get the form from the PDF
      const form = pdfDoc.getForm()
      const formFields = form.getFields()
      
      // Validate that the PDF has form fields
      if (formFields.length === 0) {
        throw new Error('Template PDF does not contain any form fields. Please upload a PDF with form fields.')
      }
      
      console.log(`Found ${formFields.length} form fields in template`)
      
      // Prepare data for field replacement
      const fieldData = this.prepareFieldData(leaveRequest)
      console.log('Prepared field data:', JSON.stringify(fieldData, null, 2))
      console.log('Substitute data:', {
        substitute: fieldData.substitute,
        substitutes: fieldData.substitutes
      })
      console.log('Decision data:', fieldData.decision)
      console.log('Signature data:', fieldData.signature)

      // Fill form fields based on mappings
      console.log(`Processing ${template.fieldMappings.length} field mappings`)
      console.log('Available field data keys:', Object.keys(fieldData))
      console.log('Decision data:', JSON.stringify(fieldData.decision, null, 2))
      console.log('Substitutes data:', {
        substitutes: fieldData.substitutes,
        substitute: fieldData.substitute,
        rawSubstitutes: leaveRequest.substitutes,
        rawSubstitute: leaveRequest.substitute
      })
      for (const mapping of template.fieldMappings) {
        try {
          // Get the PDF form field name from documentPosition
          const formFieldName = (mapping.documentPosition as any)?.formFieldName || mapping.fieldLabel
          const dataPath = mapping.fieldKey
          
          // Get the value from field data
          const value = this.getFieldValue(fieldData, dataPath)
          console.log(`Mapping ${formFieldName} <- ${dataPath}: "${value}"`)
          
          if (value) {
            // Check field type from mapping or detect from field key
            let fieldType = (mapping.documentPosition as any)?.type || 'text'
            if (!fieldType && mapping.fieldKey.includes('signature')) {
              fieldType = 'signature'
            }
            
            if (fieldType === 'checkbox') {
              try {
                const checkbox = form.getCheckBox(formFieldName)
                console.log(`Checkbox field ${formFieldName}: value="${value}", type=${typeof value}, truthy=${!!value}`)
                if (value === true || value === 'true' || value === '✓' || value === 'X') {
                  console.log(`  -> Checking checkbox`)
                  checkbox.check()
                } else {
                  console.log(`  -> Unchecking checkbox`)
                  checkbox.uncheck()
                }
              } catch (e) {
                console.warn(`Could not set checkbox ${formFieldName}:`, e)
              }
            } else {
              // Check if it's a signature field first
              if ((dataPath.includes('signature') || fieldType === 'signature') && value) {
                  console.log(`Processing signature field ${formFieldName} with value type: ${typeof value}, value length: ${value ? String(value).length : 0}, starts with data:image: ${value && typeof value === 'string' && value.startsWith('data:image')}`)
                  
                  // Check if it's an image data URL
                  if (value && typeof value === 'string' && value.startsWith('data:image')) {
                    // Store signature data for later processing after form is flattened
                    if (!this.pendingSignatures) {
                      this.pendingSignatures = []
                    }
                    this.pendingSignatures.push({
                      fieldName: formFieldName,
                      signatureData: value,
                      field: form.getField(formFieldName)
                    })
                  } else {
                    // Try to set as text (for text-based signatures like "APPROVED")
                    try {
                      const field = form.getField(formFieldName)
                      if (field && 'setText' in field) {
                        const cleanedText = this.cleanTextForPDF(String(value))
                        (field as any).setText(cleanedText)
                      }
                    } catch (sigError) {
                      console.warn(`Could not set signature text field ${formFieldName}:`, sigError)
                    }
                  }
                }
              } else {
                // Regular text field
                try {
                  const textField = form.getTextField(formFieldName)
                  const cleanedText = this.cleanTextForPDF(String(value))
                  textField.setText(cleanedText)
                } catch (e) {
                  console.warn(`Could not set text field ${formFieldName}:`, e)
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing field mapping ${mapping.fieldKey}:`, error)
        }
      }

      // Process signature images before flattening
      if (this.pendingSignatures && this.pendingSignatures.length > 0) {
        console.log(`Processing ${this.pendingSignatures.length} signature images`)
        const pages = pdfDoc.getPages()
        
        for (const sig of this.pendingSignatures) {
          try {
            // Get field widget annotations to find position
            const field = sig.field
            const widgets = field.acroField.getWidgets()
            
            if (widgets.length > 0) {
              const widget = widgets[0]
              const rect = widget.getRectangle()
              const pageIndex = pages.findIndex(page => {
                const pageRef = page.ref
                const widgetPageRef = widget.P()
                return pageRef === widgetPageRef
              })
              
              if (pageIndex >= 0 && sig.signatureData.startsWith('data:image')) {
                // Extract base64 data
                const base64Data = sig.signatureData.split(',')[1]
                const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
                
                // Embed image
                let image
                if (sig.signatureData.includes('image/png')) {
                  image = await pdfDoc.embedPng(imageBytes)
                } else if (sig.signatureData.includes('image/jpeg') || sig.signatureData.includes('image/jpg')) {
                  image = await pdfDoc.embedJpg(imageBytes)
                } else {
                  console.warn(`Unsupported image format for signature: ${sig.fieldName}`)
                  continue
                }
                
                // Draw image on page
                const page = pages[pageIndex]
                const { x, y, width, height } = rect
                
                // Scale image to fit
                const imgWidth = image.width
                const imgHeight = image.height
                const scale = Math.min(width / imgWidth, height / imgHeight) * 0.9 // 90% to leave some padding
                
                page.drawImage(image, {
                  x: x + (width - imgWidth * scale) / 2,
                  y: y + (height - imgHeight * scale) / 2,
                  width: imgWidth * scale,
                  height: imgHeight * scale,
                })
                
                // Clear the text field to remove base64 text
                try {
                  const textField = form.getTextField(sig.fieldName)
                  textField.setText('')
                } catch (e) {
                  // Field might not be a text field, ignore
                }
                
                console.log(`Drew signature image for field ${sig.fieldName}`)
              }
            }
          } catch (error) {
            console.error(`Error processing signature for field ${sig.fieldName}:`, error)
          }
        }
      }
      
      // Clear pending signatures
      this.pendingSignatures = []
      
      // Before saving, clean up text field appearances but keep signature fields
      const allFields = form.getFields()
      for (const field of allFields) {
        try {
          const fieldName = field.getName()
          
          // Only process text fields, not signature fields
          if (field.constructor.name === 'PDFTextField' && !fieldName.toLowerCase().includes('signature')) {
            const textField = field as any
            // Remove all visual decorations
            textField.setBackgroundColor(undefined)
            textField.setBorderColor(undefined)
            textField.setBorderWidth(0)
            // Update the appearance without decorations
            textField.updateAppearances(helveticaFont)
          }
        } catch (e) {
          console.warn(`Could not clean field appearance: ${e}`)
        }
      }
      
      // DON'T flatten - this would convert signatures to static images
      // Keep the form fields but with clean appearance

      // Store existing signatures before deleting
      const existingSignatures = leaveRequest.generatedDocument?.signatures || []
      
      // Delete any existing document for this leave request
      await prisma.generatedDocument.deleteMany({
        where: { leaveRequestId }
      })

      // Save the filled PDF
      const pdfBytes = await pdfDoc.save()
      // Save generated document to Minio
      const fileName = `leave-${leaveRequest.requestNumber}-${Date.now()}.pdf`
      const fileUrl = await uploadToMinio(
        Buffer.from(pdfBytes),
        `documents/${fileName}`,
        'application/pdf',
        'leave-management-uat'
      )

      // Determine initial status based on signature requirements
      const hasRequiredSignatures = template.signaturePlacements.some(s => s.isRequired)
      const initialStatus = hasRequiredSignatures ? 'PENDING_SIGNATURES' : 'COMPLETED'
      
      // Create database record
      const generatedDoc = await prisma.generatedDocument.create({
        data: {
          templateId,
          leaveRequestId,
          fileUrl: fileUrl,
          status: initialStatus,
          templateSnapshot: {
            templateId: template.id,
            templateName: template.name,
            fieldMappingsCount: template.fieldMappings.length,
            signaturePlacementsCount: template.signaturePlacements.length,
            formFieldBased: true // Indicate this used form fields
          },
          completedAt: hasRequiredSignatures ? null : new Date()
        }
      })
      
      // Restore existing signatures
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
        
        // No need to call updatePDFWithSignatures here - signatures are already included in the PDF generation above
        
        // Check if all required signatures are complete
        const requiredSignatures = template.signaturePlacements.filter(s => s.isRequired)
        const allSigned = requiredSignatures.every(req => 
          existingSignatures.some(sig => sig.signerRole === req.signerRole)
        )
        
        if (allSigned) {
          await prisma.generatedDocument.update({
            where: { id: generatedDoc.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date()
            }
          })
        }
      }

      return generatedDoc.id
    } catch (error) {
      console.error('Error generating document:', error)
      throw error
    }
  }

  private prepareSignatureData(leaveRequest: any) {
    const signatures: any = {
      employee: {
        name: `${leaveRequest.user.firstName || ''} ${leaveRequest.user.lastName || ''}`.trim(),
        date: '',
        signature: ''
      },
      manager: {
        name: '',
        date: '',
        signature: ''
      },
      director: {
        name: '',
        date: '',
        signature: ''
      },
      hr: {
        name: '',
        date: '',
        signature: ''
      },
      executive: {
        name: '',
        date: '',
        signature: ''
      }
    }

    // Check if document has signatures
    if (leaveRequest.generatedDocument?.signatures) {
      for (const sig of leaveRequest.generatedDocument.signatures) {
        const role = sig.signerRole.toLowerCase()
        if (signatures[role]) {
          // Get signer's full name
          let signerName = ''
          if (sig.signer) {
            signerName = `${sig.signer.firstName || ''} ${sig.signer.lastName || ''}`.trim()
          } else if (role === 'employee') {
            signerName = signatures.employee.name
          } else if (leaveRequest.approvals) {
            // Try to get from approvals
            const approval = leaveRequest.approvals.find((a: any) => 
              a.approver && a.status === 'APPROVED'
            )
            if (approval?.approver) {
              signerName = `${approval.approver.firstName || ''} ${approval.approver.lastName || ''}`.trim()
            }
          }

          signatures[role] = {
            name: signerName,
            date: sig.signedAt ? format(new Date(sig.signedAt), 'dd.MM.yyyy') : '',
            signature: sig.signatureData || 'SIGNED'
          }
        }
      }
    }

    // Also check approvals for signatures
    if (leaveRequest.approvals) {
      for (const approval of leaveRequest.approvals) {
        if (approval.status === 'APPROVED' && approval.approver) {
          const approverRole = approval.approver.role?.toLowerCase()
          let sigRole = 'manager' // default
          
          if (approverRole === 'executive') {
            sigRole = 'executive'
          } else if (approverRole === 'department_director') {
            sigRole = 'director'
          } else if (approverRole === 'hr') {
            sigRole = 'hr'
          }
          
          if (!signatures[sigRole].signature && approval.signature) {
            signatures[sigRole] = {
              name: `${approval.approver.firstName || ''} ${approval.approver.lastName || ''}`.trim(),
              date: approval.signedAt ? format(new Date(approval.signedAt), 'dd.MM.yyyy') : format(new Date(approval.approvedAt), 'dd.MM.yyyy'),
              signature: approval.signature || 'APPROVED'
            }
          }
        }
      }
    }

    // Create a flat structure that supports both direct access and sub-properties
    const flatSignatures: any = {}
    
    for (const role of ['employee', 'manager', 'director', 'hr', 'executive']) {
      // Direct signature field (for PDF signature fields) - use the actual signature data
      flatSignatures[role] = signatures[role].signature || ''
      // Sub-properties for name and date fields
      flatSignatures[`${role}.name`] = signatures[role].name || ''
      flatSignatures[`${role}.date`] = signatures[role].date || ''
    }

    return flatSignatures
  }

  private prepareFieldData(leaveRequest: any) {
    const startDate = new Date(leaveRequest.startDate)
    const endDate = new Date(leaveRequest.endDate)
    
    // Format individual dates or smart ranges
    let dateRange = ''
    
    // Try to get selectedDates from the new field or from supportingDocuments
    let selectedDates = leaveRequest.selectedDates || []
    if ((!selectedDates || selectedDates.length === 0) && leaveRequest.supportingDocuments) {
      const supportingDocs = typeof leaveRequest.supportingDocuments === 'string' 
        ? JSON.parse(leaveRequest.supportingDocuments) 
        : leaveRequest.supportingDocuments
      selectedDates = supportingDocs.selectedDates || []
    }
    
    console.log('Selected dates:', selectedDates)
    if (selectedDates && selectedDates.length > 0) {
      // Group consecutive dates
      const dates = selectedDates.map((d: string | Date) => new Date(d)).sort((a: Date, b: Date) => a.getTime() - b.getTime())
      const groups: string[] = []
      let currentGroup: Date[] = [dates[0]]
      
      for (let i = 1; i < dates.length; i++) {
        const prevDate = dates[i - 1]
        const currDate = dates[i]
        const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (dayDiff === 1) {
          // Consecutive day
          currentGroup.push(currDate)
        } else {
          // Gap found, close current group
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
      
      // Handle last group
      if (currentGroup.length === 1) {
        groups.push(format(currentGroup[0], 'dd.MM.yyyy'))
      } else if (currentGroup.length === 2) {
        groups.push(`${format(currentGroup[0], 'dd.MM.yyyy')}, ${format(currentGroup[1], 'dd.MM.yyyy')}`)
      } else {
        groups.push(`${format(currentGroup[0], 'dd.MM')}-${format(currentGroup[currentGroup.length - 1], 'dd.MM.yyyy')}`)
      }
      
      dateRange = groups.join(', ')
    } else {
      // Fallback to simple range
      dateRange = startDate.toDateString() === endDate.toDateString()
        ? format(startDate, 'dd.MM.yyyy')
        : `${format(startDate, 'dd.MM.yyyy')} - ${format(endDate, 'dd.MM.yyyy')}`
    }
    
    // Determine the actual approver based on requester's role
    let approverName = ''
    let approverEmail = ''
    
    if (leaveRequest.approvals && leaveRequest.approvals.length > 0) {
      const primaryApproval = leaveRequest.approvals.find((a: any) => a.level === 1)
      if (primaryApproval && primaryApproval.approver) {
        approverName = `${primaryApproval.approver.firstName} ${primaryApproval.approver.lastName}`
        approverEmail = primaryApproval.approver.email
      }
    }
    
    // Get signature data first
    const signatureData = this.prepareSignatureData(leaveRequest)
    
    // Process approvals to get decision data
    const decisions: any = {
      manager: { approved: '', rejected: '' },
      director: { approved: '', rejected: '' },
      hr: { approved: '', rejected: '' },
      executive: { approved: '', rejected: '' },
      comments: ''
    }
    
    // First, check signatures - if signed, it's approved!
    if (signatureData.manager.signature || signatureData.manager.date) {
      decisions.manager.approved = 'X'  // Put X for approved
      decisions.manager.rejected = ''   // Empty for not rejected
    }
    if (signatureData.director.signature || signatureData.director.date) {
      decisions.director.approved = 'X'
      decisions.director.rejected = ''
    }
    if (signatureData.hr.signature || signatureData.hr.date) {
      decisions.hr.approved = 'X'
      decisions.hr.rejected = ''
    }
    if (signatureData.executive.signature || signatureData.executive.date) {
      decisions.executive.approved = 'X'
      decisions.executive.rejected = ''
    }
    
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
          // For level 1 approvals, always treat as manager approval
          let decisionRole = 'manager' // default
          
          if (approval.level === 1) {
            // Level 1 is always manager approval
            decisionRole = 'manager'
          } else if (approval.approver) {
            const approverRole = approval.approver.role?.toLowerCase()
            if (approverRole === 'executive') {
              decisionRole = 'executive'
            } else if (approverRole === 'department_director') {
              decisionRole = 'director'
            } else if (approverRole === 'hr') {
              decisionRole = 'hr'
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
          
          // Collect all approval comments
          if (approval.comments) {
            if (decisions.comments) {
              decisions.comments += '\n' + approval.comments
            } else {
              decisions.comments = approval.comments
            }
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
        manager: approverName || (leaveRequest.user.manager?.firstName && leaveRequest.user.manager?.lastName 
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
        name: approverName || (leaveRequest.user.manager?.firstName && leaveRequest.user.manager?.lastName 
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
      decision: decisions,
      signature: signatureData
    }
  }

  private getSubstitutesString(leaveRequest: any): string {
    // Handle multiple substitutes
    if (leaveRequest.substitutes && leaveRequest.substitutes.length > 0) {
      console.log(`Found ${leaveRequest.substitutes.length} substitutes:`, 
        leaveRequest.substitutes.map((sub: any) => ({
          id: sub.id,
          userId: sub.userId,
          firstName: sub.user?.firstName,
          lastName: sub.user?.lastName
        }))
      )
      const names = leaveRequest.substitutes
        .map((sub: any) => `${sub.user.firstName || ''} ${sub.user.lastName || ''}`.trim())
        .filter((name: string) => name)
      console.log('Substitute names:', names)
      return names.join(', ')
    }
    // Fallback to single substitute for backward compatibility
    if (leaveRequest.substitute) {
      console.log('Using single substitute:', {
        id: leaveRequest.substitute.id,
        firstName: leaveRequest.substitute.firstName,
        lastName: leaveRequest.substitute.lastName
      })
      return `${leaveRequest.substitute.firstName || ''} ${leaveRequest.substitute.lastName || ''}`.trim()
    }
    console.log('No substitutes found')
    return ''
  }

  private getSubstitutesEmails(leaveRequest: any): string {
    // Handle multiple substitutes
    if (leaveRequest.substitutes && leaveRequest.substitutes.length > 0) {
      return leaveRequest.substitutes
        .map((sub: any) => sub.user.email)
        .filter((email: string) => email)
        .join(', ')
    }
    // Fallback to single substitute for backward compatibility
    return leaveRequest.substitute?.email || ''
  }

  private getFieldValue(data: any, fieldKey: string): string {
    const keys = fieldKey.split('.')
    let value = data
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        return ''
      }
    }
    
    if (Array.isArray(value)) {
      return value.map(item => 
        typeof item === 'object' && item.name ? item.name : String(item)
      ).join(', ')
    }
    
    if (value && typeof value === 'object' && value.name) {
      return value.name
    }
    
    return String(value || '')
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
          template: {
            include: {
              signaturePlacements: true
            }
          },
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
            data: {
              status: 'COMPLETED',
              completedAt: new Date()
            }
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
    // No need to regenerate here as signatures are already included in the generation process
    console.log('PDF signatures will be included in current generation:', documentId)
  }
}