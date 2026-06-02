import { minioClient, MINIO_BUCKET, getFromMinio } from './minio'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'
import archiver from 'archiver'
import { PassThrough } from 'stream'

// --- Types ---

interface ExportManifestEntry {
  minioKey: string
  localPath: string
  exportedAt: string
  size: number
  etag: string
}

export interface ExportManifest {
  lastSyncAt: string
  entries: Record<string, ExportManifestEntry>
}

export interface ExportFilterOptions {
  dateFrom?: string
  dateTo?: string
  status?: 'draft' | 'generated' | 'all'
  employee?: string
  leaveType?: string
}

export interface SyncResult {
  newFiles: number
  skippedFiles: number
  errors: string[]
  totalFiles: number
}

interface ParsedFilename {
  requestNumber: string
  date: string
  month: string
  employee: string
  leaveType: string
  status: string
}

export interface ExportStats {
  totalFiles: number
  totalSize: number
  lastSync: string | null
  byStatus: Record<string, number>
  byMonth: Record<string, number>
}

// --- Config ---

const EXPORT_PATH = process.env.DOCUMENT_EXPORT_PATH || '/app/document-exports'
const MANIFEST_FILE = 'export-manifest.json'
const CSV_FILE = 'manifest.csv'

// --- Helpers ---

function parseFilename(filename: string): ParsedFilename | null {
  // Handle: LR-2026-0042-2026-03-15-john.doe-concediu-odihna-draft.pdf
  // Also:  ELR-2026-0012-2026-02-24-lavinia.corban-concediu-odihna-generated.pdf
  const match = filename.match(
    /^((?:LR|ELR)-\d{4}-\d{4})-(\d{4}-\d{2}-\d{2})-(.+)-(draft|generated|final)\.pdf$/
  )
  if (!match) return null

  const [, requestNumber, date, middle, status] = match
  const month = date.substring(0, 7) // YYYY-MM

  // middle is "email.prefix-leave-type" — split at first segment that isn't part of the email
  // Email prefix format: firstname.lastname (contains dots, no hyphens)
  // So the first hyphen after the email prefix separates email from leave type
  const firstHyphen = middle.indexOf('-')
  if (firstHyphen === -1) {
    return { requestNumber, date, month, employee: middle, leaveType: '', status }
  }

  // Check if the part before the first hyphen looks like an email prefix (contains a dot)
  const beforeFirst = middle.substring(0, firstHyphen)
  if (beforeFirst.includes('.')) {
    // email.prefix is everything before the first hyphen
    return {
      requestNumber,
      date,
      month,
      employee: beforeFirst,
      leaveType: middle.substring(firstHyphen + 1),
      status,
    }
  }

  // Fallback: some names like "test-vba" don't have dots
  // Try to find the pattern: word-word or word.word followed by known leave types
  return {
    requestNumber,
    date,
    month,
    employee: beforeFirst,
    leaveType: middle.substring(firstHyphen + 1),
    status,
  }
}

function getLocalSubdirectory(minioKey: string): string {
  // documents/generated/LR-...-2026-03-15-...-generated.pdf → generated/2026-03/
  // documents/draft/LR-...-2026-02-17-...-draft.pdf → draft/2026-02/
  // templates/some-file.pdf → templates/
  if (minioKey.startsWith('templates/')) {
    return 'templates'
  }

  const filename = minioKey.split('/').pop() || ''
  const parsed = parseFilename(filename)

  if (minioKey.startsWith('documents/generated/')) {
    return `generated/${parsed?.month || 'unknown'}`
  }
  if (minioKey.startsWith('documents/draft/')) {
    return `draft/${parsed?.month || 'unknown'}`
  }

  return 'other'
}

// --- MinIO listing ---

interface MinioObjectInfo {
  name: string
  size: number
  etag: string
  lastModified: Date
}

function listMinioDocuments(prefix: string): Promise<MinioObjectInfo[]> {
  return new Promise((resolve, reject) => {
    const objects: MinioObjectInfo[] = []
    const stream = minioClient.listObjectsV2(MINIO_BUCKET, prefix, true)
    stream.on('data', (obj) => {
      if (obj.name) {
        objects.push({
          name: obj.name,
          size: obj.size,
          etag: obj.etag,
          lastModified: obj.lastModified,
        })
      }
    })
    stream.on('end', () => resolve(objects))
    stream.on('error', reject)
  })
}

// --- Manifest ---

