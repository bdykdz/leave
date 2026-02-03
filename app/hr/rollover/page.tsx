"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ArrowLeft, Calendar, TrendingUp, Users, AlertTriangle, CheckCircle } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface RolloverSummary {
  totalUsers: number
  totalDaysCarriedForward: number
  totalDaysLost: number
  avgCarryForward: number
}

interface RolloverResult {
  userId: string
  leaveTypeId: string
  year: number
  entitled: number
  used: number
  unused: number
  carriedForward: number
  lost: number
  reason: string
}

interface RolloverData {
  summary: RolloverSummary
  details: RolloverResult[]
  isExecuted: boolean
  fromYear: number
  toYear: number
}

export default function RolloverManagementPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [rolloverData, setRolloverData] = useState<RolloverData | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    if (session) {
      loadRolloverData()
    }
  }, [session, selectedYear])

  const loadRolloverData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/rollover?year=${selectedYear}`)
      
      if (response.ok) {
        const data = await response.json()
        setRolloverData(data)
      } else {
        toast.error('Failed to load rollover data')
      }
    } catch (error) {
      console.error('Error loading rollover data:', error)
      toast.error('Error loading rollover data')
    } finally {
      setLoading(false)
    }
  }

  const executeRollover = async () => {
    if (!rolloverData) return
    
    const confirmed = window.confirm(
      `Are you sure you want to execute rollover from ${rolloverData.fromYear} to ${rolloverData.toYear}? This action cannot be undone.`
    )
    
    if (!confirmed) return

    try {
      setExecuting(true)
      const response = await fetch('/api/admin/rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromYear: selectedYear,
          execute: true
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`Rollover executed successfully! ${result.successful} users processed.`)
        loadRolloverData() // Refresh data
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to execute rollover')
      }
    } catch (error) {
      console.error('Error executing rollover:', error)
      toast.error('Error executing rollover')
    } finally {
      setExecuting(false)
    }
  }

  const getStatusColor = (lost: number) => {
    if (lost === 0) return 'bg-green-500'
    if (lost <= 2) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please log in to access rollover management</p>
          <Button onClick={() => router.push('/login')}>Go to Login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leave Rollover Management</h1>
              <p className="text-gray-600">Manage year-end leave rollover for all employees</p>
            </div>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Year Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Rollover Year</CardTitle>
            <CardDescription>
              Choose the year you want to roll over leave balances from
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {[2024, 2025, 2026].map(year => (
                <Button
                  key={year}
                  variant={selectedYear === year ? "default" : "outline"}
                  onClick={() => setSelectedYear(year)}
                  disabled={loading}
                >
                  {year}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading rollover data...</p>
            </div>
          </div>
        ) : rolloverData ? (
          <>
            {/* Status Alert */}
            {rolloverData.isExecuted ? (
              <Alert className="mb-6 border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Rollover Completed</AlertTitle>
                <AlertDescription className="text-green-700">
                  The rollover from {rolloverData.fromYear} to {rolloverData.toYear} has already been executed.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="mb-6 border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800">Rollover Pending</AlertTitle>
                <AlertDescription className="text-yellow-700">
                  Rollover from {rolloverData.fromYear} to {rolloverData.toYear} has not been executed yet. Review the data below and execute when ready.
                </AlertDescription>
              </Alert>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                  </div>
                  <p className="text-2xl font-bold">{rolloverData.summary.totalUsers}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <p className="text-sm font-medium text-gray-600">Days Carried Forward</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{rolloverData.summary.totalDaysCarriedForward}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <p className="text-sm font-medium text-gray-600">Days Lost</p>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{rolloverData.summary.totalDaysLost}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-purple-500" />
                    <p className="text-sm font-medium text-gray-600">Avg Carry Forward</p>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{rolloverData.summary.avgCarryForward}</p>
                </CardContent>
              </Card>
            </div>

            {/* Execute Rollover */}
            {!rolloverData.isExecuted && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Execute Rollover</CardTitle>
                  <CardDescription>
                    Execute the year-end rollover process. This will create new leave balances for {rolloverData.toYear} with carried forward amounts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={executeRollover}
                    disabled={executing}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {executing ? 'Executing...' : `Execute Rollover ${rolloverData.fromYear} → ${rolloverData.toYear}`}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Detailed Results */}
            <Card>
              <CardHeader>
                <CardTitle>Rollover Details</CardTitle>
                <CardDescription>
                  Detailed breakdown of rollover calculations for each user
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rolloverData.details.length === 0 ? (
                    <p className="text-gray-500 text-center py-6">No leave balances found for rollover</p>
                  ) : (
                    rolloverData.details.map((detail, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(detail.lost)}`}></div>
                            <div>
                              <p className="font-medium">User ID: {detail.userId}</p>
                              <p className="text-sm text-gray-600">Leave Type: {detail.leaveTypeId}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={detail.lost > 0 ? "destructive" : "default"}>
                              {detail.lost > 0 ? `${detail.lost} days lost` : 'No loss'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Entitled:</span>
                            <span className="font-medium ml-1">{detail.entitled}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Used:</span>
                            <span className="font-medium ml-1">{detail.used}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Unused:</span>
                            <span className="font-medium ml-1">{detail.unused}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Carried Forward:</span>
                            <span className="font-medium ml-1 text-green-600">{detail.carriedForward}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Lost:</span>
                            <span className="font-medium ml-1 text-red-600">{detail.lost}</span>
                          </div>
                        </div>
                        
                        {detail.reason && (
                          <p className="text-sm text-gray-600 mt-2 italic">{detail.reason}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  )
}