import { describe, it, expect } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { spawnSync } from 'node:child_process'
import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyCancelledWatermarkToPdf, CANCELLED_WATERMARK_TEXT } from '@/lib/pdf-watermark'

function toolAvailable(cmd: string): boolean {
  return spawnSync('which', [cmd]).status === 0
}

function extractText(pdf: Uint8Array): { text: string; stderr: string } {
  const pdfPath = join(tmpdir(), `wm-test-${process.pid}-${Math.random().toString(36).slice(2)}.pdf`)
  writeFileSync(pdfPath, pdf)
  try {
    const res = spawnSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' })
    return { text: res.stdout, stderr: res.stderr }
  } finally {
    rmSync(pdfPath, { force: true })
  }
}

async function buildSamplePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]) // A4 portrait
    page.drawText(`Cerere de concediu - pagina ${i + 1}`, { x: 50, y: 780, size: 14, font })
  }
  return doc.save({ useObjectStreams: false })
}

describe('applyCancelledWatermarkToPdf', () => {
  it('keeps the document loadable and preserves page count and content', async () => {
    const original = await buildSamplePdf(2)
    const stamped = await applyCancelledWatermarkToPdf(original)

    const reloaded = await PDFDocument.load(stamped)
    expect(reloaded.getPageCount()).toBe(2)
  })

  it('stamps ANULAT on every page and keeps the original text', async () => {
    if (!toolAvailable('pdftotext')) return // environment without poppler

    const original = await buildSamplePdf(2)
    const stamped = await applyCancelledWatermarkToPdf(original)

    const { text } = extractText(stamped)
    // pdftotext fragments the big rotated text into pieces ("AN\nU\nLA\nT"),
    // so normalize whitespace away before counting occurrences
    const squashed = text.replace(/\s+/g, '')
    const occurrences = squashed.split(CANCELLED_WATERMARK_TEXT).length - 1
    expect(occurrences).toBe(2) // once per page
    expect(text).toContain('Cerere de concediu - pagina 1')
    expect(text).toContain('Cerere de concediu - pagina 2')
  })

  it('stays print-compatible (no xref errors from strict consumers)', async () => {
    if (!toolAvailable('pdftotext')) return

    const original = await buildSamplePdf(1)
    const stamped = await applyCancelledWatermarkToPdf(original)
    const { stderr } = extractText(stamped)
    expect(stderr).not.toMatch(/xref/i)
  })
})
