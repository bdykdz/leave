// Well-known identifiers for the "Fără Înlocuitor" (Without Substitute) virtual user.
// This user appears in the substitute picker for all employees and is always available,
// allowing leave requests to proceed when no real substitute is available.

export const NO_SUBSTITUTE_USER = {
  EMPLOYEE_ID: 'FARA_INLOCUITOR',
  EMAIL: 'fara-inlocuitor@system.internal',
  FIRST_NAME: 'Fără',
  LAST_NAME: 'Înlocuitor',
  DEPARTMENT: 'SYSTEM',
  POSITION: 'Virtual Substitute',
} as const

/** Check whether a given employeeId represents the virtual no-substitute user */
export function isNoSubstituteUser(employeeId: string | null | undefined): boolean {
  return employeeId === NO_SUBSTITUTE_USER.EMPLOYEE_ID
}
