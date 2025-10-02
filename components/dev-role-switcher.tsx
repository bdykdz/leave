'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Code2, RefreshCw, User, ChevronDown, ChevronUp, Move } from 'lucide-react'

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
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [position, setPosition] = useState({ x: 16, y: 16 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const dragRef = useRef<HTMLDivElement>(null)
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - (dragRef.current?.offsetWidth || 280)
    const maxY = window.innerHeight - (dragRef.current?.offsetHeight || 100)
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragStart])
  
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
    <div 
      ref={dragRef}
      className="fixed z-50 bg-orange-100 dark:bg-orange-900 rounded-lg shadow-lg border border-orange-200 dark:border-orange-800 min-w-[280px] select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Header - Always Visible */}
      <div className="flex items-center justify-between p-3 rounded-t-lg">
        <div 
          className="flex items-center gap-2 cursor-grab active:cursor-grabbing flex-1"
          onMouseDown={handleMouseDown}
        >
          <Move className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <Code2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <span className="text-sm font-medium text-orange-600 dark:text-orange-400">Dev Mode</span>
        </div>
        <button
          className="p-1 hover:bg-orange-200 dark:hover:bg-orange-800 rounded"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? 
            <ChevronDown className="h-4 w-4 text-orange-600 dark:text-orange-400" /> : 
            <ChevronUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          }
        </button>
      </div>
      
      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="p-3 pt-0 space-y-3 border-t border-orange-200 dark:border-orange-700">
          <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
            <User className="h-3 w-3" />
            <span className="truncate">{session.user.name || session.user.email}</span>
            <span className="text-orange-500">•</span>
            <span className="font-medium">{session.user.role?.replace('_', ' ')}</span>
          </div>
          
          <Select 
            value={session.user.id} 
            onValueChange={handleUserChange}
            disabled={isChanging}
          >
            <SelectTrigger className="w-full h-8">
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
      )}
    </div>
  )
}