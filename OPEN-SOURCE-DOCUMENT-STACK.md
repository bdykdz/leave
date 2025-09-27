# Open Source Document Template & Signature Stack

## Complete Open Source Solution - No Paid SDKs Required

### PDF Generation & Manipulation

#### 1. **PDF-LIB** (Pure JavaScript PDF manipulation)
```bash
npm install pdf-lib
```
- Create, modify, and fill PDF forms
- Add text, images, and drawings to existing PDFs
- No external dependencies
- Works in browser and Node.js

```typescript
import { PDFDocument, rgb } from 'pdf-lib';

// Add text to PDF at specific coordinates
const pdfDoc = await PDFDocument.load(existingPdfBytes);
const pages = pdfDoc.getPages();
const firstPage = pages[0];
firstPage.drawText('Employee Name: John Doe', {
  x: 50,
  y: 700,
  size: 12,
  color: rgb(0, 0, 0),
});

// Add signature image
const signatureImage = await pdfDoc.embedPng(signatureBytes);
firstPage.drawImage(signatureImage, {
  x: 100,
  y: 150,
  width: 200,
  height: 80,
});
```

#### 2. **React-PDF** (Generate PDFs from React components)
```bash
npm install @react-pdf/renderer
```
- Create PDFs using React components
- Full styling support
- No external services needed

```typescript
import { Document, Page, Text, View, PDFDownloadLink } from '@react-pdf/renderer';

const LeaveDocument = ({ data }) => (
  <Document>
    <Page size="A4">
      <View>
        <Text>Leave Request for {data.employeeName}</Text>
        <Text>From: {data.startDate} To: {data.endDate}</Text>
      </View>
    </Page>
  </Document>
);
```

### Signature Capture

#### 1. **React Signature Canvas** (Digital signature drawing)
```bash
npm install react-signature-canvas
```
- Touch-friendly signature capture
- Export as image (PNG/JPG/SVG)
- Completely free and open source

```typescript
import SignatureCanvas from 'react-signature-canvas';

const SignaturePad = () => {
  const sigCanvas = useRef(null);

  const save = () => {
    const dataURL = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    // Save this dataURL to your database
  };

  return (
    <SignatureCanvas 
      ref={sigCanvas}
      penColor='black'
      canvasProps={{width: 500, height: 200, className: 'border'}}
    />
  );
};
```

### Document Templates with DOCX

#### 1. **Docxtemplater** (Template DOCX files)
```bash
npm install docxtemplater pizzip
```
- Use Word documents as templates
- Simple {tag} replacement system
- Loops, conditions, and images supported

```typescript
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

// Load the docx file as binary content
const content = fs.readFileSync('template.docx', 'binary');
const zip = new PizZip(content);
const doc = new Docxtemplater(zip);

// Set the template variables
doc.setData({
  employee_name: 'John Doe',
  leave_type: 'Annual Leave',
  start_date: '2024-01-15',
  manager_name: 'Jane Smith'
});

// Generate document
doc.render();
const buf = doc.getZip().generate({ type: 'nodebuffer' });
```

### Document Viewing

#### 1. **React-PDF Viewer** (Display PDFs in browser)
```bash
npm install react-pdf
```
- PDF viewing without external services
- Page navigation, zoom, rotation
- Mobile friendly

```typescript
import { Document, Page } from 'react-pdf';

const PDFViewer = ({ url }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  return (
    <Document file={url} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
      <Page pageNumber={pageNumber} />
    </Document>
  );
};
```

### Drag & Drop Field Mapping

#### 1. **React DnD** (Drag and drop)
```bash
npm install react-dnd react-dnd-html5-backend
```
- Industry standard drag-drop library
- Touch support available
- Highly customizable

```typescript
import { useDrag, useDrop } from 'react-dnd';

const DraggableField = ({ field }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'field',
    item: { field },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1 }}>
      {field.label}
    </div>
  );
};
```

### Complete Implementation Example