export async function getExportManifest(): Promise<ExportManifest> {
  const manifestPath = path.join(EXPORT_PATH, MANIFEST_FILE)
  try {
    const data = await fs.readFile(manifestPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return { lastSyncAt: '', entries: {} }
  }
}

async function saveExportManifest(manifest: ExportManifest): Promise<void> {
  const manifestPath = path.join(EXPORT_PATH, MANIFEST_FILE)
  const tmpPath = manifestPath + '.tmp'
  await fs.writeFile(tmpPath, JSON.stringify(manifest, null, 2), 'utf-8')
  await fs.rename(tmpPath, manifestPath)
}

// --- CSV manifest ---

function generateManifestCsv(manifest: ExportManifest): string {
  const headers = 'Filename,Request Number,Date,Employee,Leave Type,Status,Size (KB)'
  const rows = Object.values(manifest.entries).map((entry) => {
    const filename = entry.minioKey.split('/').pop() || ''
    const parsed = parseFilename(filename)
    const sizeKB = Math.round(entry.size / 1024)
    if (parsed) {
      return [
        filename,
        parsed.requestNumber,
        parsed.date,
        parsed.employee,
        parsed.leaveType,
        parsed.status,
        sizeKB,
      ].join(',')
    }
    // Template or unparseable file
    return [filename, '', '', '', '', '', sizeKB].join(',')
  })
  return [headers, ...rows].join('\n')
}

// --- Core sync ---

let isSyncing = false

export async function syncDocumentsToLocal(): Promise<SyncResult> {
  if (isSyncing) {
    return { newFiles: 0, skippedFiles: 0, errors: ['Sync already in progress'], totalFiles: 0 }
  }
  isSyncing = true

  try {
    // Ensure base directory exists
    await fs.mkdir(EXPORT_PATH, { recursive: true })

    // List all objects from MinIO
    const [draftObjects, generatedObjects, templateObjects] = await Promise.all([
      listMinioDocuments('documents/draft/'),
      listMinioDocuments('documents/generated/'),
      listMinioDocuments('templates/'),
    ])
    const allObjects = [...draftObjects, ...generatedObjects, ...templateObjects]

    // Load current manifest
    const manifest = await getExportManifest()

    let newFiles = 0
    let skippedFiles = 0
    const errors: string[] = []

    for (const obj of allObjects) {
      const existingEntry = manifest.entries[obj.name]

      // Skip if already exported and etag hasn't changed
      if (existingEntry && existingEntry.etag === obj.etag) {
        skippedFiles++
        continue
      }

      try {
        // Determine local path
        const subdir = getLocalSubdirectory(obj.name)
        const filename = obj.name.split('/').pop() || obj.name
        const localDir = path.join(EXPORT_PATH, subdir)
        const localFilePath = path.join(localDir, filename)
        const relativePath = path.join(subdir, filename)

        // Create directory
        await fs.mkdir(localDir, { recursive: true })

        // Download from MinIO
        const buffer = await getFromMinio(obj.name)

        // Write to local filesystem
        await fs.writeFile(localFilePath, buffer)

        // Update manifest entry
        manifest.entries[obj.name] = {
          minioKey: obj.name,
          localPath: relativePath,
          exportedAt: new Date().toISOString(),
          size: obj.size,
          etag: obj.etag,
        }

        newFiles++
      } catch (err) {
        const msg = `Failed to export ${obj.name}: ${err instanceof Error ? err.message : String(err)}`
        console.error('[EXPORT]', msg)
        errors.push(msg)
      }
    }

    // Update manifest timestamp and save
    manifest.lastSyncAt = new Date().toISOString()
    await saveExportManifest(manifest)

    // Regenerate CSV manifest
    const csv = generateManifestCsv(manifest)
    await fs.writeFile(path.join(EXPORT_PATH, CSV_FILE), csv, 'utf-8')

    console.log(`[EXPORT] Sync complete: ${newFiles} new, ${skippedFiles} skipped, ${errors.length} errors`)

    return {
      newFiles,
      skippedFiles,
      errors,
      totalFiles: Object.keys(manifest.entries).length,
    }
  } finally {
    isSyncing = false
  }
}

// --- Stats ---

export async function getExportStats(): Promise<ExportStats> {
  const manifest = await getExportManifest()
  const entries = Object.values(manifest.entries)
  const leaveIndex = await getLeaveDateIndex()

  const byStatus: Record<string, number> = {}
  const byMonth: Record<string, number> = {}
  let totalSize = 0

  for (const entry of entries) {
    totalSize += entry.size
    const filename = entry.minioKey.split('/').pop() || ''
    const parsed = parseFilename(filename)

    if (parsed) {
      byStatus[parsed.status] = (byStatus[parsed.status] || 0) + 1
      // Group by the LEAVE month (what the request is about), falling back to the
      // filename month only when the request can't be matched.
      const leave = leaveIndex[parsed.requestNumber]
      const month = leave ? leave.start.slice(0, 7) : parsed.month
      byMonth[month] = (byMonth[month] || 0) + 1
    } else {
      // Templates or unparseable
      byStatus['template'] = (byStatus['template'] || 0) + 1
    }
  }

  return {
    totalFiles: entries.length,
    totalSize,
    lastSync: manifest.lastSyncAt || null,
    byStatus,
    byMonth,
  }
}

// --- Filtered ZIP ---

// Maps requestNumber (e.g. "LR-2026-0042") -> the leave PERIOD it is about.
// Dates are kept as 'YYYY-MM-DD' strings so they compare lexicographically and
// line up with the filter's dateFrom/dateTo (which are also 'YYYY-MM-DD').
type LeaveDateIndex = Record<string, { start: string; end: string }>

async function getLeaveDateIndex(): Promise<LeaveDateIndex> {
  const requests = await prisma.leaveRequest.findMany({
    select: { requestNumber: true, startDate: true, endDate: true },
  })
  const index: LeaveDateIndex = {}
  for (const r of requests) {
    if (!r.requestNumber) continue
    index[r.requestNumber] = {
      start: r.startDate.toISOString().slice(0, 10),
      end: r.endDate.toISOString().slice(0, 10),
    }
  }
  return index
}

function matchesFilter(
  entry: ExportManifestEntry,
  filters: ExportFilterOptions,
  leaveIndex: LeaveDateIndex
): boolean {
  const filename = entry.minioKey.split('/').pop() || ''
  const parsed = parseFilename(filename)

  if (!parsed) {
    // Templates: include only if status filter is 'all' or not set
    if (entry.minioKey.startsWith('templates/')) {
      return !filters.status || filters.status === 'all'
    }
    return false
  }

  if (filters.status && filters.status !== 'all' && parsed.status !== filters.status) {
    return false
  }
  // Date filter: match by the LEAVE PERIOD (what the request is about), not the
  // document's generation date embedded in the filename. A document is included
  // when its leave period overlaps the requested [dateFrom, dateTo] range.
  // Fall back to the filename date only when the request can't be found (orphan/draft).
  if (filters.dateFrom || filters.dateTo) {
    const leave = leaveIndex[parsed.requestNumber]
    const start = leave?.start ?? parsed.date
    const end = leave?.end ?? parsed.date
    if (filters.dateFrom && end < filters.dateFrom) {
      return false
    }
    if (filters.dateTo && start > filters.dateTo) {
      return false
    }
  }
  if (filters.employee && !parsed.employee.includes(filters.employee.toLowerCase())) {
    return false
  }
  if (filters.leaveType && !parsed.leaveType.includes(filters.leaveType.toLowerCase())) {
    return false
  }

  return true
}

export async function buildFilteredZip(filters: ExportFilterOptions): Promise<Buffer> {
  const manifest = await getExportManifest()
  const leaveIndex = await getLeaveDateIndex()
  const matchingEntries = Object.values(manifest.entries).filter((e) => matchesFilter(e, filters, leaveIndex))

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } })
    const chunks: Buffer[] = []
    const passthrough = new PassThrough()

    passthrough.on('data', (chunk: Buffer) => chunks.push(chunk))
    passthrough.on('end', () => resolve(Buffer.concat(chunks)))
    passthrough.on('error', reject)
    archive.on('error', reject)

    archive.pipe(passthrough)

    // Add matching files from local filesystem
    for (const entry of matchingEntries) {
      const localFilePath = path.join(EXPORT_PATH, entry.localPath)
      archive.file(localFilePath, { name: entry.localPath })
    }

    // Add a filtered manifest CSV
    const filteredManifest: ExportManifest = {
      lastSyncAt: manifest.lastSyncAt,
      entries: {},
    }
    for (const entry of matchingEntries) {
      filteredManifest.entries[entry.minioKey] = entry
    }
    const csv = generateManifestCsv(filteredManifest)
    archive.append(csv, { name: 'manifest.csv' })

    archive.finalize()
  })
}
