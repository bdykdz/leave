# Integration Guide: Document System into Leave Management App

## Step 1: Install Dependencies

```bash
# Core document libraries
pnpm add pdf-lib react-signature-canvas docxtemplater pizzip
pnpm add react-pdf @react-pdf/renderer
pnpm add react-dnd react-dnd-html5-backend

# Development dependencies
pnpm add -D @types/react-signature-canvas
```

## Step 2: Update Your Existing Leave Request Flow

### Current Flow:
1. Employee fills leave request form
2. Manager approves/denies
3. HR processes

### New Integrated Flow:
1. Employee fills leave request form
2. **NEW: Employee signs digitally**
3. **NEW: System generates PDF with employee data**
4. Manager reviews and approves
5. **NEW: Manager signs the document**
6. HR processes
7. **NEW: HR signs and finalizes document**
8. **NEW: All parties receive signed PDF**

## Step 3: Integration Points in Your Existing Code

### A. Update Leave Request Form (`components/leave-request-form.tsx`)

```typescript
import SignatureCanvas from 'react-signature-canvas';
import { generateDocument } from '@/lib/document-generator';

export function LeaveRequestForm() {
  const sigPad = useRef<SignatureCanvas>(null);
  
  // Your existing form code...
  
  const onSubmit = async (data: LeaveRequestData) => {
    // Get signature
    const signature = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');
    
    // Your existing submit logic
    const leaveRequest = await createLeaveRequest(data);
    
    // NEW: Generate document with signature
    const document = await fetch('/api/documents/generate', {
      method: 'POST',
      body: JSON.stringify({
        templateId: 'leave-request-template',
        leaveRequestId: leaveRequest.id,
        data: {
          ...data,
          employeeSignature: signature
        }
      })
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Your existing form fields */}
      
      {/* NEW: Add signature pad before submit */}
      <div className="mt-6">
        <Label>Employee Signature</Label>
        <div className="border rounded-md p-2">
          <SignatureCanvas
            ref={sigPad}
            canvasProps={{
              className: 'signature-pad',
              width: 400,
              height: 150
            }}
          />
        </div>
        <Button 
          type="button" 
          variant="outline" 
          size="sm"
          onClick={() => sigPad.current?.clear()}
        >
          Clear Signature
        </Button>
      </div>
      
      <Button type="submit">Submit Request</Button>
    </form>
  );
}
```

### B. Add to Manager Approval (`components/approval-dialog.tsx`)

```typescript
export function ApprovalDialog({ request, onApprove, onDeny }) {
  const sigPad = useRef<SignatureCanvas>(null);
  
  const handleApprove = async () => {
    const signature = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');
    
    // Add signature to document
    await fetch('/api/documents/add-signature', {
      method: 'POST',
      body: JSON.stringify({
        documentId: request.documentId,
        signature: signature,
        role: 'manager'
      })
    });
    
    // Continue with existing approval
    onApprove();
  };

  return (
    <Dialog>
      {/* Existing approval UI */}
      
      {/* NEW: Show document preview */}
      <div className="mb-4">
        <PDFViewer documentId={request.documentId} />
      </div>
      
      {/* NEW: Manager signature */}
      <div className="mb-4">
        <Label>Manager Signature</Label>
        <SignatureCanvas ref={sigPad} />
      </div>
      
      <Button onClick={handleApprove}>Approve & Sign</Button>
    </Dialog>
  );
}
```

## Step 4: Create API Routes

### A. Document Generation (`app/api/documents/generate/route.ts`)

```typescript
import { PDFDocument, rgb } from 'pdf-lib';
import { getTemplate, getLeaveRequest } from '@/lib/db';

export async function POST(request: Request) {
  const { templateId, leaveRequestId, data } = await request.json();
  
  // Load template
  const template = await getTemplate(templateId);
  const templateBytes = await fetch(template.fileUrl).then(res => res.arrayBuffer());
  
  // Create PDF
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  
  // Add employee data
  firstPage.drawText(`Employee: ${data.employeeName}`, {
    x: 100,
    y: 700,
    size: 12
  });
  
  firstPage.drawText(`Leave Type: ${data.leaveType}`, {
    x: 100,
    y: 670,
    size: 12
  });
  
  firstPage.drawText(`Dates: ${data.startDate} to ${data.endDate}`, {
    x: 100,
    y: 640,
    size: 12
  });
  
  // Add employee signature
  if (data.employeeSignature) {
    const signatureImage = await pdfDoc.embedPng(data.employeeSignature);
    firstPage.drawImage(signatureImage, {
      x: 100,
      y: 200,
      width: 150,
      height: 50
    });
  }
  
  // Save PDF
  const pdfBytes = await pdfDoc.save();
  
  // Store in database/storage
  const documentUrl = await uploadToStorage(pdfBytes);
  const document = await createDocument({
    leaveRequestId,
    templateId,
    fileUrl: documentUrl,
    status: 'pending_signatures'
  });
  
  return Response.json({ documentId: document.id, url: documentUrl });
}
```

