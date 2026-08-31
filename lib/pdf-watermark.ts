import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { savePdfForPrint } from '@/lib/pdf-compat'

export const CANCELLED_WATERMARK_TEXT = 'ANULAT'

/**
 * Stamp a big diagonal "ANULAT" watermark across every page, Word-style:
 * corner-to-corner, semi-transparent red, drawn on top of the existing content
 * so it stays visible over filled form fields and signatures.
 *
 * Saved via savePdfForPrint() so the output keeps the classic flat xref table
 * print drivers require (see lib/pdf-compat.ts).
 */
export async function applyCancelledWatermarkToPdf(
  pdfBytes: Buffer | Uint8Array
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize()
    const angleRad = Math.atan2(height, width)
    const diagonal = Math.sqrt(width * width + height * height)

    // Size the text so it spans ~70% of the page diagonal
    const fontSize = (diagonal * 0.7) / font.widthOfTextAtSize(CANCELLED_WATERMARK_TEXT, 1)
    const textWidth = font.widthOfTextAtSize(CANCELLED_WATERMARK_TEXT, fontSize)
    const capHeight = fontSize * 0.7

    // drawText rotates around the baseline start point; position that point so
    // the rotated text block ends up centered on the page
    const x = width / 2 - (textWidth / 2) * Math.cos(angleRad) + (capHeight / 2) * Math.sin(angleRad)
    const y = height / 2 - (textWidth / 2) * Math.sin(angleRad) - (capHeight / 2) * Math.cos(angleRad)

    page.drawText(CANCELLED_WATERMARK_TEXT, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.8, 0.1, 0.1),
      opacity: 0.25,
      rotate: degrees((angleRad * 180) / Math.PI),
    })
  }

  return savePdfForPrint(pdfDoc)
}
