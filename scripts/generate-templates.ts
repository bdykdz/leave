/**
 * Generate 3 PDF document templates with AcroForm fields
 * for the leave management system. All text in Romanian.
 *
 * Run with: npx tsx scripts/generate-templates.ts
 *
 * Templates:
 *  1. Cerere de Concediu (General - works for any leave type)
 *  2. Cerere Concediu Special (Collective contract + provisional)
 *  3. Evidenta Concediu Medical (HR-only, for sick leave)
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const OUTPUT_DIR = join(process.cwd(), 'public', 'templates')
const LOGO_PATH = join(process.cwd(), 'public', 'logo.png')

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

// ─── Helpers ──────────────────────────────────────────────────────
function drawLabel(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 9) {
  page.drawText(text, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) })
}

function drawSectionHeader(page: PDFPage, text: string, x: number, y: number, font: PDFFont, width = 500) {
  page.drawRectangle({ x: x - 5, y: y - 4, width, height: 18, color: rgb(0.92, 0.92, 0.96) })
  page.drawText(text, { x, y, size: 11, font, color: rgb(0.15, 0.15, 0.35) })
}

function drawLine(page: PDFPage, x: number, y: number, width: number) {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  })
}

function addTextField(
  form: ReturnType<PDFDocument['getForm']>,
  name: string,
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  font: PDFFont,
  multiline = false,
) {
  const field = form.createTextField(name)
  field.addToPage(page, { x, y, width, height, borderWidth: 0.5, borderColor: rgb(0.6, 0.6, 0.6) })
  if (multiline) {
    field.enableMultiline()
  }
  field.setFontSize(9)
  field.updateAppearances(font)
  return field
}

function addCheckbox(
  form: ReturnType<PDFDocument['getForm']>,
  name: string,
  page: PDFPage,
  x: number,
  y: number,
  size = 12,
) {
  const checkbox = form.createCheckBox(name)
  checkbox.addToPage(page, { x, y, width: size, height: size, borderWidth: 0.5, borderColor: rgb(0.4, 0.4, 0.4) })
  return checkbox
}

async function embedLogo(pdfDoc: PDFDocument) {
  try {
    const logoBytes = readFileSync(LOGO_PATH)
    return await pdfDoc.embedPng(logoBytes)
  } catch {
    console.warn('⚠️  Logo not found at', LOGO_PATH, '— using text header instead')
    return null
  }
}

async function drawCompanyHeader(
  page: PDFPage,
  pdfDoc: PDFDocument,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  title: string,
) {
  const { width: pageWidth } = page.getSize()
  const centerX = pageWidth / 2

  const logo = await embedLogo(pdfDoc)
  if (logo) {
    const logoScale = 40 / logo.height
    const logoWidth = logo.width * logoScale
    page.drawImage(logo, { x: centerX - logoWidth / 2, y: 775, width: logoWidth, height: 40 })
  } else {
    const companyText = 'TPF INGINERIE'
    const companyWidth = fontBold.widthOfTextAtSize(companyText, 16)
    page.drawText(companyText, { x: centerX - companyWidth / 2, y: 785, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.3) })
  }

  page.drawLine({ start: { x: 50, y: 770 }, end: { x: pageWidth - 50, y: 770 }, thickness: 1.5, color: rgb(0.0, 0.36, 0.84) })
  page.drawLine({ start: { x: 50, y: 768 }, end: { x: pageWidth - 50, y: 768 }, thickness: 0.5, color: rgb(0.4, 0.6, 0.9) })

  const titleWidth = fontBold.widthOfTextAtSize(title, 13)
  page.drawText(title, { x: centerX - titleWidth / 2, y: 750, size: 13, font: fontBold, color: rgb(0.15, 0.15, 0.35) })
}

async function drawPage2Header(
  page: PDFPage,
  pdfDoc: PDFDocument,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  title: string,
) {
  const { width: pageWidth } = page.getSize()
  const centerX = pageWidth / 2

  const logo = await embedLogo(pdfDoc)
  if (logo) {
    const logoScale = 28 / logo.height
    const logoWidth = logo.width * logoScale
    page.drawImage(logo, { x: centerX - logoWidth / 2, y: 800, width: logoWidth, height: 28 })
  } else {
    const companyText = 'TPF INGINERIE'
    const companyWidth = fontBold.widthOfTextAtSize(companyText, 12)
    page.drawText(companyText, { x: centerX - companyWidth / 2, y: 806, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.3) })
  }

  page.drawLine({ start: { x: 50, y: 793 }, end: { x: pageWidth - 50, y: 793 }, thickness: 1.5, color: rgb(0.0, 0.36, 0.84) })
  page.drawLine({ start: { x: 50, y: 791 }, end: { x: pageWidth - 50, y: 791 }, thickness: 0.5, color: rgb(0.4, 0.6, 0.9) })

  const contText = `${title} — pag. 2 / 2`
  const contWidth = fontRegular.widthOfTextAtSize(contText, 8)
  page.drawText(contText, { x: centerX - contWidth / 2, y: 780, size: 8, font: fontRegular, color: rgb(0.55, 0.55, 0.55) })
}

/**
 * Draw a signature block (label, signature area, name, date) in a column.
 * Signature box is 45px tall with clear separation from name/date below.
 */
