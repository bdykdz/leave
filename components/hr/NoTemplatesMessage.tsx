import Link from 'next/link'
import { FileText, Upload, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function NoTemplatesMessage() {
  return (
    <Card className="mt-8">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-gray-100 p-3">
              <FileText className="h-8 w-8 text-gray-600" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">No Document Templates Configured</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Before you can generate documents, you need to upload a PDF template with form fields.
            </p>
          </div>

          <Alert className="max-w-md mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              Templates must be PDFs with form fields. You can create form fields using Adobe Acrobat, 
              LibreOffice, or online PDF editors.
            </AlertDescription>
          </Alert>

          <div className="pt-4">
            <Link href="/hr/settings">
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload Template
              </Button>
            </Link>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Quick Start Guide:</h4>
            <ol className="text-left text-sm text-gray-600 max-w-sm mx-auto space-y-1">
              <li>1. Create a PDF with form fields for your leave request</li>
              <li>2. Name fields like: employee_name, department, leave_dates</li>
              <li>3. Upload the template in HR Settings</li>
              <li>4. Map PDF fields to system data fields</li>
              <li>5. Start generating documents!</li>
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}