'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Code2, RefreshCw, User } from 'lucide-react'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  department: string
}

export function DevRoleSwitcher() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [isChanging, setIsChanging] = useState(false)
  const isDevelopment = process.env.NODE_ENV === 'development' || 
    (typeof window !== 'undefined' && /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname))
  
  useEffect(() => {
    if (isDevelopment) {
      fetchUsers()
    }
  }, [isDevelopment])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/dev/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }
  
  if (!isDevelopment || !session) return null
  
  const handleUserChange = async (userId: string) => {
    setIsChanging(true)
    const user = users.find(u => u.id === userId)
    if (user) {
      await signOut({ redirect: false })
      await signIn('credentials', {
        email: user.email,
        role: user.role,
        userId: user.id,
        redirect: true,
        callbackUrl: window.location.pathname
      })
    }
    setIsChanging(false)
  }

  const handleQuickRoleSwitch = async () => {
    setIsChanging(true)
    await signOut({ redirect: false })
    await signIn('credentials', {
      email: session.user.email,
      role: session.user.role,
      userId: session.user.id === 'dev-user' ? undefined : session.user.id,
      redirect: true,
      callbackUrl: '/'
    })
    setIsChanging(false)
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-orange-100 dark:bg-orange-900 p-3 rounded-lg shadow-lg border border-orange-200 dark:border-orange-800">
      <div className="flex items-center gap-2 mb-2">
        <Code2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <span className="text-sm font-medium text-orange-600 dark:text-orange-400">Dev Mode</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
          <User className="h-3 w-3" />
          <span>{session.user.name || session.user.email}</span>
          <span className="text-orange-500">•</span>
          <span>{session.user.role?.replace('_', ' ')}</span>
        </div>
        
        <Select 
          value={session.user.id} 
          onValueChange={handleUserChange}
          disabled={isChanging}
        >
          <SelectTrigger className="w-[220px] h-8">
            <SelectValue placeholder="Switch user..." />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                <div className="flex items-center justify-between w-full">
                  <span className="truncate">{user.firstName} {user.lastName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {user.role.replace('_', ' ')}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="ghost"
          className="w-full h-7 text-xs"
          onClick={handleQuickRoleSwitch}
          disabled={isChanging}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isChanging ? 'animate-spin' : ''}`} />
          Quick refresh
        </Button>
      </div>
    </div>
  )
}