function drawSignatureBlock(
  page: PDFPage,
  form: ReturnType<PDFDocument['getForm']>,
  font: PDFFont,
  label: string,
  fieldPrefix: string, // e.g. 'signature.employee'
  x: number,
  y: number,
  width: number,
) {
  drawLabel(page, label, x, y, font, 8)
  // Signature image area (45px tall, with 4px gap below label)
  addTextField(form, `${fieldPrefix}.signature`, page, x, y - 50, width, 45, font)
  // Divider line
  drawLine(page, x, y - 53, width)
  // Name field (below divider)
  addTextField(form, `${fieldPrefix}.name`, page, x, y - 70, width, 14, font)
  // Date field
  addTextField(form, `${fieldPrefix}.date`, page, x, y - 88, Math.min(width, 120), 14, font)
  drawLabel(page, 'Nume / Data / Semnatura', x, y - 100, font, 7)
}

// ─── Template 1: Cerere de Concediu (General) ────────────────────
async function createGeneralLeaveTemplate() {
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const page = pdfDoc.addPage([595.28, 841.89]) // A4

  await drawCompanyHeader(page, pdfDoc, fontBold, fontRegular, 'CERERE DE CONCEDIU')
  const form = pdfDoc.getForm()

  let y = 732

  // ── Informatii cerere ──
  drawSectionHeader(page, 'INFORMATII CERERE', 55, y, fontBold)
  y -= 24
  drawLabel(page, 'Nr. cerere:', 55, y, fontRegular)
  addTextField(form, 'leave.requestNumber', page, 135, y - 4, 130, 18, fontRegular)
  drawLabel(page, 'Data:', 290, y, fontRegular)
  addTextField(form, 'leave.requestedDate', page, 325, y - 4, 130, 18, fontRegular)

  // ── Date angajat ──
  y -= 32
  drawSectionHeader(page, 'DATE ANGAJAT', 55, y, fontBold)
  y -= 24
  drawLabel(page, 'Nume complet:', 55, y, fontRegular)
  addTextField(form, 'employee.fullName', page, 150, y - 4, 170, 18, fontRegular)
  drawLabel(page, 'Nr. angajat:', 340, y, fontRegular)
  addTextField(form, 'employee.employeeId', page, 425, y - 4, 115, 18, fontRegular)

  y -= 24
  drawLabel(page, 'Departament:', 55, y, fontRegular)
  addTextField(form, 'employee.department', page, 150, y - 4, 170, 18, fontRegular)
  drawLabel(page, 'Functia:', 340, y, fontRegular)
  addTextField(form, 'employee.position', page, 425, y - 4, 115, 18, fontRegular)

  y -= 24
  drawLabel(page, 'Manager:', 55, y, fontRegular)
  addTextField(form, 'employee.manager', page, 150, y - 4, 170, 18, fontRegular)
  drawLabel(page, 'Data angajarii:', 340, y, fontRegular)
  addTextField(form, 'employee.joiningDate', page, 425, y - 4, 115, 18, fontRegular)

  // ── Detalii concediu ──
  y -= 32
  drawSectionHeader(page, 'DETALII CONCEDIU', 55, y, fontBold)
  y -= 24
  drawLabel(page, 'Tip concediu:', 55, y, fontRegular)
  addTextField(form, 'leave.type', page, 150, y - 4, 180, 18, fontRegular)

  y -= 24
  drawLabel(page, 'Data inceput:', 55, y, fontRegular)
  addTextField(form, 'leave.startDate', page, 150, y - 4, 120, 18, fontRegular)
  drawLabel(page, 'Data sfarsit:', 290, y, fontRegular)
  addTextField(form, 'leave.endDate', page, 375, y - 4, 120, 18, fontRegular)

  y -= 24
  drawLabel(page, 'Total zile:', 55, y, fontRegular)
  addTextField(form, 'leave.totalDays', page, 130, y - 4, 50, 18, fontRegular)
  drawLabel(page, 'Perioada:', 200, y, fontRegular)
  addTextField(form, 'leave.dates', page, 260, y - 4, 280, 18, fontRegular)

  y -= 28
  drawLabel(page, 'Motiv:', 55, y, fontRegular)
  y -= 10
  addTextField(form, 'leave.reason', page, 55, y - 34, 485, 34, fontRegular, true)

  // ── Sold concediu ──
  y -= 50
  drawSectionHeader(page, 'SOLD CONCEDIU', 55, y, fontBold)
  y -= 24
  drawLabel(page, 'Drept:', 55, y, fontRegular)
  addTextField(form, 'balance.entitled', page, 100, y - 4, 50, 18, fontRegular)
  drawLabel(page, 'Folosit:', 165, y, fontRegular)
  addTextField(form, 'balance.used', page, 210, y - 4, 50, 18, fontRegular)
  drawLabel(page, 'In asteptare:', 275, y, fontRegular)
  addTextField(form, 'balance.pending', page, 355, y - 4, 50, 18, fontRegular)
  drawLabel(page, 'Dupa aprobare:', 420, y, fontRegular)
  addTextField(form, 'balance.afterApproval', page, 505, y - 4, 35, 18, fontRegular)

  // ── Inlocuitor ──
  y -= 28
  drawLabel(page, 'Inlocuitor(i):', 55, y, fontRegular)
  addTextField(form, 'substitutes.fullName', page, 150, y - 4, 390, 18, fontRegular)

  // ── Decizii de aprobare ──
  y -= 32
  drawSectionHeader(page, 'DECIZII DE APROBARE', 55, y, fontBold)

  y -= 22
  drawLabel(page, 'Manager:', 55, y, fontRegular, 9)
  addCheckbox(form, 'decision.manager.approved', page, 120, y - 2)
  drawLabel(page, 'Aprobat', 136, y, fontRegular, 8)
  addCheckbox(form, 'decision.manager.rejected', page, 190, y - 2)
  drawLabel(page, 'Respins', 206, y, fontRegular, 8)
  drawLabel(page, 'Director:', 280, y, fontRegular, 9)
  addCheckbox(form, 'decision.director.approved', page, 330, y - 2)
  drawLabel(page, 'Aprobat', 346, y, fontRegular, 8)
  addCheckbox(form, 'decision.director.rejected', page, 400, y - 2)
  drawLabel(page, 'Respins', 416, y, fontRegular, 8)

  y -= 18
  drawLabel(page, 'HR:', 55, y, fontRegular, 9)
  addCheckbox(form, 'decision.hr.approved', page, 120, y - 2)
  drawLabel(page, 'Aprobat', 136, y, fontRegular, 8)
  addCheckbox(form, 'decision.hr.rejected', page, 190, y - 2)
  drawLabel(page, 'Respins', 206, y, fontRegular, 8)

  y -= 22
  drawLabel(page, 'Comentarii:', 55, y, fontRegular, 9)
  y -= 10
  addTextField(form, 'decision.comments', page, 55, y - 26, 485, 26, fontRegular, true)

  // ── Semnaturi ──
  y -= 48
  drawSectionHeader(page, 'SEMNATURI', 55, y, fontBold)
  y -= 6
  drawLine(page, 55, y, 490)
  y -= 4

  drawSignatureBlock(page, form, fontRegular, 'Angajat:', 'signature.employee', 55, y, 145)
  drawSignatureBlock(page, form, fontRegular, 'Manager:', 'signature.manager', 225, y, 145)
  drawSignatureBlock(page, form, fontRegular, 'Director / HR:', 'signature.director', 400, y, 140)

  // Footer
  y -= 110
  drawLine(page, 50, y, 495)
  page.drawText('Acest document este generat automat de Sistemul de Management al Concediilor.', {
    x: 55, y: y - 14, size: 7, font: fontRegular, color: rgb(0.5, 0.5, 0.5),
  })
  page.drawText('Validitatea documentului necesita toate semnaturile obligatorii de mai sus.', {
    x: 55, y: y - 24, size: 7, font: fontRegular, color: rgb(0.5, 0.5, 0.5),
  })

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false })
  const outputPath = join(OUTPUT_DIR, 'general-leave-request.pdf')
  writeFileSync(outputPath, pdfBytes)
  console.log(`  Template 1 saved: ${outputPath}`)
  return outputPath
}

