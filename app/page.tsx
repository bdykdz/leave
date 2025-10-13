import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default async function HomePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Redirect based on user role
  switch (user.role) {
    case 'EXECUTIVE':
      redirect('/executive')
    case 'MANAGER':
      // Managers should see their manager dashboard first (pending approvals, team overview)
      redirect('/manager')
    case 'ADMIN':
      redirect('/admin')
    case 'HR':
      redirect('/hr')
    case 'EMPLOYEE':
    default:
      redirect('/employee')
  }
}