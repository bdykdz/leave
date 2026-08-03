/**
 * Fill all 3 templates with realistic sample data to preview how they look.
 * Run with: npx tsx scripts/fill-template-examples.ts
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const TEMPLATES_DIR = join(process.cwd(), 'public', 'templates')
const OUTPUT_DIR = join(process.cwd(), 'public', 'templates', 'examples')

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

async function drawFakeSignature(page: any, x: number, y: number, name: string, font: any) {
  page.drawText(name, {
    x: x + 5,
    y: y + 12,
    size: 14,
    font,
    color: rgb(0.05, 0.05, 0.4),
    opacity: 0.85,
  })
  page.drawLine({
    start: { x: x + 3, y: y + 8 },
    end: { x: x + 5 + font.widthOfTextAtSize(name, 14), y: y + 10 },
    thickness: 0.7,
    color: rgb(0.05, 0.05, 0.4),
    opacity: 0.6,
  })
}

// ─── Fill Template 1: Cerere de Concediu ─────────────────────────
async function fillGeneralLeave() {
  const bytes = readFileSync(join(TEMPLATES_DIR, 'general-leave-request.pdf'))
  const pdfDoc = await PDFDocument.load(bytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const form = pdfDoc.getForm()

  const fields: Record<string, string> = {
    'leave.requestNumber': 'LR-2026-0042',
    'leave.requestedDate': '14 Februarie 2026',
    'leave.type': 'Concediu de Odihna',
    'leave.startDate': '02 Martie 2026',
    'leave.endDate': '06 Martie 2026',
    'leave.totalDays': '5',
    'leave.dates': '2-6 Martie 2026',
    'leave.reason': 'Vacanta de familie - vizita la rude in Brasov si excursie scurta la schi in Predeal.',
    'employee.fullName': 'Andrei Stoica',
    'employee.employeeId': 'EMP0001',
    'employee.department': 'Inginerie',
    'employee.position': 'Dezvoltator Senior',
    'employee.manager': 'Razvan Popa',
    'employee.joiningDate': '01 Iunie 2020',
    'balance.entitled': '21',
    'balance.used': '6',
    'balance.pending': '0',
    'balance.afterApproval': '10',
    'substitutes.fullName': 'Vlad Barbu, George Munteanu',
    'decision.comments': 'Aprobat. Acoperire echipa confirmata cu inlocuitorii.',
    'signature.employee.name': 'Andrei Stoica',
    'signature.employee.date': '14/02/2026',
    'signature.manager.name': 'Razvan Popa',
    'signature.manager.date': '15/02/2026',
    'signature.director.name': 'Bogdan Cristea',
    'signature.director.date': '15/02/2026',
  }

  for (const [name, value] of Object.entries(fields)) {
    try {
      const tf = form.getTextField(name)
      tf.setText(value)
      tf.updateAppearances(font)
    } catch { /* skip if not found */ }
  }

  try { form.getCheckBox('decision.manager.approved').check() } catch {}
  try { form.getCheckBox('decision.director.approved').check() } catch {}
  try { form.getCheckBox('decision.hr.approved').check() } catch {}

  const page = pdfDoc.getPages()[0]
  const sigFields = [
    { name: 'signature.employee.signature', sigName: 'A. Stoica' },
    { name: 'signature.manager.signature', sigName: 'R. Popa' },
    { name: 'signature.director.signature', sigName: 'B. Cristea' },
  ]

  for (const sf of sigFields) {
    try {
      const field = form.getTextField(sf.name)
      const widgets = (field as any).acroField.getWidgets()
      if (widgets.length > 0) {
        const rect = widgets[0].getRectangle()
        drawFakeSignature(page, rect.x, rect.y, sf.sigName, fontItalic)
      }
    } catch {}
  }

  form.flatten()
  const pdfBytes = await pdfDoc.save({ useObjectStreams: false })
  const outPath = join(OUTPUT_DIR, 'exemplu-cerere-concediu.pdf')
  writeFileSync(outPath, pdfBytes)
  console.log(`  Exemplu 1: ${outPath}`)
}

