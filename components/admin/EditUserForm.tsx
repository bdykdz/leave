"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Department {
  id: string
  name: string
  code: string
  isActive: boolean
}

interface Position {
  id: string
  name: string
  code: string
  isActive: boolean
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  department: string
  position: string
  isActive: boolean
}

interface EditUserFormProps {
  user: User
  onClose: () => void
}

export function EditUserForm({ user, onClose }: EditUserFormProps) {
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    department: user.department,
    position: user.position,
  })

  useEffect(() => {
    fetchDepartments()
    fetchPositions()
  }, [])

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/admin/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.filter((d: Department) => d.isActive))
      }
    } catch (error) {
      console.error('Failed to fetch departments')
    }
  }

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/admin/positions')
      if (response.ok) {
        const data = await response.json()
        setPositions(data.filter((p: Position) => p.isActive))
      }
    } catch (error) {
      console.error('Failed to fetch positions')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const result = await response.json()
        
        // Show success message with additional info for department directors
        if (formData.role === 'DEPARTMENT_DIRECTOR' && user.role !== 'DEPARTMENT_DIRECTOR') {
          toast.success(
            <div>
              <p className="font-semibold">User updated successfully!</p>
              <p className="text-sm mt-1">
                {formData.firstName} {formData.lastName} is now the Department Director for {formData.department}.
              </p>
            </div>,
            { duration: 5000 }
          )
        } else {
          toast.success('User updated successfully')
        }
        
        onClose()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update user')
      }
    } catch (error) {
      toast.error('An error occurred while updating user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value) => setFormData({ ...formData, role: value })}
        >
          <SelectTrigger id="role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EMPLOYEE">Employee</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="DEPARTMENT_DIRECTOR">Department Director</SelectItem>
            <SelectItem value="HR">HR</SelectItem>
            <SelectItem value="EXECUTIVE">Executive</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
          </SelectContent>
        </Select>
        {formData.role === 'DEPARTMENT_DIRECTOR' && user.role !== 'DEPARTMENT_DIRECTOR' && (
          <Alert className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Setting this user as Department Director will automatically make them the director for all employees in the <strong>{formData.department}</strong> department.
              {user.role === 'DEPARTMENT_DIRECTOR' && ' Any existing department director will be changed to Manager role.'}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">Department</Label>
        <Select
          value={formData.department}
          onValueChange={(value) => setFormData({ ...formData, department: value })}
        >
          <SelectTrigger id="department">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {departments.length === 0 ? (
              <SelectItem value="none" disabled>No departments configured</SelectItem>
            ) : (
              departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="position">Position</Label>
        <Select
          value={formData.position}
          onValueChange={(value) => setFormData({ ...formData, position: value })}
        >
          <SelectTrigger id="position">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {positions.length === 0 ? (
              <SelectItem value="none" disabled>No positions configured</SelectItem>
            ) : (
              positions.map((pos) => (
                <SelectItem key={pos.id} value={pos.name}>
                  {pos.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : (
            'Update User'
          )}
        </Button>
      </div>
    </form>
  )
}