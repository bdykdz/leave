"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Calendar as CalendarIcon, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Info,
  Lightbulb,
  RotateCcw,
  ArrowRight
} from 'lucide-react'
import { format, addDays, differenceInDays } from 'date-fns'
import type { ConflictResolution, ConflictInfo, DateSuggestion } from '@/lib/services/conflict-resolution-service'

interface ConflictResolutionWizardProps {
  isOpen: boolean
  onClose: () => void
  requestedDates: Date[]
  onDateSuggestionSelect: (dates: Date[]) => void
  managerId?: string
  requestId?: string
}

export function ConflictResolutionWizard({ 
  isOpen, 
  onClose, 
  requestedDates, 
  onDateSuggestionSelect,
  managerId,
  requestId
}: ConflictResolutionWizardProps) {
  const [loading, setLoading] = useState(false)
  const [resolution, setResolution] = useState<ConflictResolution | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<DateSuggestion | null>(null)

  useEffect(() => {
    if (isOpen && requestedDates.length > 0) {
      analyzeConflicts()
    }
  }, [isOpen, requestedDates])

  const analyzeConflicts = async () => {
    if (!managerId) return

    setLoading(true)
    try {
      const response = await fetch('/api/conflict-resolution/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId,
          requestedDates: requestedDates.map(d => d.toISOString()),
          excludeRequestId: requestId
        })
      })

      if (response.ok) {
        const data = await response.json()
        setResolution(data)
      } else {
        console.error('Failed to analyze conflicts')
      }
    } catch (error) {
      console.error('Error analyzing conflicts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionSelect = (suggestion: DateSuggestion) => {
    const duration = requestedDates.length
    const newDates: Date[] = []
    
    for (let i = 0; i < duration; i++) {
      newDates.push(addDays(new Date(suggestion.date), i))
    }
    
    setSelectedSuggestion(suggestion)
    onDateSuggestionSelect(newDates)
  }

  const getConflictIcon = (level: string) => {
    switch (level) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'medium':
        return <Clock className="h-4 w-4 text-orange-500" />
      case 'low':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  const getConflictBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <Badge variant="destructive" className="text-xs">High Risk</Badge>
      case 'medium':
        return <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">Medium Risk</Badge>
      case 'low':
        return <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">Low Risk</Badge>
      default:
        return <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">No Risk</Badge>
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (score >= 60) return <Clock className="h-4 w-4 text-yellow-600" />
    return <TrendingDown className="h-4 w-4 text-red-600" />
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Holiday Conflict Resolution Wizard
          </DialogTitle>
          <DialogDescription>
            Analyzing team availability and suggesting optimal alternative dates
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Analyzing conflicts...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Original Dates Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Requested Dates Analysis
                </CardTitle>
                <CardDescription>
                  Impact assessment for your selected dates: {format(requestedDates[0], 'MMM dd')} - {format(requestedDates[requestedDates.length - 1], 'MMM dd, yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resolution?.conflicts.length === 0 ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      ✅ Excellent choice! No significant team conflicts detected for your requested dates.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {resolution?.conflicts.map((conflict, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getConflictIcon(conflict.conflictLevel)}
                            <span className="font-medium">{format(conflict.date, 'EEEE, MMM dd, yyyy')}</span>
                          </div>
                          {getConflictBadge(conflict.conflictLevel)}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Team Impact</p>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">
                                {conflict.conflictingRequests.length} of {conflict.teamSize} team members unavailable
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className={`h-2 rounded-full ${
                                  conflict.conflictLevel === 'high' ? 'bg-red-500' :
                                  conflict.conflictLevel === 'medium' ? 'bg-orange-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${(conflict.conflictingRequests.length / conflict.teamSize) * 100}%` }}
                              />
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Conflicting Leave</p>
                            <div className="space-y-1">
                              {conflict.conflictingRequests.slice(0, 3).map((req, i) => (
                                <div key={i} className="text-xs text-gray-700 bg-white rounded px-2 py-1">
                                  {req.employeeName} - {req.leaveType}
                                </div>
                              ))}
                              {conflict.conflictingRequests.length > 3 && (
                                <div className="text-xs text-gray-500">
                                  +{conflict.conflictingRequests.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recommendations */}
            {resolution?.recommendations && resolution.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    Smart Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {resolution.recommendations.map((rec, index) => (
                      <Alert key={index} className="text-sm">
                        <Info className="h-4 w-4" />
                        <AlertDescription>{rec}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Alternative Date Suggestions */}
            {resolution?.suggestions && resolution.suggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-blue-500" />
                    Alternative Date Suggestions
                  </CardTitle>
                  <CardDescription>
                    Smart alternatives optimized for minimal team disruption
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {resolution.suggestions.map((suggestion, index) => (
                      <div 
                        key={index}
                        className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                          selectedSuggestion?.date === suggestion.date ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}
                        onClick={() => setSelectedSuggestion(suggestion)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">
                              {format(suggestion.date, 'MMM dd')} - {format(addDays(suggestion.date, requestedDates.length - 1), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getScoreIcon(suggestion.score)}
                            <span className={`font-bold ${getScoreColor(suggestion.score)}`}>
                              {suggestion.score}/100
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Users className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium">Team Availability</span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {suggestion.availableTeamMembers} of {suggestion.totalTeamMembers} available
                            </p>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className="h-2 rounded-full bg-green-500"
                                style={{ width: `${(suggestion.availableTeamMembers / suggestion.totalTeamMembers) * 100}%` }}
                              />
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {getConflictIcon(suggestion.conflictLevel)}
                              <span className="text-sm font-medium">Conflict Assessment</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">{suggestion.reason}</p>
                            {getConflictBadge(suggestion.conflictLevel)}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-end mt-3">
                          <Button
                            size="sm"
                            variant={selectedSuggestion?.date === suggestion.date ? "default" : "outline"}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSuggestionSelect(suggestion)
                            }}
                          >
                            {selectedSuggestion?.date === suggestion.date ? 'Selected' : 'Select These Dates'}
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <div className="flex gap-2">
                {selectedSuggestion && (
                  <Button onClick={() => onClose()}>
                    Use Selected Alternative
                  </Button>
                )}
                <Button variant="outline" onClick={analyzeConflicts}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Re-analyze
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}