// ─── Fill Template 2: Cerere Concediu Special ────────────────────
async function fillSpecialLeave() {
  const bytes = readFileSync(join(TEMPLATES_DIR, 'special-leave-request.pdf'))
  const pdfDoc = await PDFDocument.load(bytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const form = pdfDoc.getForm()

  const fields: Record<string, string> = {
    'leave.requestNumber': 'LR-2026-0078',
    'leave.requestedDate': '10 Ianuarie 2026',
    'leave.status': 'APROBAT',
    'leave.type': 'Concediu Casatorie',
    'leave.startDate': '20 Ianuarie 2026',
    'leave.endDate': '24 Ianuarie 2026',
    'leave.totalDays': '5',
    'leave.dates': '20-24 Ianuarie 2026',
    'leave.reason': 'Casatorie pe 21 Ianuarie 2026. Ceremonia in Cluj-Napoca.\nCertificatul de casatorie va fi prezentat la HR la intoarcere.',
    'employee.fullName': 'Stefan Lazar',
    'employee.employeeId': 'EMP0004',
    'employee.department': 'Inginerie',
    'employee.position': 'Dezvoltator Senior',
    'employee.manager': 'Florin Diaconu',
    'employee.email': 'stefan.lazar@tpf.ro',
    'substitutes.fullName': 'Ana Serban',
    'balance.entitled': '5',
    'balance.used': '0',
    'balance.available': '5',
    'balance.afterApproval': '0',
    'decision.comments': 'Certificat casatorie verificat. Felicitari!',
    'signature.employee.name': 'Stefan Lazar',
    'signature.employee.date': '10/01/2026',
    'signature.manager.name': 'Florin Diaconu',
    'signature.manager.date': '11/01/2026',
    'signature.hr.name': 'Diana Vasilescu',
    'signature.hr.date': '11/01/2026',
  }

  for (const [name, value] of Object.entries(fields)) {
    try {
      const tf = form.getTextField(name)
      tf.setText(value)
      tf.updateAppearances(font)
    } catch {}
  }

  try { form.getCheckBox('decision.manager.approved').check() } catch {}
  try { form.getCheckBox('decision.hr.approved').check() } catch {}

  const page = pdfDoc.getPages()[0]
  const sigFields = [
    { name: 'signature.employee.signature', sigName: 'S. Lazar' },
    { name: 'signature.manager.signature', sigName: 'F. Diaconu' },
    { name: 'signature.hr.signature', sigName: 'D. Vasilescu' },
  ]

  for (const sf of sigFields) {
    try {
      const field = form.getTextField(sf.name)
      const widgets = (field as any).acroField.getWidgets()
      if (widgets.length > 0) {
        const rect = widgets[0].getRectangle()
        drawFakeSignature(page, rect.x, rect.y, sf.sigName, fontItalic)
      }
    } catch {}
  }

  form.flatten()
  const pdfBytes = await pdfDoc.save({ useObjectStreams: false })
  const outPath = join(OUTPUT_DIR, 'exemplu-concediu-special.pdf')
  writeFileSync(outPath, pdfBytes)
  console.log(`  Exemplu 2: ${outPath}`)
}

// ─── Fill Template 3: Evidenta Concediu Medical ──────────────────
async function fillMedicalLeave() {
  const bytes = readFileSync(join(TEMPLATES_DIR, 'medical-leave-record.pdf'))
  const pdfDoc = await PDFDocument.load(bytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const form = pdfDoc.getForm()

  const fields: Record<string, string> = {
    'leave.requestNumber': 'LR-2026-0091',
    'leave.requestedDate': '03 Februarie 2026',
    'leave.type': 'Concediu Medical',
    'leave.startDate': '28 Ianuarie 2026',
    'leave.endDate': '31 Ianuarie 2026',
    'leave.totalDays': '4',
    'leave.dates': '28-31 Ianuarie 2026',
    'leave.reason': 'Diagnostic gripa. Medicul a prescris 4 zile de repaus.\nCertificat medical ref: CM-2026-4521 emis de Dr. Popescu, Clinica Medicover.',
    'employee.fullName': 'Oana Ene',
    'employee.employeeId': 'EMP0007',
    'employee.department': 'Financiar',
    'employee.position': 'Analist Financiar',
    'employee.manager': 'Adriana Radu',
    'employee.managerEmail': 'adriana.radu@tpf.ro',
    'decision.comments': 'Certificat medical CM-2026-4521 verificat. Original depus in dosarul medical al angajatului.',
    'balance.entitled': '180',
    'balance.used': '4',
    'balance.pending': '0',
    'balance.afterApproval': '176',
    'signature.employee.name': 'Oana Ene',
    'signature.employee.date': '03/02/2026',
    'signature.hr.name': 'Ioana Stanescu',
    'signature.hr.date': '03/02/2026',
  }

  for (const [name, value] of Object.entries(fields)) {
    try {
      const tf = form.getTextField(name)
      tf.setText(value)
      tf.updateAppearances(font)
    } catch {}
  }

  try { form.getCheckBox('checkMedicalCertificate').check() } catch {}
  try { form.getCheckBox('checkDoctorNote').check() } catch {}
  try { form.getCheckBox('decision.hr.approved').check() } catch {}

  const page = pdfDoc.getPages()[0]
  const sigFields = [
    { name: 'signature.employee.signature', sigName: 'O. Ene' },
    { name: 'signature.hr.signature', sigName: 'I. Stanescu' },
  ]

  for (const sf of sigFields) {
    try {
      const field = form.getTextField(sf.name)
      const widgets = (field as any).acroField.getWidgets()
      if (widgets.length > 0) {
        const rect = widgets[0].getRectangle()
        drawFakeSignature(page, rect.x, rect.y, sf.sigName, fontItalic)
      }
    } catch {}
  }

  form.flatten()
  const pdfBytes = await pdfDoc.save({ useObjectStreams: false })
  const outPath = join(OUTPUT_DIR, 'exemplu-concediu-medical.pdf')
  writeFileSync(outPath, pdfBytes)
  console.log(`  Exemplu 3: ${outPath}`)
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('Completare sabloane cu date de exemplu...\n')
  await fillGeneralLeave()
  await fillSpecialLeave()
  await fillMedicalLeave()
  console.log(`\nToate exemplele salvate in: ${OUTPUT_DIR}`)
}

main().catch(console.error)
