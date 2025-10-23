/**
 * Helper function to determine the correct dashboard route based on user role and department
 */

export function getDashboardRoute(user: { role: string; department?: string | null }): string {
  // Check if EMPLOYEE is actually in HR department
  if (user.role === 'EMPLOYEE' && user.department?.toLowerCase().includes('hr')) {
    return '/hr'
  }
  
  switch (user.role) {
    case 'EXECUTIVE':
      return '/executive'
    case 'MANAGER':
      return '/manager'
    case 'HR':
      return '/hr'
    case 'ADMIN':
      return '/hr' // Admin users typically use HR dashboard
    case 'EMPLOYEE':
    default:
      return '/employee'
  }
}

/**
 * Helper function to generate notification link based on user role and request type
 */
export function getNotificationLink(
  user: { role: string; department?: string | null }, 
  requestId: string, 
  requestType: 'leave' | 'wfh' = 'leave'
): string {
  const dashboard = getDashboardRoute(user)
  
  if (dashboard === '/hr') {
    return requestType === 'wfh' ? `/hr?wfh=${requestId}` : `/hr?request=${requestId}`
  } else if (dashboard === '/executive') {
    return requestType === 'wfh' ? `/executive?wfh=${requestId}` : `/executive?request=${requestId}`
  } else if (dashboard === '/manager') {
    return requestType === 'wfh' ? `/manager/wfh-approvals/${requestId}` : `/manager/approvals/${requestId}`
  } else {
    return requestType === 'wfh' ? `/employee?wfh=${requestId}` : `/employee?request=${requestId}`
  }
}