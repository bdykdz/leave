import React, { useState } from 'react';
import { Upload, FileText, User, Calendar, Hash, Type, Clock, Briefcase } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FieldMapping {
  id: string;
  fieldKey: string;
  label: string;
  position: { x: number; y: number; page: number };
  style?: { fontSize?: number; fontFamily?: string };
}

interface SignaturePlacement {
  id: string;
  role: string;
  label: string;
  position: { x: number; y: number; width: number; height: number; page: number };
}

const AVAILABLE_FIELDS = [
  { category: 'Employee', fields: [
    { key: 'employee.name', label: 'Employee Name', icon: User },
    { key: 'employee.id', label: 'Employee ID', icon: Hash },
    { key: 'employee.department', label: 'Department', icon: Briefcase },
    { key: 'employee.position', label: 'Position', icon: Briefcase },
  ]},
  { category: 'Leave Details', fields: [
    { key: 'leave.type', label: 'Leave Type', icon: Type },
    { key: 'leave.startDate', label: 'Start Date', icon: Calendar },
    { key: 'leave.endDate', label: 'End Date', icon: Calendar },
    { key: 'leave.duration', label: 'Duration', icon: Clock },
    { key: 'leave.reason', label: 'Reason', icon: FileText },
  ]},
  { category: 'Approval', fields: [
    { key: 'manager.name', label: 'Manager Name', icon: User },
    { key: 'hr.name', label: 'HR Representative', icon: User },
    { key: 'approval.date', label: 'Approval Date', icon: Calendar },
  ]},
];

const SIGNATURE_ROLES = [
  { role: 'employee', label: 'Employee Signature' },
  { role: 'manager', label: 'Manager Approval' },
  { role: 'hr', label: 'HR Verification' },
  { role: 'executive', label: 'Executive Approval' },
];

export function TemplateDesigner() {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [signaturePlacements, setSignaturePlacements] = useState<SignaturePlacement[]>([]);
  const [isDragging, setIsDragging] = useState<string | null>(null);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      setTemplateFile(file);
    }
  };

  const handleFieldDragStart = (fieldKey: string) => {
    setIsDragging(fieldKey);
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging.startsWith('signature.')) {
      const role = isDragging.replace('signature.', '');
      const signatureRole = SIGNATURE_ROLES.find(s => s.role === role);
      if (signatureRole) {
        setSignaturePlacements([...signaturePlacements, {
          id: Date.now().toString(),
          role: role,
          label: signatureRole.label,
          position: { x, y, width: 200, height: 80, page: 1 }
        }]);
      }
    } else {
      const field = AVAILABLE_FIELDS.flatMap(cat => cat.fields).find(f => f.key === isDragging);
      if (field) {
        setFieldMappings([...fieldMappings, {
          id: Date.now().toString(),
          fieldKey: field.key,
          label: field.label,
          position: { x, y, page: 1 }
        }]);
      }
    }
    setIsDragging(null);
  };

  return (
    <div className="h-full flex gap-4">
      {/* Left Sidebar - Field Palette */}
      <Card className="w-80 p-4">
        <Tabs defaultValue="fields" className="h-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="signatures">Signatures</TabsTrigger>
          </TabsList>
          
          <TabsContent value="fields" className="mt-4">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {AVAILABLE_FIELDS.map((category) => (
                <div key={category.category} className="mb-6">
                  <h3 className="font-semibold mb-2">{category.category}</h3>
                  <div className="space-y-2">
                    {category.fields.map((field) => (
                      <div
                        key={field.key}
                        draggable
                        onDragStart={() => handleFieldDragStart(field.key)}
                        className="flex items-center gap-2 p-2 bg-secondary rounded-md cursor-move hover:bg-secondary/80 transition-colors"
                      >
                        <field.icon className="h-4 w-4" />
                        <span className="text-sm">{field.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="signatures" className="mt-4">
            <div className="space-y-2">
              {SIGNATURE_ROLES.map((sig) => (
                <div
                  key={sig.role}
                  draggable
                  onDragStart={() => handleFieldDragStart(`signature.${sig.role}`)}
                  className="flex items-center gap-2 p-3 bg-primary/10 border-2 border-dashed border-primary/30 rounded-md cursor-move hover:bg-primary/20 transition-colors"
                >
                  <User className="h-4 w-4" />
                  <span className="text-sm font-medium">{sig.label}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Main Canvas - Document Preview */}
      <Card className="flex-1 p-6">
        {!templateFile ? (
          <div
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
            className="h-full border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center"
          >
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-2">Upload Document Template</p>
            <p className="text-sm text-gray-500 mb-4">Drag and drop a PDF or DOCX file here</p>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
          </div>
        ) : (
          <div 
            className="relative h-full bg-white border rounded-lg overflow-hidden"
            onDrop={handleCanvasDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {/* Document Preview */}
            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
              <div className="bg-white shadow-lg" style={{ width: '595px', height: '842px' }}>
                <div className="p-8">
                  <h2 className="text-xl font-bold mb-4">Leave Request Form</h2>
                  <div className="space-y-4 text-gray-400">
                    <p>Employee Information Section</p>
                    <p>Leave Details Section</p>
                    <p>Approval Section</p>
                  </div>
                </div>

                {/* Render placed fields */}
                {fieldMappings.map((field) => (
                  <div
                    key={field.id}
                    className="absolute bg-blue-100 border border-blue-300 px-2 py-1 rounded text-xs"
                    style={{ left: field.position.x, top: field.position.y }}
                  >
                    <Badge variant="secondary" className="text-xs">
                      {field.label}
                    </Badge>
                  </div>
                ))}

                {/* Render signature placements */}
                {signaturePlacements.map((sig) => (
                  <div
                    key={sig.id}
                    className="absolute bg-purple-100 border-2 border-dashed border-purple-300 rounded"
                    style={{
                      left: sig.position.x,
                      top: sig.position.y,
                      width: sig.position.width,
                      height: sig.position.height
                    }}
                  >
                    <div className="flex items-center justify-center h-full">
                      <span className="text-sm text-purple-600 font-medium">{sig.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drop Indicator */}
            {isDragging && (
              <div className="absolute inset-0 bg-blue-500/10 pointer-events-none flex items-center justify-center">
                <p className="text-lg font-medium text-blue-600">Drop field here</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Right Sidebar - Properties */}
      <Card className="w-64 p-4">
        <h3 className="font-semibold mb-4">Properties</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">Mapped Fields</p>
            <Badge variant="outline">{fieldMappings.length} fields</Badge>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Signatures</p>
            <Badge variant="outline">{signaturePlacements.length} signatures</Badge>
          </div>
          <Button className="w-full" variant="default">
            Save Template
          </Button>
          <Button className="w-full" variant="outline">
            Preview
          </Button>
        </div>
      </Card>
    </div>
  );
}