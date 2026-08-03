/**
 * Audit and repair generated PDFs already stored in MinIO.
 *
 * Every PDF produced before the pdf-compat fix carries the same defect:
 *   1. saved with pdf-lib's default xref *stream* (strict consumers like print
 *      drivers reject it), and/or
 *   2. dangling page /Annots references to widget objects deleted by
 *      removeField()/flatten(), leaving xref gaps for referenced objects.
 *
 * This script scans documents/generated/ and documents/draft/ in the bucket,
 * detects both defects, and (with --fix) rewrites each broken file in place:
 * load with pdf-lib (lenient parser), sweep dangling annotation refs, re-save
 * with a classic flat xref table. Page content — including drawn signature
 * images — is untouched; only the xref/annots bookkeeping changes.
 *
 * Supporting documents (user uploads) are deliberately not touched.
 *
 * Usage:
 *   npx tsx scripts/repair-generated-pdfs.ts            # audit only (dry run)
 *   npx tsx scripts/repair-generated-pdfs.ts --fix      # repair in place
 *
 * Requires MINIO_ENDPOINT / MINIO_ACCESS_KEY / MINIO_SECRET_KEY / MINIO_BUCKET
 * in the environment (the MinIO container port must be reachable from where
 * this runs).
 */
import { PDFDocument } from 'pdf-lib'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { minioClient, MINIO_BUCKET, getFromMinio } from '../lib/minio'
import { removeDanglingAnnotationRefs } from '../lib/pdf-compat'

const shouldFix = process.argv.includes('--fix')
const PREFIXES = ['documents/generated/', 'documents/draft/']
const BACKUP_DIR = join(homedir(), 'leave-backups', `pdf-repair-originals-${new Date().toISOString().split('T')[0]}`)

const hasPdftotext = spawnSync('which', ['pdftotext']).status === 0

/** Strict validation via poppler; returns stderr ('' = clean, null = tool unavailable). */
function validateWithPoppler(pdf: Buffer): string | null {
  if (!hasPdftotext) return null
  const path = join(tmpdir(), `repair-validate-${process.pid}.pdf`)
  writeFileSync(path, pdf)
  try {
    const res = spawnSync('pdftotext', [path, '-'], { encoding: 'utf8' })
    return /Invalid XRef|Syntax Error|Couldn't find trailer/i.test(res.stderr) ? res.stderr : ''
  } finally {
    rmSync(path, { force: true })
  }
}

async function listPdfObjects(prefix: string): Promise<string[]> {
  const names: string[] = []
  const stream = minioClient.listObjectsV2(MINIO_BUCKET, prefix, true)
  return new Promise((resolve, reject) => {
    stream.on('data', obj => {
      if (obj.name && obj.name.endsWith('.pdf')) names.push(obj.name)
    })
    stream.on('end', () => resolve(names))
    stream.on('error', reject)
  })
}

async function main() {
  console.log(`=== ${shouldFix ? 'REPAIR' : 'AUDIT (dry run — pass --fix to repair)'} ===`)
  console.log(`Bucket: ${MINIO_BUCKET}`)
  if (shouldFix) console.log(`Originals backed up to: ${BACKUP_DIR}`)
  console.log()

  let total = 0
  let broken = 0
  let repaired = 0
  let failed = 0

  for (const prefix of PREFIXES) {
    const objects = await listPdfObjects(prefix)
    console.log(`${prefix} — ${objects.length} PDF(s)`)

    for (const objectName of objects) {
      total++
      try {
        const original = await getFromMinio(objectName)
        const usesXrefStream = original.includes('/Type /XRef')

        const doc = await PDFDocument.load(original, { ignoreEncryption: true })
        const danglingRefs = removeDanglingAnnotationRefs(doc)

        if (!usesXrefStream && danglingRefs === 0) continue

        broken++
        const defects = [
          usesXrefStream ? 'xref-stream' : null,
          danglingRefs > 0 ? `${danglingRefs} dangling annot ref(s)` : null,
        ].filter(Boolean).join(', ')
        console.log(`  BROKEN: ${objectName} [${defects}]`)

        if (shouldFix) {
          const repairedBytes = Buffer.from(await doc.save({ useObjectStreams: false }))

          // Refuse to overwrite unless the repaired file passes strict validation
          const popplerStderr = validateWithPoppler(repairedBytes)
          if (popplerStderr) {
            failed++
            console.error(`    -> SKIPPED: repaired output still fails validation:\n${popplerStderr}`)
            continue
          }
          // Sanity: repaired bytes must reload cleanly with no remaining dangling refs
          const recheck = await PDFDocument.load(repairedBytes)
          if (removeDanglingAnnotationRefs(recheck) > 0) {
            failed++
            console.error('    -> SKIPPED: repaired output still has dangling refs')
            continue
          }

          // Keep the original on disk before overwriting
          const backupPath = join(BACKUP_DIR, objectName)
          mkdirSync(dirname(backupPath), { recursive: true })
          writeFileSync(backupPath, original)

          await minioClient.putObject(MINIO_BUCKET, objectName, repairedBytes, repairedBytes.length, {
            'Content-Type': 'application/pdf',
          })
          repaired++
          console.log(`    -> repaired (${original.length} -> ${repairedBytes.length} bytes)`)
        }
      } catch (error) {
        failed++
        console.error(`  ERROR processing ${objectName}:`, error instanceof Error ? error.message : error)
      }
    }
  }

  console.log(`\nScanned: ${total}  Broken: ${broken}  Repaired: ${repaired}  Errors: ${failed}`)
  if (!shouldFix && broken > 0) {
    console.log('Re-run with --fix to repair the broken files in place.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
