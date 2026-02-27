/**
 * Bulk Birthday Import Script
 *
 * Reads an Excel file with employee names and birthdays, fuzzy-matches
 * names to existing users, shows a review table, and updates after confirmation.
 *
 * Usage:
 *   npx tsx scripts/import-birthdays.ts path/to/birthdays.xlsx
 *   npx tsx scripts/import-birthdays.ts path/to/birthdays.xlsx --dry-run
 *
 * Or via the convenience npm script:
 *   pnpm import:birthdays -- path/to/birthdays.xlsx
 *   pnpm import:birthdays -- path/to/birthdays.xlsx --dry-run
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as readline from 'readline'

const prisma = new PrismaClient()

// ── CLI args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filePath = args.find(a => !a.startsWith('--'))
  return { filePath, dryRun }
}

// ── Diacritics / normalization ──────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .replace(/\u0110/g, 'D')        // Đ
    .replace(/\u0111/g, 'd')        // đ
    .replace(/[ȘșŞş]/g, m => m.toUpperCase() === m.toUpperCase() ? 'S' : 's')
    .replace(/[ȚțŢţ]/g, m => m.toUpperCase() === m.toUpperCase() ? 'T' : 't')
    .toLowerCase()
    .trim()
}

// ── Jaro-Winkler similarity ─────────────────────────────────────────────────

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  const len1 = s1.length
  const len2 = s2.length
  if (len1 === 0 || len2 === 0) return 0.0

  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0)
  const s1Matches = new Array(len1).fill(false)
  const s2Matches = new Array(len2).fill(false)

  let matches = 0
  let transpositions = 0

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist)
    const end = Math.min(i + matchDist + 1, len2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0.0

  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  )
}

function jaroWinkler(s1: string, s2: string, p = 0.1): number {
  const j = jaro(s1, s2)
  let prefix = 0
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }
  return j + prefix * p * (1 - j)
}

// ── Date parsing ────────────────────────────────────────────────────────────

function parseDate(value: unknown): Date | null {
  if (value == null || value === '') return null

  // Excel serial number
  if (typeof value === 'number') {
    const date = excelSerialToDate(value)
    return isValidBirthYear(date) ? date : null
  }

  const str = String(value).trim()

  // Already a Date object from xlsx
  if (value instanceof Date) {
    return isValidBirthYear(value) ? value : null
  }

  // DD.MM.YYYY or DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (dmy) {
    const date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    return isValidBirthYear(date) ? date : null
  }

  // YYYY-MM-DD
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymd) {
    const date = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    return isValidBirthYear(date) ? date : null
  }

  // MM/DD/YYYY (US format)
  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    const month = Number(mdy[1])
    const day = Number(mdy[2])
    // If first number > 12, it's likely DD/MM/YYYY already handled above
    if (month <= 12) {
      const date = new Date(Number(mdy[3]), month - 1, day)
      return isValidBirthYear(date) ? date : null
    }
  }

  return null
}

function excelSerialToDate(serial: number): Date {
  // Excel epoch is 1900-01-01, but has the Lotus 1-2-3 leap year bug
  const utcDays = serial - 25569 // 25569 = days between 1900-01-01 and 1970-01-01
  return new Date(utcDays * 86400 * 1000)
}

function isValidBirthYear(date: Date): boolean {
  const year = date.getFullYear()
  return year >= 1940 && year <= 2010
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ── Column detection ────────────────────────────────────────────────────────

const NAME_PATTERNS = [
  /^name$/i, /^full\s*name$/i, /^employee\s*name$/i, /^employee$/i,
  /^nume$/i, /^nume\s*(si|și)\s*prenume$/i, /^prenume\s*(si|și)\s*nume$/i,
  /^angajat$/i,
]

const BIRTHDAY_PATTERNS = [
  /^birthday$/i, /^birth\s*day$/i, /^date\s*of\s*birth$/i, /^dob$/i,
  /^data\s*na[sș]terii$/i, /^zi\s*de\s*na[sș]tere$/i, /^born$/i,
  /^birth\s*date$/i,
]

function detectColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const header of headers) {
    const trimmed = header.trim()
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) return header
    }
  }
  return null
}

// ── Matching logic ──────────────────────────────────────────────────────────

type MatchStatus = 'EXACT' | 'HIGH' | 'LOW' | 'NONE'

interface DbUser {
  id: string
  firstName: string
  lastName: string
  department: string
  dateOfBirth: Date | null
  normalizedFL: string // firstName lastName
  normalizedLF: string // lastName firstName
}

interface MatchResult {
  excelName: string
  birthday: Date | null
  user: DbUser | null
  score: number
  status: MatchStatus
}

function matchName(excelName: string, dbUsers: DbUser[]): { user: DbUser | null; score: number; secondScore: number } {
  const normName = normalize(excelName)
  let bestUser: DbUser | null = null
  let bestScore = 0
  let secondScore = 0

  for (const user of dbUsers) {
    // Test both orderings
    const scoreFL = jaroWinkler(normName, user.normalizedFL)
    const scoreLF = jaroWinkler(normName, user.normalizedLF)
    const score = Math.max(scoreFL, scoreLF)

    if (score > bestScore) {
      secondScore = bestScore
      bestScore = score
      bestUser = user
    } else if (score > secondScore) {
      secondScore = score
    }
  }

  return { user: bestUser, score: bestScore, secondScore }
}

function classifyMatch(score: number, secondScore: number): MatchStatus {
  if (score >= 1.0) return 'EXACT'
  if (score >= 0.92 && score - secondScore >= 0.03) return 'HIGH'
  if (score >= 0.80) return 'LOW'
  return 'NONE'
}

// ── Display ─────────────────────────────────────────────────────────────────

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

function printTable(results: MatchResult[]) {
  const header = [
    padRight('#', 4),
    padRight('Excel Name', 24),
    padRight('Matched User', 24),
    padRight('Dept', 14),
    padRight('Score', 7),
    padRight('Birthday', 12),
    'Status',
  ].join(' | ')

  const sep = '-'.repeat(header.length)

  console.log('\n' + sep)
  console.log(header)
  console.log(sep)

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const matchedName = r.user ? `${r.user.firstName} ${r.user.lastName}` : '(no match)'
    const dept = r.user?.department ?? ''
    const bday = r.birthday ? formatDate(r.birthday) : ''
    const statusLabel = r.status === 'LOW' ? 'LOW (skip)' : r.status

    console.log([
      padRight(String(i + 1), 4),
      padRight(r.excelName, 24),
      padRight(matchedName, 24),
      padRight(dept, 14),
      padRight(r.score.toFixed(3), 7),
      padRight(bday, 12),
      statusLabel,
    ].join(' | '))
  }

  console.log(sep)
}

// ── Prompt ──────────────────────────────────────────────────────────────────

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { filePath, dryRun } = parseArgs()

  if (!filePath) {
    console.error('Usage: npx tsx scripts/import-birthdays.ts <path-to-xlsx> [--dry-run]')
    process.exit(1)
  }

  // 1. Read Excel
  console.log(`Reading ${filePath}...`)
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

  if (rows.length === 0) {
    console.error('No data found in the spreadsheet.')
    process.exit(1)
  }

  // 2. Detect columns
  const headers = Object.keys(rows[0])
  let nameCol = detectColumn(headers, NAME_PATTERNS)
  let bdayCol = detectColumn(headers, BIRTHDAY_PATTERNS)

  if (!nameCol || !bdayCol) {
    console.log('\nDetected headers:', headers.join(', '))
    if (!nameCol) console.error('Could not auto-detect the name column.')
    if (!bdayCol) console.error('Could not auto-detect the birthday column.')
    console.error('Please rename columns to "Name" and "Birthday" (or similar) and try again.')
    process.exit(1)
  }

  console.log(`Name column: "${nameCol}", Birthday column: "${bdayCol}"`)
  console.log(`Found ${rows.length} rows in Excel.`)

  // 3. Parse Excel rows
  const excelEntries: { name: string; birthday: Date | null }[] = []
  let parseErrors = 0

  for (const row of rows) {
    const rawName = row[nameCol]
    const rawBday = row[bdayCol]

    if (!rawName || String(rawName).trim() === '') continue

    const name = String(rawName).trim()
    const birthday = parseDate(rawBday)

    if (!birthday) {
      parseErrors++
      console.warn(`  Warning: could not parse date for "${name}": ${JSON.stringify(rawBday)}`)
    }

    excelEntries.push({ name, birthday })
  }

  if (parseErrors > 0) {
    console.log(`${parseErrors} date(s) could not be parsed.`)
  }

  // 4. Fetch users from DB
  console.log('Fetching users from database...')
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true, department: true, dateOfBirth: true },
  })

  const dbUsers: DbUser[] = users.map(u => ({
    ...u,
    normalizedFL: normalize(`${u.firstName} ${u.lastName}`),
    normalizedLF: normalize(`${u.lastName} ${u.firstName}`),
  }))

  console.log(`Found ${dbUsers.length} active users in database.`)

  // 5. Match
  const results: MatchResult[] = []

  for (const entry of excelEntries) {
    const { user, score, secondScore } = matchName(entry.name, dbUsers)
    const status = classifyMatch(score, secondScore)

    results.push({
      excelName: entry.name,
      birthday: entry.birthday,
      user: status !== 'NONE' ? user : null,
      score: status !== 'NONE' ? score : (user ? score : 0),
      status,
    })
  }

  // 6. Display
  printTable(results)

  const toUpdate = results.filter(r => (r.status === 'EXACT' || r.status === 'HIGH') && r.birthday && r.user)
  const lowConf = results.filter(r => r.status === 'LOW')
  const unmatched = results.filter(r => r.status === 'NONE')
  const noBirthday = results.filter(r => (r.status === 'EXACT' || r.status === 'HIGH') && !r.birthday)

  console.log(`\nSummary: ${toUpdate.length} will update, ${lowConf.length} low confidence (skipped), ${unmatched.length} unmatched, ${noBirthday.length} missing birthday`)

  if (toUpdate.length === 0) {
    console.log('Nothing to update.')
    process.exit(0)
  }

  // 7. Confirm & update
  if (dryRun) {
    console.log('\n--dry-run mode: no changes applied.')
    process.exit(0)
  }

  const confirmed = await askConfirmation(`\nProceed with updating ${toUpdate.length} birthday(s)? (y/N) `)

  if (!confirmed) {
    console.log('Aborted.')
    process.exit(0)
  }

  console.log('Updating...')

  let updated = 0
  let errors = 0

  await prisma.$transaction(async (tx) => {
    for (const r of toUpdate) {
      try {
        await tx.user.update({
          where: { id: r.user!.id },
          data: { dateOfBirth: r.birthday! },
        })
        updated++
      } catch (err) {
        errors++
        console.error(`  Error updating ${r.user!.firstName} ${r.user!.lastName}: ${err}`)
      }
    }
  })

  console.log(`\nDone! Updated: ${updated}, Errors: ${errors}, Skipped: ${lowConf.length + unmatched.length + noBirthday.length}`)
}

main()
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
