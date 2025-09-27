# Document Template Mapping Feature

## Overview

This feature allows HR administrators to create document templates with drag-and-drop field mapping, enabling dynamic document generation with employee data and signature placement throughout the approval workflow.

## Core Features

### 1. Template Designer (HR Admin)
- **Upload document templates** (PDF, DOCX)
- **Drag-and-drop field mapping** from leave request form to document
- **Signature placement** for multiple signatories
- **Preview mode** to test with sample data
- **Template versioning** for compliance

### 2. Field Mapping System
- **Available Fields**:
  - Employee details (name, ID, department, position)
  - Leave details (type, dates, duration, reason)
  - Manager information
  - HR representative details
  - Calculated fields (remaining balance, total days)
  - Custom fields

### 3. Signature Workflow
- **Employee signature** on initial request
- **Manager signature** on approval
- **HR signature** on final processing
- **Executive signature** for extended leaves
- **Timestamp and IP tracking** for audit trail

## Technical Architecture

### Frontend Components

```typescript
// Template Designer Component Structure
components/
├── template-designer/
│   ├── TemplateDesigner.tsx       // Main container
│   ├── DocumentCanvas.tsx         // PDF/Document viewer with overlay
│   ├── FieldPalette.tsx          // Draggable fields sidebar
│   ├── FieldMapper.tsx           // Individual field component
│   ├── SignaturePlacer.tsx      // Signature field component
│   └── TemplatePreview.tsx      // Preview with sample data

// Signature Components
├── signature/
│   ├── SignatureCapture.tsx     // Drawing pad
│   ├── SignatureField.tsx       // Placeholder in document
│   └── SignatureVerify.tsx      // Verification view
```

### Database Schema

```sql
-- Document Templates
CREATE TABLE document_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  file_url TEXT,
  file_type VARCHAR(50),
  category VARCHAR(100), -- leave_request, sick_leave, vacation, etc.
  version INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Field Mappings
CREATE TABLE template_field_mappings (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES document_templates(id),
  field_key VARCHAR(100), -- employee.name, leave.start_date, etc.
  document_position JSONB, -- {x: 100, y: 200, page: 1}
  field_style JSONB, -- {fontSize: 12, fontFamily: 'Arial', align: 'left'}
  is_required BOOLEAN DEFAULT true
);

-- Signature Placements
CREATE TABLE template_signatures (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES document_templates(id),
  signer_role VARCHAR(50), -- employee, manager, hr, executive
  document_position JSONB, -- {x: 150, y: 700, page: 2, width: 200, height: 80}
  label TEXT, -- "Employee Signature", "Manager Approval", etc.
  is_required BOOLEAN DEFAULT true,
  order_index INTEGER -- Signing order
);

-- Generated Documents
CREATE TABLE generated_documents (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES document_templates(id),
  leave_request_id UUID REFERENCES leave_requests(id),
  file_url TEXT,
  status VARCHAR(50), -- draft, pending_signatures, completed
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Document Signatures
CREATE TABLE document_signatures (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES generated_documents(id),
  signer_id UUID REFERENCES users(id),
  signer_role VARCHAR(50),
  signature_data TEXT, -- Base64 encoded signature image
  signed_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT
);
```

### API Endpoints

```typescript
// Template Management
POST   /api/templates/upload          // Upload new template
POST   /api/templates/:id/fields      // Save field mappings
POST   /api/templates/:id/signatures  // Save signature placements
GET    /api/templates/:id/preview     // Preview with sample data
POST   /api/templates/:id/activate    // Activate template version

// Document Generation
POST   /api/documents/generate        // Generate from template
GET    /api/documents/:id            // Get document details
POST   /api/documents/:id/sign       // Add signature
GET    /api/documents/:id/download   // Download completed document

// Field Management
GET    /api/fields/available         // Get all mappable fields
GET    /api/fields/categories        // Get field categories
```

## Implementation Plan

### Phase 1: Template Designer UI
```tsx
// Basic Template Designer Component
import { useDropzone } from 'react-dropzone';
import { PDF } from '@react-pdf/renderer';

const TemplateDesigner = () => {
  const [template, setTemplate] = useState(null);
  const [fields, setFields] = useState([]);
  const [signatures, setSignatures] = useState([]);

  // Drag and drop for fields
  const handleFieldDrop = (field, position) => {
    setFields([...fields, {
      fieldKey: field.key,
      position: position,
      id: generateId()
    }]);
  };

  // Signature placement
  const handleSignaturePlace = (role, position) => {
    setSignatures([...signatures, {
      role: role,
      position: position,
      id: generateId()
    }]);
  };

  return (
    <div className="template-designer">
      <FieldPalette onDragStart={...} />
      <DocumentCanvas 
        document={template}
        fields={fields}
        signatures={signatures}
        onFieldDrop={handleFieldDrop}
        onSignaturePlace={handleSignaturePlace}
      />
      <PropertiesPanel />
    </div>
  );
};
```

