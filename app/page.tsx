import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default async function HomePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Redirect based on user role
  switch (user.role) {
    case 'MANAGER':
      // Managers should see their manager dashboard first (pending approvals, team overview)
      redirect('/manager')
    case 'EMPLOYEE':
    case 'ADMIN':
    case 'HR':
    case 'EXECUTIVE':
      // These roles start at personal dashboard
      redirect('/employee')
    default:
      redirect('/employee')
  }
}