```typescript
// services/documentGenerator.ts
import { PDFDocument, rgb } from 'pdf-lib';
import { createCanvas } from 'canvas';

export class OpenSourceDocumentGenerator {
  async generateFromTemplate(
    templatePath: string,
    fieldMappings: FieldMapping[],
    signatures: SignatureData[],
    formData: any
  ) {
    // 1. Load template PDF
    const existingPdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();

    // 2. Add form fields
    for (const mapping of fieldMappings) {
      const page = pages[mapping.position.page - 1];
      const value = this.getValueFromPath(formData, mapping.fieldKey);
      
      page.drawText(value || '', {
        x: mapping.position.x,
        y: mapping.position.y,
        size: mapping.style?.fontSize || 12,
        color: rgb(0, 0, 0),
      });
    }

    // 3. Add signatures
    for (const signature of signatures) {
      if (signature.imageData) {
        const page = pages[signature.position.page - 1];
        const signatureImage = await pdfDoc.embedPng(signature.imageData);
        
        page.drawImage(signatureImage, {
          x: signature.position.x,
          y: signature.position.y,
          width: signature.position.width,
          height: signature.position.height,
        });

        // Add signature metadata
        page.drawText(`Signed by: ${signature.signerName}`, {
          x: signature.position.x,
          y: signature.position.y - 20,
          size: 8,
          color: rgb(0.5, 0.5, 0.5),
        });
        
        page.drawText(`Date: ${signature.signedAt}`, {
          x: signature.position.x,
          y: signature.position.y - 30,
          size: 8,
          color: rgb(0.5, 0.5, 0.5),
        });
      }
    }

    // 4. Save the PDF
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  }

  private getValueFromPath(obj: any, path: string): string {
    return path.split('.').reduce((acc, part) => acc?.[part], obj) || '';
  }
}
```

### Database Storage (Open Source)

```typescript
// For storing templates and signatures
interface DocumentStorage {
  // Store template file
  async storeTemplate(file: Buffer): Promise<string> {
    // Option 1: Local file system
    const filename = `template_${Date.now()}.pdf`;
    await fs.writeFile(`./uploads/${filename}`, file);
    return `/uploads/${filename}`;

    // Option 2: MinIO (open source S3)
    // const result = await minioClient.putObject('templates', filename, file);
    // return result.url;
  }

  // Store signature as base64
  async storeSignature(signatureData: string): Promise<string> {
    // Save to PostgreSQL as text
    const result = await db.signatures.create({
      data: signatureData, // base64 string
      createdAt: new Date()
    });
    return result.id;
  }
}
```

### Security & Compliance (Open Source)

#### 1. **PDF Digital Signatures** (using node-signpdf)
```bash
npm install node-signpdf
```
- Add cryptographic signatures to PDFs
- X.509 certificate support
- Legally binding in many jurisdictions

```typescript
import { sign } from 'node-signpdf';

const signedPdf = sign(pdfBuffer, certificateBuffer, {
  reason: 'Leave Request Approval',
  location: 'HR Department',
  signerName: 'John Doe',
  annotationAppearanceOptions: {
    signatureCoordinates: { left: 100, bottom: 100, right: 300, top: 200 },
    signatureDetails: {
      signerName: 'John Doe',
      reason: 'Approved',
      location: 'Office',
      date: new Date(),
    },
  },
});
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

# Install dependencies for canvas (needed for PDF generation)
RUN apk add --no-cache \
    python3 \
    g++ \
    make \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Cost Comparison

| Feature | Paid SDK (DocuSign, Adobe) | Open Source Solution |
|---------|---------------------------|---------------------|
| PDF Generation | $99-999/month | FREE |
| Signature Capture | $15-40/user/month | FREE |
| Document Storage | $0.10/document | FREE (self-hosted) |
| API Calls | $0.10-0.50/call | FREE |
| Total Annual Cost | $5,000-50,000 | $0 (just hosting) |

### Implementation Timeline

1. **Week 1**: Set up PDF-lib for document generation
2. **Week 2**: Implement signature capture and storage
3. **Week 3**: Create template designer with drag-drop
4. **Week 4**: Integrate with leave workflow
5. **Week 5**: Add security features and testing

All of this can be done with **zero licensing costs** and **no vendor lock-in**. The only costs are your hosting infrastructure!