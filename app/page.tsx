import { redirect } from 'next/navigation'
import { getCurrentUser, getEffectiveRole } from '@/lib/auth'

export default async function HomePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Redirect based on effective role (considering HR department)
  const effectiveRole = getEffectiveRole(user)
  
  switch (effectiveRole) {
    case 'EXECUTIVE':
      redirect('/executive')
    case 'MANAGER':
    case 'HR_MANAGER':
      // Managers and HR managers see their manager dashboard first
      redirect('/manager')
    case 'ADMIN':
      redirect('/admin')
    case 'HR':
      redirect('/hr')
    case 'EMPLOYEE':
    case 'HR_EMPLOYEE':
    default:
      // Employees and HR employees see employee dashboard first
      redirect('/employee')
  }
}