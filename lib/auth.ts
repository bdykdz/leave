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
export function getEffectiveRole(user: { role: string; department: string | null } | null): string {
  if (!user) return 'EMPLOYEE'
  
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