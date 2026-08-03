import { PDFArray, PDFDocument, PDFName, PDFRef } from 'pdf-lib'

/**
 * pdf-lib's form.removeField()/form.flatten() delete widget annotation objects
 * but can leave each page's /Annots array still referencing them. The saved
 * file then has xref gaps for objects the document references; lenient viewers
 * rebuild the xref and render fine, but print drivers trust it and abort
 * ("Invalid XRef entry" in poppler). Removing the dangling refs makes the
 * saved xref consistent.
 *
 * Returns the number of dangling references removed.
 */
export function removeDanglingAnnotationRefs(pdfDoc: PDFDocument): number {
  let removed = 0
  for (const page of pdfDoc.getPages()) {
    const annots = page.node.lookup(PDFName.of('Annots'))
    if (!(annots instanceof PDFArray)) continue
    for (let i = annots.size() - 1; i >= 0; i--) {
      const ref = annots.get(i)
      if (ref instanceof PDFRef && !pdfDoc.context.lookup(ref)) {
        annots.remove(i)
        removed++
      }
    }
  }
  return removed
}

/**
 * Save a PDF for maximum printer/spooler compatibility: sweep dangling
 * annotation refs, then write a classic flat cross-reference table instead of
 * pdf-lib's default PDF 1.5 xref stream.
 */
export async function savePdfForPrint(pdfDoc: PDFDocument): Promise<Uint8Array> {
  removeDanglingAnnotationRefs(pdfDoc)
  return pdfDoc.save({ useObjectStreams: false })
}