// ─── Template 2: Cerere Concediu Special (2 pages) ───────────────
async function createSpecialLeaveTemplate() {
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const form = pdfDoc.getForm()

  // ═══ PAGE 1 ═══
  const page1 = pdfDoc.addPage([595.28, 841.89])
  await drawCompanyHeader(page1, pdfDoc, fontBold, fontRegular, 'CERERE CONCEDIU SPECIAL')
  const { width: pageWidth } = page1.getSize()

  let y = 730

  // Subtitle
  const subtitle = 'Contract Colectiv & Concediu Provizoriu'
  const subWidth = fontRegular.widthOfTextAtSize(subtitle, 10)
  page1.drawText(subtitle, { x: pageWidth / 2 - subWidth / 2, y, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.6) })

  // ── Informatii cerere ──
  y -= 26
  drawSectionHeader(page1, 'INFORMATII CERERE', 55, y, fontBold)
  y -= 28
  drawLabel(page1, 'Nr. cerere:', 55, y, fontRegular)
  addTextField(form, 'leave.requestNumber', page1, 135, y - 4, 110, 18, fontRegular)
  drawLabel(page1, 'Data:', 265, y, fontRegular)
  addTextField(form, 'leave.requestedDate', page1, 300, y - 4, 100, 18, fontRegular)
  drawLabel(page1, 'Status:', 420, y, fontRegular)
  addTextField(form, 'leave.status', page1, 465, y - 4, 75, 18, fontRegular)

  // ── Date angajat ──
  y -= 34
  drawSectionHeader(page1, 'DATE ANGAJAT', 55, y, fontBold)
  y -= 28
  drawLabel(page1, 'Nume:', 55, y, fontRegular)
  addTextField(form, 'employee.fullName', page1, 100, y - 4, 200, 18, fontRegular)
  drawLabel(page1, 'Nr. angajat:', 320, y, fontRegular)
  addTextField(form, 'employee.employeeId', page1, 400, y - 4, 140, 18, fontRegular)

  y -= 26
  drawLabel(page1, 'Departament:', 55, y, fontRegular)
  addTextField(form, 'employee.department', page1, 145, y - 4, 155, 18, fontRegular)
  drawLabel(page1, 'Functia:', 320, y, fontRegular)
  addTextField(form, 'employee.position', page1, 375, y - 4, 165, 18, fontRegular)

  y -= 26
  drawLabel(page1, 'Manager:', 55, y, fontRegular)
  addTextField(form, 'employee.manager', page1, 120, y - 4, 180, 18, fontRegular)
  drawLabel(page1, 'Email:', 320, y, fontRegular)
  addTextField(form, 'employee.email', page1, 360, y - 4, 180, 18, fontRegular)

  // ── Detalii concediu ──
  y -= 34
  drawSectionHeader(page1, 'DETALII CONCEDIU', 55, y, fontBold)
  y -= 28
  drawLabel(page1, 'Tip concediu:', 55, y, fontRegular)
  addTextField(form, 'leave.type', page1, 145, y - 4, 200, 18, fontRegular)

  y -= 26
  drawLabel(page1, 'Perioada:', 55, y, fontRegular)
  addTextField(form, 'leave.startDate', page1, 115, y - 4, 100, 18, fontRegular)
  drawLabel(page1, 'pana la', 225, y, fontRegular)
  addTextField(form, 'leave.endDate', page1, 270, y - 4, 100, 18, fontRegular)
  drawLabel(page1, 'Zile:', 385, y, fontRegular)
  addTextField(form, 'leave.totalDays', page1, 415, y - 4, 40, 18, fontRegular)

  y -= 26
  drawLabel(page1, 'Date:', 55, y, fontRegular)
  addTextField(form, 'leave.dates', page1, 90, y - 4, 450, 18, fontRegular)

  y -= 30
  drawLabel(page1, 'Motiv / Justificare:', 55, y, fontRegular)
  y -= 12
  addTextField(form, 'leave.reason', page1, 55, y - 52, 485, 52, fontRegular, true)

  // ── Documente justificative ──
  y -= 74
  page1.drawRectangle({ x: 50, y: y - 8, width: 500, height: 44, color: rgb(0.97, 0.95, 0.88), borderColor: rgb(0.85, 0.78, 0.55), borderWidth: 0.5 })
  page1.drawText('DOCUMENTE JUSTIFICATIVE', { x: 55, y: y + 22, size: 9, font: fontBold, color: rgb(0.55, 0.45, 0.15) })
  page1.drawText('Documentele necesare (certificat casatorie, certificat deces, certificat nastere, adeverinta donare, etc.)', {
    x: 55, y: y + 8, size: 7.5, font: fontRegular, color: rgb(0.55, 0.45, 0.15),
  })
  page1.drawText('trebuie depuse la HR impreuna cu aceasta cerere. Documentele sunt verificate confidential de HR.', {
    x: 55, y: y - 3, size: 7.5, font: fontRegular, color: rgb(0.55, 0.45, 0.15),
  })

  // ── Inlocuitor ──
  y -= 32
  drawLabel(page1, 'Inlocuitor(i):', 55, y, fontRegular)
  addTextField(form, 'substitutes.fullName', page1, 150, y - 4, 390, 18, fontRegular)

  // ── Sold ──
  y -= 30
  drawSectionHeader(page1, 'SOLD CONCEDIU', 55, y, fontBold)
  y -= 26
  drawLabel(page1, 'Drept:', 55, y, fontRegular)
  addTextField(form, 'balance.entitled', page1, 100, y - 4, 45, 18, fontRegular)
  drawLabel(page1, 'Folosit:', 160, y, fontRegular)
  addTextField(form, 'balance.used', page1, 205, y - 4, 45, 18, fontRegular)
  drawLabel(page1, 'Disponibil:', 265, y, fontRegular)
  addTextField(form, 'balance.available', page1, 325, y - 4, 45, 18, fontRegular)
  drawLabel(page1, 'Dupa aprobare:', 385, y, fontRegular)
  addTextField(form, 'balance.afterApproval', page1, 470, y - 4, 70, 18, fontRegular)

  // ── Decizii ──
  y -= 32
  drawSectionHeader(page1, 'DECIZII DE APROBARE', 55, y, fontBold)
  y -= 26

  drawLabel(page1, 'Manager:', 55, y, fontRegular, 9)
  addCheckbox(form, 'decision.manager.approved', page1, 115, y - 2)
  drawLabel(page1, 'Aprobat', 130, y, fontRegular, 8)
  addCheckbox(form, 'decision.manager.rejected', page1, 185, y - 2)
  drawLabel(page1, 'Respins', 200, y, fontRegular, 8)
  drawLabel(page1, 'Director:', 275, y, fontRegular, 9)
  addCheckbox(form, 'decision.director.approved', page1, 335, y - 2)
  drawLabel(page1, 'Aprobat', 350, y, fontRegular, 8)
  addCheckbox(form, 'decision.director.rejected', page1, 405, y - 2)
  drawLabel(page1, 'Respins', 420, y, fontRegular, 8)

  y -= 22
  drawLabel(page1, 'HR:', 55, y, fontRegular, 9)
  addCheckbox(form, 'decision.hr.approved', page1, 115, y - 2)
  drawLabel(page1, 'Aprobat', 130, y, fontRegular, 8)
  addCheckbox(form, 'decision.hr.rejected', page1, 185, y - 2)
  drawLabel(page1, 'Respins', 200, y, fontRegular, 8)
  drawLabel(page1, 'Executiv:', 275, y, fontRegular, 9)
  addCheckbox(form, 'decision.executive.approved', page1, 335, y - 2)
  drawLabel(page1, 'Aprobat', 350, y, fontRegular, 8)
  addCheckbox(form, 'decision.executive.rejected', page1, 405, y - 2)
  drawLabel(page1, 'Respins', 420, y, fontRegular, 8)

  y -= 26
  drawLabel(page1, 'Comentarii:', 55, y, fontRegular, 9)
  y -= 12
  addTextField(form, 'decision.comments', page1, 55, y - 36, 485, 36, fontRegular, true)

  // Page 1 footer note
  y -= 58
  drawLine(page1, 50, y, 495)
  page1.drawText('Continuare pe pagina 2 — Semnaturi', {
    x: 55, y: y - 12, size: 7, font: fontRegular, color: rgb(0.6, 0.6, 0.6),
  })

  // ═══ PAGE 2 ═══
  const page2 = pdfDoc.addPage([595.28, 841.89])
  await drawPage2Header(page2, pdfDoc, fontBold, fontRegular, 'CERERE CONCEDIU SPECIAL')

  let y2 = 760

  // ── Semnaturi ──
  y2 -= 10
  drawSectionHeader(page2, 'SEMNATURI', 55, y2, fontBold)
  y2 -= 6
  drawLine(page2, 55, y2, 490)
  y2 -= 4

  drawSignatureBlock(page2, form, fontRegular, 'Angajat:', 'signature.employee', 55, y2, 145)
  drawSignatureBlock(page2, form, fontRegular, 'Manager direct:', 'signature.manager', 225, y2, 145)
  drawSignatureBlock(page2, form, fontRegular, 'Verificare HR:', 'signature.hr', 400, y2, 140)

  // Footer
  y2 -= 120
  drawLine(page2, 50, y2, 495)
  page2.drawText('Acest document este generat automat de Sistemul de Management al Concediilor.', {
    x: 55, y: y2 - 14, size: 7, font: fontRegular, color: rgb(0.5, 0.5, 0.5),
  })
  page2.drawText('Concediul special necesita verificarea documentelor justificative de catre HR.', {
    x: 55, y: y2 - 24, size: 7, font: fontRegular, color: rgb(0.5, 0.5, 0.5),
  })

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false })
  const outputPath = join(OUTPUT_DIR, 'special-leave-request.pdf')
  writeFileSync(outputPath, pdfBytes)
  console.log(`  Template 2 saved (2 pages): ${outputPath}`)
  return outputPath
}

