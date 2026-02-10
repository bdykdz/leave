import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import { WorkflowEngine } from './workflow-engine';
import { getFromMinio, uploadToMinio, generateLeaveDocumentName } from '@/lib/minio';
import path from 'path';
const workflowEngine = new WorkflowEngine();

interface SignatureRequirement {
  role: string;
  required: boolean;
  signerId?: string;
  isSigned: boolean;
  signatureData?: string;
}

export class DocumentGenerator {
  /**
   * Generate a document from template for a leave request
   */
  async generateFromTemplate(leaveRequestId: string): Promise<string> {
    // Get leave request with all related data
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: {
        user: {
          include: {
            manager: true,
            departmentDirector: true,
          }
        },
        leaveType: true,
        substitute: true,
        approvals: {
          include: {
            approver: true,
          }
        },
      }
    });

    if (!leaveRequest) {
      throw new Error('Leave request not found');
    }

    // Find appropriate template
    const template = await prisma.documentTemplate.findFirst({
      where: {
        category: this.getTemplateCategory(leaveRequest.leaveType.code),
        isActive: true,
      },
      include: {
        fieldMappings: true,
        signaturePlacements: {
          orderBy: { orderIndex: 'asc' }
        },
      }
    });

    if (!template) {
      throw new Error('No active template found for this leave type');
    }

    // Check if document already exists
    let generatedDoc = await prisma.generatedDocument.findUnique({
      where: { leaveRequestId },
      include: { signatures: true }
    });

    // Determine workflow rule
    const workflowRule = await workflowEngine.determineWorkflowRule(leaveRequest);

    if (!generatedDoc) {
      // Create template snapshot
      const templateSnapshot = {
        template: {
          id: template.id,
          name: template.name,
          fileUrl: template.fileUrl,
          fileType: template.fileType,
          version: template.version,
        },
        fieldMappings: template.fieldMappings,
        signaturePlacements: template.signaturePlacements,
        workflowRule: workflowRule,
        generatedAt: new Date(),
      };

      // Create new document with snapshot
      generatedDoc = await prisma.generatedDocument.create({
        data: {
          templateId: template.id,
          leaveRequestId,
          fileUrl: '', // Will be updated after generation
          status: 'PENDING_SIGNATURES',
          templateSnapshot: templateSnapshot,
          decisions: [],
        },
        include: { signatures: true }
      });
    }

    // Determine required signatures based on user role and hierarchy
    const signatureRequirements = await this.determineSignatureRequirements(
      leaveRequest,
      template.signaturePlacements
    );

    // Generate PDF with current data and signatures
    const pdfPath = await this.generatePDF(
      template,
      leaveRequest,
      generatedDoc,
      signatureRequirements
    );

    // Update document with file path
    await prisma.generatedDocument.update({
      where: { id: generatedDoc.id },
      data: { fileUrl: pdfPath }
    });

    return generatedDoc.id;
  }

  /**
   * Determine which signatures are required based on user hierarchy
   */
  private async determineSignatureRequirements(
    leaveRequest: any,
    templateSignatures: any[]
  ): Promise<SignatureRequirement[]> {
    const requirements: SignatureRequirement[] = [];
    const user = leaveRequest.user;

    for (const templateSig of templateSignatures) {
      let requirement: SignatureRequirement = {
        role: templateSig.signerRole,
        required: templateSig.isRequired,
        isSigned: false,
      };

      switch (templateSig.signerRole) {
        case 'employee':
          requirement.signerId = user.id;
          requirement.required = true;
          break;

        case 'manager':
          // Special case: If user is EXECUTIVE, they might be their own manager
          if (user.role === 'EXECUTIVE') {
            // Check if they have a separate manager or they approve themselves
            if (user.managerId && user.managerId !== user.id) {
              requirement.signerId = user.managerId;
            } else {
              // Executive approves as their own manager
              requirement.signerId = user.id;
            }
          } else if (user.role === 'DEPARTMENT_DIRECTOR') {
            // Department directors need their manager if they have one
            requirement.signerId = user.managerId || null;
            requirement.required = !!user.managerId;
          } else {
            // Regular employees and managers need manager approval
            requirement.signerId = user.managerId;
            requirement.required = !!user.managerId;
          }
          break;

        case 'department_director':
          // Special case: If user is EXECUTIVE or DEPARTMENT_DIRECTOR
          if (user.role === 'EXECUTIVE') {
            // Executives might sign as their own department director
            if (user.departmentDirectorId && user.departmentDirectorId !== user.id) {
              requirement.signerId = user.departmentDirectorId;
            } else {
              // Executive signs as department director
              requirement.signerId = user.id;
            }
          } else if (user.role === 'DEPARTMENT_DIRECTOR') {
            // If they are the department director, they don't need to sign again
            // unless they have a higher department director
            if (user.departmentDirectorId && user.departmentDirectorId !== user.id) {
              requirement.signerId = user.departmentDirectorId;
            } else {
              requirement.required = false; // Already signing as manager
            }
          } else {
            // Regular employees need department director approval
            requirement.signerId = user.departmentDirectorId;
            requirement.required = !!user.departmentDirectorId;
          }
          break;

        case 'hr':
          // HR signature might be optional or required based on leave type
          requirement.required = templateSig.isRequired;
          // HR signatory will be determined when HR processes the request
          break;

        case 'executive':
          // Only required for specific leave types or durations
          requirement.required = false; // Will be determined by business rules
          break;
      }

      // Check if signature already exists
      const existingSignature = await prisma.documentSignature.findFirst({
        where: {
          documentId: leaveRequest.generatedDocument?.id,
          signerRole: templateSig.signerRole,
        }
      });

      if (existingSignature) {
        requirement.isSigned = true;
        requirement.signatureData = existingSignature.signatureData;
      }

      requirements.push(requirement);
    }

    return requirements;
  }

  /**
   * Generate PDF with filled data and signatures
   */
  private async generatePDF(
    template: any,
    leaveRequest: any,
    generatedDoc: any,
    signatureRequirements: SignatureRequirement[]
  ): Promise<string> {
    // Use template snapshot if regenerating
    const templateData = generatedDoc.templateSnapshot || template;
    const fieldMappings = templateData.fieldMappings || template.fieldMappings;
    const signaturePlacements = templateData.signaturePlacements || template.signaturePlacements;
    
    // Load the template PDF from Minio or filesystem
    let existingPdfBytes: Buffer
    
    if (template.fileUrl.startsWith('minio://')) {
      // Load from Minio
      const minioPath = template.fileUrl.replace('minio://', '')
      const bucketName = minioPath.split('/')[0]
      const objectPath = minioPath.substring(bucketName.length + 1)
      existingPdfBytes = await getFromMinio(objectPath, bucketName)
    } else {
      // Legacy filesystem storage
      const templatePath = path.join(process.cwd(), 'public', template.fileUrl);
      const fs = await import('fs/promises');
      existingPdfBytes = await fs.readFile(templatePath);
    }
    
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Embed font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Get pages
    const pages = pdfDoc.getPages();

    // Prepare data for field mapping including decisions
    const fieldData = await this.prepareFieldData(leaveRequest, generatedDoc);

    // Fill in field mappings
    for (const mapping of fieldMappings) {
      const position = mapping.documentPosition as any;
      const style = mapping.fieldStyle as any || {};
      
      if (position.page <= pages.length) {
        const page = pages[position.page - 1];
        
        // Check if this is a checkbox field
        if (mapping.fieldKey.includes('.approved') || mapping.fieldKey.includes('.rejected')) {
          const fieldValue = this.resolveFieldValue(mapping.fieldKey, fieldData);
          const isChecked = fieldValue === 'true';
          if (isChecked) {
            // Draw checkmark
            page.drawText('✓', {
              x: position.x,
              y: page.getHeight() - position.y - (position.height || 20),
              size: style.fontSize || 16,
              font: helveticaBoldFont,
              color: rgb(0, 0.5, 0),
            });
          }
        } else {
          // Regular text field
          const value = this.resolveFieldValue(mapping.fieldKey, fieldData);
          if (value) {
            page.drawText(value, {
              x: position.x,
              y: page.getHeight() - position.y - (position.height || 20),
              size: style.fontSize || 12,
              font: helveticaFont,
              color: rgb(0, 0, 0),
            });
          }
        }
      }
    }

    // Add signatures
    for (const sigPlacement of template.signaturePlacements) {
      const position = sigPlacement.documentPosition as any;
      const requirement = signatureRequirements.find(r => r.role === sigPlacement.signerRole);
      
      if (position.page <= pages.length && requirement) {
        const page = pages[position.page - 1];
        
        // Draw signature box
        const boxY = page.getHeight() - position.y - position.height;
        
        // Draw border
        page.drawRectangle({
          x: position.x,
          y: boxY,
          width: position.width,
          height: position.height,
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 1,
        });

        // Add label
        page.drawText(sigPlacement.label, {
          x: position.x + 5,
          y: boxY + position.height - 20,
          size: 10,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5),
        });

        // If signed, add signature image and details
        if (requirement.isSigned && requirement.signatureData) {
          try {
            // Convert base64 signature to image
            const signatureImage = await pdfDoc.embedPng(requirement.signatureData);
            const signatureDims = signatureImage.scale(0.5);
            
            page.drawImage(signatureImage, {
              x: position.x + 10,
              y: boxY + 10,
              width: Math.min(signatureDims.width, position.width - 20),
              height: Math.min(signatureDims.height, position.height - 40),
            });

            // Add signature date
            const signature = generatedDoc.signatures.find(
              (s: any) => s.signerRole === sigPlacement.signerRole
            );
            if (signature) {
              const signedDate = new Date(signature.signedAt).toLocaleDateString();
              page.drawText(`Signed: ${signedDate}`, {
                x: position.x + 5,
                y: boxY + 5,
                size: 8,
                font: helveticaFont,
                color: rgb(0.5, 0.5, 0.5),
              });
            }
          } catch (error) {
            console.error('Failed to embed signature image:', error);
          }
        } else if (!requirement.required) {
          // Mark as not required
          page.drawText('(Optional)', {
            x: position.x + position.width - 60,
            y: boxY + position.height - 20,
            size: 8,
            font: helveticaFont,
            color: rgb(0.7, 0.7, 0.7),
          });
        }
      }
    }

    // Save the PDF to Minio with descriptive filename
    const pdfBytes = await pdfDoc.save();
    const fileName = generateLeaveDocumentName(
      leaveRequest.requestNumber,
      leaveRequest.user.email,
      leaveRequest.leaveType.name,
      'draft' // Start as draft, will be moved to 'generated' when fully approved
    );
    
    // Upload generated document to Minio
    const fileUrl = await uploadToMinio(
      Buffer.from(pdfBytes), 
      fileName, 
      'application/pdf',
      undefined,
      'documents/draft'
    );

    return fileUrl;
  }

  /**
   * Prepare field data from leave request
   */
  private async prepareFieldData(leaveRequest: any, generatedDoc?: any): Promise<any> {
    const user = leaveRequest.user;
    const leave = leaveRequest;
    
    // Get actual leave balance from database
    const currentYear = new Date().getFullYear();
    let leaveBalance = null;
    try {
      leaveBalance = await prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId: leave.userId,
            leaveTypeId: leave.leaveTypeId,
            year: currentYear
          }
        }
      });
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    }
    
    // Calculate leave balance after approval
    const balance = {
      entitled: leaveBalance?.entitled || 0,
      used: leaveBalance?.used || 0,
      pending: leaveBalance?.pending || leave.totalDays,
      available: leaveBalance?.available || 0,
      afterApproval: (leaveBalance?.available || 0) - leave.totalDays,
    };

    // Prepare decision data
    const decisions = generatedDoc?.decisions || [];
    const decisionData: any = {
      manager: { approved: 'false', rejected: 'false' },
      director: { approved: 'false', rejected: 'false' },
      department_director: { approved: 'false', rejected: 'false' }, // Add full role name
      hr: { approved: 'false', rejected: 'false' },
      executive: { approved: 'false', rejected: 'false' },
      comments: '',
    };

    // Map decisions to checkboxes
    for (const decision of decisions) {
      if (decision.role === 'manager') {
        decisionData.manager.approved = decision.approved ? 'true' : 'false';
        decisionData.manager.rejected = !decision.approved ? 'true' : 'false';
      } else if (decision.role === 'department_director') {
        // Map to both for compatibility
        decisionData.director.approved = decision.approved ? 'true' : 'false';
        decisionData.director.rejected = !decision.approved ? 'true' : 'false';
        decisionData.department_director.approved = decision.approved ? 'true' : 'false';
        decisionData.department_director.rejected = !decision.approved ? 'true' : 'false';
      } else if (decision.role === 'hr') {
        decisionData.hr.approved = decision.approved ? 'true' : 'false';
        decisionData.hr.rejected = !decision.approved ? 'true' : 'false';
      } else if (decision.role === 'executive') {
        decisionData.executive.approved = decision.approved ? 'true' : 'false';
        decisionData.executive.rejected = !decision.approved ? 'true' : 'false';
      }
      
      if (decision.comments) {
        decisionData.comments += `${decision.role}: ${decision.comments}\n`;
      }
    }

    return {
      employee: {
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        employeeId: user.employeeId,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        department: user.department,
        position: user.position,
        joiningDate: new Date(user.joiningDate).toLocaleDateString(),
      },
      leave: {
        type: leave.leaveType.name,
        startDate: new Date(leave.startDate).toLocaleDateString(),
        endDate: new Date(leave.endDate).toLocaleDateString(),
        totalDays: leave.totalDays.toString(),
        reason: leave.reason,
        requestNumber: leave.requestNumber,
        status: leave.status,
        requestedDate: new Date(leave.createdAt).toLocaleDateString(),
      },
      substitute: leave.substitute ? {
        fullName: `${leave.substitute.firstName} ${leave.substitute.lastName}`,
        employeeId: leave.substitute.employeeId,
        department: leave.substitute.department,
        position: leave.substitute.position,
      } : {},
      manager: user.manager ? {
        fullName: `${user.manager.firstName} ${user.manager.lastName}`,
        employeeId: user.manager.employeeId,
        department: user.manager.department,
        position: user.manager.position,
        email: user.manager.email,
      } : {},
      balance,
      calculated: {
        currentDate: new Date().toLocaleDateString(),
        currentYear: new Date().getFullYear().toString(),
        workingDays: this.calculateWorkingDays(leave.startDate, leave.endDate),
        weekendDays: this.calculateWeekendDays(leave.startDate, leave.endDate),
      },
      decision: decisionData,
    };
  }

  /**
   * Resolve field value from data
   */
  private resolveFieldValue(fieldKey: string, data: any): string {
    const keys = fieldKey.split('.');
    let value = data;
    
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return '';
      }
    }
    
    return value?.toString() || '';
  }

  /**
   * Get template category based on leave type
   */
  private getTemplateCategory(leaveTypeCode: string): string {
    const categoryMap: Record<string, string> = {
      'ANNUAL': 'leave_request',
      'SICK': 'sick_leave',
      'VACATION': 'vacation',
      'REMOTE': 'remote_work',
    };
    
    return categoryMap[leaveTypeCode] || 'leave_request';
  }

  /**
   * Calculate working days between two dates
   */
  private calculateWorkingDays(startDate: Date, endDate: Date): string {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count.toString();
  }

  /**
   * Calculate weekend days between two dates
   */
  private calculateWeekendDays(startDate: Date, endDate: Date): string {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count.toString();
  }

  /**
   * Add signature to document with decision
   */
  async addSignature(
    documentId: string,
    signerId: string,
    signerRole: string,
    signatureData: string,
    approved: boolean = true,
    comments?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Check if signature already exists
    const existingSignature = await prisma.documentSignature.findFirst({
      where: {
        documentId,
        signerRole,
      }
    });

    if (existingSignature) {
      throw new Error('Signature already exists for this role');
    }

    // Add signature
    await prisma.documentSignature.create({
      data: {
        documentId,
        signerId,
        signerRole,
        signatureData,
        ipAddress,
        userAgent,
      }
    });

    // Record decision
    await workflowEngine.recordDecision(
      documentId,
      signerRole,
      approved,
      signerId,
      comments
    );

    // Check if all required signatures are collected
    const document = await prisma.generatedDocument.findUnique({
      where: { id: documentId },
      include: {
        template: {
          include: {
            signaturePlacements: true,
          }
        },
        signatures: true,
        leaveRequest: {
          include: {
            user: {
              include: {
                manager: true,
                departmentDirector: true,
              }
            }
          }
        }
      }
    });

    if (!document) return;

    // Always regenerate PDF after adding a signature to show it immediately
    await this.generateFromTemplate(document.leaveRequestId);
    
    // Check if all approvals are complete
    const allApproved = await workflowEngine.checkApprovalCompletion(documentId);
  }
}