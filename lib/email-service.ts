import { Resend } from 'resend'

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface LeaveRequestEmailData {
  employeeName: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason?: string
  managerName: string
  companyName: string
  requestId: string
}

export interface ApprovalEmailData {
  employeeName: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  approverName: string
  status: 'approved' | 'rejected'
  comments?: string
  companyName: string
  requestId: string
}

class EmailService {
  private resend: Resend | null = null

  constructor() {
    this.initializeResend()
  }

  private initializeResend() {
    try {
      if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not found in environment variables')
        return
      }

      this.resend = new Resend(process.env.RESEND_API_KEY)
      console.log('Email service initialized successfully with Resend')
    } catch (error) {
      console.error('Failed to initialize email service:', error)
    }
  }

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!this.resend) {
      console.error('Resend not initialized')
      return false
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      console.error('RESEND_FROM_EMAIL not configured')
      return false
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${process.env.COMPANY_NAME || 'Leave Management'} <${process.env.RESEND_FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
      })

      if (error) {
        console.error('Failed to send email:', error)
        return false
      }

      console.log('Email sent successfully:', data?.id)
      return true
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }

  generateLeaveRequestEmail(data: LeaveRequestEmailData): EmailTemplate {
    const subject = `Cerere nouă de concediu - ${data.employeeName}`
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 20px; }
        .details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { background-color: #6b7280; color: white; padding: 15px; text-align: center; font-size: 12px; }
        .button { display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .approve { background-color: #059669; }
        .reject { background-color: #dc2626; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Cerere Nouă de Concediu</h1>
        </div>
        
        <div class="content">
            <p>Bună ziua <strong>${data.managerName}</strong>,</p>
            
            <p>Aveți o cerere nouă de concediu care necesită aprobarea dvs.</p>
            
            <div class="details">
                <h3>Detalii Cerere:</h3>
                <ul>
                    <li><strong>Angajat:</strong> ${data.employeeName}</li>
                    <li><strong>Tip concediu:</strong> ${data.leaveType}</li>
                    <li><strong>Data început:</strong> ${data.startDate}</li>
                    <li><strong>Data sfârșit:</strong> ${data.endDate}</li>
                    <li><strong>Numărul de zile:</strong> ${data.days}</li>
                    ${data.reason ? `<li><strong>Motivul:</strong> ${data.reason}</li>` : ''}
                </ul>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
                <a href="${process.env.NEXTAUTH_URL}/manager" class="button approve">
                    Aprobă Cererea
                </a>
                <a href="${process.env.NEXTAUTH_URL}/manager" class="button reject">
                    Respinge Cererea
                </a>
            </div>
            
            <p>Vă rugăm să vă conectați la sistemul de management al concediilor pentru a revizui și aproba această cerere.</p>
        </div>
        
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${data.companyName}. Toate drepturile rezervate.</p>
            <p>Acesta este un email generat automat. Vă rugăm să nu răspundeți la acest mesaj.</p>
        </div>
    </div>
</body>
</html>
    `

    const text = `
Cerere Nouă de Concediu

Bună ziua ${data.managerName},

Aveți o cerere nouă de concediu care necesită aprobarea dvs.

Detalii Cerere:
- Angajat: ${data.employeeName}
- Tip concediu: ${data.leaveType}
- Data început: ${data.startDate}
- Data sfârșit: ${data.endDate}
- Numărul de zile: ${data.days}
${data.reason ? `- Motivul: ${data.reason}` : ''}

Vă rugăm să vă conectați la sistemul de management al concediilor pentru a revizui și aproba această cerere:
${process.env.NEXTAUTH_URL}/manager

© ${new Date().getFullYear()} ${data.companyName}. Toate drepturile rezervate.
    `

    return { subject, html, text }
  }

  generateApprovalEmail(data: ApprovalEmailData): EmailTemplate {
    const isApproved = data.status === 'approved'
    const subject = `Cererea de concediu ${isApproved ? 'aprobată' : 'respinsă'}`
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${isApproved ? '#059669' : '#dc2626'}; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 20px; }
        .details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { background-color: #6b7280; color: white; padding: 15px; text-align: center; font-size: 12px; }
        .status { padding: 10px; border-radius: 5px; text-align: center; margin: 15px 0; }
        .approved { background-color: #d1fae5; color: #065f46; border: 1px solid #059669; }
        .rejected { background-color: #fee2e2; color: #991b1b; border: 1px solid #dc2626; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Cererea de Concediu ${isApproved ? 'Aprobată' : 'Respinsă'}</h1>
        </div>
        
        <div class="content">
            <p>Bună ziua <strong>${data.employeeName}</strong>,</p>
            
            <div class="status ${isApproved ? 'approved' : 'rejected'}">
                <h3>Cererea dvs. de concediu a fost ${isApproved ? 'APROBATĂ' : 'RESPINSĂ'}</h3>
            </div>
            
            <div class="details">
                <h3>Detalii Cerere:</h3>
                <ul>
                    <li><strong>Tip concediu:</strong> ${data.leaveType}</li>
                    <li><strong>Data început:</strong> ${data.startDate}</li>
                    <li><strong>Data sfârșit:</strong> ${data.endDate}</li>
                    <li><strong>Numărul de zile:</strong> ${data.days}</li>
                    <li><strong>Aprobată/Respinsă de:</strong> ${data.approverName}</li>
                    ${data.comments ? `<li><strong>Comentarii:</strong> ${data.comments}</li>` : ''}
                </ul>
            </div>
            
            ${isApproved 
              ? '<p>Vă rugăm să planificați în consecință și să coordonați cu echipa dvs. pentru acoperirea responsabilităților pe perioada concediului.</p>'
              : '<p>Pentru detalii suplimentare despre motivul respingerii, vă rugăm să contactați managerul dvs. sau departamentul HR.</p>'
            }
            
            <p>Pentru a vedea toate cererile dvs. de concediu, vă rugăm să vă conectați la sistemul de management:</p>
            <p style="text-align: center;">
                <a href="${process.env.NEXTAUTH_URL}/employee" style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Vezi Cererile Mele
                </a>
            </p>
        </div>
        
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${data.companyName}. Toate drepturile rezervate.</p>
            <p>Acesta este un email generat automat. Vă rugăm să nu răspundeți la acest mesaj.</p>
        </div>
    </div>
</body>
</html>
    `

    const text = `
Cererea de Concediu ${isApproved ? 'Aprobată' : 'Respinsă'}

Bună ziua ${data.employeeName},

Cererea dvs. de concediu a fost ${isApproved ? 'APROBATĂ' : 'RESPINSĂ'}.

Detalii Cerere:
- Tip concediu: ${data.leaveType}
- Data început: ${data.startDate}
- Data sfârșit: ${data.endDate}
- Numărul de zile: ${data.days}
- Aprobată/Respinsă de: ${data.approverName}
${data.comments ? `- Comentarii: ${data.comments}` : ''}

${isApproved 
  ? 'Vă rugăm să planificați în consecință și să coordonați cu echipa dvs. pentru acoperirea responsabilităților pe perioada concediului.'
  : 'Pentru detalii suplimentare despre motivul respingerii, vă rugăm să contactați managerul dvs. sau departamentul HR.'
}

Pentru a vedea toate cererile dvs. de concediu, vă rugăm să vă conectați la sistemul de management:
${process.env.NEXTAUTH_URL}/employee

© ${new Date().getFullYear()} ${data.companyName}. Toate drepturile rezervate.
    `

    return { subject, html, text }
  }

  async sendLeaveRequestNotification(managerEmail: string, data: LeaveRequestEmailData): Promise<boolean> {
    const template = this.generateLeaveRequestEmail(data)
    return await this.sendEmail(managerEmail, template.subject, template.html, template.text)
  }

  async sendApprovalNotification(employeeEmail: string, data: ApprovalEmailData): Promise<boolean> {
    const template = this.generateApprovalEmail(data)
    return await this.sendEmail(employeeEmail, template.subject, template.html, template.text)
  }

  // WFH Email Methods
  generateWFHRequestEmail(data: {
    employeeName: string
    startDate: string
    endDate: string
    days: number
    location: string
    managerName: string
    requestId: string
  }): EmailTemplate {
    const subject = `New Work From Home Request - ${data.employeeName}`
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 20px; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .button { display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Work From Home Request</h2>
        </div>
        <div class="content">
            <p>Dear ${data.managerName},</p>
            <p><strong>${data.employeeName}</strong> has submitted a work from home request that requires your approval.</p>
            
            <div class="details">
                <h3>Request Details:</h3>
                <p><strong>Period:</strong> ${data.startDate} - ${data.endDate}</p>
                <p><strong>Total Days:</strong> ${data.days}</p>
                <p><strong>Location:</strong> ${data.location}</p>
                <p><strong>Request ID:</strong> ${data.requestId}</p>
            </div>
            
            <p>Please log in to the system to review and approve/reject this request.</p>
            
            <a href="${process.env.NEXTAUTH_URL}/manager" class="button">Review Request</a>
        </div>
        <div class="footer">
            <p>This is an automated message from the Leave Management System</p>
        </div>
    </div>
</body>
</html>`
    
    const text = `
Work From Home Request

Dear ${data.managerName},

${data.employeeName} has submitted a work from home request that requires your approval.

Request Details:
- Period: ${data.startDate} - ${data.endDate}
- Total Days: ${data.days}
- Location: ${data.location}
- Request ID: ${data.requestId}

Please log in to the system to review and approve/reject this request.

This is an automated message from the Leave Management System.
`
    
    return { subject, html, text }
  }

  generateWFHApprovalEmail(data: {
    employeeName: string
    startDate: string
    endDate: string
    days: number
    location: string
    approved: boolean
    managerName: string
    comments?: string
  }): EmailTemplate {
    const status = data.approved ? 'Approved' : 'Rejected'
    const subject = `Your Work From Home Request Has Been ${status}`
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${data.approved ? '#10b981' : '#ef4444'}; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 20px; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .status { font-weight: bold; color: ${data.approved ? '#10b981' : '#ef4444'}; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Work From Home Request ${status}</h2>
        </div>
        <div class="content">
            <p>Dear ${data.employeeName},</p>
            <p>Your work from home request has been <span class="status">${status.toLowerCase()}</span> by ${data.managerName}.</p>
            
            <div class="details">
                <h3>Request Details:</h3>
                <p><strong>Period:</strong> ${data.startDate} - ${data.endDate}</p>
                <p><strong>Total Days:</strong> ${data.days}</p>
                <p><strong>Location:</strong> ${data.location}</p>
                ${data.comments ? `<p><strong>Manager's Comments:</strong> ${data.comments}</p>` : ''}
            </div>
            
            ${data.approved ? 
              '<p>You are approved to work from the specified location during the requested period.</p>' :
              '<p>Please contact your manager if you need to discuss this decision.</p>'
            }
        </div>
        <div class="footer">
            <p>This is an automated message from the Leave Management System</p>
        </div>
    </div>
</body>
</html>`
    
    const text = `
Work From Home Request ${status}

Dear ${data.employeeName},

Your work from home request has been ${status.toLowerCase()} by ${data.managerName}.

Request Details:
- Period: ${data.startDate} - ${data.endDate}
- Total Days: ${data.days}
- Location: ${data.location}
${data.comments ? `- Manager's Comments: ${data.comments}` : ''}

${data.approved ? 
  'You are approved to work from the specified location during the requested period.' :
  'Please contact your manager if you need to discuss this decision.'
}

This is an automated message from the Leave Management System.
`
    
    return { subject, html, text }
  }

  async sendWFHRequestNotification(managerEmail: string, data: Parameters<EmailService['generateWFHRequestEmail']>[0]): Promise<boolean> {
    const template = this.generateWFHRequestEmail(data)
    return await this.sendEmail(managerEmail, template.subject, template.html, template.text)
  }

  async sendWFHApprovalNotification(employeeEmail: string, data: Parameters<EmailService['generateWFHApprovalEmail']>[0]): Promise<boolean> {
    const template = this.generateWFHApprovalEmail(data)
    return await this.sendEmail(employeeEmail, template.subject, template.html, template.text)
  }
}

export const emailService = new EmailService()