### Phase 2: Document Generation Engine
```typescript
// Document generation service
class DocumentGenerator {
  async generateFromTemplate(
    templateId: string, 
    leaveRequestData: LeaveRequest
  ): Promise<GeneratedDocument> {
    // 1. Load template and mappings
    const template = await getTemplate(templateId);
    const fieldMappings = await getFieldMappings(templateId);
    const signaturePlacements = await getSignaturePlacements(templateId);

    // 2. Load original document
    const originalDoc = await loadDocument(template.fileUrl);

    // 3. Apply field mappings
    const docWithFields = await applyFieldMappings(
      originalDoc, 
      fieldMappings, 
      leaveRequestData
    );

    // 4. Add signature placeholders
    const finalDoc = await addSignaturePlaceholders(
      docWithFields, 
      signaturePlacements
    );

    // 5. Save and return
    return await saveGeneratedDocument(finalDoc, leaveRequestData);
  }
}
```

### Phase 3: Signature Workflow Integration
```typescript
// Signature workflow in approval process
const handleManagerApproval = async (leaveRequestId: string) => {
  // 1. Generate document if not exists
  const document = await generateDocument(leaveRequestId);
  
  // 2. Show signature modal
  const signature = await captureSignature();
  
  // 3. Apply signature to document
  await applySignature(document.id, signature, 'manager');
  
  // 4. Check if all required signatures collected
  if (await allSignaturesCollected(document.id)) {
    await finalizeDocument(document.id);
  }
  
  // 5. Continue approval workflow
  await approveLeaveRequest(leaveRequestId);
};
```

## UI/UX Flow

### HR Admin Flow
1. **Upload Template**: HR uploads a leave form template (PDF/DOCX)
2. **Map Fields**: Drag available fields onto the document preview
3. **Place Signatures**: Add signature boxes for each approver
4. **Set Properties**: Configure fonts, sizes, and requirements
5. **Preview & Test**: Test with sample employee data
6. **Activate Template**: Make available for use

### Employee/Manager Flow
1. **Employee**: Fills leave request → Signs digitally → Submits
2. **System**: Generates document with employee data and signature
3. **Manager**: Reviews request → Opens document → Signs approval
4. **HR**: Final review → Signs document → Document completed
5. **All parties**: Receive final signed document via email

## Technologies Required

### Document Processing
- **PDF Generation**: @react-pdf/renderer or PDFKit
- **PDF Manipulation**: PDF-lib for adding fields/signatures
- **DOCX Support**: Docxtemplater or PizZip
- **Preview**: React-PDF or PDF.js

### Drag & Drop
- **React DnD**: For field mapping interface
- **React Beautiful DnD**: Alternative option
- **Custom canvas**: For precise positioning

### Signature Capture
- **React Signature Canvas**: For drawing signatures
- **Signature Pad**: Alternative library
- **Touch support**: For mobile/tablet signing

## Security Considerations

1. **Document Integrity**
   - Hash documents after each signature
   - Prevent tampering with signed documents
   - Audit trail for all modifications

2. **Signature Verification**
   - Store signature metadata (IP, timestamp, device)
   - Certificate-based signing for legal compliance
   - Biometric data protection

3. **Access Control**
   - Only HR can create/modify templates
   - Users can only sign their designated fields
   - Signed documents are immutable

## Compliance Features

1. **Audit Trail**
   - Track all template changes
   - Log all document generations
   - Record all signature events

2. **Legal Compliance**
   - Meet e-signature regulations (ESIGN, UETA)
   - Support for witness signatures if required
   - Timestamp server integration

3. **Data Retention**
   - Configurable retention policies
   - Automatic archival of old documents
   - Secure deletion procedures

## Example Implementation Timeline

- **Week 1-2**: Template designer UI with drag-drop
- **Week 3-4**: Document generation engine
- **Week 5**: Signature capture and placement
- **Week 6**: Workflow integration
- **Week 7**: Testing and refinement
- **Week 8**: Security and compliance features

This feature will transform your leave management system into a complete document workflow solution, eliminating paper forms while maintaining legal compliance and audit trails.