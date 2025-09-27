# How the Document System Works - Step by Step

## Overview Flow
```
Employee Request → Generate PDF → Manager Signs → HR Signs → Final Document
```

## Detailed Step-by-Step Process

### Step 1: HR Sets Up Document Template
```
HR Admin Dashboard
│
├─> Uploads leave form template (PDF or DOCX)
├─> Opens Template Designer
├─> Drags fields onto document:
│   ├─> Employee Name → drops at coordinates (100, 700)
│   ├─> Leave Dates → drops at coordinates (100, 650)
│   ├─> Department → drops at coordinates (100, 600)
│   └─> Leave Type → drops at coordinates (100, 550)
│
├─> Places signature boxes:
│   ├─> Employee Signature → bottom of page 1
│   ├─> Manager Signature → bottom of page 2
│   └─> HR Signature → bottom of page 2
│
└─> Saves template configuration to database
```

**What happens technically:**
```javascript
// Template configuration saved as:
{
  templateId: "leave-request-v1",
  fieldMappings: [
    { field: "employee.name", position: { x: 100, y: 700, page: 1 } },
    { field: "leave.startDate", position: { x: 100, y: 650, page: 1 } },
    // ... more fields
  ],
  signatures: [
    { role: "employee", position: { x: 100, y: 200, page: 1 } },
    { role: "manager", position: { x: 100, y: 100, page: 2 } },
    // ... more signatures
  ]
}
```

### Step 2: Employee Submits Leave Request

**What employee sees:**
1. Fills out leave request form (existing UI)
2. NEW: Signs with finger/mouse on signature pad
3. Clicks "Submit Request"

**What happens behind the scenes:**
```javascript
// 1. Capture signature as image
const signatureData = signaturePad.toDataURL('image/png');

// 2. Submit leave request
const leaveRequest = {
  employeeName: "John Doe",
  startDate: "2024-01-15",
  endDate: "2024-01-20",
  leaveType: "Annual Leave",
  reason: "Family vacation"
};

// 3. Generate PDF document
const response = await fetch('/api/documents/generate', {
  method: 'POST',
  body: JSON.stringify({
    templateId: 'leave-request-v1',
    data: leaveRequest,
    employeeSignature: signatureData
  })
});
```

### Step 3: System Generates PDF Document

**The magic happens here:**
```javascript
// Inside /api/documents/generate

// 1. Load the template PDF
const templatePDF = await PDFDocument.load(templateBytes);

// 2. Get field mappings from database
const mappings = await getTemplateMappings(templateId);

// 3. Fill in the data
mappings.forEach(mapping => {
  const value = getValueFromData(data, mapping.field);
  // Example: mapping.field = "employee.name" → value = "John Doe"
  
  templatePDF.drawText(value, {
    x: mapping.position.x,
    y: mapping.position.y,
    page: mapping.position.page
  });
});

// 4. Add employee signature
const signatureImage = await templatePDF.embedPng(employeeSignature);
templatePDF.drawImage(signatureImage, {
  x: 100,
  y: 200,
  width: 150,
  height: 50
});

// 5. Save the PDF
const generatedPDF = await templatePDF.save();
```

**Result:** A PDF with all employee data filled in and their signature

### Step 4: Manager Reviews and Signs

**Manager's view:**
```
Manager Dashboard
│
├─> Sees pending leave request
├─> Clicks to review
├─> NEW: PDF preview shows:
│   ├─> Employee's filled form
│   ├─> Employee's signature
│   └─> Empty signature box for manager
│
├─> Approves request
├─> Signs on signature pad
└─> System adds manager signature to PDF
```

**Technical process:**
```javascript
// Manager's signature is captured
const managerSignature = signaturePad.toDataURL();

// Add to existing PDF
const existingPDF = await PDFDocument.load(currentDocumentBytes);
const managerSigImage = await existingPDF.embedPng(managerSignature);

// Place at manager's signature location
existingPDF.drawImage(managerSigImage, {
  x: 100,
  y: 100,
  page: 2
});

// Add timestamp
existingPDF.drawText(`Approved by: ${managerName}`, { x: 100, y: 80 });
existingPDF.drawText(`Date: ${new Date().toLocaleString()}`, { x: 100, y: 60 });
```

