"use client"

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const ALL_ROLES = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'DEPARTMENT_DIRECTOR', label: 'Department Director' },
  { value: 'HR', label: 'HR' },
  { value: 'EXECUTIVE', label: 'Executive' },
  { value: 'ADMIN', label: 'Admin' },
] as const

interface WikiVisibilitySelectorProps {
  value: string[]
  onChange: (roles: string[]) => void
}

export function WikiVisibilitySelector({ value, onChange }: WikiVisibilitySelectorProps) {
  const handleToggle = (role: string) => {
    if (value.includes(role)) {
      onChange(value.filter((r) => r !== role))
    } else {
      onChange([...value, role])
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">
        Leave empty for all roles, or select specific roles that can view this page.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ALL_ROLES.map((role) => (
          <div key={role.value} className="flex items-center space-x-2">
            <Checkbox
              id={`role-${role.value}`}
              checked={value.includes(role.value)}
              onCheckedChange={() => handleToggle(role.value)}
            />
            <Label htmlFor={`role-${role.value}`} className="text-sm">
              {role.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  )
}
