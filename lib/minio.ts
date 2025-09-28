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

// Upload file to Minio
export async function uploadToMinio(
  buffer: Buffer, 
  fileName: string, 
  contentType: string,
  bucketName: string = MINIO_BUCKET
): Promise<string> {
  await ensureBucketExists(bucketName)
  
  const objectName = `templates/${fileName}`
  await minioClient.putObject(bucketName, objectName, buffer, buffer.length, {
    'Content-Type': contentType,
  })
  
  return `minio://${bucketName}/${objectName}`
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