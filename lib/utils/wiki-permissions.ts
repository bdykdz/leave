import { Role } from '@prisma/client'

export function canEditWiki(role: Role): boolean {
  return role === 'HR' || role === 'ADMIN'
}
