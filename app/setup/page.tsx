'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, Lock, AlertCircle, CheckCircle, Users, Settings, Database, Key, Shield } from 'lucide-react'
import { toast } from 'sonner'

export default function SetupPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)
  
  // Admin auth state
  const [adminPassword, setAdminPassword] = useState('')
  
  // Azure AD config state
  const [azureConfig, setAzureConfig] = useState({
    clientId: '',
    clientSecret: '',
    tenantId: ''
  })
  
  // Import users state
  const [importedUsers, setImportedUsers] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  
  // Admin selection state
  const [selectedAdminId, setSelectedAdminId] = useState<string>('')
  const [savingAdmin, setSavingAdmin] = useState(false)
  
  // Leave settings state
  const [leaveSettings, setLeaveSettings] = useState({
    normalLeaveDays: 21,
    sickLeaveDays: 0, // 0 means unlimited
    specialLeaveDays: 0 // 0 means unlimited
  })

  useEffect(() => {
    checkSetupStatus()
  }, [])

  const fetchExistingUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/setup/check-users')
      if (res.ok) {
        const data = await res.json()
        setImportedUsers(data.users || [])
        console.log(`Loaded ${data.count} existing users from database`)
        if (data.count > 0) {
          toast.success(`Loaded ${data.count} existing users`)
        }
      } else {
        const errorData = await res.json()
        console.error('Failed to fetch users:', errorData)
        toast.error(`Failed to load users: ${errorData.details || errorData.error}`)
      }
    } catch (error) {
      console.error('Failed to fetch existing users:', error)
      toast.error('Failed to load existing users')
    } finally {
      setLoadingUsers(false)
    }
  }

  const checkSetupStatus = async () => {
    try {
      const res = await fetch('/api/setup/status')
      const data = await res.json()
      setSetupComplete(data.isComplete)
      if (data.azureConfigured) {
        setAzureConfig({
          clientId: data.clientId || '',
          clientSecret: '********', // Don't show actual secret
          tenantId: data.tenantId || ''
        })
      }
    } catch (error) {
      console.error('Failed to check setup status')
    }
  }

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const res = await fetch('/api/setup/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      })
      
      if (res.ok) {
        setIsAuthenticated(true)
        toast.success('Authentication successful')
        // Immediately load existing users
        setTimeout(() => {
          fetchExistingUsers()
        }, 100)
      } else {
        toast.error('Invalid admin password')
      }
    } catch (error) {
      toast.error('Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAzureConfig = async () => {
    setLoading(true)
    
    try {
      const res = await fetch('/api/setup/azure-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(azureConfig)
      })
      
      if (res.ok) {
        toast.success('Azure AD configuration saved')
        checkSetupStatus()
      } else {
        toast.error('Failed to save configuration')
      }
    } catch (error) {
      toast.error('Error saving configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleImportUsers = async () => {
    setImporting(true)
    
    try {
      // First, ensure leave types exist
      const initRes = await fetch('/api/setup/init-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!initRes.ok) {
        toast.error('Failed to initialize leave types')
        return
      }

      // Then import users
      const res = await fetch('/api/setup/import-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (res.ok) {
        const data = await res.json()
        console.log('Import response:', data)
        
        // Use the users from the response directly
        if (data.users && data.users.length > 0) {
          setImportedUsers(data.users)
          toast.success(`Imported ${data.count} users from Microsoft 365`)
        } else {
          // If no users in response, fetch from database
          await fetchExistingUsers()
        }
      } else {
        const error = await res.json()
        console.error('Import API error:', res.status, error)
        
        // Show detailed error for permissions issue
        if (error.instructions) {
          toast.error(
            <div className="space-y-2">
              <p className="font-semibold">{error.message}</p>
              <ul className="text-xs list-disc list-inside">
                {error.instructions.map((instruction: string, i: number) => (
                  <li key={i}>{instruction}</li>
                ))}
              </ul>
            </div>,
            { duration: 10000 } // Show for 10 seconds
          )
        } else {
          toast.error(error.message || 'Failed to import users')
        }
      }
    } catch (error) {
      toast.error('Error importing users')
    } finally {
      setImporting(false)
    }
  }

  const handleSaveAdmin = async () => {
    setSavingAdmin(true)
    
    try {
      const res = await fetch('/api/setup/set-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedAdminId })
      })
      
      if (res.ok) {
        toast.success('Administrator role assigned successfully!')
        // Update the local user data to reflect the new role
        setImportedUsers(users => 
          users.map(user => 
            user.id === selectedAdminId 
              ? { ...user, role: 'ADMIN' } 
              : user
          )
        )
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to set administrator')
      }
    } catch (error) {
      console.error('Error setting admin:', error)
      toast.error('Failed to set administrator')
    } finally {
      setSavingAdmin(false)
    }
  }

  const handleCompleteSetup = async () => {
    setLoading(true)
    
    try {
      const res = await fetch('/api/setup/complete', {
        method: 'POST'
      })
      
      if (res.ok) {
        toast.success('Setup completed! Redirecting to login...')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        toast.error('Failed to complete setup')
      }
    } catch (error) {
      toast.error('Error completing setup')
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Lock className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">System Setup</CardTitle>
            <CardDescription>
              Enter admin password to access setup
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAdminAuth}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Admin Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter setup password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the setup password to access system configuration
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Access Setup'
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Leave Management System Setup</h1>
            <p className="text-muted-foreground">Configure Azure AD and import users from Microsoft 365</p>
          </div>

          {setupComplete && (
            <Alert className="mb-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Setup is complete! The system is ready to use.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="users">
                <Users className="mr-2 h-4 w-4" />
                Import Users
              </TabsTrigger>
              <TabsTrigger value="admin">
                <Shield className="mr-2 h-4 w-4" />
                Select Admin
              </TabsTrigger>
              <TabsTrigger value="leave-settings">
                <Settings className="mr-2 h-4 w-4" />
                Leave Settings
              </TabsTrigger>
              <TabsTrigger value="database">
                <Database className="mr-2 h-4 w-4" />
                Database
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>Import Users from Microsoft 365</CardTitle>
                  <CardDescription>
                    Import all users from your Microsoft 365 organization. This will create user accounts in the database.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {importedUsers.length > 0 && (
                    <Alert>
                      <Users className="h-4 w-4" />
                      <AlertDescription>
                        {importedUsers.length} users already exist in the database. 
                        Importing again will add any new users from Microsoft 365.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Button 
                    onClick={handleImportUsers}
                    disabled={importing}
                    className="w-full"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing Users...
                      </>
                    ) : (
                      <>
                        <Users className="mr-2 h-4 w-4" />
                        Import Users from Microsoft 365
                      </>
                    )}
                  </Button>

                  {importedUsers.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Imported Users ({importedUsers.length})</h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={fetchExistingUsers}
                              disabled={importing || loadingUsers}
                            >
                              <Loader2 className={`h-4 w-4 mr-1 ${loadingUsers ? 'animate-spin' : ''}`} />
                              Refresh
                            </Button>
                          </div>
                          <div className="max-h-64 overflow-y-auto space-y-2">
                            {importedUsers.map((user) => (
                              <div key={user.id || user.email} className="flex items-center justify-between p-2 bg-secondary rounded-md">
                                <div>
                                  <p className="text-sm font-medium">{user.displayName}</p>
                                  <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                                <Badge variant="outline">{user.role}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="admin">
              <Card>
                <CardHeader>
                  <CardTitle>Select Administrator</CardTitle>
                  <CardDescription>
                    Choose the first administrator who will have full access to manage the system.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {importedUsers.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please import users first before selecting an administrator.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="admin-select">Select Administrator</Label>
                        <select
                          id="admin-select"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={selectedAdminId}
                          onChange={(e) => setSelectedAdminId(e.target.value)}
                        >
                          <option value="">-- Select a user --</option>
                          {importedUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.displayName} ({user.email}) - Current role: {user.role}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedAdminId && (
                        <div className="p-4 bg-secondary rounded-lg">
                          <p className="text-sm font-medium mb-2">Selected Administrator:</p>
                          {(() => {
                            const admin = importedUsers.find(u => u.id === selectedAdminId)
                            return admin ? (
                              <div>
                                <p className="font-medium">{admin.displayName}</p>
                                <p className="text-sm text-muted-foreground">{admin.email}</p>
                              </div>
                            ) : null
                          })()}
                        </div>
                      )}

                      <Button
                        onClick={handleSaveAdmin}
                        disabled={!selectedAdminId || savingAdmin}
                        className="w-full"
                      >
                        {savingAdmin ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving Administrator...
                          </>
                        ) : (
                          <>
                            <Shield className="mr-2 h-4 w-4" />
                            Save Administrator
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leave-settings">
              <Card>
                <CardHeader>
                  <CardTitle>Default Leave Settings</CardTitle>
                  <CardDescription>
                    Configure default leave days for all employees. These can be adjusted per employee later.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="normalLeave">Normal Leave (Vacation Days)</Label>
                      <Input
                        id="normalLeave"
                        type="number"
                        min="0"
                        max="365"
                        value={leaveSettings.normalLeaveDays}
                        onChange={(e) => setLeaveSettings({...leaveSettings, normalLeaveDays: parseInt(e.target.value) || 0})}
                      />
                      <p className="text-xs text-muted-foreground">
                        Default annual vacation days for new employees
                      </p>
                    </div>
                    
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>EU Compliance:</strong> Sick leave and special leave types are tracked but not limited. 
                        Only normal leave (vacation days) has a fixed balance.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="pt-4 border-t">
                      <Button 
                        onClick={async () => {
                          try {
                            setLoading(true)
                            const response = await fetch('/api/setup/leave-settings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(leaveSettings)
                            })
                            
                            if (response.ok) {
                              toast.success('Leave settings saved successfully')
                            } else {
                              toast.error('Failed to save leave settings')
                            }
                          } catch (error) {
                            toast.error('An error occurred')
                          } finally {
                            setLoading(false)
                          }
                        }}
                        disabled={loading}
                        className="w-full"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving Settings...
                          </>
                        ) : (
                          'Save Leave Settings'
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="database">
              <Card>
                <CardHeader>
                  <CardTitle>Database Configuration</CardTitle>
                  <CardDescription>
                    View database connection status and seed initial data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Database Connection</span>
                      <Badge variant="default">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Users</span>
                      <Badge variant="outline">{importedUsers.length || 0}</Badge>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <Button 
                      onClick={handleCompleteSetup}
                      disabled={loading || importedUsers.length === 0}
                      className="w-full"
                      variant="default"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Completing Setup...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Complete Setup
                        </>
                      )}
                    </Button>
                    {importedUsers.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Please import users first.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}