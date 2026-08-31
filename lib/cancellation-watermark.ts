import { prisma } from '@/lib/prisma'
import { getFromMinio, minioClient } from '@/lib/minio'
import { applyCancelledWatermarkToPdf } from '@/lib/pdf-watermark'

export type WatermarkOutcome =
  | 'stamped'
  | 'already-stamped'
  | 'no-document'
  | 'not-cancelled'
  | 'unsupported-storage'

// Marker stored inside GeneratedDocument.decisions (Json). When a document is
// regenerated, smart-document-generator deletes and recreates the row, so the
// marker is naturally cleared and the fresh PDF gets re-stamped by the sweep.
const MARKER_KEY = 'cancellationWatermarkAt'

/**
 * Overwrite the generated PDF of a CANCELLED leave request in MinIO with a
 * version carrying a big diagonal "ANULAT" watermark. Idempotent: a marker in
 * GeneratedDocument.decisions prevents double-stamping. The MinIO object is
 * rewritten in place (same key), so its etag changes and the document-export
 * sync re-downloads the refreshed file over the stale local copy.
 */
export async function watermarkCancelledLeaveDocument(
  leaveRequestId: string
): Promise<WatermarkOutcome> {
  const doc = await prisma.generatedDocument.findUnique({
    where: { leaveRequestId },
    select: {
      id: true,
      fileUrl: true,
      decisions: true,
      leaveRequest: { select: { status: true, requestNumber: true } },
    },
  })

  if (!doc) return 'no-document'
  if (doc.leaveRequest.status !== 'CANCELLED') return 'not-cancelled'

  const decisions = (doc.decisions as Record<string, unknown> | null) ?? {}
  if (decisions[MARKER_KEY]) return 'already-stamped'

  if (!doc.fileUrl.startsWith('minio://')) {
    // Legacy filesystem-stored documents are not part of the MinIO export
    return 'unsupported-storage'
  }

  const minioPath = doc.fileUrl.replace('minio://', '')
  const bucketName = minioPath.split('/')[0]
  const objectPath = minioPath.substring(bucketName.length + 1)

  const original = await getFromMinio(objectPath, bucketName)
  const stamped = await applyCancelledWatermarkToPdf(original)

  const stampedBuffer = Buffer.from(stamped)
  await minioClient.putObject(bucketName, objectPath, stampedBuffer, stampedBuffer.length, {
    'Content-Type': 'application/pdf',
  })

  await prisma.generatedDocument.update({
    where: { id: doc.id },
    data: {
      decisions: { ...decisions, [MARKER_KEY]: new Date().toISOString() },
    },
  })

  console.log(
    `[WATERMARK] Stamped ANULAT on ${doc.leaveRequest.requestNumber || leaveRequestId} (${objectPath})`
  )
  return 'stamped'
}

/**
 * Sweep: stamp every generated document belonging to a CANCELLED leave request
 * that hasn't been watermarked yet. Covers requests cancelled by cron jobs /
 * paths without a direct hook, and documents regenerated after cancellation.
 */
export async function watermarkAllCancelledLeaveDocuments(): Promise<{
  stamped: number
  errors: string[]
}> {
  const docs = await prisma.generatedDocument.findMany({
    where: { leaveRequest: { status: 'CANCELLED' } },
    select: { leaveRequestId: true, decisions: true },
  })

  let stamped = 0
  const errors: string[] = []

  for (const doc of docs) {
    const decisions = (doc.decisions as Record<string, unknown> | null) ?? {}
    if (decisions[MARKER_KEY]) continue
    try {
      const outcome = await watermarkCancelledLeaveDocument(doc.leaveRequestId)
      if (outcome === 'stamped') stamped++
    } catch (err) {
      errors.push(
        `Failed to watermark document for request ${doc.leaveRequestId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }

  return { stamped, errors }
}
