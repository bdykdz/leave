import { Client } from 'minio'

// Initialize Minio client
export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT?.split(':')[0] || 'localhost',
  port: parseInt(process.env.MINIO_ENDPOINT?.split(':')[1] || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
})

// Default bucket name
export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'leave-management'

// Ensure bucket exists
export async function ensureBucketExists(bucketName: string = MINIO_BUCKET) {
  try {
    const exists = await minioClient.bucketExists(bucketName)
    if (!exists) {
      await minioClient.makeBucket(bucketName, 'us-east-1')
      console.log(`Created Minio bucket: ${bucketName}`)
    }
    return true
  } catch (error) {
    console.error('Error ensuring bucket exists:', error)
    return false
  }
}

// Upload file to Minio with organized folder structure
export async function uploadToMinio(
  buffer: Buffer, 
  fileName: string, 
  contentType: string,
  bucketName: string = MINIO_BUCKET,
  folder: 'templates' | 'documents/generated' | 'documents/draft' | 'documents/supporting' = 'templates'
): Promise<string> {
  await ensureBucketExists(bucketName)
  
  const objectName = `${folder}/${fileName}`
  await minioClient.putObject(bucketName, objectName, buffer, buffer.length, {
    'Content-Type': contentType,
  })
  
  return `minio://${bucketName}/${objectName}`
}

// Generate descriptive filename for leave documents
export function generateLeaveDocumentName(
  requestNumber: string,
  employeeEmail: string,
  leaveType: string,
  status: 'draft' | 'final' = 'draft',
  extension: string = 'pdf'
): string {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const emailPrefix = employeeEmail.split('@')[0]
  // Convert to lowercase without using toLowerCase() method
  const leaveTypeStr = String(leaveType || '')
  let sanitizedLeaveType = ''
  for (let i = 0; i < leaveTypeStr.length; i++) {
    const char = leaveTypeStr[i]
    if (char === ' ') {
      sanitizedLeaveType += '-'
    } else if (char >= 'A' && char <= 'Z') {
      sanitizedLeaveType += String.fromCharCode(char.charCodeAt(0) + 32)
    } else {
      sanitizedLeaveType += char
    }
  }
  sanitizedLeaveType = sanitizedLeaveType.replace(/\s+/g, '-')
  
  return `${requestNumber}-${date}-${emailPrefix}-${sanitizedLeaveType}-${status}.${extension}`
}

// Generate descriptive filename for supporting documents
export function generateSupportingDocumentName(
  requestNumber: string,
  employeeEmail: string,
  originalFileName: string
): string {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const emailPrefix = employeeEmail.split('@')[0]
  const extension = originalFileName.split('.').pop() || 'pdf'
  // Convert to lowercase without using toLowerCase() method
  const baseNameStr = originalFileName.split('.').slice(0, -1).join('.')
  let baseName = ''
  for (let i = 0; i < baseNameStr.length; i++) {
    const char = baseNameStr[i]
    if (char === ' ') {
      baseName += '-'
    } else if (char >= 'A' && char <= 'Z') {
      baseName += String.fromCharCode(char.charCodeAt(0) + 32)
    } else {
      baseName += char
    }
  }
  baseName = baseName.replace(/\s+/g, '-')
  
  return `${requestNumber}-${date}-${emailPrefix}-${baseName}.${extension}`
}

// Get file from Minio
export async function getFromMinio(
  objectName: string,
  bucketName: string = MINIO_BUCKET
): Promise<Buffer> {
  const stream = await minioClient.getObject(bucketName, objectName)
  const chunks: Buffer[] = []
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

// Delete file from Minio
export async function deleteFromMinio(
  objectName: string,
  bucketName: string = MINIO_BUCKET
): Promise<void> {
  try {
    await minioClient.removeObject(bucketName, objectName)
    console.log(`Deleted file from Minio: ${objectName}`)
  } catch (error) {
    console.error(`Error deleting file from Minio: ${objectName}`, error)
    throw error
  }
}