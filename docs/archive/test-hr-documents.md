# HR Document Viewing Fix - Test Guide

## What Was Fixed

The HR document manager was showing direct MinIO URLs (e.g., `minio://leave-management-uat/...`) which are not accessible from the browser. This has been fixed by:

1. **Created secure API endpoints** for document viewing:
   - `/api/hr/documents/view/[documentId]` - For viewing generated PDF documents
   - `/api/hr/documents/supporting` - For viewing/downloading supporting documents

2. **Updated the HR DocumentFileManager component** to use these endpoints instead of direct MinIO URLs

3. **Added proper access controls** - Only HR and ADMIN roles can access these endpoints

## How It Works Now

### For Generated Documents:
- Click "View Generated" button → Opens PDF in new tab via our secure API
- The document is fetched from MinIO through our server and served to the browser

### For Supporting Documents:  
- **"View" button** (Eye icon) → Opens first document in new tab for viewing
- **"Download" button** → Downloads all supporting documents

## Testing Steps

1. **Login as HR user**
2. **Go to HR Dashboard → Document File Manager**
3. **Find a leave request with documents**
4. **Test viewing:**
   - Click "View Generated" for generated documents
   - Click "View" (eye icon) for supporting documents
   - Both should open in new tabs showing the actual PDF/image

## Security Features

- Documents are served through our API, not direct MinIO URLs
- Only HR and ADMIN users can access these endpoints
- Proper content-type headers for different file types
- Files are cached for better performance

## Technical Details

The API endpoints:
- Parse MinIO URLs (format: `minio://bucket/path`)
- Fetch files from MinIO using server credentials
- Stream files to browser with proper headers
- Support PDF, images, and other document types