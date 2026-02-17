/**
 * Register the 3 generated PDF templates into the database.
 * Uploads each PDF to MinIO and creates DocumentTemplate + TemplateFieldMapping records.
 *
 * Template → Leave type mapping:
 *   general-leave-request.pdf  → STANDARD leave types (excluding Sick Leave)
 *   special-leave-request.pdf  → PERSONAL + PROVISIONAL leave types
 *   medical-leave-record.pdf   → Sick Leave (code: SL)
 *
 * Run with: npx tsx scripts/register-templates.ts
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'
import { uploadToMinio, ensureBucketExists } from '../lib/minio'

const prisma = new PrismaClient()
const TEMPLATES_DIR = join(process.cwd(), 'public', 'templates')

// ─── Field mapping definitions ────────────────────────────────────────────────
// fieldKey   = dot-notation data path resolved by SmartDocumentGenerator
// formFieldName = exact PDF AcroForm field name (same as fieldKey in our templates)
// type       = 'text' | 'checkbox' | 'signature'

function makeMapping(fieldKey: string, fieldLabel: string, type: string) {
  return {
    fieldKey,
    fieldLabel,
    documentPosition: { formFieldName: fieldKey, type },
    fieldStyle: {},
    isRequired: type !== 'signature',
  }
}

const GENERAL_LEAVE_FIELDS = [
  // Leave details
  makeMapping('leave.requestNumber',   'Nr. cerere',           'text'),
  makeMapping('leave.requestedDate',   'Data cererii',         'text'),
  makeMapping('leave.type',            'Tip concediu',         'text'),
  makeMapping('leave.startDate',       'Data inceput',         'text'),
  makeMapping('leave.endDate',         'Data sfarsit',         'text'),
  makeMapping('leave.totalDays',       'Zile totale',          'text'),
  makeMapping('leave.dates',           'Perioade',             'text'),
  makeMapping('leave.reason',          'Motiv',                'text'),
  makeMapping('leave.status',          'Status',               'text'),
  // Employee
  makeMapping('employee.fullName',     'Nume complet',         'text'),
  makeMapping('employee.employeeId',   'ID angajat',           'text'),
  makeMapping('employee.department',   'Departament',          'text'),
  makeMapping('employee.position',     'Functie',              'text'),
  makeMapping('employee.manager',      'Manager',              'text'),
  // Balance
  makeMapping('balance.entitled',      'Zile cuvenite',        'text'),
  makeMapping('balance.used',          'Zile folosite',        'text'),
  makeMapping('balance.pending',       'Zile in asteptare',    'text'),
  makeMapping('balance.available',     'Zile disponibile',     'text'),
  makeMapping('balance.afterApproval', 'Dupa aprobare',        'text'),
  // Substitutes
  makeMapping('substitutes.fullName',  'Inlocuitori',          'text'),
  // Decision
  makeMapping('decision.manager.approved',  'Aprobat manager',   'checkbox'),
  makeMapping('decision.director.approved', 'Aprobat director',  'checkbox'),
  makeMapping('decision.hr.approved',       'Aprobat HR',        'checkbox'),
  makeMapping('decision.comments',     'Comentarii',           'text'),
  // Signatures
  makeMapping('signature.employee.name',      'Nume angajat',       'text'),
  makeMapping('signature.employee.date',      'Data angajat',       'text'),
  makeMapping('signature.employee.signature', 'Semnatura angajat',  'signature'),
  makeMapping('signature.manager.name',       'Nume manager',       'text'),
  makeMapping('signature.manager.date',       'Data manager',       'text'),
  makeMapping('signature.manager.signature',  'Semnatura manager',  'signature'),
  makeMapping('signature.director.name',      'Nume director',      'text'),
  makeMapping('signature.director.date',      'Data director',      'text'),
  makeMapping('signature.director.signature', 'Semnatura director', 'signature'),
]

const SPECIAL_LEAVE_FIELDS = [
  // Leave details
  makeMapping('leave.requestNumber',   'Nr. cerere',           'text'),
  makeMapping('leave.requestedDate',   'Data cererii',         'text'),
  makeMapping('leave.status',          'Status',               'text'),
  makeMapping('leave.type',            'Tip concediu',         'text'),
  makeMapping('leave.startDate',       'Data inceput',         'text'),
  makeMapping('leave.endDate',         'Data sfarsit',         'text'),
  makeMapping('leave.totalDays',       'Zile totale',          'text'),
  makeMapping('leave.dates',           'Perioade',             'text'),
  makeMapping('leave.reason',          'Motiv',                'text'),
  // Employee
  makeMapping('employee.fullName',     'Nume complet',         'text'),
  makeMapping('employee.employeeId',   'ID angajat',           'text'),
  makeMapping('employee.department',   'Departament',          'text'),
  makeMapping('employee.position',     'Functie',              'text'),
  makeMapping('employee.manager',      'Manager',              'text'),
  makeMapping('employee.email',        'Email angajat',        'text'),
  // Balance
  makeMapping('balance.entitled',      'Zile cuvenite',        'text'),
  makeMapping('balance.used',          'Zile folosite',        'text'),
  makeMapping('balance.available',     'Zile disponibile',     'text'),
  makeMapping('balance.afterApproval', 'Dupa aprobare',        'text'),
  // Substitutes
  makeMapping('substitutes.fullName',  'Inlocuitori',          'text'),
  // Decision
  makeMapping('decision.manager.approved', 'Aprobat manager',  'checkbox'),
  makeMapping('decision.hr.approved',      'Aprobat HR',       'checkbox'),
  makeMapping('decision.comments',     'Comentarii',           'text'),
  // Signatures
  makeMapping('signature.employee.name',     'Nume angajat',      'text'),
  makeMapping('signature.employee.date',     'Data angajat',      'text'),
  makeMapping('signature.employee.signature','Semnatura angajat', 'signature'),
  makeMapping('signature.manager.name',      'Nume manager',      'text'),
  makeMapping('signature.manager.date',      'Data manager',      'text'),
  makeMapping('signature.manager.signature', 'Semnatura manager', 'signature'),
  makeMapping('signature.hr.name',           'Nume HR',           'text'),
  makeMapping('signature.hr.date',           'Data HR',           'text'),
  makeMapping('signature.hr.signature',      'Semnatura HR',      'signature'),
]

const MEDICAL_LEAVE_FIELDS = [
  // Leave details
  makeMapping('leave.requestNumber',   'Nr. cerere',           'text'),
  makeMapping('leave.requestedDate',   'Data cererii',         'text'),
  makeMapping('leave.type',            'Tip concediu',         'text'),
  makeMapping('leave.startDate',       'Data inceput',         'text'),
  makeMapping('leave.endDate',         'Data sfarsit',         'text'),
  makeMapping('leave.totalDays',       'Zile totale',          'text'),
  makeMapping('leave.dates',           'Perioade',             'text'),
  makeMapping('leave.reason',          'Motiv / Diagnostic',   'text'),
  // Employee
  makeMapping('employee.fullName',     'Nume complet',         'text'),
  makeMapping('employee.employeeId',   'ID angajat',           'text'),
  makeMapping('employee.department',   'Departament',          'text'),
  makeMapping('employee.position',     'Functie',              'text'),
  makeMapping('employee.manager',      'Manager',              'text'),
  // Balance
  makeMapping('balance.entitled',      'Zile cuvenite',        'text'),
  makeMapping('balance.used',          'Zile folosite',        'text'),
  makeMapping('balance.pending',       'Zile in asteptare',    'text'),
  makeMapping('balance.afterApproval', 'Dupa aprobare',        'text'),
  // Decision
  makeMapping('decision.hr.approved',  'Aprobat HR',           'checkbox'),
  makeMapping('decision.comments',     'Comentarii HR',        'text'),
  // Signatures
  makeMapping('signature.employee.name',     'Nume angajat',      'text'),
  makeMapping('signature.employee.date',     'Data angajat',      'text'),
  makeMapping('signature.employee.signature','Semnatura angajat', 'signature'),
  makeMapping('signature.hr.name',           'Nume HR',           'text'),
  makeMapping('signature.hr.date',           'Data HR',           'text'),
  makeMapping('signature.hr.signature',      'Semnatura HR',      'signature'),
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadTemplate(fileName: string): Promise<string> {
  const buf = readFileSync(join(TEMPLATES_DIR, fileName))
  const objectName = `template-${Date.now()}-${fileName}`
  const url = await uploadToMinio(buf, objectName, 'application/pdf', undefined, 'templates')
  console.log(`  Uploaded ${fileName} → ${url}`)
  return url
}

async function createTemplate(
  name: string,
  description: string,
  fileUrl: string,
  leaveTypeId: string,
  createdBy: string,
  fields: ReturnType<typeof makeMapping>[]
) {
  // Remove any existing active template for this leave type (avoid duplicates on re-run)
  await prisma.documentTemplate.updateMany({
    where: { leaveTypeId, isActive: true },
    data: { isActive: false },
  })

  const template = await prisma.documentTemplate.create({
    data: {
      name,
      description,
      fileUrl,
      fileType: 'pdf',
      category: 'leave_request',
      isActive: true,
      leaveTypeId,
      createdBy,
    },
  })

  await prisma.templateFieldMapping.createMany({
    data: fields.map((f) => ({
      templateId: template.id,
      fieldKey: f.fieldKey,
      fieldLabel: f.fieldLabel,
      documentPosition: f.documentPosition,
      fieldStyle: f.fieldStyle,
      isRequired: f.isRequired,
    })),
  })

  return template
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Registering PDF templates...\n')

  await ensureBucketExists()

  // Find an admin/HR user to be the creator
  const creator = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'HR'] } },
    select: { id: true, email: true },
  })
  if (!creator) throw new Error('No ADMIN or HR user found in DB')
  console.log(`Using creator: ${creator.email}\n`)

  // Load all active leave types
  const leaveTypes = await prisma.leaveType.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, category: true },
  })
  console.log(`Found ${leaveTypes.length} active leave types\n`)

  // Upload PDFs to MinIO (each once)
  console.log('Uploading PDFs to MinIO...')
  const [generalUrl, specialUrl, medicalUrl] = await Promise.all([
    uploadTemplate('general-leave-request.pdf'),
    uploadTemplate('special-leave-request.pdf'),
    uploadTemplate('medical-leave-record.pdf'),
  ])
  console.log()

  // Categorise leave types
  const medicalCodes = ['SL']                                        // → medical template
  const personalCategories = ['PERSONAL', 'PROVISIONAL']            // → special template
  // Everything else (STANDARD, unset) except medical codes → general template

  let generalCount = 0
  let specialCount = 0
  let medicalCount = 0

  console.log('Creating DocumentTemplate records...')
  for (const lt of leaveTypes) {
    let url: string
    let fields: ReturnType<typeof makeMapping>[]
    let templateName: string

    if (medicalCodes.includes(lt.code)) {
      url = medicalUrl
      fields = MEDICAL_LEAVE_FIELDS
      templateName = 'Evidenta Concediu Medical'
      medicalCount++
    } else if (personalCategories.includes(lt.category ?? '')) {
      url = specialUrl
      fields = SPECIAL_LEAVE_FIELDS
      templateName = 'Cerere Concediu Special'
      specialCount++
    } else {
      url = generalUrl
      fields = GENERAL_LEAVE_FIELDS
      templateName = 'Cerere de Concediu'
      generalCount++
    }

    const template = await createTemplate(
      templateName,
      `Template pentru ${lt.name}`,
      url,
      lt.id,
      creator.id,
      fields
    )

    console.log(`  [${lt.code}] ${lt.name} → ${templateName} (${fields.length} fields, id: ${template.id})`)
  }

  console.log(`
Done!
  General leave template: ${generalCount} leave type(s)
  Special leave template: ${specialCount} leave type(s)
  Medical leave template: ${medicalCount} leave type(s)

Next step: go to Admin → Templates and click "Regenerate All" to rebuild
all existing leave request documents with the new templates.
`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
