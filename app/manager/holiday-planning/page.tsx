"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Eye, Check, X, MessageCircle, ArrowLeft } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface HolidayPlan {
  id: string
  year: number
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'FINALIZED'
  submittedAt?: string
  notes?: string
  dates: Array<{
    id: string
    date: string
    priority: 'ESSENTIAL' | 'PREFERRED' | 'NICE_TO_HAVE'
    reason?: string
  }>
  user: {
    firstName: string
    lastName: string
    email: string
    employeeId: string
    department: string
    position: string
  }
}

const PRIORITY_OPTIONS = [
  { value: 'ESSENTIAL', label: 'Essential', color: 'bg-red-500' },
  { value: 'PREFERRED', label: 'Preferred', color: 'bg-blue-500' },
  { value: 'NICE_TO_HAVE', label: 'Nice to Have', color: 'bg-green-500' }
]

const STATUS_COLORS = {
  'DRAFT': 'bg-gray-500',
  'SUBMITTED': 'bg-yellow-500',
  'REVIEWED': 'bg-green-500',
  'FINALIZED': 'bg-blue-500'
}

export default function ManagerHolidayPlanningPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [holidayPlans, setHolidayPlans] = useState<HolidayPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<HolidayPlan | null>(null)
  const [comments, setComments] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const currentYear = new Date().getFullYear()
  const planningYear = currentYear + 1

  useEffect(() => {
    if (session) {
      loadTeamHolidayPlans()
    }
  }, [session])

  const loadTeamHolidayPlans = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/holiday-planning/team-plans?year=${planningYear}`)
      
      if (response.ok) {
        const data = await response.json()
        setHolidayPlans(data.holidayPlans || [])
      } else {
        toast.error('Failed to load team holiday plans')
      }
    } catch (error) {
      console.error('Error loading team holiday plans:', error)
      toast.error('Failed to load team holiday plans')
    } finally {
      setLoading(false)
    }
  }

  const handlePlanAction = async (planId: string, action: 'approve' | 'reject' | 'request_revision') => {
    try {
      setActionLoading(true)
      
      const response = await fetch(`/api/holiday-planning/approve/${planId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          comments: comments || undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        
        // Refresh the plans list
        await loadTeamHolidayPlans()
        
        // Reset form
        setSelectedPlan(null)
        setComments('')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update holiday plan')
      }
    } catch (error) {
      console.error('Error updating holiday plan:', error)
      toast.error('Failed to update holiday plan')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-500'
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'Pending Review'
      case 'REVIEWED': return 'Approved'
      case 'FINALIZED': return 'Finalized'
      default: return status
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please log in to access holiday planning management</p>
          <Button onClick={() => router.push('/login')}>Go to Login</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading team holiday plans...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Team Holiday Plans {planningYear}</h1>
              <p className="text-gray-600">Review and approve your team's holiday planning requests</p>
            </div>
            <Button variant="outline" onClick={() => router.push('/manager')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {holidayPlans.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Holiday Plans Yet</h3>
            <p className="text-gray-600">Your team members haven't submitted any holiday plans for {planningYear}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {holidayPlans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {plan.user.firstName} {plan.user.lastName}
                      </CardTitle>
                      <CardDescription>
                        {plan.user.position} • {plan.user.department} • {plan.user.employeeId}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <Badge className={`${getStatusBadgeColor(plan.status)} text-white`}>
                        {formatStatus(plan.status)}
                      </Badge>
                      {plan.submittedAt && (
                        <p className="text-sm text-gray-600 mt-1">
                          Submitted {format(parseISO(plan.submittedAt), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Days</p>
                      <p className="text-lg font-semibold">{plan.dates.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Essential Days</p>
                      <p className="text-lg font-semibold">
                        {plan.dates.filter(d => d.priority === 'ESSENTIAL').length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">First Holiday</p>
                      <p className="text-lg font-semibold">
                        {plan.dates.length > 0 
                          ? format(parseISO(plan.dates[0].date), 'MMM d')
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>

                  {plan.notes && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        <strong>Manager Notes:</strong> {plan.notes}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            Holiday Plan - {plan.user.firstName} {plan.user.lastName}
                          </DialogTitle>
                          <DialogDescription>
                            Detailed view of holiday planning request for {planningYear}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          {plan.dates.length === 0 ? (
                            <p className="text-gray-600">No dates selected</p>
                          ) : (
                            <div className="space-y-3">
                              {plan.dates
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                .map((date, index) => {
                                  const priority = PRIORITY_OPTIONS.find(p => p.value === date.priority)
                                  return (
                                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${priority?.color}`}></div>
                                        <div>
                                          <p className="font-medium">
                                            {format(parseISO(date.date), 'EEEE, MMMM d, yyyy')}
                                          </p>
                                          {date.reason && (
                                            <p className="text-sm text-gray-600">{date.reason}</p>
                                          )}
                                        </div>
                                      </div>
                                      <Badge variant="secondary">{priority?.label}</Badge>
                                    </div>
                                  )
                                })}
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    {plan.status === 'SUBMITTED' && (
                      <>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => setSelectedPlan(plan)}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Approve Holiday Plan</DialogTitle>
                              <DialogDescription>
                                Approve {plan.user.firstName} {plan.user.lastName}'s holiday plan for {planningYear}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4">
                              <Textarea
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                placeholder="Optional comments for the employee..."
                                rows={3}
                              />
                            </div>
                            
                            <DialogFooter>
                              <Button
                                onClick={() => handlePlanAction(plan.id, 'approve')}
                                disabled={actionLoading}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {actionLoading ? 'Approving...' : 'Approve Plan'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-red-300 text-red-700 hover:bg-red-50"
                              onClick={() => setSelectedPlan(plan)}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reject Holiday Plan</DialogTitle>
                              <DialogDescription>
                                Reject {plan.user.firstName} {plan.user.lastName}'s holiday plan for {planningYear}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4">
                              <Textarea
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                placeholder="Please provide a reason for rejection..."
                                rows={3}
                                required
                              />
                            </div>
                            
                            <DialogFooter>
                              <Button
                                onClick={() => handlePlanAction(plan.id, 'reject')}
                                disabled={actionLoading || !comments.trim()}
                                variant="destructive"
                              >
                                {actionLoading ? 'Rejecting...' : 'Reject Plan'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                              onClick={() => setSelectedPlan(plan)}
                            >
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Request Changes
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Request Plan Revision</DialogTitle>
                              <DialogDescription>
                                Request {plan.user.firstName} {plan.user.lastName} to revise their holiday plan
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4">
                              <Textarea
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                placeholder="Please specify what changes are needed..."
                                rows={3}
                                required
                              />
                            </div>
                            
                            <DialogFooter>
                              <Button
                                onClick={() => handlePlanAction(plan.id, 'request_revision')}
                                disabled={actionLoading || !comments.trim()}
                                className="bg-yellow-600 hover:bg-yellow-700"
                              >
                                {actionLoading ? 'Sending...' : 'Request Changes'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}