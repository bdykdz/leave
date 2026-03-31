/**
 * Creates or updates the "Fără Înlocuitor" (Without Substitute) virtual user.
 * This user appears in the substitute picker for all employees and is always available.
 *
 * Usage: npx tsx scripts/create-no-substitute-user.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { NO_SUBSTITUTE_USER } from '../lib/no-substitute-user'

const prisma = new PrismaClient()

async function main() {
  // Generate an unguessable password that will never be used for login
  const randomPassword = crypto.randomUUID() + crypto.randomUUID()
  const hashedPassword = await bcrypt.hash(randomPassword, 10)

  const user = await prisma.user.upsert({
    where: { employeeId: NO_SUBSTITUTE_USER.EMPLOYEE_ID },
    update: {
      firstName: NO_SUBSTITUTE_USER.FIRST_NAME,
      lastName: NO_SUBSTITUTE_USER.LAST_NAME,
      isActive: true,
    },
    create: {
      email: NO_SUBSTITUTE_USER.EMAIL,
      password: hashedPassword,
      firstName: NO_SUBSTITUTE_USER.FIRST_NAME,
      lastName: NO_SUBSTITUTE_USER.LAST_NAME,
      employeeId: NO_SUBSTITUTE_USER.EMPLOYEE_ID,
      role: 'EMPLOYEE',
      department: NO_SUBSTITUTE_USER.DEPARTMENT,
      position: NO_SUBSTITUTE_USER.POSITION,
      joiningDate: new Date('2000-01-01'),
      isActive: true,
    },
  })

  console.log(`✓ Virtual substitute user created/updated: ${user.firstName} ${user.lastName} (ID: ${user.id})`)
}

main()
  .catch((e) => {
    console.error('Failed to create virtual substitute user:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