// ─── Template 3: Evidenta Concediu Medical (HR Only, 2 pages) ────
async function createMedicalLeaveTemplate() {
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const form = pdfDoc.getForm()

  // ═══ PAGE 1 ═══
  const page1 = pdfDoc.addPage([595.28, 841.89])
  await drawCompanyHeader(page1, pdfDoc, fontBold, fontRegular, 'EVIDENTA CONCEDIU MEDICAL')
  const { width: pageWidth } = page1.getSize()

  let y = 730

  // Confidentiality notice
  page1.drawRectangle({ x: 50, y: y - 8, width: 500, height: 22, color: rgb(0.95, 0.88, 0.88), borderColor: rgb(0.8, 0.4, 0.4), borderWidth: 0.5 })
  const confText = 'CONFIDENTIAL — DOAR UZ INTERN HR'
  const confWidth = fontBold.widthOfTextAtSize(confText, 10)
  page1.drawText(confText, { x: pageWidth / 2 - confWidth / 2, y: y - 2, size: 10, font: fontBold, color: rgb(0.7, 0.2, 0.2) })

  // ── Informatii inregistrare ──
  y -= 36
  drawSectionHeader(page1, 'INFORMATII INREGISTRARE', 55, y, fontBold)
  y -= 28
  drawLabel(page1, 'Nr. cerere:', 55, y, fontRegular)
  addTextField(form, 'leave.requestNumber', page1, 135, y - 4, 120, 18, fontRegular)
  drawLabel(page1, 'Data inregistrarii:', 280, y, fontRegular)
  addTextField(form, 'leave.requestedDate', page1, 390, y - 4, 150, 18, fontRegular)

  // ── Date angajat ──
  y -= 34
  drawSectionHeader(page1, 'DATE ANGAJAT', 55, y, fontBold)
  y -= 28
  drawLabel(page1, 'Nume complet:', 55, y, fontRegular)
  addTextField(form, 'employee.fullName', page1, 150, y - 4, 180, 18, fontRegular)
  drawLabel(page1, 'Nr. angajat:', 350, y, fontRegular)
  addTextField(form, 'employee.employeeId', page1, 435, y - 4, 105, 18, fontRegular)

  y -= 26
  drawLabel(page1, 'Departament:', 55, y, fontRegular)
  addTextField(form, 'employee.department', page1, 150, y - 4, 180, 18, fontRegular)
  drawLabel(page1, 'Functia:', 350, y, fontRegular)
  addTextField(form, 'employee.position', page1, 435, y - 4, 105, 18, fontRegular)

  y -= 26
  drawLabel(page1, 'Manager:', 55, y, fontRegular)
  addTextField(form, 'employee.manager', page1, 150, y - 4, 180, 18, fontRegular)
  drawLabel(page1, 'Email manager:', 350, y, fontRegular)
  addTextField(form, 'employee.managerEmail', page1, 435, y - 4, 105, 18, fontRegular)

  // ── Detalii concediu medical ──
  y -= 34
  drawSectionHeader(page1, 'DETALII CONCEDIU MEDICAL', 55, y, fontBold)
  y -= 28
  drawLabel(page1, 'Tip concediu:', 55, y, fontRegular)
  addTextField(form, 'leave.type', page1, 150, y - 4, 200, 18, fontRegular)

  y -= 26
  drawLabel(page1, 'Data inceput:', 55, y, fontRegular)
  addTextField(form, 'leave.startDate', page1, 150, y - 4, 120, 18, fontRegular)
  drawLabel(page1, 'Data sfarsit:', 290, y, fontRegular)
  addTextField(form, 'leave.endDate', page1, 375, y - 4, 120, 18, fontRegular)

  y -= 26
  drawLabel(page1, 'Total zile:', 55, y, fontRegular)
  addTextField(form, 'leave.totalDays', page1, 130, y - 4, 50, 18, fontRegular)
  drawLabel(page1, 'Perioada:', 200, y, fontRegular)
  addTextField(form, 'leave.dates', page1, 260, y - 4, 280, 18, fontRegular)

  y -= 30
  drawLabel(page1, 'Motiv medical / Diagnostic:', 55, y, fontRegular)
  y -= 12
  addTextField(form, 'leave.reason', page1, 55, y - 52, 485, 52, fontRegular, true)

  // ── Documentatie medicala ──
  y -= 74
  drawSectionHeader(page1, 'DOCUMENTATIE MEDICALA', 55, y, fontBold)
  y -= 5
  page1.drawRectangle({ x: 50, y: y - 68, width: 500, height: 65, color: rgb(0.97, 0.97, 0.99), borderColor: rgb(0.7, 0.7, 0.8), borderWidth: 0.5 })

  y -= 16
  drawLabel(page1, 'Documente primite:', 55, y, fontBold, 9)
  y -= 18
  addCheckbox(form, 'checkMedicalCertificate', page1, 60, y - 2)
  drawLabel(page1, 'Certificat medical', 78, y, fontRegular, 8)
  addCheckbox(form, 'checkDoctorNote', page1, 200, y - 2)
  drawLabel(page1, 'Adeverinta medic', 218, y, fontRegular, 8)
  addCheckbox(form, 'checkHospitalDischarge', page1, 350, y - 2)
  drawLabel(page1, 'Bilet iesire spital', 368, y, fontRegular, 8)

  y -= 18
  addCheckbox(form, 'checkLabResults', page1, 60, y - 2)
  drawLabel(page1, 'Analize laborator', 78, y, fontRegular, 8)
  addCheckbox(form, 'checkPrescription', page1, 200, y - 2)
  drawLabel(page1, 'Reteta medicala', 218, y, fontRegular, 8)
  addCheckbox(form, 'checkOtherDoc', page1, 350, y - 2)
  drawLabel(page1, 'Alte documente', 368, y, fontRegular, 8)

  // ── Sold concediu (on page 1) ──
  y -= 34
  drawSectionHeader(page1, 'SOLD CONCEDIU MEDICAL', 55, y, fontBold)
  y -= 28
  drawLabel(page1, 'Drept (zile/an):', 55, y, fontRegular)
  addTextField(form, 'balance.entitled', page1, 150, y - 4, 50, 18, fontRegular)
  drawLabel(page1, 'Folosit:', 215, y, fontRegular)
  addTextField(form, 'balance.used', page1, 255, y - 4, 50, 18, fontRegular)
  drawLabel(page1, 'In asteptare:', 320, y, fontRegular)
  addTextField(form, 'balance.pending', page1, 400, y - 4, 50, 18, fontRegular)
  drawLabel(page1, 'Ramas:', 465, y, fontRegular)
  addTextField(form, 'balance.afterApproval', page1, 500, y - 4, 40, 18, fontRegular)

  // ── Decizie HR (on page 1) ──
  y -= 34
  drawSectionHeader(page1, 'DECIZIE HR', 55, y, fontBold)
  y -= 26
  addCheckbox(form, 'decision.hr.approved', page1, 60, y - 2)
  drawLabel(page1, 'Verificat & Aprobat', 78, y, fontRegular, 9)
  addCheckbox(form, 'decision.hr.rejected', page1, 230, y - 2)
  drawLabel(page1, 'Respins / Necesita informatii suplimentare', 248, y, fontRegular, 9)

  y -= 26
  drawLabel(page1, 'Note verificare HR:', 55, y, fontRegular, 9)
  y -= 12
  addTextField(form, 'decision.comments', page1, 55, y - 36, 485, 36, fontRegular, true)

  // Page 1 footer note
  y -= 58
  drawLine(page1, 50, y, 495)
  page1.drawText('Continuare pe pagina 2 — Semnaturi', {
    x: 55, y: y - 12, size: 7, font: fontRegular, color: rgb(0.6, 0.6, 0.6),
  })

  // ═══ PAGE 2 ═══
  const page2 = pdfDoc.addPage([595.28, 841.89])
  await drawPage2Header(page2, pdfDoc, fontBold, fontRegular, 'EVIDENTA CONCEDIU MEDICAL')

  let y2 = 760

  // Reminder box
  page2.drawRectangle({ x: 50, y: y2 - 38, width: 500, height: 30, color: rgb(0.95, 0.88, 0.88), borderColor: rgb(0.8, 0.4, 0.4), borderWidth: 0.5 })
  page2.drawText('CONFIDENTIAL — Detaliile medicale sunt gestionate exclusiv de HR si nu sunt partajate cu managerii.', {
    x: 55, y: y2 - 12, size: 7.5, font: fontRegular, color: rgb(0.65, 0.2, 0.2),
  })
  page2.drawText('Documentele medicale originale trebuie depuse fizic la HR pentru dosarul medical al angajatului.', {
    x: 55, y: y2 - 24, size: 7.5, font: fontRegular, color: rgb(0.65, 0.2, 0.2),
  })

  y2 -= 55

  // ── Semnaturi ──
  drawSectionHeader(page2, 'SEMNATURI', 55, y2, fontBold)
  y2 -= 6
  drawLine(page2, 55, y2, 490)
  y2 -= 4

  drawSignatureBlock(page2, form, fontRegular, 'Angajat:', 'signature.employee', 55, y2, 210)
  drawSignatureBlock(page2, form, fontRegular, 'Reprezentant HR:', 'signature.hr', 325, y2, 220)

  // Footer
  y2 -= 120
  drawLine(page2, 50, y2, 495)
  page2.drawText('CONFIDENTIAL: Evidentele concediului medical sunt gestionate exclusiv de departamentul HR.', {
    x: 55, y: y2 - 14, size: 7, font: fontBold, color: rgb(0.6, 0.3, 0.3),
  })
  page2.drawText('Detaliile medicale sensibile nu sunt partajate cu managerii sau alti aprobatori.', {
    x: 55, y: y2 - 24, size: 7, font: fontRegular, color: rgb(0.5, 0.5, 0.5),
  })

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false })
  const outputPath = join(OUTPUT_DIR, 'medical-leave-record.pdf')
  writeFileSync(outputPath, pdfBytes)
  console.log(`  Template 3 saved (2 pages): ${outputPath}`)
  return outputPath
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('Generating PDF templates...\n')

  await createGeneralLeaveTemplate()
  await createSpecialLeaveTemplate()
  await createMedicalLeaveTemplate()

  console.log(`\nAll 3 templates generated in: ${OUTPUT_DIR}`)
}

main().catch(console.error)
