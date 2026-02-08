import { redirect } from 'next/navigation'
import { getCurrentUser, getEffectiveRole } from '@/lib/auth'

interface PageProps {
  params: {
    id: string
  }
}

export default async function LeaveRequestRedirect({ params }: PageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Get the user's effective role
  const effectiveRole = await getEffectiveRole(user)
  const requestId = params.id

  // Redirect to the appropriate dashboard with the request ID in query params
  // Each dashboard can then highlight or show the specific request
  switch (effectiveRole) {
    case 'EXECUTIVE':
      redirect(`/executive?requestId=${requestId}`)
    case 'MANAGER':
      redirect(`/manager?requestId=${requestId}`)
    case 'HR_MANAGER':
    case 'HR':
    case 'HR_EMPLOYEE':
      // HR users go to HR dashboard
      redirect(`/hr?requestId=${requestId}&tab=verification`)
    case 'ADMIN':
      redirect(`/admin?requestId=${requestId}`)
    case 'EMPLOYEE':
    default:
      // Regular employees see their own dashboard
      redirect(`/employee?requestId=${requestId}`)
  }
}