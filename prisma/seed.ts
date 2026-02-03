/**
 * Staging Database Seed Script
 *
 * This script creates comprehensive test data for the staging environment.
 * It is idempotent - running multiple times will not create duplicate data.
 *
 * Creates:
 * - Departments and Positions
 * - Users for each role (Employee, Manager, HR, Executive, Admin)
 * - Leave types with policies
 * - Historical leave requests in various states
 * - Organizational hierarchy
 * - Edge case scenarios (executives approving each other)
 * - Romanian public holidays
 * - Company settings
 * - Workflow rules
 */

import { PrismaClient, Role, RequestStatus, ApprovalStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Password for all seed users (for dev login)
const DEFAULT_PASSWORD = 'password123'

// Helper to create date relative to today
function daysFromNow(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(0, 0, 0, 0)
  return date
}

function daysAgo(days: number): Date {
  return daysFromNow(-days)
}

// Generate unique employee ID
function generateEmployeeId(prefix: string, index: number): string {
  return `${prefix}${String(index).padStart(4, '0')}`
}

async function main() {
  console.log('🌱 Starting seed process...')

  // Hash password once for all users
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  // =====================
  // 1. DEPARTMENTS
  // =====================
  console.log('📁 Creating departments...')

  const departments = [
    { name: 'Engineering', code: 'ENG', description: 'Software Development and Engineering', order: 1 },
    { name: 'Human Resources', code: 'HR', description: 'Human Resources Department', order: 2 },
    { name: 'Finance', code: 'FIN', description: 'Finance and Accounting', order: 3 },
    { name: 'Sales', code: 'SALES', description: 'Sales and Business Development', order: 4 },
    { name: 'Marketing', code: 'MKT', description: 'Marketing and Communications', order: 5 },
    { name: 'Operations', code: 'OPS', description: 'Operations and Infrastructure', order: 6 },
    { name: 'Executive Office', code: 'EXEC', description: 'Executive Leadership', order: 7 },
    { name: 'IT Support', code: 'IT', description: 'IT Support and Infrastructure', order: 8 },
  ]

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: dept,
      create: dept,
    })
  }

  // =====================
  // 2. POSITIONS
  // =====================
  console.log('👔 Creating positions...')

  const positions = [
    { name: 'Junior Developer', code: 'JR_DEV', description: 'Entry-level developer', order: 1 },
    { name: 'Senior Developer', code: 'SR_DEV', description: 'Senior software developer', order: 2 },
    { name: 'Tech Lead', code: 'TECH_LEAD', description: 'Technical team lead', order: 3 },
    { name: 'Engineering Manager', code: 'ENG_MGR', description: 'Engineering department manager', order: 4 },
    { name: 'HR Specialist', code: 'HR_SPEC', description: 'Human Resources specialist', order: 5 },
    { name: 'HR Manager', code: 'HR_MGR', description: 'Human Resources manager', order: 6 },
    { name: 'Finance Analyst', code: 'FIN_ANL', description: 'Financial analyst', order: 7 },
    { name: 'Finance Manager', code: 'FIN_MGR', description: 'Finance department manager', order: 8 },
    { name: 'Sales Representative', code: 'SALES_REP', description: 'Sales representative', order: 9 },
    { name: 'Sales Manager', code: 'SALES_MGR', description: 'Sales department manager', order: 10 },
    { name: 'Marketing Specialist', code: 'MKT_SPEC', description: 'Marketing specialist', order: 11 },
    { name: 'Department Director', code: 'DEPT_DIR', description: 'Department director', order: 12 },
    { name: 'Vice President', code: 'VP', description: 'Vice President', order: 13 },
    { name: 'Chief Executive Officer', code: 'CEO', description: 'CEO', order: 14 },
    { name: 'Chief Technology Officer', code: 'CTO', description: 'CTO', order: 15 },
    { name: 'Chief Financial Officer', code: 'CFO', description: 'CFO', order: 16 },
    { name: 'System Administrator', code: 'SYS_ADMIN', description: 'System administrator', order: 17 },
  ]

  for (const pos of positions) {
    await prisma.position.upsert({
      where: { code: pos.code },
      update: pos,
      create: pos,
    })
  }

  // =====================
  // 3. LEAVE TYPES
  // =====================
  console.log('🏖️ Creating leave types...')

  const leaveTypes = [
    {
      name: 'Normal Leave',
      code: 'NL',
      daysAllowed: 21,
      carryForward: true,
      maxCarryForward: 5,
      requiresApproval: true,
      requiresDocument: false,
      description: 'Standard annual leave entitlement',
      isActive: true,
      maxDaysPerRequest: 14,
      isSpecialLeave: false,
      requiresHRVerification: false,
    },
    {
      name: 'Sick Leave',
      code: 'SL',
      daysAllowed: 180,
      carryForward: false,
      requiresApproval: true,
      requiresDocument: true,
      description: 'Medical leave with doctor certificate',
      isActive: true,
      maxDaysPerRequest: 30,
      isSpecialLeave: false,
      requiresHRVerification: true,
      documentTypes: ['medical_certificate'],
    },
    {
      name: 'Paternity Leave',
      code: 'PAT',
      daysAllowed: 5,
      carryForward: false,
      requiresApproval: true,
      requiresDocument: true,
      description: 'Leave for new fathers',
      isActive: true,
      maxDaysPerRequest: 5,
      isSpecialLeave: true,
      requiresHRVerification: true,
      documentTypes: ['birth_certificate'],
    },
    {
      name: 'Maternity Leave',
      code: 'MAT',
      daysAllowed: 126,
      carryForward: false,
      requiresApproval: true,
      requiresDocument: true,
      description: 'Leave for new mothers (126 days)',
      isActive: true,
      maxDaysPerRequest: 126,
      isSpecialLeave: true,
      requiresHRVerification: true,
      documentTypes: ['medical_certificate', 'birth_certificate'],
    },
    {
      name: 'Marriage Leave',
      code: 'MARR',
      daysAllowed: 5,
      carryForward: false,
      requiresApproval: true,
      requiresDocument: true,
      description: 'Leave for employee marriage',
      isActive: true,
      maxDaysPerRequest: 5,
      isSpecialLeave: true,
      requiresHRVerification: true,
      documentTypes: ['marriage_certificate'],
    },
    {
      name: 'Bereavement Leave',
      code: 'BER',
      daysAllowed: 3,
      carryForward: false,
      requiresApproval: true,
      requiresDocument: true,
      description: 'Leave for death of immediate family member',
      isActive: true,
      maxDaysPerRequest: 3,
      isSpecialLeave: true,
      requiresHRVerification: true,
      documentTypes: ['death_certificate'],
    },
    {
      name: 'Study Leave',
      code: 'STD',
      daysAllowed: 10,
      carryForward: false,
      requiresApproval: true,
      requiresDocument: true,
      description: 'Leave for exams and professional development',
      isActive: true,
      maxDaysPerRequest: 5,
      isSpecialLeave: true,
      requiresHRVerification: false,
      documentTypes: ['enrollment_proof'],
    },
    {
      name: 'Unpaid Leave',
      code: 'UPL',
      daysAllowed: 30,
      carryForward: false,
      requiresApproval: true,
      requiresDocument: false,
      description: 'Leave without pay',
      isActive: true,
      maxDaysPerRequest: 30,
      isSpecialLeave: false,
      requiresHRVerification: true,
    },
    {
      name: 'Child Care Leave',
      code: 'CCL',
      daysAllowed: 2,
      carryForward: false,
      requiresApproval: true,
      requiresDocument: false,
      description: 'Leave for child care responsibilities (per event)',
      isActive: true,
      maxDaysPerRequest: 2,
      isSpecialLeave: true,
      requiresHRVerification: false,
    },
    {
      name: 'Blood Donation Leave',
      code: 'BDL',
      daysAllowed: 1,
      carryForward: false,
      requiresApproval: true,
      requiresDocument: true,
      description: 'Leave for blood donation',
      isActive: true,
      maxDaysPerRequest: 1,
      isSpecialLeave: true,
      requiresHRVerification: false,
      documentTypes: ['donation_certificate'],
    },
  ]

  const createdLeaveTypes: Record<string, string> = {}
  for (const lt of leaveTypes) {
    const created = await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: lt,
      create: lt,
    })
    createdLeaveTypes[lt.code] = created.id
  }

  // =====================
  // 4. USERS - Executives (CEO, CTO, CFO)
  // =====================
  console.log('👥 Creating executives...')

  // Create executives first - they can approve each other (edge case scenario)
  const ceo = await prisma.user.upsert({
    where: { email: 'ceo@staging.local' },
    update: {},
    create: {
      email: 'ceo@staging.local',
      password: hashedPassword,
      firstName: 'Maria',
      lastName: 'Popescu',
      employeeId: generateEmployeeId('EXEC', 1),
      role: Role.EXECUTIVE,
      department: 'Executive Office',
      position: 'Chief Executive Officer',
      joiningDate: new Date('2018-01-15'),
      phoneNumber: '+40 721 000 001',
      isActive: true,
    },
  })

  const cto = await prisma.user.upsert({
    where: { email: 'cto@staging.local' },
    update: {},
    create: {
      email: 'cto@staging.local',
      password: hashedPassword,
      firstName: 'Alexandru',
      lastName: 'Ionescu',
      employeeId: generateEmployeeId('EXEC', 2),
      role: Role.EXECUTIVE,
      department: 'Executive Office',
      position: 'Chief Technology Officer',
      joiningDate: new Date('2019-03-01'),
      phoneNumber: '+40 721 000 002',
      isActive: true,
      managerId: ceo.id, // CEO is the manager
    },
  })

  const cfo = await prisma.user.upsert({
    where: { email: 'cfo@staging.local' },
    update: {},
    create: {
      email: 'cfo@staging.local',
      password: hashedPassword,
      firstName: 'Elena',
      lastName: 'Dumitrescu',
      employeeId: generateEmployeeId('EXEC', 3),
      role: Role.EXECUTIVE,
      department: 'Executive Office',
      position: 'Chief Financial Officer',
      joiningDate: new Date('2019-06-15'),
      phoneNumber: '+40 721 000 003',
      isActive: true,
      managerId: ceo.id,
    },
  })

  // Update CEO to have CTO as alternate approver (edge case: executives approving each other)
  await prisma.user.update({
    where: { id: ceo.id },
    data: { departmentDirectorId: cto.id },
  })

  // =====================
  // 5. ADMIN USER
  // =====================
  console.log('🔧 Creating admin users...')

  const admin1 = await prisma.user.upsert({
    where: { email: 'admin@staging.local' },
    update: {},
    create: {
      email: 'admin@staging.local',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      employeeId: generateEmployeeId('ADM', 1),
      role: Role.ADMIN,
      department: 'IT Support',
      position: 'System Administrator',
      joiningDate: new Date('2020-01-01'),
      phoneNumber: '+40 721 000 100',
      isActive: true,
    },
  })

  const admin2 = await prisma.user.upsert({
    where: { email: 'admin2@staging.local' },
    update: {},
    create: {
      email: 'admin2@staging.local',
      password: hashedPassword,
      firstName: 'Backup',
      lastName: 'Admin',
      employeeId: generateEmployeeId('ADM', 2),
      role: Role.ADMIN,
      department: 'IT Support',
      position: 'System Administrator',
      joiningDate: new Date('2021-03-15'),
      phoneNumber: '+40 721 000 101',
      isActive: true,
    },
  })

  // =====================
  // 6. HR USERS
  // =====================
  console.log('👥 Creating HR users...')

  const hrManager = await prisma.user.upsert({
    where: { email: 'hr.manager@staging.local' },
    update: {},
    create: {
      email: 'hr.manager@staging.local',
      password: hashedPassword,
      firstName: 'Diana',
      lastName: 'Vasilescu',
      employeeId: generateEmployeeId('HR', 1),
      role: Role.HR,
      department: 'Human Resources',
      position: 'HR Manager',
      joiningDate: new Date('2019-02-01'),
      phoneNumber: '+40 721 000 200',
      isActive: true,
      managerId: ceo.id,
    },
  })

  const hrSpecialist1 = await prisma.user.upsert({
    where: { email: 'hr1@staging.local' },
    update: {},
    create: {
      email: 'hr1@staging.local',
      password: hashedPassword,
      firstName: 'Ioana',
      lastName: 'Stanescu',
      employeeId: generateEmployeeId('HR', 2),
      role: Role.HR,
      department: 'Human Resources',
      position: 'HR Specialist',
      joiningDate: new Date('2020-05-01'),
      phoneNumber: '+40 721 000 201',
      isActive: true,
      managerId: hrManager.id,
    },
  })

  const hrSpecialist2 = await prisma.user.upsert({
    where: { email: 'hr2@staging.local' },
    update: {},
    create: {
      email: 'hr2@staging.local',
      password: hashedPassword,
      firstName: 'Andreea',
      lastName: 'Moldovan',
      employeeId: generateEmployeeId('HR', 3),
      role: Role.HR,
      department: 'Human Resources',
      position: 'HR Specialist',
      joiningDate: new Date('2021-01-15'),
      phoneNumber: '+40 721 000 202',
      isActive: true,
      managerId: hrManager.id,
    },
  })

  // =====================
  // 7. DEPARTMENT DIRECTORS
  // =====================
  console.log('👥 Creating department directors...')

  const engDirector = await prisma.user.upsert({
    where: { email: 'eng.director@staging.local' },
    update: {},
    create: {
      email: 'eng.director@staging.local',
      password: hashedPassword,
      firstName: 'Bogdan',
      lastName: 'Cristea',
      employeeId: generateEmployeeId('DIR', 1),
      role: Role.DEPARTMENT_DIRECTOR,
      department: 'Engineering',
      position: 'Department Director',
      joiningDate: new Date('2018-06-01'),
      phoneNumber: '+40 721 000 300',
      isActive: true,
      managerId: cto.id,
    },
  })

  const finDirector = await prisma.user.upsert({
    where: { email: 'fin.director@staging.local' },
    update: {},
    create: {
      email: 'fin.director@staging.local',
      password: hashedPassword,
      firstName: 'Catalin',
      lastName: 'Marinescu',
      employeeId: generateEmployeeId('DIR', 2),
      role: Role.DEPARTMENT_DIRECTOR,
      department: 'Finance',
      position: 'Department Director',
      joiningDate: new Date('2019-01-01'),
      phoneNumber: '+40 721 000 301',
      isActive: true,
      managerId: cfo.id,
    },
  })

  const salesDirector = await prisma.user.upsert({
    where: { email: 'sales.director@staging.local' },
    update: {},
    create: {
      email: 'sales.director@staging.local',
      password: hashedPassword,
      firstName: 'Mihai',
      lastName: 'Gheorghiu',
      employeeId: generateEmployeeId('DIR', 3),
      role: Role.DEPARTMENT_DIRECTOR,
      department: 'Sales',
      position: 'Department Director',
      joiningDate: new Date('2019-04-01'),
      phoneNumber: '+40 721 000 302',
      isActive: true,
      managerId: ceo.id,
    },
  })

  // =====================
  // 8. MANAGERS
  // =====================
  console.log('👥 Creating managers...')

  const engManager1 = await prisma.user.upsert({
    where: { email: 'eng.manager1@staging.local' },
    update: {},
    create: {
      email: 'eng.manager1@staging.local',
      password: hashedPassword,
      firstName: 'Razvan',
      lastName: 'Popa',
      employeeId: generateEmployeeId('MGR', 1),
      role: Role.MANAGER,
      department: 'Engineering',
      position: 'Engineering Manager',
      joiningDate: new Date('2019-09-01'),
      phoneNumber: '+40 721 000 400',
      isActive: true,
      managerId: engDirector.id,
      departmentDirectorId: engDirector.id,
    },
  })

  const engManager2 = await prisma.user.upsert({
    where: { email: 'eng.manager2@staging.local' },
    update: {},
    create: {
      email: 'eng.manager2@staging.local',
      password: hashedPassword,
      firstName: 'Florin',
      lastName: 'Diaconu',
      employeeId: generateEmployeeId('MGR', 2),
      role: Role.MANAGER,
      department: 'Engineering',
      position: 'Tech Lead',
      joiningDate: new Date('2020-02-01'),
      phoneNumber: '+40 721 000 401',
      isActive: true,
      managerId: engDirector.id,
      departmentDirectorId: engDirector.id,
    },
  })

  const finManager = await prisma.user.upsert({
    where: { email: 'fin.manager@staging.local' },
    update: {},
    create: {
      email: 'fin.manager@staging.local',
      password: hashedPassword,
      firstName: 'Adriana',
      lastName: 'Radu',
      employeeId: generateEmployeeId('MGR', 3),
      role: Role.MANAGER,
      department: 'Finance',
      position: 'Finance Manager',
      joiningDate: new Date('2020-01-15'),
      phoneNumber: '+40 721 000 402',
      isActive: true,
      managerId: finDirector.id,
      departmentDirectorId: finDirector.id,
    },
  })

  const salesManager = await prisma.user.upsert({
    where: { email: 'sales.manager@staging.local' },
    update: {},
    create: {
      email: 'sales.manager@staging.local',
      password: hashedPassword,
      firstName: 'Cristian',
      lastName: 'Negru',
      employeeId: generateEmployeeId('MGR', 4),
      role: Role.MANAGER,
      department: 'Sales',
      position: 'Sales Manager',
      joiningDate: new Date('2020-03-01'),
      phoneNumber: '+40 721 000 403',
      isActive: true,
      managerId: salesDirector.id,
      departmentDirectorId: salesDirector.id,
    },
  })

  // =====================
  // 9. EMPLOYEES
  // =====================
  console.log('👥 Creating employees...')

  // Engineering employees under manager 1
  const emp1 = await prisma.user.upsert({
    where: { email: 'dev1@staging.local' },
    update: {},
    create: {
      email: 'dev1@staging.local',
      password: hashedPassword,
      firstName: 'Andrei',
      lastName: 'Stoica',
      employeeId: generateEmployeeId('EMP', 1),
      role: Role.EMPLOYEE,
      department: 'Engineering',
      position: 'Senior Developer',
      joiningDate: new Date('2020-06-01'),
      phoneNumber: '+40 721 000 500',
      isActive: true,
      managerId: engManager1.id,
      departmentDirectorId: engDirector.id,
    },
  })

  const emp2 = await prisma.user.upsert({
    where: { email: 'dev2@staging.local' },
    update: {},
    create: {
      email: 'dev2@staging.local',
      password: hashedPassword,
      firstName: 'Vlad',
      lastName: 'Barbu',
      employeeId: generateEmployeeId('EMP', 2),
      role: Role.EMPLOYEE,
      department: 'Engineering',
      position: 'Junior Developer',
      joiningDate: new Date('2021-01-15'),
      phoneNumber: '+40 721 000 501',
      isActive: true,
      managerId: engManager1.id,
      departmentDirectorId: engDirector.id,
    },
  })

  const emp3 = await prisma.user.upsert({
    where: { email: 'dev3@staging.local' },
    update: {},
    create: {
      email: 'dev3@staging.local',
      password: hashedPassword,
      firstName: 'George',
      lastName: 'Munteanu',
      employeeId: generateEmployeeId('EMP', 3),
      role: Role.EMPLOYEE,
      department: 'Engineering',
      position: 'Senior Developer',
      joiningDate: new Date('2019-11-01'),
      phoneNumber: '+40 721 000 502',
      isActive: true,
      managerId: engManager1.id,
      departmentDirectorId: engDirector.id,
    },
  })

  // Engineering employees under manager 2
  const emp4 = await prisma.user.upsert({
    where: { email: 'dev4@staging.local' },
    update: {},
    create: {
      email: 'dev4@staging.local',
      password: hashedPassword,
      firstName: 'Stefan',
      lastName: 'Lazar',
      employeeId: generateEmployeeId('EMP', 4),
      role: Role.EMPLOYEE,
      department: 'Engineering',
      position: 'Senior Developer',
      joiningDate: new Date('2020-09-01'),
      phoneNumber: '+40 721 000 503',
      isActive: true,
      managerId: engManager2.id,
      departmentDirectorId: engDirector.id,
    },
  })

  const emp5 = await prisma.user.upsert({
    where: { email: 'dev5@staging.local' },
    update: {},
    create: {
      email: 'dev5@staging.local',
      password: hashedPassword,
      firstName: 'Ana',
      lastName: 'Serban',
      employeeId: generateEmployeeId('EMP', 5),
      role: Role.EMPLOYEE,
      department: 'Engineering',
      position: 'Junior Developer',
      joiningDate: new Date('2022-03-01'),
      phoneNumber: '+40 721 000 504',
      isActive: true,
      managerId: engManager2.id,
      departmentDirectorId: engDirector.id,
    },
  })

  // Finance employees
  const emp6 = await prisma.user.upsert({
    where: { email: 'fin1@staging.local' },
    update: {},
    create: {
      email: 'fin1@staging.local',
      password: hashedPassword,
      firstName: 'Larisa',
      lastName: 'Preda',
      employeeId: generateEmployeeId('EMP', 6),
      role: Role.EMPLOYEE,
      department: 'Finance',
      position: 'Finance Analyst',
      joiningDate: new Date('2020-07-01'),
      phoneNumber: '+40 721 000 600',
      isActive: true,
      managerId: finManager.id,
      departmentDirectorId: finDirector.id,
    },
  })

  const emp7 = await prisma.user.upsert({
    where: { email: 'fin2@staging.local' },
    update: {},
    create: {
      email: 'fin2@staging.local',
      password: hashedPassword,
      firstName: 'Oana',
      lastName: 'Ene',
      employeeId: generateEmployeeId('EMP', 7),
      role: Role.EMPLOYEE,
      department: 'Finance',
      position: 'Finance Analyst',
      joiningDate: new Date('2021-04-15'),
      phoneNumber: '+40 721 000 601',
      isActive: true,
      managerId: finManager.id,
      departmentDirectorId: finDirector.id,
    },
  })

  // Sales employees
  const emp8 = await prisma.user.upsert({
    where: { email: 'sales1@staging.local' },
    update: {},
    create: {
      email: 'sales1@staging.local',
      password: hashedPassword,
      firstName: 'Marius',
      lastName: 'Tudor',
      employeeId: generateEmployeeId('EMP', 8),
      role: Role.EMPLOYEE,
      department: 'Sales',
      position: 'Sales Representative',
      joiningDate: new Date('2020-08-01'),
      phoneNumber: '+40 721 000 700',
      isActive: true,
      managerId: salesManager.id,
      departmentDirectorId: salesDirector.id,
    },
  })

  const emp9 = await prisma.user.upsert({
    where: { email: 'sales2@staging.local' },
    update: {},
    create: {
      email: 'sales2@staging.local',
      password: hashedPassword,
      firstName: 'Roxana',
      lastName: 'Voicu',
      employeeId: generateEmployeeId('EMP', 9),
      role: Role.EMPLOYEE,
      department: 'Sales',
      position: 'Sales Representative',
      joiningDate: new Date('2021-02-01'),
      phoneNumber: '+40 721 000 701',
      isActive: true,
      managerId: salesManager.id,
      departmentDirectorId: salesDirector.id,
    },
  })

  // Part-time employee
  const empPartTime = await prisma.user.upsert({
    where: { email: 'parttime@staging.local' },
    update: {},
    create: {
      email: 'parttime@staging.local',
      password: hashedPassword,
      firstName: 'Iulia',
      lastName: 'Coman',
      employeeId: generateEmployeeId('EMP', 10),
      role: Role.EMPLOYEE,
      department: 'Engineering',
      position: 'Junior Developer',
      joiningDate: new Date('2022-01-15'),
      phoneNumber: '+40 721 000 800',
      isActive: true,
      managerId: engManager1.id,
      departmentDirectorId: engDirector.id,
      workingPattern: 'PART_TIME',
      workingDaysPerWeek: 3,
      workingHoursPerWeek: 24,
    },
  })

  // Intern
  const intern = await prisma.user.upsert({
    where: { email: 'intern@staging.local' },
    update: {},
    create: {
      email: 'intern@staging.local',
      password: hashedPassword,
      firstName: 'Cosmin',
      lastName: 'Mihai',
      employeeId: generateEmployeeId('EMP', 11),
      role: Role.EMPLOYEE,
      department: 'Engineering',
      position: 'Junior Developer',
      joiningDate: new Date('2024-09-01'),
      phoneNumber: '+40 721 000 801',
      isActive: true,
      managerId: engManager2.id,
      departmentDirectorId: engDirector.id,
      contractType: 'INTERN',
    },
  })

  // Inactive employee (for testing)
  await prisma.user.upsert({
    where: { email: 'inactive@staging.local' },
    update: {},
    create: {
      email: 'inactive@staging.local',
      password: hashedPassword,
      firstName: 'Former',
      lastName: 'Employee',
      employeeId: generateEmployeeId('EMP', 99),
      role: Role.EMPLOYEE,
      department: 'Engineering',
      position: 'Senior Developer',
      joiningDate: new Date('2019-01-01'),
      phoneNumber: '+40 721 000 999',
      isActive: false,
      managerId: engManager1.id,
    },
  })

  // Collect all active employees for leave balances
  const allActiveUsers = [
    ceo, cto, cfo, admin1, admin2, hrManager, hrSpecialist1, hrSpecialist2,
    engDirector, finDirector, salesDirector, engManager1, engManager2,
    finManager, salesManager, emp1, emp2, emp3, emp4, emp5, emp6, emp7,
    emp8, emp9, empPartTime, intern
  ]

  // =====================
  // 10. LEAVE BALANCES
  // =====================
  console.log('📊 Creating leave balances...')

  const currentYear = new Date().getFullYear()
  const normalLeaveTypeId = createdLeaveTypes['NL']

  for (const user of allActiveUsers) {
    // Pro-rata calculation for new joiners
    const joiningYear = user.joiningDate.getFullYear()
    let entitled = 21 // Default entitlement

    // Part-time adjustment
    if (user.workingPattern === 'PART_TIME') {
      entitled = Math.round(21 * (user.workingDaysPerWeek / 5))
    }

    // Pro-rata for current year joiners
    if (joiningYear === currentYear) {
      const monthsRemaining = 12 - user.joiningDate.getMonth()
      entitled = Math.round((entitled * monthsRemaining) / 12)
    }

    // Random usage for testing (some have used days, some haven't)
    const usedDays = Math.floor(Math.random() * Math.min(entitled, 10))
    const pendingDays = Math.floor(Math.random() * 3)

    await prisma.leaveBalance.upsert({
      where: {
        userId_leaveTypeId_year: {
          userId: user.id,
          leaveTypeId: normalLeaveTypeId,
          year: currentYear,
        },
      },
      update: {
        entitled,
        used: usedDays,
        pending: pendingDays,
        available: entitled - usedDays - pendingDays,
      },
      create: {
        userId: user.id,
        leaveTypeId: normalLeaveTypeId,
        year: currentYear,
        entitled,
        used: usedDays,
        pending: pendingDays,
        available: entitled - usedDays - pendingDays,
        carriedForward: currentYear > 2024 ? Math.floor(Math.random() * 5) : 0,
      },
    })
  }

  // =====================
  // 11. ROMANIAN PUBLIC HOLIDAYS
  // =====================
  console.log('🎄 Creating Romanian public holidays...')

  const holidays = [
    { nameEn: "New Year's Day", nameRo: 'Anul Nou', date: `${currentYear}-01-01` },
    { nameEn: "Day After New Year", nameRo: 'A doua zi de Anul Nou', date: `${currentYear}-01-02` },
    { nameEn: 'Union Day', nameRo: 'Ziua Unirii', date: `${currentYear}-01-24` },
    { nameEn: 'Easter Monday (Orthodox)', nameRo: 'A doua zi de Paște', date: `${currentYear}-05-05` }, // 2025 date
    { nameEn: 'Labour Day', nameRo: 'Ziua Muncii', date: `${currentYear}-05-01` },
    { nameEn: "Children's Day", nameRo: 'Ziua Copilului', date: `${currentYear}-06-01` },
    { nameEn: 'Whit Monday', nameRo: 'A doua zi de Rusalii', date: `${currentYear}-06-23` }, // 2025 date
    { nameEn: 'Dormition of the Mother of God', nameRo: 'Adormirea Maicii Domnului', date: `${currentYear}-08-15` },
    { nameEn: "St. Andrew's Day", nameRo: 'Sfântul Andrei', date: `${currentYear}-11-30` },
    { nameEn: 'National Day', nameRo: 'Ziua Națională', date: `${currentYear}-12-01` },
    { nameEn: 'Christmas Day', nameRo: 'Crăciunul', date: `${currentYear}-12-25` },
    { nameEn: 'Second Day of Christmas', nameRo: 'A doua zi de Crăciun', date: `${currentYear}-12-26` },
  ]

  for (const holiday of holidays) {
    await prisma.holiday.upsert({
      where: {
        date_nameEn: {
          date: new Date(holiday.date),
          nameEn: holiday.nameEn,
        },
      },
      update: {},
      create: {
        nameEn: holiday.nameEn,
        nameRo: holiday.nameRo,
        date: new Date(holiday.date),
        isRecurring: true,
        country: 'RO',
        isActive: true,
        isBlocked: true,
      },
    })
  }

  // =====================
  // 12. HISTORICAL LEAVE REQUESTS
  // =====================
  console.log('📝 Creating historical leave requests...')

  // Helper to create request number
  function createRequestNumber(): string {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000)
    return `LR-${timestamp}-${random}`
  }

  // APPROVED request (completed, 30 days ago)
  const approvedRequest = await prisma.leaveRequest.upsert({
    where: { requestNumber: 'LR-SEED-APPROVED-1' },
    update: {},
    create: {
      requestNumber: 'LR-SEED-APPROVED-1',
      userId: emp1.id,
      leaveTypeId: normalLeaveTypeId,
      startDate: daysAgo(35),
      endDate: daysAgo(31),
      totalDays: 5,
      reason: 'Family vacation to the seaside',
      status: RequestStatus.APPROVED,
      selectedDates: [daysAgo(35), daysAgo(34), daysAgo(33), daysAgo(32), daysAgo(31)],
    },
  })

  // Create approval for approved request
  await prisma.approval.upsert({
    where: {
      id: `APR-${approvedRequest.id}-1`,
    },
    update: {},
    create: {
      id: `APR-${approvedRequest.id}-1`,
      leaveRequestId: approvedRequest.id,
      approverId: engManager1.id,
      level: 1,
      status: ApprovalStatus.APPROVED,
      comments: 'Approved. Enjoy your vacation!',
      approvedAt: daysAgo(36),
    },
  })

  // PENDING request (waiting for manager approval)
  const pendingRequest1 = await prisma.leaveRequest.upsert({
    where: { requestNumber: 'LR-SEED-PENDING-1' },
    update: {},
    create: {
      requestNumber: 'LR-SEED-PENDING-1',
      userId: emp2.id,
      leaveTypeId: normalLeaveTypeId,
      startDate: daysFromNow(14),
      endDate: daysFromNow(18),
      totalDays: 5,
      reason: 'Personal matters',
      status: RequestStatus.PENDING,
      selectedDates: [daysFromNow(14), daysFromNow(15), daysFromNow(16), daysFromNow(17), daysFromNow(18)],
    },
  })

  await prisma.approval.upsert({
    where: {
      id: `APR-${pendingRequest1.id}-1`,
    },
    update: {},
    create: {
      id: `APR-${pendingRequest1.id}-1`,
      leaveRequestId: pendingRequest1.id,
      approverId: engManager1.id,
      level: 1,
      status: ApprovalStatus.PENDING,
    },
  })

  // PENDING request (longer leave, needs director approval)
  const pendingRequest2 = await prisma.leaveRequest.upsert({
    where: { requestNumber: 'LR-SEED-PENDING-2' },
    update: {},
    create: {
      requestNumber: 'LR-SEED-PENDING-2',
      userId: emp3.id,
      leaveTypeId: normalLeaveTypeId,
      startDate: daysFromNow(30),
      endDate: daysFromNow(44),
      totalDays: 15,
      reason: 'Extended holiday abroad',
      status: RequestStatus.PENDING,
      selectedDates: Array.from({ length: 15 }, (_, i) => daysFromNow(30 + i)),
    },
  })

  // First level approved by manager
  await prisma.approval.upsert({
    where: {
      id: `APR-${pendingRequest2.id}-1`,
    },
    update: {},
    create: {
      id: `APR-${pendingRequest2.id}-1`,
      leaveRequestId: pendingRequest2.id,
      approverId: engManager1.id,
      level: 1,
      status: ApprovalStatus.APPROVED,
      comments: 'Approved from my side',
      approvedAt: daysAgo(1),
    },
  })

  // Waiting for director approval
  await prisma.approval.upsert({
    where: {
      id: `APR-${pendingRequest2.id}-2`,
    },
    update: {},
    create: {
      id: `APR-${pendingRequest2.id}-2`,
      leaveRequestId: pendingRequest2.id,
      approverId: engDirector.id,
      level: 2,
      status: ApprovalStatus.PENDING,
    },
  })

  // REJECTED request
  const rejectedRequest = await prisma.leaveRequest.upsert({
    where: { requestNumber: 'LR-SEED-REJECTED-1' },
    update: {},
    create: {
      requestNumber: 'LR-SEED-REJECTED-1',
      userId: emp4.id,
      leaveTypeId: normalLeaveTypeId,
      startDate: daysAgo(20),
      endDate: daysAgo(15),
      totalDays: 6,
      reason: 'Trip with friends',
      status: RequestStatus.REJECTED,
      selectedDates: Array.from({ length: 6 }, (_, i) => daysAgo(20 - i)),
    },
  })

  await prisma.approval.upsert({
    where: {
      id: `APR-${rejectedRequest.id}-1`,
    },
    update: {},
    create: {
      id: `APR-${rejectedRequest.id}-1`,
      leaveRequestId: rejectedRequest.id,
      approverId: engManager2.id,
      level: 1,
      status: ApprovalStatus.REJECTED,
      comments: 'Critical project deadline during this period. Please reschedule.',
      approvedAt: daysAgo(22),
    },
  })

  // CANCELLED request
  const cancelledRequest = await prisma.leaveRequest.upsert({
    where: { requestNumber: 'LR-SEED-CANCELLED-1' },
    update: {},
    create: {
      requestNumber: 'LR-SEED-CANCELLED-1',
      userId: emp5.id,
      leaveTypeId: normalLeaveTypeId,
      startDate: daysFromNow(60),
      endDate: daysFromNow(64),
      totalDays: 5,
      reason: 'Summer vacation',
      status: RequestStatus.CANCELLED,
      selectedDates: Array.from({ length: 5 }, (_, i) => daysFromNow(60 + i)),
    },
  })

  // DRAFT request (not submitted yet)
  await prisma.leaveRequest.upsert({
    where: { requestNumber: 'LR-SEED-DRAFT-1' },
    update: {},
    create: {
      requestNumber: 'LR-SEED-DRAFT-1',
      userId: emp6.id,
      leaveTypeId: normalLeaveTypeId,
      startDate: daysFromNow(90),
      endDate: daysFromNow(94),
      totalDays: 5,
      reason: 'Tentative vacation plans',
      status: RequestStatus.DRAFT,
      selectedDates: Array.from({ length: 5 }, (_, i) => daysFromNow(90 + i)),
    },
  })

  // Sick leave request (with HR verification)
  const sickLeave = await prisma.leaveRequest.upsert({
    where: { requestNumber: 'LR-SEED-SICK-1' },
    update: {},
    create: {
      requestNumber: 'LR-SEED-SICK-1',
      userId: emp7.id,
      leaveTypeId: createdLeaveTypes['SL'],
      startDate: daysAgo(10),
      endDate: daysAgo(7),
      totalDays: 4,
      reason: 'Flu symptoms',
      status: RequestStatus.APPROVED,
      selectedDates: [daysAgo(10), daysAgo(9), daysAgo(8), daysAgo(7)],
      hrDocumentVerified: true,
      hrVerifiedBy: hrSpecialist1.id,
      hrVerifiedAt: daysAgo(6),
      hrVerificationNotes: 'Medical certificate verified',
    },
  })

  await prisma.approval.upsert({
    where: {
      id: `APR-${sickLeave.id}-1`,
    },
    update: {},
    create: {
      id: `APR-${sickLeave.id}-1`,
      leaveRequestId: sickLeave.id,
      approverId: finManager.id,
      level: 1,
      status: ApprovalStatus.APPROVED,
      comments: 'Get well soon!',
      approvedAt: daysAgo(9),
    },
  })

  // Executive leave request (CTO requests leave, CEO approves - edge case)
  const execLeave = await prisma.leaveRequest.upsert({
    where: { requestNumber: 'LR-SEED-EXEC-1' },
    update: {},
    create: {
      requestNumber: 'LR-SEED-EXEC-1',
      userId: cto.id,
      leaveTypeId: normalLeaveTypeId,
      startDate: daysFromNow(45),
      endDate: daysFromNow(52),
      totalDays: 8,
      reason: 'International tech conference and vacation',
      status: RequestStatus.PENDING,
      selectedDates: Array.from({ length: 8 }, (_, i) => daysFromNow(45 + i)),
    },
  })

  // CEO needs to approve CTO's leave
  await prisma.approval.upsert({
    where: {
      id: `APR-${execLeave.id}-1`,
    },
    update: {},
    create: {
      id: `APR-${execLeave.id}-1`,
      leaveRequestId: execLeave.id,
      approverId: ceo.id,
      level: 1,
      status: ApprovalStatus.PENDING,
    },
  })

  // =====================
  // 13. COMPANY SETTINGS
  // =====================
  console.log('⚙️ Creating company settings...')

  const companySettings = [
    {
      key: 'company_info',
      value: {
        name: 'Staging Company SRL',
        country: 'Romania',
        timezone: 'Europe/Bucharest',
      },
      category: 'general',
      description: 'Company information',
    },
    {
      key: 'default_leave_days',
      value: {
        normalLeaveDays: 21,
        maxCarryForwardDays: 5,
      },
      category: 'leave',
      description: 'Default leave allocation settings',
    },
    {
      key: 'approval_settings',
      value: {
        autoApproveThreshold: 0,
        escalationDays: 3,
        requireDirectorApprovalAboveDays: 10,
      },
      category: 'approval',
      description: 'Approval workflow settings',
    },
    {
      key: 'notification_settings',
      value: {
        sendEmailNotifications: true,
        sendReminderBeforeDays: 7,
        sendBalanceWarningBelow: 5,
      },
      category: 'notifications',
      description: 'Notification settings',
    },
    {
      key: 'holiday_planning_settings',
      value: {
        draftStartMonth: 10,
        draftStartDay: 1,
        submissionEndMonth: 11,
        submissionEndDay: 30,
        finalizationMonth: 12,
        finalizationDay: 31,
      },
      category: 'holiday_planning',
      description: 'Holiday planning window settings',
    },
  ]

  for (const setting of companySettings) {
    await prisma.companySetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    })
  }

  // =====================
  // 14. WORKFLOW RULES
  // =====================
  console.log('📋 Creating workflow rules...')

  const workflowRules = [
    {
      name: 'Standard Leave Approval',
      description: 'Standard approval flow for leave requests up to 10 days',
      conditions: {
        maxDays: 10,
        leaveTypes: ['NL', 'SL', 'STD'],
      },
      approvalLevels: [
        { level: 1, role: 'MANAGER', description: 'Direct manager approval' },
      ],
      skipDuplicateSignatures: true,
      priority: 1,
      isActive: true,
    },
    {
      name: 'Extended Leave Approval',
      description: 'Multi-level approval for leave requests over 10 days',
      conditions: {
        minDays: 11,
        leaveTypes: ['NL'],
      },
      approvalLevels: [
        { level: 1, role: 'MANAGER', description: 'Direct manager approval' },
        { level: 2, role: 'DEPARTMENT_DIRECTOR', description: 'Department director approval' },
      ],
      skipDuplicateSignatures: true,
      priority: 2,
      isActive: true,
    },
    {
      name: 'Special Leave HR Verification',
      description: 'Special leave types requiring HR verification',
      conditions: {
        leaveTypes: ['PAT', 'MAT', 'MARR', 'BER'],
      },
      approvalLevels: [
        { level: 1, role: 'MANAGER', description: 'Direct manager approval' },
        { level: 2, role: 'HR', description: 'HR verification of documents' },
      ],
      skipDuplicateSignatures: true,
      priority: 3,
      isActive: true,
    },
    {
      name: 'Executive Leave Approval',
      description: 'Approval flow for executive-level employees',
      conditions: {
        roles: ['EXECUTIVE', 'DEPARTMENT_DIRECTOR'],
      },
      approvalLevels: [
        { level: 1, role: 'EXECUTIVE', description: 'CEO/higher executive approval' },
      ],
      skipDuplicateSignatures: true,
      priority: 10,
      isActive: true,
    },
  ]

  for (const rule of workflowRules) {
    const existingRule = await prisma.workflowRule.findFirst({
      where: { name: rule.name },
    })

    if (!existingRule) {
      await prisma.workflowRule.create({
        data: rule,
      })
    }
  }

  // =====================
  // 15. APPROVAL DELEGATES (for testing delegation)
  // =====================
  console.log('🔄 Creating approval delegates...')

  // Manager 1 delegates to Manager 2 (vacation coverage)
  await prisma.approvalDelegate.upsert({
    where: {
      delegatorId_delegateId_startDate: {
        delegatorId: engManager1.id,
        delegateId: engManager2.id,
        startDate: daysFromNow(60),
      },
    },
    update: {},
    create: {
      delegatorId: engManager1.id,
      delegateId: engManager2.id,
      startDate: daysFromNow(60),
      endDate: daysFromNow(74),
      reason: 'Summer vacation coverage',
      isActive: true,
    },
  })

  // =====================
  // 16. NOTIFICATIONS (for testing notification system)
  // =====================
  console.log('🔔 Creating sample notifications...')

  await prisma.notification.createMany({
    skipDuplicates: true,
    data: [
      {
        userId: engManager1.id,
        type: 'APPROVAL_REQUIRED',
        title: 'New Leave Request',
        message: 'Vlad Barbu has submitted a leave request for 5 days',
        link: `/manager/approvals`,
        isRead: false,
      },
      {
        userId: emp1.id,
        type: 'LEAVE_APPROVED',
        title: 'Leave Request Approved',
        message: 'Your leave request for 5 days has been approved',
        link: '/employee/leave-requests',
        isRead: true,
        readAt: daysAgo(30),
      },
      {
        userId: emp4.id,
        type: 'LEAVE_REJECTED',
        title: 'Leave Request Rejected',
        message: 'Your leave request has been rejected. Please check comments.',
        link: '/employee/leave-requests',
        isRead: false,
      },
    ],
  })

  // =====================
  // 17. AUDIT LOGS (for testing audit trail)
  // =====================
  console.log('📜 Creating sample audit logs...')

  await prisma.auditLog.createMany({
    skipDuplicates: true,
    data: [
      {
        userId: admin1.id,
        action: 'CREATE',
        entity: 'User',
        entityType: 'User',
        entityId: emp1.id,
        details: { message: 'User created via seed script' },
        createdAt: daysAgo(100),
      },
      {
        userId: emp1.id,
        action: 'CREATE',
        entity: 'LeaveRequest',
        entityType: 'LeaveRequest',
        entityId: approvedRequest.id,
        details: { message: 'Leave request submitted' },
        createdAt: daysAgo(36),
      },
      {
        userId: engManager1.id,
        action: 'APPROVE',
        entity: 'LeaveRequest',
        entityType: 'LeaveRequest',
        entityId: approvedRequest.id,
        details: { message: 'Leave request approved by manager' },
        createdAt: daysAgo(35),
      },
    ],
  })

  // =====================
  // SUMMARY
  // =====================
  console.log('\n✅ Seed completed successfully!')
  console.log('\n📊 Summary:')
  console.log(`   - Departments: ${departments.length}`)
  console.log(`   - Positions: ${positions.length}`)
  console.log(`   - Leave Types: ${leaveTypes.length}`)
  console.log(`   - Users created: ${allActiveUsers.length + 1} (including 1 inactive)`)
  console.log(`   - Executives: 3 (CEO, CTO, CFO)`)
  console.log(`   - Admins: 2`)
  console.log(`   - HR Staff: 3`)
  console.log(`   - Department Directors: 3`)
  console.log(`   - Managers: 4`)
  console.log(`   - Employees: 11+ (including part-time and intern)`)
  console.log(`   - Leave Requests: 8 (various states)`)
  console.log(`   - Romanian Holidays: ${holidays.length}`)
  console.log(`   - Company Settings: ${companySettings.length}`)
  console.log(`   - Workflow Rules: ${workflowRules.length}`)
  console.log('\n🔑 All users have password: password123')
  console.log('📧 Login emails: [role]@staging.local (e.g., admin@staging.local)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
