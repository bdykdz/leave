import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-config"
import { prisma } from "@/lib/prisma"

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      department: true,
      position: true,
      profileImage: true,
      managerId: true,
    }
  })

  return user
}

// Helper function to check if user is in HR department
export function isHRDepartment(user: { department: string | null } | null): boolean {
  if (!user?.department) return false
  return user.department.includes('HR') || user.department.includes('hr') || user.department.includes('Hr')
}

// Helper function to determine effective role for HR users
export async function getEffectiveRole(user: { id: string; role: string; department: string | null } | null): Promise<string> {
  if (!user) return 'EMPLOYEE'
  
  // For HR role users, check if they have direct reports to determine dashboard
  if (user.role === 'HR') {
    const directReports = await prisma.user.count({
      where: { managerId: user.id }
    })
    return directReports > 0 ? 'HR_MANAGER' : 'HR_EMPLOYEE'
  }
  
  // HR users with EMPLOYEE role act as employees but can access HR dashboard
  if (user.role === 'EMPLOYEE' && isHRDepartment(user)) {
    return 'HR_EMPLOYEE'
  }
  
  // HR users with MANAGER role act as managers but can access HR dashboard  
  if (user.role === 'MANAGER' && isHRDepartment(user)) {
    return 'HR_MANAGER'
  }
  
  return user.role
}