### Step 5: HR Final Processing

**HR sees:**
```
HR Dashboard
│
├─> Reviews approved request
├─> Sees PDF with:
│   ├─> All employee data
│   ├─> Employee signature ✓
│   ├─> Manager signature ✓
│   └─> Empty HR signature box
│
├─> Verifies information
├─> Signs document
└─> Document is finalized
```

### Step 6: Final Document Distribution

**What happens:**
1. Final PDF has all three signatures
2. Document status → "completed"
3. System sends email to all parties with PDF attached
4. Document stored permanently in system

## Visual Example of Final Document

```
┌─────────────────────────────────────┐
│         LEAVE REQUEST FORM          │
│                                     │
│ Employee: John Doe                  │
│ Department: Engineering             │
│ Leave Type: Annual Leave            │
│ Start Date: 2024-01-15             │
│ End Date: 2024-01-20               │
│ Total Days: 6                       │
│                                     │
│ Reason: Family vacation             │
│                                     │
│ Employee Signature:                 │
│ ┌─────────────────┐                │
│ │ [John's Sign]   │                │
│ └─────────────────┘                │
│ Signed: 2024-01-10 09:30 AM        │
│                                     │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                     │
│ Manager Approval:                   │
│ ┌─────────────────┐                │
│ │ [Jane's Sign]   │                │
│ └─────────────────┘                │
│ Jane Smith - 2024-01-10 02:15 PM   │
│                                     │
│ HR Verification:                    │
│ ┌─────────────────┐                │
│ │ [Bob's Sign]    │                │
│ └─────────────────┘                │
│ Bob Johnson - 2024-01-10 04:30 PM  │
└─────────────────────────────────────┘
```

## Key Technical Components

### 1. PDF-LIB for Document Operations
```javascript
import { PDFDocument, rgb } from 'pdf-lib';

// Load existing PDF
const pdfDoc = await PDFDocument.load(existingPdfBytes);

// Add text
page.drawText('Employee: John Doe', { x: 50, y: 700 });

// Add image/signature
const image = await pdfDoc.embedPng(imageBytes);
page.drawImage(image, { x: 100, y: 200, width: 150, height: 50 });

// Save
const pdfBytes = await pdfDoc.save();
```

### 2. React Signature Canvas
```javascript
import SignatureCanvas from 'react-signature-canvas';

<SignatureCanvas 
  ref={sigPad}
  canvasProps={{
    width: 400,
    height: 150,
    className: 'signature-pad'
  }}
/>

// Get signature
const signature = sigPad.current.toDataURL('image/png');
```

### 3. Template Mapping Storage
```sql
-- Database stores where each field goes
template_field_mappings:
- field_key: "employee.name"
  position: { x: 100, y: 700, page: 1 }
  
-- Database stores where signatures go  
template_signatures:
- role: "manager"
  position: { x: 100, y: 100, page: 2 }
```

## Security & Compliance

1. **Audit Trail**: Every action is logged
   - Who signed when
   - IP address captured
   - Document version history

2. **Tamper Protection**: 
   - Documents are regenerated, not edited
   - Each version stored separately
   - Hash verification possible

3. **Legal Compliance**:
   - Meets e-signature requirements
   - Timestamp from server
   - Identity verification through login

## Benefits Over Traditional Process

| Traditional Paper | Your Digital System |
|-------------------|-------------------|
| Print form | Auto-generated PDF |
| Hand-carry for signatures | Sign from anywhere |
| Physical filing | Searchable database |
| Can be lost | Permanent storage |
| No audit trail | Complete history |
| Days to complete | Hours to complete |

## Cost Comparison

- **DocuSign**: $15-40/user/month
- **Adobe Sign**: $10-35/user/month  
- **Your System**: $0 (just hosting costs)

The entire system runs inside your Next.js app using free, open-source libraries!