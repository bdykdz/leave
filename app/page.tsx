import { redirect } from 'next/navigation'
import { getCurrentUser, getEffectiveRole } from '@/lib/auth'

export default async function HomePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Redirect based on effective role (considering HR department and direct reports)
  const effectiveRole = await getEffectiveRole(user)
  
  switch (effectiveRole) {
    case 'EXECUTIVE':
      redirect('/executive')
    case 'DEPARTMENT_DIRECTOR':
      // Department directors should go to manager dashboard
      redirect('/manager')
    case 'MANAGER':
      redirect('/manager')
    case 'HR_MANAGER':
      // HR managers should go to HR dashboard
      redirect('/hr')
    case 'ADMIN':
      redirect('/admin')
    case 'HR':
      redirect('/hr')
    case 'HR_EMPLOYEE':
      // HR employees should go to HR dashboard
      redirect('/hr')
    case 'EMPLOYEE':
    default:
      // Regular employees see employee dashboard
      redirect('/employee')
  }
}