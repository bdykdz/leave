'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Building2, Code2, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  department: string
}

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [devEmail, setDevEmail] = useState('dev@company.com')
  const [devRole, setDevRole] = useState('EMPLOYEE')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.APP_ENV === 'uat'

  useEffect(() => {
    if (isDevelopment) {
      fetchUsers()
    }
  }, [isDevelopment])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dev/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
        if (data.length > 0) {
          setSelectedUserId(data[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMicrosoftLogin = () => {
    signIn('azure-ad', { callbackUrl: '/' })
  }

  const handleDevLogin = () => {
    signIn('credentials', {
      email: devEmail,
      role: devRole,
      callbackUrl: '/'
    })
  }

  const handleUserLogin = () => {
    const user = users.find(u => u.id === selectedUserId)
    if (user) {
      signIn('credentials', {
        email: user.email,
        role: user.role,
        userId: user.id,
        callbackUrl: '/'
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Leave Management System</CardTitle>
          <CardDescription>
            Sign in with your company Microsoft account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error === 'AccessDenied' 
                  ? 'Your email is not registered in the system. Please contact HR.'
                  : 'An error occurred during sign in. Please try again.'
                }
              </AlertDescription>
            </Alert>
          )}
          
          <Button 
            onClick={handleMicrosoftLogin}
            className="w-full"
            size="lg"
          >
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 21 21"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Sign in with Microsoft
          </Button>

          {isDevelopment && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Development Mode
                  </span>
                </div>
              </div>

              <div className="space-y-4 border rounded-lg p-4 border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
                <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                  <Code2 className="h-4 w-4" />
                  <span className="font-medium">Development Login</span>
                </div>
                
                <Tabs defaultValue="user" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="user">Existing User</TabsTrigger>
                    <TabsTrigger value="custom">Custom Role</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="user" className="space-y-4">
                    <Select 
                      value={selectedUserId} 
                      onValueChange={setSelectedUserId}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loading ? "Loading users..." : "Select a user"} />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{user.firstName} {user.lastName}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {user.role.replace('_', ' ')}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedUserId && (
                      <div className="text-xs text-muted-foreground">
                        {(() => {
                          const user = users.find(u => u.id === selectedUserId)
                          return user ? (
                            <div className="space-y-1">
                              <p>Email: {user.email}</p>
                              <p>Department: {user.department}</p>
                            </div>
                          ) : null
                        })()}
                      </div>
                    )}
                    
                    <Button 
                      onClick={handleUserLogin}
                      className="w-full"
                      variant="outline"
                      disabled={!selectedUserId || loading}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Sign in as Selected User
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="custom" className="space-y-4">
                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="Email"
                        value={devEmail}
                        onChange={(e) => setDevEmail(e.target.value)}
                      />
                      
                      <Select value={devRole} onValueChange={setDevRole}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMPLOYEE">Employee</SelectItem>
                          <SelectItem value="MANAGER">Manager</SelectItem>
                          <SelectItem value="DEPARTMENT_DIRECTOR">Department Director</SelectItem>
                          <SelectItem value="HR">HR</SelectItem>
                          <SelectItem value="EXECUTIVE">Executive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      onClick={handleDevLogin}
                      className="w-full"
                      variant="outline"
                    >
                      Sign in as {devRole}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <div className="text-sm text-center text-muted-foreground w-full">
            <p className="mb-2">Only authorized company accounts can access this system.</p>
            <p className="text-xs">Contact your HR department if you need access.</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  )
}