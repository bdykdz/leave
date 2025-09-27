// Example: How signature capture works in the leave request form

import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function SignatureExample() {
  const sigPad = useRef<SignatureCanvas>(null);
  const [preview, setPreview] = useState<string>('');

  const handleClear = () => {
    sigPad.current?.clear();
    setPreview('');
  };

  const handleSave = () => {
    if (sigPad.current) {
      // This is how we get the signature as an image
      const dataURL = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
      setPreview(dataURL);
      
      // In real implementation, this would be sent with the form
      console.log('Signature captured:', dataURL.substring(0, 50) + '...');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-2">Step 1: Employee Signs</h3>
        <div className="border-2 border-dashed rounded-lg p-2">
          <SignatureCanvas
            ref={sigPad}
            penColor="black"
            canvasProps={{
              width: 400,
              height: 150,
              className: 'border bg-white'
            }}
          />
        </div>
        <div className="flex gap-2 mt-2">
          <Button onClick={handleClear} variant="outline" size="sm">
            Clear
          </Button>
          <Button onClick={handleSave} size="sm">
            Save Signature
          </Button>
        </div>
      </Card>

      {preview && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-2">Step 2: Signature Captured</h3>
          <p className="text-sm text-muted-foreground mb-2">
            This image data is what gets embedded in the PDF:
          </p>
          <img 
            src={preview} 
            alt="Signature preview" 
            className="border bg-gray-50 p-2"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Data URL: {preview.substring(0, 50)}...
          </p>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-2">Step 3: How it goes into the PDF</h3>
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`// When generating the PDF:
const pdfDoc = await PDFDocument.load(templateBytes);
const page = pdfDoc.getPages()[0];

// Embed the signature image
const signatureImage = await pdfDoc.embedPng(signatureDataURL);

// Place it exactly where HR configured
page.drawImage(signatureImage, {
  x: 100,  // from template configuration
  y: 200,  // from template configuration  
  width: 150,
  height: 50
});

// Add timestamp
page.drawText('Signed: ' + new Date().toLocaleString(), {
  x: 100,
  y: 180,
  size: 8
});`}
        </pre>
      </Card>
    </div>
  );
}