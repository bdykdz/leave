import { prisma } from '@/lib/prisma';

/**
 * Check if a user has admin privileges
 * ADMIN and EXECUTIVE always have admin access
 * HR users have admin access if they are managers (have direct reports)
 */
export async function hasAdminAccess(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      role: true,
      id: true 
    }
  });

  if (!user) return false;

  // ADMIN and EXECUTIVE always have admin access
  if (user.role === 'ADMIN' || user.role === 'EXECUTIVE') {
    return true;
  }

  // HR users have admin access if they manage people
  if (user.role === 'HR') {
    const directReports = await prisma.user.count({
      where: {
        managerId: userId,
        isActive: true
      }
    });
    return directReports > 0;
  }

  return false;
}

/**
 * Get list of roles that have admin access
 * Note: This is simplified and doesn't check HR manager status
 * Use hasAdminAccess() for accurate checking
 */
export const ADMIN_ROLES = ['ADMIN', 'EXECUTIVE', 'HR'];

/**
 * Check if user can manage other users
 */
export async function canManageUsers(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (!user) return false;

  // These roles can always manage users
  return ['ADMIN', 'EXECUTIVE', 'HR'].includes(user.role);
}

/**
 * Check if user can access financial/sensitive data
 */
export function canAccessFinancialData(role: string): boolean {
  return ['ADMIN', 'EXECUTIVE'].includes(role);
}

/**
 * Check if user can modify system settings
 */
export function canModifySystemSettings(role: string): boolean {
  return ['ADMIN', 'EXECUTIVE'].includes(role);
}