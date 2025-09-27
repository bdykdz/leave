import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default async function HomePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Redirect based on user role
  switch (user.role) {
    case 'EMPLOYEE':
    case 'ADMIN': // ADMIN users see employee dashboard with extra button
    case 'EXECUTIVE': // EXECUTIVES also see employee dashboard first
    case 'HR': // HR also sees employee dashboard first
      redirect('/employee')
    case 'MANAGER':
      redirect('/manager')
    default:
      redirect('/employee')
  }
}