### B. Add Signature (`app/api/documents/add-signature/route.ts`)

```typescript
export async function POST(request: Request) {
  const { documentId, signature, role } = await request.json();
  
  // Load existing document
  const document = await getDocument(documentId);
  const pdfBytes = await fetch(document.fileUrl).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  // Add signature based on role
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  
  const positions = {
    manager: { x: 300, y: 200 },
    hr: { x: 100, y: 100 },
    executive: { x: 300, y: 100 }
  };
  
  const position = positions[role];
  const signatureImage = await pdfDoc.embedPng(signature);
  
  firstPage.drawImage(signatureImage, {
    x: position.x,
    y: position.y,
    width: 150,
    height: 50
  });
  
  // Add timestamp
  firstPage.drawText(`${role} signed: ${new Date().toLocaleString()}`, {
    x: position.x,
    y: position.y - 20,
    size: 8,
    color: rgb(0.5, 0.5, 0.5)
  });
  
  // Save updated PDF
  const updatedPdfBytes = await pdfDoc.save();
  const newUrl = await uploadToStorage(updatedPdfBytes);
  
  // Update document record
  await updateDocument(documentId, {
    fileUrl: newUrl,
    [`${role}SignedAt`]: new Date()
  });
  
  return Response.json({ success: true });
}
```

## Step 5: Add HR Template Designer

### Add to HR Dashboard (`app/hr/page.tsx`)

```typescript
import { TemplateDesigner } from '@/components/template-designer/TemplateDesigner';

export default function HRDashboard() {
  return (
    <Tabs>
      {/* Existing tabs */}
      
      <TabsContent value="templates">
        <Card>
          <CardHeader>
            <CardTitle>Document Templates</CardTitle>
            <CardDescription>
              Design and manage leave request document templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateDesigner />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
```

## Step 6: Update Database Schema

```typescript
// Add to your Prisma schema or database migrations
model DocumentTemplate {
  id          String   @id @default(cuid())
  name        String
  fileUrl     String
  category    String
  isActive    Boolean  @default(true)
  fieldMappings Json   // Store field positions
  signatures    Json   // Store signature positions
  createdAt   DateTime @default(now())
}

model GeneratedDocument {
  id              String   @id @default(cuid())
  leaveRequestId  String
  templateId      String
  fileUrl         String
  status          String   // pending_signatures, completed
  employeeSignedAt   DateTime?
  managerSignedAt    DateTime?
  hrSignedAt         DateTime?
  createdAt       DateTime @default(now())
}
```

## Step 7: Add Document Preview Component

```typescript
// components/document-preview.tsx
import { Document, Page } from 'react-pdf';

export function DocumentPreview({ documentId }) {
  const [url, setUrl] = useState('');
  
  useEffect(() => {
    fetch(`/api/documents/${documentId}`)
      .then(res => res.json())
      .then(data => setUrl(data.url));
  }, [documentId]);
  
  return (
    <div className="border rounded-lg p-4">
      <Document file={url}>
        <Page pageNumber={1} width={500} />
      </Document>
    </div>
  );
}
```

## Complete Integration Timeline

1. **Day 1-2**: Install dependencies and create basic document generation
2. **Day 3-4**: Add signature capture to existing forms
3. **Day 5-6**: Create API routes for document handling
4. **Day 7-8**: Integrate with approval workflow
5. **Day 9-10**: Add template designer for HR
6. **Day 11-12**: Testing and refinement

## Benefits of This Integration

1. **Seamless Experience**: Users never leave your app
2. **Automated Workflow**: Documents generated and signed within the approval process
3. **No External Services**: Everything runs in your Next.js app
4. **Cost Effective**: No per-document or per-signature fees
5. **Fully Customizable**: Complete control over the document format and workflow

The document system becomes a natural part of your leave management workflow, not a separate system!