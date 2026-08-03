import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { removeDanglingAnnotationRefs, savePdfForPrint } from '@/lib/pdf-compat'

// Print drivers and spoolers trust the cross-reference table literally, while
// lenient viewers rebuild it by scanning the file. Two pdf-lib behaviors break
// strict consumers:
//   1. default save() emits a PDF 1.5 xref stream instead of a classic table
//   2. removeField()/flatten() delete widget objects but leave page /Annots
//      arrays referencing them, so the xref has gaps for referenced objects
// savePdfForPrint() (lib/pdf-compat.ts) fixes both; these tests pin that down.

function toolAvailable(cmd: string): boolean {
  return spawnSync('which', [cmd]).status === 0
}

/** Replicates the production path in smart-document-generator: load a template
 *  with fields, fill, remove signature fields, flatten. */
async function buildFilledDoc(): Promise<PDFDocument> {
  const template = await PDFDocument.create()
  const page = template.addPage([595, 842])
  const form = template.getForm()
  const nameField = form.createTextField('employee_name')
  nameField.addToPage(page, { x: 50, y: 700, width: 250, height: 20 })
  const sigField = form.createTextField('employee_signature')
  sigField.addToPage(page, { x: 50, y: 600, width: 250, height: 40 })
  const templateBytes = await template.save({ useObjectStreams: false })

  const doc = await PDFDocument.load(templateBytes)
  const docForm = doc.getForm()
  docForm.getTextField('employee_name').setText('Ion Popescu')
  docForm.removeField(docForm.getField('employee_signature'))
  docForm.flatten()
  return doc
}

function popplerErrors(pdf: Buffer): string {
  const pdfPath = join(tmpdir(), `xref-test-${process.pid}-${Math.random().toString(36).slice(2)}.pdf`)
  writeFileSync(pdfPath, pdf)
  try {
    const res = spawnSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' })
    return res.stderr
  } finally {
    rmSync(pdfPath, { force: true })
  }
}

describe('savePdfForPrint', () => {
  it('writes a classic flat xref table, not an xref stream', async () => {
    const pdf = Buffer.from(await savePdfForPrint(await buildFilledDoc()))
    expect(pdf.includes('/Type /XRef')).toBe(false)
    expect(pdf.includes('\nxref\n')).toBe(true)
    expect(pdf.includes('\ntrailer')).toBe(true)
  })

  it('removes the annotation refs left dangling by removeField/flatten', async () => {
    const doc = await buildFilledDoc()
    // both widgets (removed signature field + flattened text field) leak refs
    expect(removeDanglingAnnotationRefs(doc)).toBeGreaterThan(0)
    // sweep is idempotent
    expect(removeDanglingAnnotationRefs(doc)).toBe(0)
  })

  it('detector sanity check: default save() does emit an xref stream', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const streamed = Buffer.from(await doc.save())
    expect(streamed.includes('/Type /XRef')).toBe(true)
  })

  it('output passes external xref validation (qpdf / pdftotext)', async () => {
    const hasQpdf = toolAvailable('qpdf')
    const hasPdftotext = toolAvailable('pdftotext')
    if (!hasQpdf && !hasPdftotext) {
      console.warn('Skipping external PDF validation: neither qpdf nor pdftotext installed')
      return
    }

    const pdf = Buffer.from(await savePdfForPrint(await buildFilledDoc()))

    if (hasPdftotext) {
      expect(popplerErrors(pdf)).not.toMatch(/Invalid XRef|Syntax Error|Couldn't find trailer/i)
    }
    if (hasQpdf) {
      const pdfPath = join(tmpdir(), `xref-qpdf-${process.pid}.pdf`)
      writeFileSync(pdfPath, pdf)
      try {
        // qpdf --check exits non-zero and prints errors if the xref is inconsistent
        execFileSync('qpdf', ['--check', pdfPath], { encoding: 'utf8' })
      } finally {
        rmSync(pdfPath, { force: true })
      }
    }
  })

  it('regression proof: a plain save() of the same doc DOES fail strict validation', async () => {
    if (!toolAvailable('pdftotext')) return
    const doc = await buildFilledDoc()
    const broken = Buffer.from(await doc.save({ useObjectStreams: false }))
    expect(popplerErrors(broken)).toMatch(/Invalid XRef/i)
  })

  it('document generators save through savePdfForPrint, never pdfDoc.save directly', () => {
    const generators = [
      'lib/smart-document-generator.ts',
      'lib/services/document-generator.ts',
    ]
    for (const rel of generators) {
      const source = readFileSync(resolve(__dirname, '../..', rel), 'utf8')
      expect(source, `${rel} must use savePdfForPrint`).toContain('savePdfForPrint(pdfDoc)')
      expect(source, `${rel} must not call pdfDoc.save directly`).not.toMatch(/pdfDoc\.save\(/)
    }
  })
})
